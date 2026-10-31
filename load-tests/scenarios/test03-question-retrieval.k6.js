/**
 * TEST 03 — 200-USER SIMULTANEOUS QUESTION RETRIEVAL (k6)
 *
 * Simulates 200 participants opening an active round simultaneously and fetching
 * the round question set within a 5-second window:
 * - `GET /api/rounds`
 * - `GET /api/competition/state`
 * - `GET /api/rounds/1/questions` (50 MCQ questions)
 * - `GET /api/rounds/2/questions` (30 Graph Challenge questions)
 * - `GET /api/rounds/3/questions` (30 Rapid Fire questions)
 */

import { K6_THRESHOLDS } from '../config/config.js';
import { fetchCompetitionState, fetchRoundQuestions, fetchRoundsList } from '../helpers/questions.js';

export const options = {
  scenarios: {
    simultaneous_question_burst: {
      executor: 'per-vu-iterations',
      vus: 200,
      iterations: 1,
      maxDuration: '5s',
    },
  },
  thresholds: K6_THRESHOLDS,
};

export default function () {
  fetchCompetitionState();
  fetchRoundsList();
  fetchRoundQuestions(1);
  fetchRoundQuestions(2);
  fetchRoundQuestions(3);
}

