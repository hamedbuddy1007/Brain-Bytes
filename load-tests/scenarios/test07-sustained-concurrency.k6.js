/**
 * TEST 07 — SUSTAINED CONCURRENCY TEST (k6)
 *
 * Maintains 200 active participants continuously across a full round duration
 * (configurable via `SUSTAINED_DURATION`, defaulting to `180s` for Round 3 Rapid Fire
 * or `600s` for Round 1/2), monitoring latency drift, memory growth, and connection stability.
 */

import { sleep } from 'k6';
import { K6_THRESHOLDS } from '../config/config.js';
import { fetchCompetitionState, fetchRoundQuestions, fetchRoundsList } from '../helpers/questions.js';

const SUSTAINED_DURATION = __ENV.SUSTAINED_DURATION || '180s';

export const options = {
  scenarios: {
    sustained_200_users: {
      executor: 'constant-vus',
      vus: 200,
      duration: SUSTAINED_DURATION,
    },
  },
  thresholds: K6_THRESHOLDS,
};

export default function () {
  fetchCompetitionState();
  fetchRoundsList();
  fetchRoundQuestions(((__VU - 1) % 3) + 1);
  sleep(3.0);
}

