const path = require('path');
require(path.join(__dirname, '../backend/node_modules/dotenv')).config({ path: path.join(__dirname, '../backend/.env') });
// SAFETY: registers a participant and runs UPDATE attempts ... in SQL. Refuses to run unless a disposable database
// is confirmed; on success DATABASE_URL is re-pointed at that database before any query (see tests/README.md).
require('./lib/testkit.cjs').requireDisposableOrExit('test_timeout.cjs');
const http = require('http');

function apiCall(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('http://localhost:4000/api' + endpoint);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };
    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), cookie: setCookie });
        } catch {
          resolve({ status: res.statusCode, body: data, cookie: setCookie });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

async function run() {
  const { query } = await import('../backend/src/db.js');
  const reg = await apiCall('/participants/register', {
    method: 'POST',
    body: {
      fullName: 'Timeout Test Candidate',
      rollNumber: 'TIMEOUT_TEST_04',
      collegeName: 'Test College',
      joinCode: 'BYTE2026'
    }
  });
  console.log('Registered candidate status:', reg.status);
  const cookie = reg.cookie ? reg.cookie[0].split(';')[0] : '';
  const headers = cookie ? { Cookie: cookie } : {};

  const start = await apiCall('/rounds/1/attempts/start', { method: 'POST', headers });
  console.log('Attempt Started ID:', start.body.id);
  const attemptId = start.body.id;

  console.log('Setting deadline to 30 seconds in the past...');
  await query("UPDATE attempts SET deadline_at = NOW() - INTERVAL '30 seconds' WHERE id = $1", [attemptId]);

  console.log('Attempting auto-submit after timeout...');
  const res = await apiCall(`/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers,
    body: {
      answers: [
        { questionId: 1, selectedOption: 0 }
      ]
    }
  });
  console.log('Status after timeout submit:', res.status);
  console.log('Response body:', res.body);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
