/**
 * Brain Bytes / Data Mania - complete audit (fail-closed rewrite).
 *
 * What changed vs. the original:
 *  - backend/.env is loaded explicitly BEFORE the DB pool exists (values are never printed).
 *  - No hardcoded credentials. Admin checks need BB_TEST_ADMIN_USERNAME / BB_TEST_ADMIN_PASSWORD.
 *  - It never mutates the configured (production) database and never calls localhost:4000.
 *      * Default: nothing runs unless you opt in with BB_TEST_ALLOW_READONLY=1 (SELECT / GET only).
 *      * Write-capable lifecycle tests run ONLY against a disposable database you name with
 *        BB_TEST_DATABASE_URL and confirm with BB_TEST_CONFIRM_DISPOSABLE=<host>/<database>.
 *        The API is started in-process against that database; cleanup removes only rows this run created.
 *  - Failures print the real status/error and the process exits non-zero. Skips are reported as skips.
 *
 * Usage: see tests/README.md.
 */
import { createRequire } from 'node:module';

const kit = createRequire(import.meta.url)('./lib/testkit.cjs');

const env = kit.loadBackendEnv(); // explicit, before any pool is created
const rep = new kit.Reporter('BRAIN BYTES / DATA MANIA - COMPLETE AUDIT');
rep.info(env.loaded
  ? `backend/.env loaded explicitly (${env.keys} keys, values never printed).`
  : `backend/.env was not loaded: ${env.reason}.`);

/* ------------------------------------------------ read-only (SELECT/GET) -- */

async function runReadOnly({ db, call }) {
  await kit.runQuestionBankChecks(rep, db);

  rep.section('Competition state (read-only)');
  const state = (await db.query('SELECT status, round_states, round_durations FROM competition_state WHERE singleton=TRUE')).rows;
  rep.check(state.length === 1, 'competition_state has exactly one singleton row', `rows=${state.length}`);

  rep.section('Public API (GET only)');
  const health = await call('GET', '/health');
  rep.status(health, 200, 'GET /health returns 200');
  rep.check(health.body?.database === 'connected', 'Health reports database connected', JSON.stringify(health.body));

  const cs = await call('GET', '/competition/state');
  rep.status(cs, 200, 'GET /competition/state returns 200');
  rep.check(cs.body?.round_states && typeof cs.body.round_states === 'object', 'competition state exposes round_states');
  rep.check(cs.body?.round_durations && typeof cs.body.round_durations === 'object', 'competition state exposes round_durations');

  for (const round of [1, 2, 3]) {
    const q = await call('GET', `/rounds/${round}/questions`);
    if (q.status === 423) {
      rep.skip(`Round ${round} public payload leak check`, 'Round is currently locked (HTTP 423); not changing competition state to inspect it.');
      continue;
    }
    if (!rep.status(q, 200, `GET /rounds/${round}/questions returns 200`)) continue;
    const list = q.body?.questions || [];
    rep.check(list.length === kit.EXPECTED_COUNTS[round], `Round ${round} public payload has ${kit.EXPECTED_COUNTS[round]} questions`, `got ${list.length}`);
    const leaked = list.filter((x) => ['correct_answer', 'explanation', 'points_correct', 'points_wrong'].some((k) => k in x));
    rep.check(leaked.length === 0, `Round ${round} public payload leaks no answer key, explanation or points`, `${leaked.length} leaking questions`);
  }

  rep.section('Auth is enforced (requests that are rejected before any write)');
  for (const route of ['/admin/overview-stats', '/admin/participants', '/admin/attempts']) {
    rep.status(await call('GET', route), 401, `Unauthenticated GET ${route} is rejected`);
  }
  rep.status(await call('POST', '/participants/proctor-event', { body: { eventType: 'proctor.blur' } }), 401, 'Unauthenticated proctor-event is rejected');
  rep.status(await call('POST', '/attempts/1/submit', { body: { answers: [] } }), 401, 'Unauthenticated attempt submit is rejected');
  rep.status(await call('PATCH', '/admin/competition/state', { body: { status: 'LIVE' } }), 401, 'Unauthenticated competition-state PATCH is rejected');
  rep.status(
    await call('POST', '/auth/admin/login', { body: { identifier: `no-such-admin-${Date.now()}`, password: 'not-a-real-password' } }),
    401, 'Admin login with an unknown account is rejected');
  rep.status(
    await call('POST', '/participants/register', { body: { fullName: 'X', rollNumber: '', joinCode: '' } }),
    400, 'Registration with empty input is rejected (400)');
  const probe = await call('POST', '/participants/register', { body: { fullName: 'Audit Probe', rollNumber: `PROBE-${Date.now()}`, joinCode: `INVALID-${Date.now()}` } });
  if (probe.status === 503) {
    rep.skip('Registration with an invalid join code is rejected', `Join codes are not configured in this environment (${kit.describe(probe)}).`);
  } else {
    rep.status(probe, 400, 'Registration with an invalid join code is rejected (400) before any insert');
  }

  rep.skip('Participant lifecycle, scoring, leaderboard, admin-authenticated checks',
    'These write rows; they only run in the integration tier against a confirmed disposable database.');
}

