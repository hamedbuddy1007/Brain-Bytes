/**
 * TEST 05 — 200-PARTICIPANT SUBMISSION BURST (k6)
 *
 * Simulates the end-of-round timer expiration when all 200 participants submit their
 * 50-question Round 1 answer sheet within a 5–10 second window via
 * `POST /api/attempts/:attemptId/submit`, followed by a duplicate-submission check.
 *
 * SAFETY GATE: Requires `BB_TEST_CONFIRM_DISPOSABLE=YES_DISPOSABLE_TEST_DB` to execute
 * database writes against an isolated Neon test branch.
 */

import { fail } from 'k6';
import { K6_THRESHOLDS } from '../config/config.js';
import { executeFullParticipantJourney } from '../helpers/participant.js';

export const options = {
  scenarios: {
    submission_burst_200: {
      executor: 'per-vu-iterations',
      vus: 200,
      iterations: 1,
      maxDuration: '10s',
    },
  },
  thresholds: K6_THRESHOLDS,
};

const ALLOW_WRITE = (__ENV.BB_TEST_CONFIRM_DISPOSABLE || '') === 'YES_DISPOSABLE_TEST_DB';

export default function () {
  if (!ALLOW_WRITE) {
    fail(
      'SAFETY GATE: Write-intensive 200-user submission burst aborted because BB_TEST_CONFIRM_DISPOSABLE is not set to YES_DISPOSABLE_TEST_DB.'
    );
  }
  const vuIndex = ((__VU - 1) % 200) + 1;
  executeFullParticipantJourney(vuIndex, 1, { allowWrite: true });
}

