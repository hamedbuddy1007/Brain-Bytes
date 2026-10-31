/**
 * TEST 08 — LOAD CAPACITY RAMP TEST (k6)
 *
 * Ramps concurrent users through 4 stages:
 *   50 users -> 100 users -> 150 users -> 200 users
 * Identifies the exact concurrency threshold where latency or rate-limiting degrades.
 */

import { sleep } from 'k6';
import { K6_THRESHOLDS } from '../config/config.js';
import { fetchCompetitionState, fetchRoundQuestions, fetchRoundsList } from '../helpers/questions.js';

export const options = {
  stages: [
    { duration: '15s', target: 50 },
    { duration: '15s', target: 100 },
    { duration: '15s', target: 150 },
    { duration: '15s', target: 200 },
    { duration: '5s', target: 0 },
  ],
  thresholds: K6_THRESHOLDS,
};

export default function () {
  fetchCompetitionState();
  fetchRoundsList();
  fetchRoundQuestions(1);
  sleep(1.0);
}

