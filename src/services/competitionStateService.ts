/**
 * Central State & Synchronization Service for Brain Bytes   Data Quiz
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

import {
  DEFAULT_ADMIN_SETTINGS,
  type Participant,
  type AdminSettings,
  type LeaderboardEntry,
  type RoundStatus,
} from '../types/competition';


import { apiRequest } from './apiClient';
import { calculateRoundScore, compareRankings, compareRound3Rankings, type ScoreSummary } from './scoringService';

// Storage Keys
const KEY_ACTIVE_PARTICIPANT = 'bb_active_participant_session';
const KEY_ADMIN_SETTINGS = 'bb_admin_settings_state';
const KEY_SUBMISSIONS = 'bb_competition_submissions_v2';
const KEY_QUALIFICATIONS = 'bb_round_qualifications_v2';
const KEY_COMPETITION_STATE = 'bb_tournament_global_state';
const KEY_CLEARED_ROUNDS = 'bb_cleared_rounds_v2';

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
  answers: Record<number, number>,
  serverScoreDetails?: { score: number; correctCount: number; incorrectCount: number; unansweredCount: number }
): { submission: SubmissionRecord; isDuplicate: boolean } {
  const existing = getParticipantSubmission(roundId, participant.rollNumber);
  if (existing) {
    return { submission: existing, isDuplicate: true };
  }

  // Authoritatively compute score using official ScoringService or server results
  const scoreSummary: ScoreSummary = calculateRoundScore(roundId, answers);
  const score = serverScoreDetails?.score ?? scoreSummary.score;
  const correctCount = serverScoreDetails?.correctCount ?? scoreSummary.correctCount;
  const incorrectCount = serverScoreDetails?.incorrectCount ?? scoreSummary.incorrectCount;
  const unansweredCount = serverScoreDetails?.unansweredCount ?? scoreSummary.unansweredCount;

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
    score,
    maxScore: scoreSummary.maxPossibleScore,
    correctCount,
    incorrectCount,
    unansweredCount,
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
  _rollNumber: string
): { isEligible: boolean; status: 'eligible' | 'pending_evaluation' | 'eliminated' | 'locked' } {
  const settings = getAdminSettings();
  const roundStatus: RoundStatus = settings.roundStates[roundId] || 'locked';

  if (roundStatus === 'locked') {
    return { isEligible: false, status: 'locked' };
  }

  // Round is open and active: participant can enter. Administrator physically decides who stays in the lab.
  return { isEligible: true, status: 'eligible' };
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

// Authoritative leaderboard: always comes from the server database (GET /api/leaderboard).
// There is no demo seed and no localStorage score data any more.
let serverLeaderboard: LeaderboardEntry[] = [];

interface ApiLeaderboardRow {
  name: string;
  roll_number: string;
  college_name: string | null;
  round1_score: number | string | null;
  round2_score: number | string | null;
  round3_score: number | string | null;
  total_score: number | string | null;
  total_time_seconds: number | string | null;
}

export async function refreshLeaderboardFromServer(): Promise<void> {
  try {
    const rows = await apiRequest<ApiLeaderboardRow[]>('/leaderboard');
    serverLeaderboard = rows.map((row) => {
      const r1 = row.round1_score === null ? null : Number(row.round1_score);
      const r2 = row.round2_score === null ? null : Number(row.round2_score);
      const r3 = row.round3_score === null ? null : Number(row.round3_score);
      let stage: LeaderboardEntry['stage'] = 'Participant';
      if (r3 !== null) stage = 'Podium Winner';
      else if (r2 !== null) stage = 'Top 8 Finalist';
      else if (r1 !== null) stage = 'Qualified R1';
      return {
        id: `lb-${row.roll_number}`,
        rank: 0,
        name: row.name,
        rollNumber: row.roll_number,
        collegeName: row.college_name || '',
        round1Score: r1 ?? 0,
        round2Score: r2 ?? 0,
        round3Score: r3 ?? 0,
        totalScore: Number(row.total_score ?? 0),
        stage,
        timeTakenSeconds: Number(row.total_time_seconds ?? 0),
        lastActive: r1 !== null || r2 !== null || r3 !== null ? 'Verified' : 'Ready',
      };
    });
    window.dispatchEvent(new Event('bb_storage_sync'));
  } catch {
    // Keep showing the last good data if the server is briefly unreachable.
  }
}

export function getUnifiedLeaderboard(): LeaderboardEntry[] {
  // Sort with authoritative tie-breaking comparator, then assign sequential 1-based ranks
  return [...serverLeaderboard]
    .sort((a, b) => compareRankings(a, b))
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
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
  const roundPrefixes = [
    `bb_progress_r${roundId}_`,
    `bb_answers_r${roundId}_`,
    `bb_marked_r${roundId}_`,
    `bb_submitted_r${roundId}_`,
    `bb_score_r${roundId}_`,
    `bb_review_r${roundId}_`,
    `bb_attempt_id_r${roundId}_`,
  ];
  const keysToRemove: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && roundPrefixes.some((p) => k.startsWith(p))) {
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

  // 5. Broadcast event across tabs & windows
  window.dispatchEvent(new Event('bb_storage_sync'));
  window.dispatchEvent(new CustomEvent('bb_round_reset', { detail: { roundId } }));

  return {
    roundId,
    deletedSubmissionsCount,
    clearedProgressCount,
    clearedAt: Date.now(),
  };
}

/**
 * Live Rehearsal Cleanup / Full Tournament Purge:
 * Permanently clears all local storage state, participant caches, submissions,
 * in-progress answers, attempt IDs, review data, and leaderboard entries across all 3 rounds.
 */
export function purgeAllTournamentData(): void {
  try {
    localStorage.removeItem(KEY_SUBMISSIONS);
    localStorage.removeItem(KEY_QUALIFICATIONS);
    localStorage.removeItem(KEY_CLEARED_ROUNDS);
    localStorage.removeItem(KEY_ACTIVE_PARTICIPANT);
    localStorage.removeItem(KEY_COMPETITION_STATE);
  } catch (err) {
    console.error('Failed removing storage keys:', err);
  }
  serverLeaderboard = [];

  const tournamentPrefixes = [
    'bb_progress_',
    'bb_answers_',
    'bb_marked_',
    'bb_submitted_',
    'bb_score_',
    'bb_review_',
    'bb_attempt_id_',
  ];
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && tournamentPrefixes.some((p) => k.startsWith(p))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.error('Failed clearing tournament keys:', err);
  }

  // Notify all components across the application
  window.dispatchEvent(new Event('bb_storage_sync'));
  window.dispatchEvent(new CustomEvent('bb_round_reset', { detail: { roundId: 1 } }));
  window.dispatchEvent(new CustomEvent('bb_round_reset', { detail: { roundId: 2 } }));
  window.dispatchEvent(new CustomEvent('bb_round_reset', { detail: { roundId: 3 } }));
}
