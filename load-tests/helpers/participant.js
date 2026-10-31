/**
 * PROJECT BRAIN BYTES — Realistic Participant Workflow Helper (k6)
 *
 * Encapsulates the 17-step end-to-end participant journey discovered in Phase 1:
 *  1. Open deployed application / health check
 *  2. Load landing page competition state
 *  3. Register / enter participant details (`LOADTEST_USER_XXX`)
 *  4. Authenticate via `POST /api/participants/login-access-code`
 *  5. Receive individual participant JWT session
 *  6. Retrieve competition state & round list
 *  7. Open active round (`POST /api/rounds/:roundId/attempts/start`)
 *  8. Retrieve round questions (`GET /api/rounds/:roundId/questions`)
 *  9-12. Navigate questions, select answers, modify answers, mark for review, poll active deadline
 *  13. Poll `GET /api/participants/me`
 *  14. Submit round (`POST /api/attempts/:attemptId/submit`)
 *  15. Verify submission confirmation (`status === 'SUBMITTED'`)
 *  16. Attempt to start/access the completed round again
 *  17. Verify duplicate-submission protection (`409 ROUND_LOCKED_ALREADY_SUBMITTED` or ` Attempt already submitted`)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL } from '../config/config.js';
import { buildAuthHeaders, loginParticipantWithAccessCode, registerLoadTestParticipant } from './auth.js';
import { fetchActiveDeadline, fetchCompetitionState, fetchRoundQuestions, fetchRoundsList } from './questions.js';
import { buildSimulatedAnswerSheet, startRoundAttempt, submitRoundAttempt } from './submissions.js';

export function fetchParticipantMe(sessionToken) {
  const res = http.get(`${BASE_URL}/api/participants/me`, {
    headers: buildAuthHeaders(sessionToken),
    tags: { endpoint: 'GET /api/participants/me', phase: 'participant_me' },
  });
  check(res, {
    'GET /api/participants/me status 200': (r) => r.status === 200,
  });
  return res;
}

export function executeFullParticipantJourney(vuIndex, roundNumber = 1, options = {}) {
  const { allowWrite = false, preRegisteredAccessCode = null } = options;

  // Step 1 & 2: Landing page / competition state + rounds list
  fetchCompetitionState();
  fetchRoundsList();
  fetchRoundQuestions(roundNumber);

  if (!allowWrite) {
    // Read-only safe simulation when disposable test DB is not enabled
    sleep(0.2);
    return { mode: 'READ_ONLY_SAFE', vuIndex };
  }

  // Step 3: Register participant if not pre-registered
  let accessCode = preRegisteredAccessCode;
  if (!accessCode) {
    const reg = registerLoadTestParticipant(vuIndex);
    accessCode = reg.accessCode;
  }

  // Step 4 & 5: Authenticate & obtain independent session token
  const login = loginParticipantWithAccessCode(accessCode);
  if (!login.sessionToken) {
    return { mode: 'AUTH_FAILED', status: login.response.status, vuIndex };
  }

  const token = login.sessionToken;

  // Step 6: Retrieve participant profile & competition state
  fetchParticipantMe(token);
  fetchCompetitionState();

  // Step 7: Open active round
  const start = startRoundAttempt(roundNumber, token);
  if (!start.attemptId) {
    return { mode: 'START_FAILED', status: start.response.status, vuIndex };
  }

  // Step 8: Retrieve questions for the round
  const qRes = fetchRoundQuestions(roundNumber);
  let questions = [];
  try {
    questions = qRes.json()?.questions || [];
  } catch {
    questions = [];
  }

  // Steps 9-13: Navigate questions, select/modify answers, mark for review, poll active deadline
  const answers = buildSimulatedAnswerSheet(questions, vuIndex);
  fetchActiveDeadline(roundNumber, token);
  fetchParticipantMe(token);

  // Step 14 & 15: Submit round & verify confirmation
  const submitRes = submitRoundAttempt(start.attemptId, answers, token, 180);

  // Step 16 & 17: Verify duplicate-submission / re-entry protection
  const duplicateSubmitRes = http.post(
    `${BASE_URL}/api/attempts/${start.attemptId}/submit`,
    JSON.stringify({ answers, timeRemainingSeconds: 175 }),
    {
      headers: buildAuthHeaders(token),
      tags: { endpoint: 'POST /api/attempts/:attemptId/submit (duplicate)', phase: 'duplicate_check' },
    }
  );

  check(duplicateSubmitRes, {
    'duplicate submit rejected with 409': (r) => r.status === 409,
  });

  const reStartRes = http.post(
    `${BASE_URL}/api/rounds/${roundNumber}/attempts/start`,
    JSON.stringify({}),
    {
      headers: buildAuthHeaders(token),
      tags: { endpoint: 'POST /api/rounds/:roundId/attempts/start (re-entry)', phase: 'duplicate_check' },
    }
  );

  check(reStartRes, {
    'completed round re-entry rejected with 409': (r) => r.status === 409,
  });

  return {
    mode: 'FULL_JOURNEY_COMPLETE',
    vuIndex,
    submitStatus: submitRes.status,
    duplicateStatus: duplicateSubmitRes.status,
    reEntryStatus: reStartRes.status,
  };
}

