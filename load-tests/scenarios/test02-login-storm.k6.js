/**
 * TEST 02 — 200-USER LOGIN STORM (k6)
 *
 * Simulates 200 participants (`LOADTEST_USER_001`..`LOADTEST_USER_200`) joining the
 * competition within a 30-second window via `POST /api/participants/login-access-code`.
 *
 * Supports two network modes via `--env CAMPUS_NAT_MODE`:
 * - `shared_ip` (default): Simulates a college computer lab / auditorium sharing 1 public NAT IP
 * - `distributed_ip`: Simulates 200 distinct cellular/client IPs via `X-Forwarded-For`
 */

import { sleep } from 'k6';
import { K6_THRESHOLDS, getLoadTestIdentity } from '../config/config.js';
import { loginParticipantWithAccessCode, registerLoadTestParticipant } from '../helpers/auth.js';

export const options = {
  scenarios: {
    login_storm_200: {
      executor: 'per-vu-iterations',
      vus: 200,
      iterations: 1,
      maxDuration: '30s',
    },
  },
  thresholds: K6_THRESHOLDS,
};

const ALLOW_WRITE = (__ENV.BB_TEST_CONFIRM_DISPOSABLE || '') === 'YES_DISPOSABLE_TEST_DB';
const CAMPUS_NAT_MODE = __ENV.CAMPUS_NAT_MODE || 'shared_ip';

export default function () {
  const vuIndex = ((__VU - 1) % 200) + 1;
  const identity = getLoadTestIdentity(vuIndex);
  const customHeaders =
    CAMPUS_NAT_MODE === 'distributed_ip'
      ? { 'X-Forwarded-For': `10.200.${Math.floor(vuIndex / 250)}.${(vuIndex % 250) + 1}` }
      : {};

  // Stagger arrival across the 30s storm window
  sleep((vuIndex % 30) * 0.5);

  if (ALLOW_WRITE) {
    registerLoadTestParticipant(vuIndex, customHeaders);
  }

  loginParticipantWithAccessCode(identity.accessCode, customHeaders);
}

