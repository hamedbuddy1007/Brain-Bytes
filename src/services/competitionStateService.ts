/**
 * Central State & Synchronization Service for Brain Bytes — Data Quiz
 * 
 * Provides:
 * 1. Persistent active participant session across browser reloads
 * 2. Cross-tab synchronized round states (Admin <-> Participants)
 * 3. Robust quiz answer auto-save & refresh restoration
 * 4. Deadline-enforced persistent timers (prevents timer resets on reload)
 * 5. Authoritative submission records with duplicate-submission protection
 * 6. Qualification & elimination workflow (R1 -> R2 -> R3 -> Final Winners)
 * 7. Live leaderboard aggregation with tie-breaking
 */

import type {
  Participant,
  AdminSettings,
  LeaderboardEntry,
  RoundStatus,
} from '../types/competition';
import { DEFAULT_ADMIN_SETTINGS, INITIAL_LEADERBOARD } from '../data/mockData';
import { ADMIN_REGISTRY_PARTICIPANTS, type RegistryParticipant } from '../data/adminMockData';
import { calculateRoundScore, compareRankings, compareRound3Rankings, type ScoreSummary } from './scoringService';

// Storage Keys
const KEY_ACTIVE_PARTICIPANT = 'bb_active_participant_session';
const KEY_ADMIN_SETTINGS = 'bb_admin_settings_state';
const KEY_SUBMISSIONS = 'bb_competition_submissions_v2';
const KEY_QUALIFICATIONS = 'bb_round_qualifications_v2';
const KEY_COMPETITION_STATE = 'bb_tournament_global_state';
const KEY_CLEARED_ROUNDS = 'bb_cleared_rounds_v2';
const KEY_REGISTRY_PARTICIPANTS = 'bb_registry_participants_v2';

export interface RoundProgress {
  roundId: number;
  rollNumber: string;
  answers: Record<number, number>;
  markedForReview: number[];
  visitedQuestions: number[];
  startTime: number;
  deadlineTime: number;
  durationSeconds: number;
  lastSavedAt: number;
}

export interface SubmissionRecord {
  id: string;
  roundId: 1 | 2 | 3;
  rollNumber: string;
  participantName: string;
  collegeName: string;
  ticketId: string;
  score: number;
  maxScore: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  timeTakenSeconds: number;
  submittedAt: number;
  submissionDateStr: string;
}

export interface QualificationMap {
  round2QualifiedRolls: string[]; // Qualified from Round 1
  round3QualifiedRolls: string[]; // Qualified from Round 2 (Top Finalists)
  eliminatedRolls: string[];
}

export type GlobalCompetitionState = 'NOT_STARTED' | 'LIVE' | 'PAUSED' | 'COMPLETED';

// Helper for safe localStorage access
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
    // Dispatch local event for same-window subscribers
    window.dispatchEvent(new Event('bb_storage_sync'));
  } catch (err) {
    console.error('LocalStorage write failed:', err);
  }
}

// ---------------------------------------------------------------------------
// 1. PARTICIPANT SESSION
// ---------------------------------------------------------------------------

