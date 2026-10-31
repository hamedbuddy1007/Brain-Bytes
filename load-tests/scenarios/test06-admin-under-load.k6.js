/**
 * TEST 06 — ADMIN DASHBOARD & LEADERBOARD UNDER 200-USER LOAD (k6)
 *
 * Runs two concurrent workload groups simultaneously:
 * 1. `participant_load` (200 VUs): Active competition polling and question retrieval
 * 2. `admin_console` (3 VUs): Admin operators polling `GET /api/admin/overview`,
 *    `GET /api/admin/participants`, `GET /api/leaderboard`, and `GET /api/rounds`
 *    every 2.5 seconds (matching `AdminDashboard.tsx`).
 */

import { sleep } from 'k6';
import { K6_THRESHOLDS } from '../config/config.js';
import { fetchAdminOverview, fetchAdminParticipants, fetchLeaderboard } from '../helpers/admin.js';
import { fetchCompetitionState, fetchRoundQuestions, fetchRoundsList } from '../helpers/questions.js';

export const options = {
  scenarios: {
    participant_load: {
      executor: 'constant-vus',
      vus: 200,
      duration: '20s',
      exec: 'participantScenario',
    },
    admin_console: {
      executor: 'constant-vus',
      vus: 3,
      duration: '20s',
      exec: 'adminScenario',
    },
  },
  thresholds: K6_THRESHOLDS,
};

const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || '';

export function participantScenario() {
  fetchCompetitionState();
  fetchRoundQuestions(1);
  sleep(2.5);
}

export function adminScenario() {
  fetchRoundsList();
  fetchLeaderboard(ADMIN_TOKEN);
  if (ADMIN_TOKEN) {
    fetchAdminOverview(ADMIN_TOKEN);
    fetchAdminParticipants(ADMIN_TOKEN);
  }
  sleep(2.5);
}

