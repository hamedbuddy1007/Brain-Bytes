'use strict';
/**
 * Brain Bytes - "brutal" audit (fail-closed rewrite).
 *
 * Fixes vs. the original:
 *  - No hardcoded admin credentials (BB_TEST_ADMIN_USERNAME / BB_TEST_ADMIN_PASSWORD, or the section is skipped).
 *  - Never targets localhost:4000 and never touches the database in backend/.env with writes. Write-capable
 *    sections run only against a confirmed disposable database (BB_TEST_DATABASE_URL + BB_TEST_CONFIRM_DISPOSABLE).
 *  - Fixture cleanup is tracked per row (the old LIKE 'BRUTAL_%' / 'DIRECT_%' sweep never matched the EXP_TEST_
 *    participant, so it leaked it, and it matched anything else with those prefixes). Only participants created
 *    by this run (HTTP 201 + run-unique roll number) are deleted, with their attempts, answers and audit events.
 *  - Real error/status is shown for every failure; exit code is non-zero on failure; skips are never "passes".
 *  - The dist/ leak scan now understands minified output (the old `correctAnswer: 2` pattern, with a space,
 *    could never match a minified bundle).
 *
 * Static sections (bundle scan, mock-data sweep) need no database or HTTP and always run.
 */
const fs = require('node:fs');
const path = require('node:path');
const kit = require('./lib/testkit.cjs');

const env = kit.loadBackendEnv(); // explicit, before any pool; values never printed
const rep = new kit.Reporter('BRAIN BYTES - BRUTAL AUDIT');
rep.info(env.loaded ? `backend/.env loaded explicitly (${env.keys} keys, values never printed).` : `backend/.env not loaded: ${env.reason}.`);

/* ------------------------------------------------------------- static ---- */

function sectionBundle() {
  rep.section('SECTION A: Production bundle (static, no DB/HTTP)');
  const scan = kit.scanBundle();
  if (!scan.exists) { rep.skip('dist/ bundle scan', 'dist/assets not found. Run `npm run build` first.'); return; }
  rep.check(scan.files.length > 0, 'dist/assets contains JavaScript files', `found ${scan.files.length}`);
  for (const f of scan.files) {
    rep.info(`${f.name}: ${(f.bytes / 1024).toFixed(0)} KB`);
    rep.check(f.answerKeyLiterals === 0,
      `${f.name} ships no answer keys (correctAnswer:<n> literals)`,
      `${f.answerKeyLiterals} answer-key literals and ${f.explanationLiterals} explanation strings are readable by any browser`);
  }
}

function sectionMockSweep() {
  rep.section('SECTION B: Mock / dummy data sweep (static)');
  const srcDir = path.join(kit.ROOT, 'src');
  const patterns = [/A\.\s*Sharma/i, /Priya\s*Patel/i, /TODO:\s*replace\s*with\s*real/i, /CRC-9F40EA12/i, /MOCK_PARTICIPANTS/i];
  const hits = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name)) {
        const text = fs.readFileSync(full, 'utf8');
        for (const p of patterns) if (p.test(text)) hits.push(`${path.relative(srcDir, full)} [${p}]`);
      }
    }
  };
  walk(srcDir);
  rep.check(hits.length === 0, 'No mock participant markers remain in src/', hits.join('; '));
}

/* ------------------------------------------------------- read-only tier -- */

async function readOnlyTier({ db }) {
  rep.section('SECTION 1 (read-only): schema & question bank');
  await kit.runQuestionBankChecks(rep, db);
  const state = (await db.query('SELECT COUNT(*)::int AS n FROM competition_state WHERE singleton=TRUE')).rows[0].n;
  rep.check(state === 1, 'competition_state has a valid singleton record', `rows=${state}`);
  rep.skip('Sections 3-9 (admin auth, registration, progression, timer, proctor, scoring, deadline)',
    'They write rows; they only run against a confirmed disposable database.');
}

/* ------------------------------------------------- disposable DB tier ---- */

