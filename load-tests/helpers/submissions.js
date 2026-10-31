/**
 * PROJECT BRAIN BYTES — Answer Saving & Submission Helpers (k6)
 *
 * Maps accurately to the BRAIN BYTES architecture:
 * - During an active exam round (`Round1MCQ.tsx`, `Round2GraphChallenge.tsx`, `Round3RapidFire.tsx`),
 *   selecting an answer, changing an answer, and marking a question for review update client state
 *   and `localStorage` (`bb_r1_state_<userId>`, `bb_r2_state_<userId>`, `bb_r3_state_<userId>`),
 *   while background timers poll:
 *     1. `GET /api/rounds/:roundId/attempts/active-deadline` (every 2.5s)
 *     2. `GET /api/participants/me` (every 3.5s)
 *     3. `GET /api/competition/state` (every 3.0s x 2 components)
 * - When the participant finishes or the timer expires, the entire answer sheet is persisted
 *   transactional-style via `POST /api/attempts/:attemptId/submit`.
 */

import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../config/config.js';
import { buildAuthHeaders } from './auth.js';

/**
 * Starts or resumes a participant's attempt for a given round via
 * `POST /api/rounds/:roundId/attempts/start`.
 */
export function startRoundAttempt(roundNumber, sessionToken) {
  const res = http.post(
    `${BASE_URL}/api/rounds/${roundNumber}/attempts/start`,
    JSON.stringify({}),
    {
      headers: buildAuthHeaders(sessionToken),
      tags: { endpoint: 'POST /api/rounds/:roundId/attempts/start', round: String(roundNumber), phase: 'attempt_start' },
    }
  );

  check(res, {
    'start attempt status 200 or 201': (r) => r.status === 200 || r.status === 201,
  });

  let body = null;
  try {
    body = res.json();
  } catch {
    body = null;
  }

  return {
    response: res,
    attemptId: body?.attempt?.id || null,
    attempt: body?.attempt || null,
  };
}

/**
 * Simulates in-round client answer state management (selecting options, modifying previous selections,
 * and marking questions for review) and returns the formatted `answers` payload expected by
 * `POST /api/attempts/:attemptId/submit`.
 */
export function buildSimulatedAnswerSheet(questions, vuIndex = 1) {
  const optionCycle = ['A', 'B', 'C', 'D'];
  const stateMap = {};
  const reviewSet = new Set();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    // Initial selection
    const initialOption = optionCycle[(i + vuIndex) % 4];
    stateMap[q.id] = initialOption;

    // Simulate marking every 5th question for review and changing every 4th answer
    if (i % 5 === 0) {
      reviewSet.add(q.id);
    }
    if (i % 4 === 0) {
      stateMap[q.id] = optionCycle[(i + vuIndex + 1) % 4];
    }
    // Leave ~10% of questions unattempted (realistic exam behavior)
    if (i % 10 === 9) {
      stateMap[q.id] = null;
    }
  }

  return questions.map((q) => ({
    questionId: q.id,
    selectedOption: stateMap[q.id] ?? null,
  }));
}

/**
 * Submits a participant's completed answer array via `POST /api/attempts/:attemptId/submit`.
 */
export function submitRoundAttempt(attemptId, answers, sessionToken, timeRemainingSeconds = 120) {
  const res = http.post(
    `${BASE_URL}/api/attempts/${attemptId}/submit`,
    JSON.stringify({
      answers,
      timeRemainingSeconds,
    }),
    {
      headers: buildAuthHeaders(sessionToken),
      tags: { endpoint: 'POST /api/attempts/:attemptId/submit', phase: 'submission' },
    }
  );

  check(res, {
    'submit status is 200': (r) => r.status === 200,
    'submit returns submitted attempt': (r) => {
      try {
        return r.json()?.attempt?.status === 'SUBMITTED';
      } catch {
        return false;
      }
    },
  });

  return res;
}

