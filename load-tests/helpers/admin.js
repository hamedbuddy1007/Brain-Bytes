/**
 * PROJECT BRAIN BYTES — Admin Dashboard & Leaderboard Helpers (k6)
 *
 * Maps to actual admin and leaderboard endpoints in `backend/src/routes.js`:
 * - `GET /api/admin/overview-stats`
 * - `GET /api/admin/participants`
 * - `GET /api/admin/participants/:id/answers`
 * - `GET /api/leaderboard`
 * - `GET /api/competition/state`
 */

import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../config/config.js';
import { buildAuthHeaders } from './auth.js';

export function fetchAdminOverview(adminToken) {
  const res = http.get(`${BASE_URL}/api/admin/overview-stats`, {
    headers: buildAuthHeaders(adminToken),
    tags: { endpoint: 'GET /api/admin/overview-stats', phase: 'admin_dashboard' },
  });
  check(res, {
    'GET /api/admin/overview-stats status 200': (r) => r.status === 200,
  });
  return res;
}

export function fetchAdminParticipants(adminToken) {
  const res = http.get(`${BASE_URL}/api/admin/participants`, {
    headers: buildAuthHeaders(adminToken),
    tags: { endpoint: 'GET /api/admin/participants', phase: 'admin_dashboard' },
  });
  check(res, {
    'GET /api/admin/participants status 200': (r) => r.status === 200,
  });
  return res;
}

export function fetchAdminParticipantAnswers(adminToken, participantId) {
  const res = http.get(`${BASE_URL}/api/admin/participants/${participantId}/answers`, {
    headers: buildAuthHeaders(adminToken),
    tags: { endpoint: 'GET /api/admin/participants/:id/answers', phase: 'admin_dashboard' },
  });
  check(res, {
    'GET /api/admin/participants/:id/answers status 200': (r) => r.status === 200,
  });
  return res;
}

export function fetchLeaderboard(sessionToken = null) {
  const res = http.get(`${BASE_URL}/api/leaderboard`, {
    headers: buildAuthHeaders(sessionToken),
    tags: { endpoint: 'GET /api/leaderboard', phase: 'leaderboard' },
  });
  check(res, {
    'GET /api/leaderboard status 200': (r) => r.status === 200,
  });
  return res;
}