export function getActiveParticipant(): Participant | null {
  try {
    const raw = sessionStorage.getItem(KEY_ACTIVE_PARTICIPANT);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setActiveParticipant(participant: Participant | null): void {
  try {
    if (participant) {
      sessionStorage.setItem(KEY_ACTIVE_PARTICIPANT, JSON.stringify(participant));
    } else {
      sessionStorage.removeItem(KEY_ACTIVE_PARTICIPANT);
    }
    window.dispatchEvent(new Event('bb_storage_sync'));
  } catch (err) {
    console.error('SessionStorage write failed:', err);
  }
}

// ---------------------------------------------------------------------------
// 2. ADMIN SETTINGS & TOURNAMENT STATE
// ---------------------------------------------------------------------------

export function getAdminSettings(): AdminSettings {
  try {
    const raw = safeGetItem(KEY_ADMIN_SETTINGS);
    if (!raw) return DEFAULT_ADMIN_SETTINGS;
    const parsed = JSON.parse(raw);
    const isLegacyDefault =
      parsed.roundStates &&
      parsed.roundStates[1] === 'active' &&
      parsed.roundStates[2] === 'locked' &&
      parsed.roundStates[3] === 'locked' &&
      !parsed.adminCustomized;

    const roundStates = isLegacyDefault
      ? { ...DEFAULT_ADMIN_SETTINGS.roundStates }
      : {
          ...DEFAULT_ADMIN_SETTINGS.roundStates,
          ...(parsed.roundStates || {}),
        };

    return {
      ...DEFAULT_ADMIN_SETTINGS,
      ...parsed,
      roundStates,
    };
  } catch {
    return DEFAULT_ADMIN_SETTINGS;
  }
}

export function saveAdminSettings(settings: AdminSettings): void {
  safeSetItem(KEY_ADMIN_SETTINGS, JSON.stringify(settings));
}

export function getGlobalCompetitionState(): GlobalCompetitionState {
  return (safeGetItem(KEY_COMPETITION_STATE) as GlobalCompetitionState) || 'LIVE';
}

export function setGlobalCompetitionState(state: GlobalCompetitionState): void {
  safeSetItem(KEY_COMPETITION_STATE, state);
}

// ---------------------------------------------------------------------------
// 3. QUIZ ANSWER AUTO-SAVE & RELOAD RECOVERY
// ---------------------------------------------------------------------------

function getProgressKey(roundId: number, rollNumber: string): string {
  return `bb_progress_r${roundId}_${rollNumber.trim().toUpperCase()}`;
}

export function saveQuizProgress(
  roundId: number,
  rollNumber: string,
  answers: Record<number, number>,
  markedForReview: number[],
  visitedQuestions: number[]
): void {
  if (!rollNumber) return;
  const key = getProgressKey(roundId, rollNumber);
  const existing = loadQuizProgress(roundId, rollNumber);

  const updated: RoundProgress = {
    roundId,
    rollNumber,
    answers,
    markedForReview,
    visitedQuestions,
    startTime: existing?.startTime || Date.now(),
    deadlineTime: existing?.deadlineTime || Date.now() + 600 * 1000,
    durationSeconds: existing?.durationSeconds || 600,
    lastSavedAt: Date.now(),
  };

  safeSetItem(key, JSON.stringify(updated));
}

export function loadQuizProgress(roundId: number, rollNumber: string): RoundProgress | null {
  if (!rollNumber) return null;
  const key = getProgressKey(roundId, rollNumber);
  const raw = safeGetItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 4. PERSISTENT DEADLINE TIMER
// ---------------------------------------------------------------------------

export interface TimerStatus {
  startTime: number;
  deadlineTime: number;
  remainingSeconds: number;
  isExpired: boolean;
}

export function getOrInitRoundTimer(
  roundId: number,
  rollNumber: string,
  durationSeconds: number
): TimerStatus {
  const existing = loadQuizProgress(roundId, rollNumber);
  const now = Date.now();

  if (existing && existing.deadlineTime) {
    const diffSeconds = Math.round((existing.deadlineTime - now) / 1000);
    const remainingSeconds = Math.max(0, diffSeconds);
    return {
      startTime: existing.startTime,
      deadlineTime: existing.deadlineTime,
      remainingSeconds,
      isExpired: remainingSeconds <= 0,
    };
  }

  // First time starting this round
  const startTime = now;
  const deadlineTime = now + durationSeconds * 1000;
  const key = getProgressKey(roundId, rollNumber);

  const initData: RoundProgress = {
    roundId,
    rollNumber,
    answers: {},
    markedForReview: [],
    visitedQuestions: [1],
    startTime,
    deadlineTime,
    durationSeconds,
    lastSavedAt: now,
  };

  safeSetItem(key, JSON.stringify(initData));

  return {
    startTime,
    deadlineTime,
    remainingSeconds: durationSeconds,
    isExpired: false,
  };
}

// ---------------------------------------------------------------------------
// 5. SUBMISSIONS & AUTHORITATIVE SCORING
// ---------------------------------------------------------------------------

export function getAllSubmissions(): SubmissionRecord[] {
  try {
    const raw = safeGetItem(KEY_SUBMISSIONS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getParticipantSubmission(
  roundId: 1 | 2 | 3,
  rollNumber: string
): SubmissionRecord | null {
  const submissions = getAllSubmissions();
  const normalizedRoll = rollNumber.trim().toUpperCase();
  return (
    submissions.find(
      (s) => s.roundId === roundId && s.rollNumber.trim().toUpperCase() === normalizedRoll
    ) || null
  );
}

export function recordSubmission(
  roundId: 1 | 2 | 3,
  participant: Participant,
  answers: Record<number, number>
): { submission: SubmissionRecord; isDuplicate: boolean } {
  const existing = getParticipantSubmission(roundId, participant.rollNumber);
  if (existing) {
    return { submission: existing, isDuplicate: true };
  }

  // Authoritatively compute score using official ScoringService
  const scoreSummary: ScoreSummary = calculateRoundScore(roundId, answers);

  // Calculate elapsed time from timer progress
  const progress = loadQuizProgress(roundId, participant.rollNumber);
  const now = Date.now();
  let timeTaken = 0;
  if (progress?.startTime) {
    timeTaken = Math.min(
      progress.durationSeconds,
      Math.max(1, Math.round((now - progress.startTime) / 1000))
    );
  }

  const newRecord: SubmissionRecord = {
    id: `sub-${roundId}-${participant.rollNumber}-${Date.now()}`,
    roundId,
    rollNumber: participant.rollNumber,
    participantName: participant.fullName,
    collegeName: participant.collegeName || 'Computing Department',
    ticketId: participant.ticketId || `BB-${participant.rollNumber}`,
    score: scoreSummary.score,
    maxScore: scoreSummary.maxPossibleScore,
    correctCount: scoreSummary.correctCount,
    incorrectCount: scoreSummary.incorrectCount,
    unansweredCount: scoreSummary.unansweredCount,
    timeTakenSeconds: timeTaken,
    submittedAt: now,
    submissionDateStr: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  const all = getAllSubmissions();
  all.push(newRecord);
  safeSetItem(KEY_SUBMISSIONS, JSON.stringify(all));

  // If this round was previously marked cleared, unmark it now
  const cleared = getClearedRounds();
  if (cleared.includes(roundId)) {
    safeSetItem(KEY_CLEARED_ROUNDS, JSON.stringify(cleared.filter((r) => r !== roundId)));
  }

  return { submission: newRecord, isDuplicate: false };
}

// ---------------------------------------------------------------------------
// 6. QUALIFICATION & ELIMINATION
// ---------------------------------------------------------------------------

export function getQualifications(): QualificationMap {
  try {
    const raw = safeGetItem(KEY_QUALIFICATIONS);
    if (!raw) {
      return {
        round2QualifiedRolls: [],
        round3QualifiedRolls: [],
        eliminatedRolls: [],
      };
    }
    return JSON.parse(raw);
  } catch {
    return {
      round2QualifiedRolls: [],
      round3QualifiedRolls: [],
      eliminatedRolls: [],
    };
  }
}

export function saveQualifications(qualifications: QualificationMap): void {
  safeSetItem(KEY_QUALIFICATIONS, JSON.stringify(qualifications));
}

/**
 * Checks eligibility of a participant for a target round.
 * Round 1: Any verified registered participant with join code.
 * Round 2: Must be qualified from Round 1 results (or admin waived).
 * Round 3: Must be qualified from Round 2 results (Top Finalists).
 */
export function checkRoundEligibility(
  roundId: number,
  rollNumber: string
): { isEligible: boolean; status: 'eligible' | 'pending_evaluation' | 'eliminated' | 'locked' } {
  const normRoll = rollNumber.trim().toUpperCase();
  const quals = getQualifications();
  const settings = getAdminSettings();

  const roundStatus: RoundStatus = settings.roundStates[roundId] || 'locked';

  if (roundId === 1) {
    if (roundStatus === 'locked') return { isEligible: false, status: 'locked' };
    return { isEligible: true, status: 'eligible' };
  }

  if (roundId === 2) {
    // Check if participant submitted Round 1
    const r1Sub = getParticipantSubmission(1, rollNumber);
    if (!r1Sub) {
      return { isEligible: false, status: 'locked' };
    }

    if (quals.eliminatedRolls.includes(normRoll)) {
      return { isEligible: false, status: 'eliminated' };
    }

    if (quals.round2QualifiedRolls.includes(normRoll)) {
      if (roundStatus === 'locked') {
        return { isEligible: true, status: 'locked' };
      }
      return { isEligible: true, status: 'eligible' };
    }

    return { isEligible: false, status: 'pending_evaluation' };
  }

  if (roundId === 3) {
    const r2Sub = getParticipantSubmission(2, rollNumber);
    if (!r2Sub) {
      return { isEligible: false, status: 'locked' };
    }

    if (quals.eliminatedRolls.includes(normRoll)) {
      return { isEligible: false, status: 'eliminated' };
    }

    if (quals.round3QualifiedRolls.includes(normRoll)) {
      if (roundStatus === 'locked') {
        return { isEligible: true, status: 'locked' };
      }
      return { isEligible: true, status: 'eligible' };
    }

    return { isEligible: false, status: 'pending_evaluation' };
  }

  return { isEligible: false, status: 'locked' };
}

/**
 * Admin action: Qualify top N participants based on verified submitted scores in a round.
 */
export function autoQualifyTopN(sourceRound: 1 | 2, count: number): { qualifiedCount: number } {
  const submissions = getAllSubmissions().filter((s) => s.roundId === sourceRound);
  submissions.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.timeTakenSeconds - b.timeTakenSeconds;
  });

  const qualifiedList = submissions.slice(0, count).map((s) => s.rollNumber.trim().toUpperCase());
  const eliminatedList = submissions.slice(count).map((s) => s.rollNumber.trim().toUpperCase());

  const quals = getQualifications();
  if (sourceRound === 1) {
    quals.round2QualifiedRolls = Array.from(new Set([...quals.round2QualifiedRolls, ...qualifiedList]));
    quals.eliminatedRolls = Array.from(
      new Set(
        [...quals.eliminatedRolls, ...eliminatedList].filter(
          (roll) => !quals.round2QualifiedRolls.includes(roll)
        )
      )
    );
  } else if (sourceRound === 2) {
    quals.round3QualifiedRolls = Array.from(new Set([...quals.round3QualifiedRolls, ...qualifiedList]));
    quals.eliminatedRolls = Array.from(
      new Set(
        [...quals.eliminatedRolls, ...eliminatedList].filter(
          (roll) => !quals.round3QualifiedRolls.includes(roll)
        )
      )
    );
  }

  saveQualifications(quals);
  return { qualifiedCount: qualifiedList.length };
}

// ---------------------------------------------------------------------------
// 7. UNIFIED LIVE LEADERBOARD
// ---------------------------------------------------------------------------

export function getUnifiedLeaderboard(): LeaderboardEntry[] {
  const submissions = getAllSubmissions();
  const quals = getQualifications();

  // Map participant roll number to accumulated scores
  const scoreMap = new Map<
    string,
    {
      name: string;
      college: string;
      r1: number;
      r2: number;
      r3: number;
      timeTaken: number;
      lastSubmission: number;
    }
  >();

  // Seed with base demo leaderboard participants if available
  const clearedRounds = getClearedRounds();
  INITIAL_LEADERBOARD.forEach((b) => {
    scoreMap.set(b.rollNumber.trim().toUpperCase(), {
      name: b.name,
      college: b.collegeName,
      r1: clearedRounds.includes(1) ? 0 : b.round1Score,
      r2: clearedRounds.includes(2) ? 0 : b.round2Score,
      r3: clearedRounds.includes(3) ? 0 : b.round3Score,
      timeTaken: 120,
      lastSubmission: 0,
    });
  });

  // Apply real submissions
  submissions.forEach((sub) => {
    const key = sub.rollNumber.trim().toUpperCase();
    const current = scoreMap.get(key) || {
      name: sub.participantName,
      college: sub.collegeName,
      r1: 0,
      r2: 0,
      r3: 0,
      timeTaken: 0,
      lastSubmission: sub.submittedAt,
    };

    if (sub.roundId === 1) current.r1 = sub.score;
    if (sub.roundId === 2) current.r2 = sub.score;
    if (sub.roundId === 3) current.r3 = sub.score;

    current.timeTaken += sub.timeTakenSeconds;
    current.lastSubmission = Math.max(current.lastSubmission, sub.submittedAt);
    scoreMap.set(key, current);
  });

  const entries: LeaderboardEntry[] = [];
  scoreMap.forEach((val, roll) => {
    const total = val.r1 + val.r2 + val.r3;
    let stage: LeaderboardEntry['stage'] = 'Participant';

    const hasR3Submission = submissions.some((s) => s.roundId === 3 && s.rollNumber.trim().toUpperCase() === roll);
    if (quals.round3QualifiedRolls.includes(roll) || hasR3Submission || val.r3 !== 0) {
      stage = 'Podium Winner';
    } else if (quals.round2QualifiedRolls.includes(roll) || val.r2 > 0) {
      stage = 'Top 8 Finalist';
    } else if (val.r1 > 0) {
      stage = 'Qualified R1';
    }

    entries.push({
      id: `lb-${roll}`,
      rank: 0,
      name: val.name,
      rollNumber: roll,
      collegeName: val.college,
      round1Score: val.r1,
      round2Score: val.r2,
      round3Score: val.r3,
      totalScore: total,
      stage,
      timeTakenSeconds: val.timeTaken,
      lastActive: val.lastSubmission > 0 ? 'Verified' : 'Ready',
    });
  });

  // Sort with authoritative tie-breaking comparator
  entries.sort((a, b) => compareRankings(a, b));

  // Assign sequential 1-based ranks
  return entries.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));
}

/**
 * Authoritative Round 3 Leaderboard:
 * Returns participants ranked strictly by total Round 3 score with tiebreakers.
 */
export function getRound3Leaderboard(): LeaderboardEntry[] {
  const unified = getUnifiedLeaderboard();
  const sorted = [...unified].sort((a, b) => compareRound3Rankings(a, b));
  return sorted.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));
}

// ---------------------------------------------------------------------------
// 8. STORAGE SYNC EVENT LISTENER
// ---------------------------------------------------------------------------

export function subscribeToCompetitionSync(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener('storage', handler);
  window.addEventListener('bb_storage_sync', handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener('bb_storage_sync', handler);
  };
}

// ---------------------------------------------------------------------------
// 9. EVENT & ROUND RESET FUNCTIONALITY
// ---------------------------------------------------------------------------

export interface ResetRoundResult {
  roundId: 1 | 2 | 3;
  deletedSubmissionsCount: number;
  clearedProgressCount: number;
  clearedAt: number;
}

export function getClearedRounds(): number[] {
  try {
    const raw = safeGetItem(KEY_CLEARED_ROUNDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getRoundProgressCount(roundId: 1 | 2 | 3): number {
  let count = 0;
  const prefix = `bb_progress_r${roundId}_`;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        count++;
      }
    }
  } catch {
    // fallback
  }
  return count;
}

export function getRegistryParticipants(): RegistryParticipant[] {
  try {
    const raw = safeGetItem(KEY_REGISTRY_PARTICIPANTS);
    if (!raw) return ADMIN_REGISTRY_PARTICIPANTS;
    return JSON.parse(raw);
  } catch {
    return ADMIN_REGISTRY_PARTICIPANTS;
  }
}

export function saveRegistryParticipants(participants: RegistryParticipant[]): void {
  safeSetItem(KEY_REGISTRY_PARTICIPANTS, JSON.stringify(participants));
}

export function resetRegistryForRound(roundId: 1 | 2 | 3): void {
  const roundTag = roundId === 1 ? 'R-01' : roundId === 2 ? 'R-02' : 'R-03';
  const list = getRegistryParticipants();
  const updated = list.map((p) => {
    if (p.round.includes(roundTag)) {
      return {
        ...p,
        solvedCount: 0,
        accuracy: 0,
        statusType: 'in-progress' as const,
        statusLabel: 'RESET [0/20]',
        questionGrid: Array(p.totalQuestions || 20).fill('pending') as ('answered' | 'review' | 'pending')[],
      };
    }
    return p;
  });
  saveRegistryParticipants(updated);
}

/**
 * Authoritative Round Reset:
 * Completely purges all submission records, participant in-progress answers,
 * exam countdown timers, and qualification promotion states for the chosen round.
 */
export function resetRoundState(roundId: 1 | 2 | 3): ResetRoundResult {
  // 1. Delete all submission records for this round
  const allSubs = getAllSubmissions();
  const remainingSubs = allSubs.filter((s) => s.roundId !== roundId);
  const deletedSubmissionsCount = allSubs.length - remainingSubs.length;
  safeSetItem(KEY_SUBMISSIONS, JSON.stringify(remainingSubs));

  // 2. Clear all participant exam progress & saved answers in localStorage for this round
  let clearedProgressCount = 0;
  const prefix = `bb_progress_r${roundId}_`;
  const keysToRemove: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => {
      localStorage.removeItem(k);
      clearedProgressCount++;
    });
  } catch (err) {
    console.error('Failed clearing round progress keys:', err);
  }

  // 3. Mark this round as cleared for demo baseline overrides
  const cleared = getClearedRounds();
  if (!cleared.includes(roundId)) {
    safeSetItem(KEY_CLEARED_ROUNDS, JSON.stringify([...cleared, roundId]));
  }

  // 4. Reset round qualifications associated with this stage
  const quals = getQualifications();
  if (roundId === 1) {
    quals.round2QualifiedRolls = [];
  } else if (roundId === 2) {
    quals.round3QualifiedRolls = [];
  }
  saveQualifications(quals);

  // 5. Reset candidate registry for this round
  resetRegistryForRound(roundId);

  // 6. Broadcast event across tabs & windows
  window.dispatchEvent(new Event('bb_storage_sync'));
  window.dispatchEvent(new CustomEvent('bb_round_reset', { detail: { roundId } }));

  return {
    roundId,
    deletedSubmissionsCount,
    clearedProgressCount,
    clearedAt: Date.now(),
  };
}