/* --------------------------------- write-capable, disposable DB only ----- */

async function runIntegration({ db, call, tracker, setState }) {
  const allActive = { 1: 'active', 2: 'active', 3: 'active' };
  await setState({ status: 'LIVE', registrationOpen: true, roundStates: allActive });

  await kit.runQuestionBankChecks(rep, db);
  const bank = {};
  for (const r of [1, 2, 3]) bank[r] = await kit.loadQuestionRows(db, r);

  rep.section('Public API');
  rep.status(await call('GET', '/health'), 200, 'GET /health returns 200');
  const cs = await call('GET', '/competition/state');
  rep.check(cs.status === 200 && cs.body?.round_states?.['1'] === 'active', 'competition state reflects the test setup', kit.describe(cs));
  for (const round of [1, 2, 3]) {
    const q = await call('GET', `/rounds/${round}/questions`);
    rep.status(q, 200, `GET /rounds/${round}/questions returns 200`);
    const list = q.body?.questions || [];
    rep.check(list.length === kit.EXPECTED_COUNTS[round], `Round ${round} public payload has ${kit.EXPECTED_COUNTS[round]} questions`, `got ${list.length}`);
    rep.check(!list.some((x) => ['correct_answer', 'explanation', 'points_correct', 'points_wrong'].some((k) => k in x)),
      `Round ${round} public payload leaks no answer key, explanation or points`);
  }

  rep.section('Registration & session rules');
  rep.status(await call('POST', '/participants/register', { body: { fullName: 'X', rollNumber: '', joinCode: '' } }), 400, 'Empty registration -> 400');
  const badCode = await tracker.register('BADCODE', { body: { joinCode: 'INVALID-CODE-999' } });
  rep.status(badCode.res, 400, 'Invalid join code -> 400');
  const direct = await tracker.register('DIRECTR2', { body: { roundId: 2 } });
  rep.status(direct.res, 403, 'New participant registering directly into Round 2 -> 403');
  rep.check(!(await db.query('SELECT 1 FROM participants WHERE roll_number=$1', [direct.rollNumber])).rowCount, 'Rejected direct-R2 registration created no participant row');

  const P = await tracker.register('MAIN');
  rep.status(P.res, 201, 'Valid registration -> 201');
  rep.check(Boolean(P.token) && Number.isInteger(P.id), 'Registration returns a bearer token and numeric id', kit.describe(P.res));
  const seat = parseInt(String(P.res.body?.assignedSeat || '').replace(/\D/g, ''), 10);
  rep.check(seat >= 1 && seat <= 120, 'Assigned station is within 1..120', `seat=${P.res.body?.assignedSeat}`);
  rep.status(await call('POST', '/participants/register', { body: { fullName: 'BBT Audit Fixture', rollNumber: P.rollNumber, joinCode: tracker.joinCode } }),
    409, 'Duplicate roll number without a session -> 409 (anti-impersonation)');
  rep.status(await call('POST', '/participants/register', { token: P.token, body: { fullName: 'BBT Audit Fixture', rollNumber: P.rollNumber, joinCode: tracker.joinCode } }),
    200, 'Duplicate roll number WITH its own session resumes -> 200');
  rep.status(await call('POST', '/participants/reauth', { body: { rollNumber: P.rollNumber, joinCode: tracker.joinCode } }),
    401, 'Reauth without a session -> 401 (a roll number alone never authorizes)');
  rep.status(await call('POST', '/participants/reauth', { token: P.token, body: { rollNumber: P.rollNumber, joinCode: tracker.joinCode } }),
    200, 'Reauth with a valid session -> 200');
  const me = await call('GET', '/participants/me', { token: P.token });
  rep.check(me.status === 200 && Number(me.body?.id) === P.id, 'GET /participants/me returns the same participant', kit.describe(me));

  const W = await tracker.register('WRONG');
  const Q = await tracker.register('QUIET');
  const D = await tracker.register('LATE');
  const L = await tracker.register('LOCK');
  rep.check([W, Q, D, L].every((x) => x.res.status === 201), 'Additional fixture participants created (201)');

  const startAndSubmit = async (who, round, correct, wrong, label) => {
    const start = await call('POST', `/rounds/${round}/attempts/start`, { token: who.token });
    if (!rep.status(start, 200, `${label}: Round ${round} attempt starts`)) return null;
    const secs = (new Date(start.body.deadline_at) - new Date(start.body.started_at)) / 1000;
    rep.check(Math.abs(secs - ({ 1: 600, 2: 600, 3: 180 })[round]) <= 2, `${label}: R${round} duration matches competition_state`, `duration=${secs}s`);
    rep.check(Boolean(start.body.server_now), `${label}: R${round} start returns server_now`);
    const answers = kit.buildAnswers(bank[round], correct, wrong);
    const res = await call('POST', `/attempts/${start.body.id}/submit`, { token: who.token, body: { answers } });
    if (!rep.status(res, 200, `${label}: Round ${round} submit`)) return { start, res: null };
    const total = bank[round].length;
    rep.check(res.body.correct_count === correct, `${label}: R${round} correct_count === ${correct}`, `got ${res.body.correct_count}`);
    rep.check(res.body.incorrect_count === wrong, `${label}: R${round} incorrect_count === ${wrong}`, `got ${res.body.incorrect_count}`);
    rep.check(res.body.unanswered_count === total - correct - wrong, `${label}: R${round} unanswered_count === ${total - correct - wrong}`, `got ${res.body.unanswered_count}`);
    const want = kit.expectedScore(round, correct, wrong);
    rep.check(res.body.score === want, `${label}: R${round} score === ${want} (${round === 3 ? '+5/-2/0' : '+1/0/0'})`, `got ${res.body.score}`);
    rep.check(Array.isArray(res.body.review) && res.body.review.length === total, `${label}: R${round} review lists ${total} questions after submit`);
    return { start, res };
  };

  rep.section('Participant lifecycle - main (R1 6 right/4 wrong, R2 3/2, R3 2/1)');
  const r1 = await startAndSubmit(P, 1, 6, 4, 'main');
  if (r1?.res) {
    const again = await call('POST', `/attempts/${r1.start.body.id}/submit`, { token: P.token, body: { answers: kit.buildAnswers(bank[1], 50, 0) } });
    rep.check(again.status === 200 && again.body?.alreadySubmitted === true && again.body?.score === 6, 'Re-submit is idempotent and cannot change the score', kit.describe(again));
    const stored = (await db.query('SELECT COUNT(*)::int AS n FROM answers WHERE attempt_id=$1', [r1.start.body.id])).rows[0].n;
    rep.check(stored === 10, 'Only the 10 answered questions are stored for R1', `stored=${stored}`);
    const restart = await call('POST', '/rounds/1/attempts/start', { token: P.token });
    rep.check(restart.status === 200 && restart.body?.alreadySubmitted === true, 'Restarting a submitted round returns the stored result (no new attempt)', kit.describe(restart));
  }
  await startAndSubmit(P, 2, 3, 2, 'main');
  await startAndSubmit(P, 3, 2, 1, 'main');

  rep.section('Marking rules - wrong answers and no answers');
  await startAndSubmit(W, 1, 0, 3, 'wrong-only');   // R1: wrong = 0
  await startAndSubmit(W, 2, 0, 3, 'wrong-only');   // R2: wrong = 0
  await startAndSubmit(W, 3, 0, 3, 'wrong-only');   // R3: wrong = -2 each => -6
  await startAndSubmit(Q, 1, 0, 0, 'no-answers');
  await startAndSubmit(Q, 3, 0, 0, 'no-answers');   // R3: unanswered = 0

  rep.section('Authorization on attempts');
  if (r1?.start) {
    rep.status(await call('POST', `/attempts/${r1.start.body.id}/submit`, { token: Q.token, body: { answers: [] } }), 403, "Another participant cannot submit someone else's attempt");
  }
  rep.status(await call('POST', '/attempts/999999999/submit', { token: P.token, body: { answers: [] } }), 404, 'Submitting a non-existent attempt -> 404');

  rep.section('Proctor events & deadline enforcement');
  const dStart = await call('POST', '/rounds/1/attempts/start', { token: D.token });
  rep.status(dStart, 200, 'late-fixture: R1 attempt starts');
  for (const [i, type] of ['proctor.tab_switch', 'proctor.tab_switch', 'proctor.autosubmit_violation'].entries()) {
    rep.status(await call('POST', '/participants/proctor-event', { token: D.token, body: { eventType: type, details: { roundId: 1, warningCount: i + 1 } } }), 200, `Proctor event ${i + 1} recorded`);
  }
  const ev = (await db.query("SELECT COUNT(*)::int AS n FROM audit_events WHERE actor_type='participant' AND actor_id=$1 AND event_type LIKE 'proctor.%'", [D.id])).rows[0].n;
  rep.check(ev === 3, 'Exactly 3 proctor audit events stored for the fixture', `stored=${ev}`);
  if (dStart.body?.id) {
    // Expire OUR attempt (id returned to our own fixture participant) well past the 45s grace window.
    const upd = await db.query("UPDATE attempts SET deadline_at = NOW() - INTERVAL '10 minutes' WHERE id=$1 AND participant_id=$2", [dStart.body.id, D.id]);
    rep.check(upd.rowCount === 1, 'Fixture attempt deadline moved into the past (owned row only)');
    const late = await call('POST', `/attempts/${dStart.body.id}/submit`, { token: D.token, body: { answers: kit.buildAnswers(bank[1], 5, 0) } });
    rep.status(late, 409, 'Submission after deadline + 45s grace is rejected (409)');
    const left = (await db.query('SELECT COUNT(*)::int AS n FROM answers WHERE attempt_id=$1', [dStart.body.id])).rows[0].n;
    rep.check(left === 0, 'Rejected late submission stored no answers');
  }

  rep.section('Leaderboard');
  const lb = await call('GET', '/leaderboard');
  rep.status(lb, 200, 'GET /leaderboard returns 200');
  const rows = Array.isArray(lb.body) ? lb.body : [];
  const find = (who) => rows.find((r) => String(r.roll_number).toUpperCase() === who.rollNumber);
  const mainRow = find(P);
  if (rep.check(Boolean(mainRow), 'Main fixture appears on the leaderboard', `rows=${rows.length}`)) {
    rep.check(Number(mainRow.round1_score) === 6 && Number(mainRow.round2_score) === 3 && Number(mainRow.round3_score) === 8, 'Leaderboard per-round scores are 6 / 3 / 8',
      `${mainRow.round1_score}/${mainRow.round2_score}/${mainRow.round3_score}`);
    rep.check(Number(mainRow.total_score) === 17, 'Leaderboard total_score === 17', `got ${mainRow.total_score}`);
  }
  const wrongRow = find(W);
  if (wrongRow) rep.check(Number(wrongRow.total_score) === -6, 'Wrong-only fixture total === -6 (0 + 0 - 6)', `got ${wrongRow.total_score}`);
  else rep.skip('Wrong-only leaderboard row', `Not within the leaderboard's 500-row window (rows=${rows.length}).`);

  rep.section('Round locks & pause');
  await setState({ status: 'PAUSED', registrationOpen: true, roundStates: allActive });
  rep.status(await call('POST', '/rounds/1/attempts/start', { token: L.token }), 423, 'PAUSED competition blocks starting an attempt (423)');
  await setState({ status: 'LIVE', registrationOpen: true, roundStates: { 1: 'locked', 2: 'locked', 3: 'locked' } });
  rep.status(await call('POST', '/rounds/1/attempts/start', { token: L.token }), 423, 'Locked round blocks starting an attempt (423)');
  rep.status(await call('GET', '/rounds/3/questions'), 423, 'Locked round hides its questions (423)');
  await setState({ status: 'LIVE', registrationOpen: false, roundStates: allActive });
  const closed = await tracker.register('CLOSED');
  rep.status(closed.res, 409, 'Closed registration rejects new participants (409)');

  /* Admin-authenticated checks need explicitly supplied test credentials. */
  rep.section('Admin-authenticated checks');
  const creds = kit.requireAdminCredsOrNull();
  if (!creds) {
    rep.skip('Admin login, /auth/admin/me, admin participant monitor, overview stats',
      'BB_TEST_ADMIN_USERNAME and BB_TEST_ADMIN_PASSWORD were not provided. Create/choose an admin in the DISPOSABLE database and pass its credentials via the environment.');
    return;
  }
  await setState({ status: 'LIVE', registrationOpen: true, roundStates: allActive });
  const login = await call('POST', '/auth/admin/login', { body: { identifier: creds.username, password: creds.password } });
  if (!rep.status(login, 200, 'Admin login with supplied test credentials')) return;
  const admin = login.body.token;
  rep.status(await call('GET', '/auth/admin/me', { token: admin }), 200, 'GET /auth/admin/me with bearer token');
  rep.status(await call('GET', '/auth/admin/me', { token: P.token }), 403, 'Participant token is rejected on admin routes (403)');
  rep.status(await call('GET', '/participants/me', { token: admin }), 403, 'Admin token is rejected on participant routes (403)');
  const list = await call('GET', '/admin/participants', { token: admin });
  rep.status(list, 200, 'GET /admin/participants');
  const mine = (Array.isArray(list.body) ? list.body : []).find((r) => r.rollNumber === P.rollNumber);
  if (rep.check(Boolean(mine), 'Admin monitor lists the main fixture')) {
    rep.check(mine.rounds?.[1]?.score === 6 && mine.rounds?.[2]?.score === 3 && mine.rounds?.[3]?.score === 8, 'Admin monitor per-round scores are 6 / 3 / 8',
      JSON.stringify([mine.rounds?.[1]?.score, mine.rounds?.[2]?.score, mine.rounds?.[3]?.score]));
    rep.check(mine.totalScore === 17, 'Admin monitor totalScore === 17', `got ${mine.totalScore}`);
  }
  const flagged = (Array.isArray(list.body) ? list.body : []).find((r) => r.rollNumber === D.rollNumber);
  rep.check(flagged?.statusType === 'flagged-focus' && /3 VIOLATIONS/.test(flagged?.statusLabel || ''), 'Admin monitor flags the fixture with 3 proctor violations', flagged?.statusLabel);
  const stats = await call('GET', '/admin/overview-stats', { token: admin });
  rep.status(stats, 200, 'GET /admin/overview-stats');
  rep.check(typeof stats.body?.totalParticipants === 'number', 'overview-stats totalParticipants is numeric', JSON.stringify(stats.body?.totalParticipants));
  rep.info('Admin audit rows (admin.login) written to the disposable DB are left in place: their ownership cannot be proven.');
  // Deliberately NOT called: /admin/reset-all, /admin/rounds/:id/reset, /admin/competition/state PATCH, qualification endpoints.
}

/* ------------------------------------------------------------------ main -- */

try {
  if (process.env.BB_TEST_DATABASE_URL) {
    await kit.withDisposableEnvironment(rep, 'Write-capable lifecycle & admin integration tests', runIntegration);
  } else {
    await kit.withReadOnlyEnvironment(rep, 'Read-only database & API checks', runReadOnly);
    rep.skip('Write-capable lifecycle & admin integration tests', kit.getWriteGate().reason);
  }
} catch (error) {
  rep.fail('Audit aborted by an unexpected error', error?.message || String(error));
}
process.exitCode = rep.finish();
