// SAFETY: writes participants/attempts and PATCHes competition state on whatever server answers on localhost:4000.
// It now refuses to run unless a disposable database is confirmed (tests/README.md) and uses no default credentials.
const http = require('http');
const kit = require('./lib/testkit.cjs');
kit.loadBackendEnv();
kit.requireDisposableOrExit('test_round_progression_rules.cjs');
const adminCreds = kit.requireAdminCredsOrNull();
if (!adminCreds) {
  console.error('[REFUSED] test_round_progression_rules.cjs: set BB_TEST_ADMIN_USERNAME and BB_TEST_ADMIN_PASSWORD (an admin in the DISPOSABLE database).');
  process.exit(2);
}

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: body ? JSON.parse(body) : null, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

(async () => {
  try {
    const candidateRoll = 'LEGIT-' + Date.now();
    const strangerRoll = 'STRANGER-' + Date.now();

    console.log('--- 1. Testing Rule: New Participant Direct Entry to Round 2 BLOCKED ---');
    const directR2 = await request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/participants/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      fullName: 'Stranger Competitor',
      rollNumber: strangerRoll,
      joinCode: 'BYTE2026',
      roundId: 2,
    });
    console.log('Direct Round 2 status:', directR2.status, directR2.body?.error);
    if (directR2.status !== 403) throw new Error(`Expected 403 Forbidden for new R2 entry, got ${directR2.status}`);

    console.log('\n--- 2. Testing Rule: Valid Registration for Round 1 ALLOWED ---');
    const r1Reg = await request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/participants/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      fullName: 'Legitimate Candidate',
      rollNumber: candidateRoll,
      joinCode: 'BYTE2026',
      roundId: 1,
    });
    console.log('Round 1 registration status:', r1Reg.status, r1Reg.body?.fullName);
    if (r1Reg.status !== 201 && r1Reg.status !== 200) throw new Error(`Registration failed: ${r1Reg.status}`);
    const cookie = r1Reg.headers['set-cookie']?.[0]?.split(';')[0];

    console.log('\n--- 3. Testing Rule: Existing Participant in R2 WITHOUT Round 1 Attempt BLOCKED ---');
    const r2BeforeAppeared = await request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/participants/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    }, {
      fullName: 'Legitimate Candidate',
      rollNumber: candidateRoll,
      joinCode: 'BYTE2026',
      roundId: 2,
    });
    console.log('R2 entry before R1 attempt status:', r2BeforeAppeared.status, r2BeforeAppeared.body?.error);
    if (r2BeforeAppeared.status !== 403) throw new Error(`Expected 403 Forbidden before R1 attempt, got ${r2BeforeAppeared.status}`);

    console.log('\n--- 4. Testing Rule: Starting and Submitting Round 1 Attempt ---');
    const startR1 = await request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/rounds/1/attempts/start',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    });
    console.log('Start R1 status:', startR1.status, 'Attempt ID:', startR1.body?.id);
    if (startR1.status !== 200) throw new Error(`Start R1 failed: ${startR1.status}`);

    const submitR1 = await request({
      hostname: 'localhost',
      port: 4000,
      path: `/api/attempts/${startR1.body.id}/submit`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    }, {
      answers: [{ questionId: 1, selectedOption: 0 }],
    });
    console.log('Submit R1 status:', submitR1.status, 'Score:', submitR1.body?.score);

    console.log('\n--- 5. Testing Rule: Existing Candidate who Appeared in R1 Entering Round 2 ALLOWED ---');
    const r2AfterAppeared = await request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/participants/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    }, {
      fullName: 'Legitimate Candidate',
      rollNumber: candidateRoll,
      joinCode: 'BYTE2026',
      roundId: 2,
    });
    console.log('R2 entry after R1 appeared status:', r2AfterAppeared.status, 'Participant ID:', r2AfterAppeared.body?.id);
    if (r2AfterAppeared.status !== 200) throw new Error(`Expected 200 OK after appearing in R1, got ${r2AfterAppeared.status}`);

    console.log('\n--- 6. Testing Rule: Starting Round 2 Attempt ALLOWED once Host Unlocks R2 ---');
    // Admin unlocks Round 2
    const loginAdmin = await request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/auth/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { identifier: adminCreds.username, password: adminCreds.password });
    if (loginAdmin.status !== 200) throw new Error(`Admin login failed with status ${loginAdmin.status}: ${loginAdmin.body?.error ?? ''}`);
    const adminCookie = loginAdmin.headers['set-cookie']?.[0]?.split(';')[0];

    await request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/admin/competition/state',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
    }, { roundStates: { '1': 'completed', '2': 'active', '3': 'locked' } });

    const startR2 = await request({
      hostname: 'localhost',
      port: 4000,
      path: '/api/rounds/2/attempts/start',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    });
    console.log('Start R2 status:', startR2.status, 'Attempt ID:', startR2.body?.id);
    if (startR2.status !== 200) throw new Error(`Start R2 failed: ${startR2.status}`);

    console.log('\n✅ ALL ROUND PROGRESSION & ANTI-NEW-ENTRY CHECKS PASSED PERFECTLY!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Check failed:', err);
    process.exit(1);
  }
})();
