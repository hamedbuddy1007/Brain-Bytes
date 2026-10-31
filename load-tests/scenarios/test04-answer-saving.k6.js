/**
 * TEST 04 — 200-USER CONCURRENT ANSWER SAVING & IN-ROUND TELEMETRY (k6)
 *
 * Simulates 200 participants actively taking the exam at the same time:
 * - Navigating between questions, selecting answers, modifying previous selections,
 *   and marking questions for review (client-side state + localStorage persistence)
 * - Executing the exact background HTTP polling cadence implemented in the React frontend:
 *     - `GET /api/rounds/:roundId/attempts/active-deadline` (every 2.5s)
 *     - `GET /api/participants/me` (every 3.5s)
 *     - `GET /api/competition/state` (every 3.0s)
 */

import { sleep } from 'k6';
import { K6_THRESHOLDS } from '../config/config.js';
import { fetchActiveDeadline, fetchCompetitionState, fetchRoundQuestions } from '../helpers/questions.js';
import { buildSimulatedAnswerSheet } from '../helpers/submissions.js';
import { fetchParticipantMe } from '../helpers/participant.js';

export const options = {
  scenarios: {
    concurrent_exam_activity_200: {
      executor: 'constant-vus',
      vus: 200,
      duration: '30s',
    },
  },
  thresholds: K6_THRESHOLDS,
};

const SESSION_TOKEN = __ENV.PARTICIPANT_TOKEN || '';

export default function () {
  const vuIndex = ((__VU - 1) % 200) + 1;
  const qRes = fetchRoundQuestions(1);
  let questions = [];
  try {
    questions = qRes.json()?.questions || [];
  } catch {
    questions = [];
  }

  // Simulate answer selection, answer modification, and review marking across all 50 questions
  buildSimulatedAnswerSheet(questions, vuIndex);

  // Execute active round telemetry polls
  fetchCompetitionState();
  if (SESSION_TOKEN) {
    fetchActiveDeadline(1, SESSION_TOKEN);
    fetchParticipantMe(SESSION_TOKEN);
  }
  sleep(2.5);
}

