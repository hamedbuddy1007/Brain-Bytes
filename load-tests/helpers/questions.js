/**
 * PROJECT BRAIN BYTES — Question Retrieval & Competition State Helpers (k6)
 *
 * Maps to actual backend endpoints in `backend/src/routes.js`:
 * - `GET /api/health`
 * - `GET /api/competition/state`
 * - `GET /api/rounds/:roundId/questions`
 * - `GET /api/rounds/:roundId/attempts/active-deadline`
 */

import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../config/config.js';
import { buildAuthHeaders } from './auth.js';

export function fetchRoundsList() {
  const res = http.get(`${BASE_URL}/api/competition/state`, {
    tags: { endpoint: 'GET /api/competition/state', phase: 'competition_info' },
  });
  check(res, {
    'GET /api/competition/state status 200': (r) => r.status === 200,
  });
  return res;
}

export function fetchCompetitionState() {
  const res = http.get(`${BASE_URL}/api/competition/state`, {
    tags: { endpoint: 'GET /api/competition/state', phase: 'competition_state' },
  });
  check(res, {
    'GET /api/competition/state status 200': (r) => r.status === 200,
  });
  return res;
}

export function fetchRoundQuestions(roundNumber) {
  const res = http.get(`${BASE_URL}/api/rounds/${roundNumber}/questions`, {
    tags: { endpoint: 'GET /api/rounds/:roundId/questions', round: String(roundNumber), phase: 'questions' },
  });
  check(res, {
    'GET /api/rounds/:roundId/questions status 200': (r) => r.status === 200,
    'questions array present': (r) => {
      try {
        return Array.isArray(r.json()?.questions);
      } catch {
        return false;
      }
    },
  });
  return res;
}

export function fetchActiveDeadline(roundNumber, sessionToken) {
  const res = http.get(`${BASE_URL}/api/rounds/${roundNumber}/attempts/active-deadline`, {
    headers: buildAuthHeaders(sessionToken),
    tags: { endpoint: 'GET /api/rounds/:roundId/attempts/active-deadline', round: String(roundNumber), phase: 'exam_poll' },
  });
  check(res, {
    'GET active-deadline status 200': (r) => r.status === 200,
  });
  return res;
}
