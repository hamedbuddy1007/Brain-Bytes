require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
// SAFETY: registers a participant and runs UPDATE attempts ... in SQL. Refuses to run unless a disposable database
// is confirmed; on success DATABASE_URL is re-pointed at that database before any query (see tests/README.md).
require('./lib/testkit.cjs').requireDisposableOrExit('test_timeout_autosubmit.cjs');
const http = require('http');
const { query } = require('../backend/src/db.js');

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
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed, cookie: setCookie });
        } catch {
          resolve({ status: res.statusCode, body: data, cookie: setCookie });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function testAutoSubmit() {
  console.log('--- Registering Candidate for Timeout Test ---');
  const reg = await apiCall('/participants/register', {
    method: 'POST',
    body: {
      fullName: 'Timeout Test Candidate',
      rollNumber: 'TIMEOUT_TEST_02',
      collegeName: 'Test College',
      joinCode: 'BYTE2026'
    }
  });
  console.log('Registered:', reg.status, reg.body.rollNumber);
  const cookie = reg.cookie ? reg.cookie[0].split(';')[0] : '';
  const headers = cookie ? { Cookie: cookie } : {};

  console.log('--- Starting Attempt ---');
  const start = await apiCall('/rounds/1/attempts/start', {
    method: 'POST',
    headers
  });
  console.log('Attempt Started:', start.status, 'ID:', start.body.id);
  const attemptId = start.body.id;

  console.log('--- Setting attempt deadline to 30 seconds ago (simulating expired timer) ---');
  await query("UPDATE attempts SET deadline_at = NOW() - INTERVAL '30 seconds' WHERE id = $1", [attemptId]);

  console.log('--- Calling submit (simulating client auto-submit after timeout) ---');
  const timeoutSubmit = await apiCall(`/attempts/${attemptId}/submit`, {
    method: 'POST',
    headers,
    body: {
      answers: [
        { questionId: 1, selectedOption: 0 },
        { questionId: 2, selectedOption: 2 }
      ]
    }
  });

  console.log('Timeout Submit Status:', timeoutSubmit.status);
  console.log('Timeout Submit Response:', timeoutSubmit.body);

  process.exit(0);
}

testAutoSubmit().catch(err => {
  console.error(err);
  process.exit(1);
});
