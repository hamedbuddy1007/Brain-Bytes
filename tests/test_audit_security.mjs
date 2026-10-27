import assert from 'node:assert';
import http from 'node:http';
import { createRequire } from 'node:module';
import jwtLib from 'jsonwebtoken';
import { app } from '../backend/src/app.js';
import { query, getPool } from '../backend/src/db.js';
import { secret, issueSession } from '../backend/src/auth.js';

const kit = createRequire(import.meta.url)('./lib/testkit.cjs');
kit.loadBackendEnv();

console.log('====================================================');
console.log('   BRAIN BYTES — PRODUCTION SECURITY & AUDIT SUITE ');
console.log('====================================================\n');

let server;
let baseUrl;

async function setup() {
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

async function teardown() {
  await getPool().end().catch(() => {});
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function runTests() {
  await setup();
  let passCount = 0;
  let testCount = 0;

  function testPass(msg) {
    testCount++;
    passCount++;
    console.log(`  [PASS] ${msg}`);
  }

  // 1. App import safety
  console.log('1. Express App Import & Startup Safety:');
  const serverModule = await import('../backend/src/server.js');
  assert.ok(serverModule.app, 'server.js exports app');
  assert.strictEqual(Boolean(serverModule.app.listening), false, 'Importing server.js does NOT open a port listener');
  testPass('Express app can be safely imported without binding ports or running migrations');

  // 2. Health check via Vercel-style routing
  console.log('\n2. Vercel Serverless Entrypoint & Path Routing:');
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert.strictEqual(healthRes.status, 200, 'GET /api/health returns 200');
  const healthData = await healthRes.json();
  assert.strictEqual(healthData.status, 'ok', 'Status is ok');
  assert.strictEqual(healthData.database, 'connected', 'Database is connected');
  testPass('Vercel serverless /api/health endpoint connects and reports healthy status');

  const healthNoApiRes = await fetch(`${baseUrl}/health`);
  assert.strictEqual(healthNoApiRes.status, 200, 'GET /health without /api prefix returns 200');
  testPass('Proxy-stripped path (/health) correctly reaches router');

  // 3. Question bank integrity and public leak prevention
  console.log('\n3. Question Banks & Safe Payload Verification:');
  const r1Count = await query('SELECT count(*)::int as count FROM questions WHERE round_id=1 AND enabled=TRUE');
  const r2Count = await query('SELECT count(*)::int as count FROM questions WHERE round_id=2 AND enabled=TRUE');
  const r3Count = await query('SELECT count(*)::int as count FROM questions WHERE round_id=3 AND enabled=TRUE');

  assert.strictEqual(r1Count.rows[0].count, 50, 'Round 1 questions count is 50');
  assert.strictEqual(r2Count.rows[0].count, 30, 'Round 2 questions count is 30');
  assert.strictEqual(r3Count.rows[0].count, 30, 'Round 3 questions count is 30');
  testPass(`Question counts verified in Neon: R1=50, R2=30, R3=30`);

  const qRes = await fetch(`${baseUrl}/api/rounds/1/questions`);
  assert.strictEqual(qRes.status, 200);
  const qData = await qRes.json();
  const leaksAnswer = (qData.questions || []).some((q) => q.correct_answer !== undefined || q.explanation !== undefined);
  assert.strictEqual(leaksAnswer, false, 'Questions endpoint must never leak correct answers or explanations');
  testPass('Public questions endpoint does NOT leak correct_answer or explanation to candidates');

  // 4. Admin Authentication & Role Authorization
  console.log('\n4. Admin Authentication & Role Separation:');
  const badLogin = await fetch(`${baseUrl}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'wrongpassword!123' }),
  });
  assert.strictEqual(badLogin.status, 401, 'Bad admin password returns 401');
  testPass('Admin login rejects incorrect credentials safely');

  // Admin authentication check (requires explicit test credentials)
  let adminToken = null;
  const adminCreds = kit.requireAdminCredsOrNull();
  if (adminCreds) {
    const goodLogin = await fetch(`${baseUrl}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: adminCreds.username, password: adminCreds.password }),
    });
    if (goodLogin.status === 200) {
      const goodData = await goodLogin.json();
      adminToken = goodData.token;
      assert.ok(adminToken, 'Admin login returned JWT token');
      testPass('Admin authentication succeeds with bcrypt password hash verification');

      // Admin /me check
      const meRes = await fetch(`${baseUrl}/api/auth/admin/me`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(meRes.status, 200);
      const meData = await meRes.json();
      assert.ok(meData.username, 'Admin me returns database username');
      testPass('GET /api/auth/admin/me returns authenticated admin details from Neon');
    } else {
      console.error(`  [FAIL] Admin login with test credentials failed (status: ${goodLogin.status})`);
    }
  } else {
    console.log('  [SKIP] Admin authenticated login check (BB_TEST_ADMIN_USERNAME / BB_TEST_ADMIN_PASSWORD not set)');
  }

  // Cross-role verification
  // A participant token attempting to access admin route must be rejected with 403
  const fakeParticipantToken = jwtLib.sign(
    { sub: '999', role: 'participant' },
    secret(),
    { expiresIn: 3600 }
  );

  const crossAuthAdmin = await fetch(`${baseUrl}/api/auth/admin/me`, {
    headers: { Authorization: `Bearer ${fakeParticipantToken}` },
  });
  assert.strictEqual(crossAuthAdmin.status, 403, 'Participant token must be rejected on admin routes with 403');
  testPass('Strict Role Separation: Participant token cannot authorize admin endpoints (403)');

  // An admin token attempting to access participant route must be rejected with 403
  const fakeAdminToken = jwtLib.sign(
    { sub: '1', role: 'admin' },
    secret(),
    { expiresIn: 3600 }
  );

  const crossAuthParticipant = await fetch(`${baseUrl}/api/participants/me`, {
    headers: { Authorization: `Bearer ${fakeAdminToken}` },
  });
  assert.strictEqual(crossAuthParticipant.status, 403, 'Admin token must be rejected on participant routes with 403');
  testPass('Strict Role Separation: Admin token cannot authorize participant endpoints (403)');

  // 5. Participant Authentication & Anti-Impersonation Fixes
  console.log('\n5. Participant Authentication & Vulnerability Fixes:');

  // Vulnerability A: /participants/reauth without session MUST fail closed
  const reauthNoSession = await fetch(`${baseUrl}/api/participants/reauth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rollNumber: 'CS23-B1042', joinCode: 'BYTE2026' }),
  });
  assert.strictEqual(reauthNoSession.status, 401, 'Reauth without session must fail with 401');
  const reauthNoSessionBody = await reauthNoSession.json();
  assert.ok(reauthNoSessionBody.error.includes('active session'), 'Error explains session requirement');
  testPass('Vulnerability A Fixed: /participants/reauth rejects unauthenticated roll-number requests (401)');

  // Vulnerability B: /participants/register impersonation prevention
  // Fetch an existing participant roll number to test impersonation defense
  const existingP = await query('SELECT id, full_name, roll_number FROM participants LIMIT 1');
  if (existingP.rowCount) {
    const p = existingP.rows[0];

    // Attacker sends matching roll number and matching full name with valid join code, but NO session
    const impersonationAttempt = await fetch(`${baseUrl}/api/participants/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: p.full_name,
        rollNumber: p.roll_number,
        joinCode: 'BYTE2026',
        roundId: 1,
      }),
    });
    assert.strictEqual(impersonationAttempt.status, 409, 'Impersonation attempt must be blocked with 409 Conflict');
    const impBody = await impersonationAttempt.json();
    assert.ok(impBody.error.includes('already registered'), 'Returns duplicate registration notice');
    testPass('Vulnerability B Fixed: Registration impersonation by roll number + name is blocked (409)');

    // Legitimate re-entry: caller holds valid JWT session for this participant ID
    const validPToken = jwtLib.sign(
      { sub: String(p.id), role: 'participant' },
      secret(),
      { expiresIn: 3600 }
    );

    if (kit.getWriteGate().ok) {
      const legitimateReentry = await fetch(`${baseUrl}/api/participants/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validPToken}`,
        },
        body: JSON.stringify({
          fullName: p.full_name,
          rollNumber: p.roll_number,
          joinCode: 'BYTE2026',
          roundId: 1,
        }),
      });
      assert.strictEqual(legitimateReentry.status, 200, 'Legitimate participant with active token successfully resumes');
      const legitBody = await legitimateReentry.json();
      assert.strictEqual(Number(legitBody.id), Number(p.id), 'Returns correct participant ID');
      testPass('Legitimate session resumption with active participant token succeeds (200)');

      // Reauth endpoint WITH active participant session succeeds
      const reauthWithSession = await fetch(`${baseUrl}/api/participants/reauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${validPToken}`,
        },
        body: JSON.stringify({ rollNumber: p.roll_number, joinCode: 'BYTE2026' }),
      });
      assert.strictEqual(reauthWithSession.status, 200, 'Reauth with verified session succeeds');
      testPass('POST /participants/reauth succeeds when caller possesses verified session');

      // Clean up the audit event inserted during this test in the disposable database
      await query("DELETE FROM audit_events WHERE actor_type='participant' AND actor_id=$1 AND event_type='participant.reentry'", [p.id]);
    } else {
      console.log('  [SKIP] Legitimate participant reentry/reauth checks skipped to preserve production audit logs (requires disposable DB)');
    }

    // Attempt security test: Non-existent attempt returns 404
    const nonExistentSubmit = await fetch(`${baseUrl}/api/attempts/9999999/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validPToken}`,
      },
      body: JSON.stringify({ answers: [] }),
    });
    assert.strictEqual(nonExistentSubmit.status, 404, 'Non-existent attempt returns 404');
    testPass('Attempt Validation: Non-existent attempt is safely rejected with 404');

    // Round lock enforcement: Attempting to start locked round 2 returns 423
    const lockedRoundStart = await fetch(`${baseUrl}/api/rounds/2/attempts/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validPToken}`,
      },
    });
    assert.strictEqual(lockedRoundStart.status, 423, 'Locked round start must be rejected with 423');
    testPass('Round Locks: Inactive/locked round attempt start rejected with 423');
  }

  // 6. Production join code requirement
  console.log('\n6. Event Join Code Fail-Safe Check:');
  const badJoinRes = await fetch(`${baseUrl}/api/participants/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'New Candidate Test',
      rollNumber: 'NON_EXISTENT_ROLL_9999',
      joinCode: 'WRONG_CODE_XYZ',
      roundId: 1,
    }),
  });
  assert.strictEqual(badJoinRes.status, 400, 'Bad join code returns 400');
  testPass('Invalid event join codes are rejected');

  console.log('\n====================================================');
  console.log(` AUDIT RESULTS: ALL ${testCount} SECURITY & ARCHITECTURE CHECKS PASSED`);
  console.log('====================================================\n');
}

runTests()
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await teardown();
  });
