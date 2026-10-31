/**
 * PROJECT BRAIN BYTES — Load Testing Authentication Helpers (k6)
 *
 * Provides independent session management per virtual user (VU).
 * Every simulated participant receives an isolated identity (`LOADTEST_USER_001`..`200`)
 * and never shares a Bearer token across VUs.
 */

import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, getLoadTestIdentity } from '../config/config.js';

/**
 * Registers a disposable load-test participant (`LOADTEST_USER_XXX`) via
 * `POST /api/participants/register` and returns the registration payload
 * (including `accessCode` and `participant.id`).
 *
 * NOTE: Requires an isolated disposable test database (`BB_TEST_CONFIRM_DISPOSABLE=YES_DISPOSABLE_TEST_DB`).
 */
export function registerLoadTestParticipant(vuIndex, customHeaders = {}) {
  const identity = getLoadTestIdentity(vuIndex);
  const url = `${BASE_URL}/api/participants/register`;
  const payload = JSON.stringify({
    name: identity.name,
    email: identity.email,
    accessCode: identity.accessCode,
  });

  const res = http.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      ...customHeaders,
    },
    tags: { endpoint: 'POST /api/participants/register', phase: 'auth' },
  });

  check(res, {
    'register status is 201 or 409 (already registered)': (r) => r.status === 201 || r.status === 409,
  });

  let body = null;
  try {
    body = res.json();
  } catch {
    body = null;
  }

  return {
    response: res,
    identity,
    participant: body?.participant || null,
    accessCode: body?.accessCode || identity.accessCode,
  };
}

/**
 * Authenticates an individual participant via `POST /api/participants/login-access-code`
 * and returns a dedicated session object containing that VU's JWT Bearer token.
 */
export function loginParticipantWithAccessCode(accessCode, customHeaders = {}) {
  const url = `${BASE_URL}/api/participants/login-access-code`;
  const payload = JSON.stringify({ accessCode });

  const res = http.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      ...customHeaders,
    },
    tags: { endpoint: 'POST /api/participants/login-access-code', phase: 'auth' },
  });

  const ok = check(res, {
    'login status is 200': (r) => r.status === 200,
    'login returns sessionToken': (r) => {
      try {
        return Boolean(r.json()?.sessionToken);
      } catch {
        return false;
      }
    },
  });

  let body = null;
  try {
    body = res.json();
  } catch {
    body = null;
  }

  return {
    ok,
    response: res,
    sessionToken: body?.sessionToken || null,
    participant: body?.participant || null,
    activeRound: body?.activeRound || null,
  };
}

/**
 * Authenticates an admin operator via `POST /api/admin/login`.
 * Credentials are read from k6 environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`)
 * and never hardcoded.
 */
export function loginAdmin(adminEmail, adminPassword, customHeaders = {}) {
  const url = `${BASE_URL}/api/admin/login`;
  const payload = JSON.stringify({
    email: adminEmail,
    password: adminPassword,
  });

  const res = http.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      ...customHeaders,
    },
    tags: { endpoint: 'POST /api/admin/login', phase: 'admin_auth' },
  });

  check(res, {
    'admin login status is 200': (r) => r.status === 200,
  });

  let body = null;
  try {
    body = res.json();
  } catch {
    body = null;
  }

  return {
    response: res,
    sessionToken: body?.sessionToken || null,
    admin: body?.admin || null,
  };
}

/**
 * Builds standard JSON + Authorization request headers for an authenticated VU session.
 */
export function buildAuthHeaders(sessionToken, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }
  return headers;
}

