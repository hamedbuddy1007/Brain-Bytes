/**
 * Authoritative Scoring Service for Brain Bytes — Data Quiz
 * 
 * Strict Scoring Rules:
 * - Round 1: Data MCQ (10 mins, 20 questions)
 *   - Correct answer: +1 point
 *   - Incorrect / unanswered: 0 points
 * - Round 2: Graph Challenge (10 mins, 5 questions)
 *   - Correct answer: +1 point
 *   - Incorrect / unanswered: 0 points
 * - Round 3: Rapid Fire (3 mins, 5 questions)
 *   - Correct answer: +5 points
 *   - Incorrect answer: -2 points
 *   - Unanswered or skipped question: 0 points
 * 
 * Consistent across:
 * - Participant result displays, Admin reports, Leaderboard, and Projector
 */

import { ROUND_1_QUESTIONS } from '../data/round1Questions';
import { ROUND_2_QUESTIONS } from '../data/round2Questions';
import { ROUND_3_QUESTIONS } from '../data/round3Questions';

export interface ScoreSummary {
  roundId: number;
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  correctCount: number;
  incorrectCount: number;
  score: number; // Evaluated according to round-specific rules
  maxPossibleScore: number;
  percentage: number;
}

/**
 * Pure calculation for Round 3 (Rapid Fire) score:
 * +5 points per correct answer, -2 points per incorrect answer, 0 points for unanswered.
 */
export function calculateRound3RawScore(correctCount: number, incorrectCount: number): number {
  return correctCount * 5 - incorrectCount * 2;
}

/**
 * Calculates authoritative score for any competition round.
 * Evaluates against official question keys or custom test questions.
 * 
 * @param roundId 1 | 2 | 3
 * @param selectedAnswers Map of question ID to chosen option index (0-3)
 * @param customQuestions Optional custom questions array for testing or evaluation
 */
export function calculateRoundScore(
  roundId: 1 | 2 | 3,
  selectedAnswers: Record<number, number>,
  customQuestions?: { id: number; correctAnswer: number }[]
): ScoreSummary {
  let questions: { id: number; correctAnswer: number }[] = [];

  if (customQuestions && customQuestions.length > 0) {
    questions = customQuestions;
  } else if (roundId === 1) {
    questions = ROUND_1_QUESTIONS;
  } else if (roundId === 2) {
    questions = ROUND_2_QUESTIONS;
  } else if (roundId === 3) {
    questions = ROUND_3_QUESTIONS;
  }

  const totalQuestions = questions.length;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;

  for (const q of questions) {
    const chosen = selectedAnswers[q.id];
    if (chosen === undefined || chosen === null) {
      unansweredCount++;
    } else if (chosen === q.correctAnswer) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  }

  // Scoring Rules:
  // Round 3 (Rapid Fire): +5 for correct, -2 for incorrect, 0 for unanswered
  // Round 1 & Round 2: +1 for correct, 0 for incorrect, 0 for unanswered (preserved exactly)
  const score = roundId === 3
    ? calculateRound3RawScore(correctCount, incorrectCount)
    : correctCount * 1;

  const maxPossibleScore = roundId === 3 ? totalQuestions * 5 : totalQuestions;
  const percentage = maxPossibleScore > 0
    ? Math.max(0, Math.round((score / maxPossibleScore) * 100))
    : 0;

  return {
    roundId,
    totalQuestions,
    answeredCount: correctCount + incorrectCount,
    unansweredCount,
    correctCount,
    incorrectCount,
    score,
    maxPossibleScore,
    percentage,
  };
}

/**
 * Deterministic tie-breaking policy for overall tournament rankings:
 * 1. Primary: Total Score (descending)
 * 2. Secondary: Total Time Taken in seconds (ascending - fastest candidate wins)
 * 3. Tertiary: Higher Round Priority (Round 3 > Round 2 > Round 1)
 * 4. Quaternary: Name alphabetical (ascending)
 */
export function compareRankings<T extends {
  totalScore: number;
  timeTakenSeconds?: number;
  round3Score?: number;
  round2Score?: number;
  round1Score?: number;
  name?: string;
}>(a: T, b: T): number {
  // 1. Total score DESC
  if (b.totalScore !== a.totalScore) {
    return b.totalScore - a.totalScore;
  }

  // 2. Faster completion time ASC (if recorded)
  const timeA = a.timeTakenSeconds ?? 999999;
  const timeB = b.timeTakenSeconds ?? 999999;
  if (timeA !== timeB) {
    return timeA - timeB;
  }

  // 3. Round 3 score DESC
  const r3A = a.round3Score ?? 0;
  const r3B = b.round3Score ?? 0;
  if (r3B !== r3A) {
    return r3B - r3A;
  }

  // 4. Round 2 score DESC
  const r2A = a.round2Score ?? 0;
  const r2B = b.round2Score ?? 0;
  if (r2B !== r2A) {
    return r2B - r2A;
  }

  // 5. Name ASC
  return (a.name || '').localeCompare(b.name || '');
}

/**
 * Deterministic ranking specifically for Round 3 (Rapid Fire) leaderboard:
 * 1. Primary: Total Round 3 Score (descending)
 * 2. Secondary: Faster completion time in seconds (ascending)
 * 3. Tertiary: Total Cumulative Tournament Score (descending)
 * 4. Quaternary: Name alphabetical (ascending)
 */
export function compareRound3Rankings<T extends {
  round3Score?: number;
  timeTakenSeconds?: number;
  totalScore?: number;
  name?: string;
}>(a: T, b: T): number {
  const r3A = a.round3Score ?? 0;
  const r3B = b.round3Score ?? 0;
  if (r3B !== r3A) {
    return r3B - r3A;
  }

  const timeA = a.timeTakenSeconds ?? 999999;
  const timeB = b.timeTakenSeconds ?? 999999;
  if (timeA !== timeB) {
    return timeA - timeB;
  }

  const totalA = a.totalScore ?? 0;
  const totalB = b.totalScore ?? 0;
  if (totalB !== totalA) {
    return totalB - totalA;
  }

  return (a.name || '').localeCompare(b.name || '');
}