async function integrationTier({ db, call, tracker, setState }) {
  const bank = {};
  for (const r of [1, 2, 3]) bank[r] = await kit.loadQuestionRows(db, r);
  const round1Only = { 1: 'active', 2: 'locked', 3: 'locked' };
  await setState({ status: 'LIVE', registrationOpen: true, roundStates: round1Only });

  rep.section('SECTION 1: schema & question bank');
  await kit.runQuestionBankChecks(rep, db);

  rep.section('SECTION 3: admin authentication & restricted access');
  rep.status(await call('GET', '/admin/overview-stats'), 401, 'Unauthenticated /admin/overview-stats -> 401');
  rep.status(await call('POST', '/auth/admin/login', { body: { identifier: `no-such-admin-${Date.now()}`, password: 'wrong-password' } }), 401, 'Admin login with bad credentials -> 401');
  const creds = kit.requireAdminCredsOrNull();
  let admin = null;
  if (!creds) {
    rep.skip('Admin login / overview-stats / monitor checks', 'BB_TEST_ADMIN_USERNAME and BB_TEST_ADMIN_PASSWORD not provided (no default credentials are ever used).');
  } else {
    const login = await call('POST', '/auth/admin/login', { body: { identifier: creds.username, password: creds.password } });
    if (rep.status(login, 200, 'Admin login with supplied test credentials -> 200')) admin = login.body.token;
    if (admin) {
      const stats = await call('GET', '/admin/overview-stats', { token: admin });
      rep.status(stats, 200, 'Authenticated admin can fetch overview-stats');
      rep.check(typeof stats.body?.totalParticipants === 'number', 'overview-stats totalParticipants is numeric', String(stats.body?.totalParticipants));
    }
  }

  rep.section('SECTION 4: participant registration & bounds');
  rep.status(await call('POST', '/participants/register', { body: { fullName: '', rollNumber: '', collegeName: '', joinCode: '' } }), 400, 'Empty registration -> 400');
  const bad = await tracker.register('BADJOIN', { body: { joinCode: 'INVALID_CODE_999' } });
  rep.status(bad.res, 400, 'Invalid join code -> 400');
  const A = await tracker.register('BRUTAL');
  rep.status(A.res, 201, 'Valid registration -> 201');
  const seat = parseInt(String(A.res.body?.assignedSeat || '').replace(/\D/g, ''), 10);
  rep.check(seat >= 1 && seat <= 120, 'Assigned station is within 1..120', `seat=${A.res.body?.assignedSeat}`);
  rep.status(await call('POST', '/participants/register', { body: { fullName: 'BBT Audit Fixture', rollNumber: A.rollNumber, joinCode: tracker.joinCode } }),
    409, 'Duplicate registration without a session -> 409 (anti-impersonation)');
  const resumed = await call('POST', '/participants/register', { token: A.token, body: { fullName: 'BBT Audit Fixture', rollNumber: A.rollNumber, joinCode: tracker.joinCode } });
  rep.check(resumed.status === 200 && resumed.body?.rollNumber === A.rollNumber, 'Duplicate registration WITH its own session resumes (200)', kit.describe(resumed));

  rep.section('SECTION 5: round progression (server enforces admin round locks)');
  rep.status(await call('POST', '/rounds/2/attempts/start', { token: A.token }), 423, 'Starting locked Round 2 -> 423');
  rep.status(await call('POST', '/rounds/3/attempts/start', { token: A.token }), 423, 'Starting locked Round 3 -> 423');
  const direct = await tracker.register('DIRECT', { body: { roundId: 2 } });
  rep.status(direct.res, 403, 'New participant registering directly into Round 2 -> 403');
  rep.info('Note: the server gates R2/R3 starts only by the admin round lock; it does not verify R1 qualification when a round is unlocked.');

  rep.section('SECTION 6: attempt start & timer');
  const start = await call('POST', '/rounds/1/attempts/start', { token: A.token });
  rep.status(start, 200, 'Round 1 attempt starts');
  const attemptId = start.body?.id;
  rep.check(Boolean(attemptId), 'Server returned an attempt id', kit.describe(start));
  if (attemptId) {
    const secs = (new Date(start.body.deadline_at) - new Date(start.body.started_at)) / 1000;
    rep.check(Math.abs(secs - 600) <= 2, 'Round 1 duration is 600s (competition_state default)', `duration=${secs}s`);
    rep.check(Boolean(start.body.server_now), 'Server returned server_now for countdown alignment');
  }

  rep.section('SECTION 7: proctor events');
  for (const [i, type] of ['proctor.tab_switch', 'proctor.tab_switch', 'proctor.autosubmit_violation'].entries()) {
    rep.status(await call('POST', '/participants/proctor-event', { token: A.token, body: { eventType: type, details: { roundId: 1, warningCount: i + 1 } } }), 200, `Proctor violation ${i + 1} recorded`);
  }
  const n = (await db.query("SELECT COUNT(*)::int AS n FROM audit_events WHERE actor_type='participant' AND actor_id=$1 AND event_type LIKE 'proctor.%'", [A.id])).rows[0].n;
  rep.check(n === 3, 'Three proctor audit events stored for the fixture', `stored=${n}`);
  if (admin) {
    const list = await call('GET', '/admin/participants', { token: admin });
    const row = (Array.isArray(list.body) ? list.body : []).find((p) => p.rollNumber === A.rollNumber);
    rep.check(Boolean(row), 'Fixture appears in the admin participant monitor', kit.describe(list));
    rep.check(row?.statusType === 'flagged-focus' && /3 VIOLATIONS/.test(row?.statusLabel || ''), 'Admin monitor flags the 3rd violation', `statusLabel=${row?.statusLabel}`);
    const ov = await call('GET', '/admin/overview-stats', { token: admin });
    rep.check((ov.body?.recentLogs || []).some((l) => /PROCTOR (DISQUALIFICATION|ALERT)/.test(l.message || '')), 'Admin activity feed shows proctor entries');
  }

  rep.section('SECTION 8: submission & scoring');
  if (attemptId) {
    const answers = kit.buildAnswers(bank[1], 3, 2); // 3 right, 2 wrong, 45 unanswered
    const sub = await call('POST', `/attempts/${attemptId}/submit`, { token: A.token, body: { answers } });
    rep.status(sub, 200, 'Final submission succeeds');
    rep.check(sub.body?.correct_count === 3 && sub.body?.incorrect_count === 2 && sub.body?.unanswered_count === 45, 'R1 counts are 3 correct / 2 wrong / 45 unanswered',
      `${sub.body?.correct_count}/${sub.body?.incorrect_count}/${sub.body?.unanswered_count}`);
    rep.check(sub.body?.score === kit.expectedScore(1, 3, 2), 'R1 score === 3 (+1 per correct, 0 wrong, 0 unanswered)', `got ${sub.body?.score}`);
    rep.check(Array.isArray(sub.body?.review), 'Review data is returned only after submit');
    const dup = await call('POST', `/attempts/${attemptId}/submit`, { token: A.token, body: { answers } });
    rep.check(dup.body?.score === 3 && dup.body?.alreadySubmitted === true, 'Re-submit is idempotent and does not change the score', kit.describe(dup));
  }
  // Round 3 marking rule on a disposable fixture (unlock R3 in the disposable DB only).
  await setState({ status: 'LIVE', registrationOpen: true, roundStates: { 1: 'active', 2: 'active', 3: 'active' } });
  const R3 = await tracker.register('R3RULE');
  const r3s = await call('POST', '/rounds/3/attempts/start', { token: R3.token });
  if (rep.status(r3s, 200, 'Round 3 attempt starts (disposable DB)')) {
    const sub = await call('POST', `/attempts/${r3s.body.id}/submit`, { token: R3.token, body: { answers: kit.buildAnswers(bank[3], 4, 2) } });
    rep.check(sub.status === 200 && sub.body?.score === kit.expectedScore(3, 4, 2) && sub.body?.unanswered_count === 24,
      'R3 score === 16 for 4 right / 2 wrong / 24 unanswered (+5 / -2 / 0)', `status=${sub.status} score=${sub.body?.score} unanswered=${sub.body?.unanswered_count}`);
  }

  rep.section('SECTION 9: deadline expiration & 45s grace');
  const E = await tracker.register('EXPIRED');
  const es = await call('POST', '/rounds/1/attempts/start', { token: E.token });
  if (rep.status(es, 200, 'Expired-fixture attempt starts through the API')) {
    const upd = await db.query("UPDATE attempts SET deadline_at = NOW() - INTERVAL '20 minutes' WHERE id=$1 AND participant_id=$2", [es.body.id, E.id]);
    rep.check(upd.rowCount === 1, 'Fixture attempt deadline moved into the past (owned row only)');
    rep.status(await call('POST', `/attempts/${es.body.id}/submit`, { token: E.token, body: { answers: kit.buildAnswers(bank[1], 1, 0) } }), 409, 'Submission past deadline + 45s grace -> 409');
  }
}

/* ------------------------------------------------------------------ main -- */

(async () => {
  try {
    sectionBundle();
    sectionMockSweep();
    if (process.env.BB_TEST_DATABASE_URL) {
      await kit.withDisposableEnvironment(rep, 'Database / API sections (disposable database)', integrationTier);
    } else {
      await kit.withReadOnlyEnvironment(rep, 'Database sections (read-only)', readOnlyTier);
      rep.skip('Write-capable sections (admin auth, registration, scoring, deadline)', kit.getWriteGate().reason);
    }
  } catch (error) {
    rep.fail('Audit aborted by an unexpected error', error?.message || String(error));
  }
  process.exitCode = rep.finish();
})();
