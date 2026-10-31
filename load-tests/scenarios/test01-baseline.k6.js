/**
 * TEST 01 — BASELINE PERFORMANCE TEST (k6)
 *
 * Stages: 1 VU -> 5 VUs -> 10 VUs
 * Purpose: Establish clean baseline latencies (p50, p95, p99) before high-concurrency testing.
 */

import { sleep } from 'k6';
import { K6_THRESHOLDS } from '../config/config.js';
import { fetchCompetitionState, fetchRoundQuestions, fetchRoundsList } from '../helpers/questions.js';
import { executeFullParticipantJourney } from '../helpers/participant.js';

export const options = {
  stages: [
    { duration: '10s', target: 1 },
    { duration: '15s', target: 5 },
    { duration: '15s', target: 10 },
    { duration: '5s', target: 0 },
  ],
  thresholds: K6_THRESHOLDS,
};

const ALLOW_WRITE = (__ENV.BB_TEST_CONFIRM_DISPOSABLE || '') === 'YES_DISPOSABLE_TEST_DB';

export default function () {
  const vuIndex = ((__VU - 1) % 200) + 1;
  fetchCompetitionState();
  fetchRoundsList();
  fetchRoundQuestions(1);
  fetchRoundQuestions(2);
  fetchRoundQuestions(3);

  if (ALLOW_WRITE) {
    executeFullParticipantJourney(vuIndex, 1, { allowWrite: true });
  }
  sleep(0.5);
}

