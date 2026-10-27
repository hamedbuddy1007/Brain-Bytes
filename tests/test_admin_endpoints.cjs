// Admin endpoint smoke test.
//
// SAFETY: this script used to call POST /admin/rounds/3/reset (which deletes every Round 3 attempt) and fell back
// to a hardcoded admin password. Both are gone. It now:
//   - refuses to run unless a disposable database is confirmed AND you confirm the already-running API server
//     it calls is attached to that database (see tests/README.md and tests/lib/testkit.cjs),
//   - needs BB_TEST_ADMIN_USERNAME / BB_TEST_ADMIN_PASSWORD (no defaults),
//   - never calls any reset endpoint, and exits non-zero when a check fails.
// Preferred alternative: `npm run test:audit:integration` (starts its own in-process API).
const path = require('path');
const kit = require('./lib/testkit.cjs');
kit.loadBackendEnv();
kit.requireDisposableOrExit('test_admin_endpoints.cjs');

const creds = kit.requireAdminCredsOrNull();
if (!creds) {
  console.error('[REFUSED] test_admin_endpoints.cjs: set BB_TEST_ADMIN_USERNAME and BB_TEST_ADMIN_PASSWORD (an admin in the DISPOSABLE database). No default credentials are used.');
  process.exit(2);
}

const base = process.env.BB_TEST_API_BASE || 'http://localhost:4000/api';
const call = kit.makeCaller(base);
const rep = new kit.Reporter(`Admin endpoint smoke test (${path.basename(__filename)})`);

(async () => {
  try {
    rep.section('1. Admin login');
    const login = await call('POST', '/auth/admin/login', { body: { identifier: creds.username, password: creds.password } });
    if (!rep.status(login, 200, 'Admin login with supplied test credentials')) return;
    const token = login.body.token;

    rep.section('2. /admin/overview-stats');
    const stats = await call('GET', '/admin/overview-stats', { token });
    rep.status(stats, 200, 'GET /admin/overview-stats');
    rep.check(typeof stats.body?.totalParticipants === 'number', 'totalParticipants is numeric', String(stats.body?.totalParticipants));
    rep.check(Array.isArray(stats.body?.recentLogs), 'recentLogs is an array');
    rep.info('Round reset endpoints are intentionally NOT exercised.');
  } catch (error) {
    rep.fail('Unexpected error', error?.message || String(error));
  } finally {
    process.exitCode = rep.finish();
  }
})();
