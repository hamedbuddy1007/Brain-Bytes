// SAFETY: registers a participant, starts and submits attempts on whatever server answers on localhost:4000.
// Refuses to run unless a disposable database is confirmed (see tests/README.md).
const http = require('http');
require('./lib/testkit.cjs').requireDisposableOrExit('test_e2e_flow.cjs');

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

// Deterministic shuffle logic to verify
function getLCG(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function stringToSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

function shuffleForParticipant(items, seedStr) {
  const arr = [...items];
  const rng = getLCG(stringToSeed(seedStr));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

async function run() {
  console.log('--- 1. Testing Question Shuffling ---');
  const dummyQuestions = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
  const orderA1 = shuffleForParticipant(dummyQuestions, '22CS001').map(q => q.id);
  const orderA2 = shuffleForParticipant(dummyQuestions, '22CS001').map(q => q.id);
  const orderB = shuffleForParticipant(dummyQuestions, '22CS002').map(q => q.id);

  console.log('Order A1 == Order A2 (Deterministic check):', JSON.stringify(orderA1) === JSON.stringify(orderA2) ? 'PASS' : 'FAIL');
  console.log('Order A1 != Order B (Anti-cheating shuffle check):', JSON.stringify(orderA1) !== JSON.stringify(orderB) ? 'PASS' : 'FAIL');
  console.log('Order A1 first 5:', orderA1.slice(0, 5));
  console.log('Order B first 5: ', orderB.slice(0, 5));

  console.log('\n--- 2. Testing Station Assignment (120 stations max) ---');
  const reg1 = await apiCall('/participants/register', {
    method: 'POST',
    body: {
      fullName: 'Test Candidate One',
      rollNumber: 'TEST_ROLL_102',
      collegeName: 'Test College',
      joinCode: 'BYTE2026'
    }
  });
  console.log('Register candidate status:', reg1.status);
  const assignedSeat = reg1.body.assignedSeat;
  console.log('Assigned seat candidate:', assignedSeat);
  const seatNum = parseInt(assignedSeat?.replace(/[^0-9]/g, '') || '0', 10);
  console.log(`Seat within 1..120 range: ${seatNum >= 1 && seatNum <= 120 ? 'PASS' : 'FAIL'} (${seatNum})`);

  const cookie = reg1.cookie ? reg1.cookie[0].split(';')[0] : '';
  const headers = cookie ? { Cookie: cookie } : {};

  console.log('\n--- 3. Testing Attempt Start ---');
  const startRes = await apiCall('/rounds/1/attempts/start', {
    method: 'POST',
    headers
  });
  console.log('Start attempt status:', startRes.status);
  console.log('Attempt ID:', startRes.body.id);
  console.log('Deadline AT:', startRes.body.deadline_at);
  console.log('Server NOW:', startRes.body.server_now);

  console.log('\n--- 4. Testing Attempt Submission & Review Payload ---');
  const submitRes = await apiCall(`/attempts/${startRes.body.id}/submit`, {
    method: 'POST',
    headers,
    body: {
      answers: [
        { questionId: 1, selectedOption: 0 },
        { questionId: 2, selectedOption: 1 }
      ]
    }
  });
  console.log('Submit status:', submitRes.status);
  console.log('Score:', submitRes.body.score);
  console.log('Correct Count:', submitRes.body.correct_count);
  console.log('Has Review array:', Array.isArray(submitRes.body.review) ? 'PASS' : 'FAIL');
  if (Array.isArray(submitRes.body.review) && submitRes.body.review.length > 0) {
    const r0 = submitRes.body.review[0];
    console.log('Sample review item:', {
      id: r0.id,
      correct_answer: r0.correct_answer,
      explanation: r0.explanation?.slice(0, 40) + '...'
    });
  }

  console.log('\n--- 5. Testing Attempt Reload / Start after Submit ---');
  const reloadRes = await apiCall('/rounds/1/attempts/start', {
    method: 'POST',
    headers
  });
  console.log('Reload attempt status:', reloadRes.status);
  console.log('Submitted at:', reloadRes.body.submitted_at);
  console.log('Score retained:', reloadRes.body.score);
  console.log('Has Review on reload:', Array.isArray(reloadRes.body.review) ? 'PASS' : 'FAIL');
  console.log('Has Answers on reload:', (reloadRes.body.answers && typeof reloadRes.body.answers === 'object') ? 'PASS' : 'FAIL');

  console.log('\n--- ALL CHECKS COMPLETE ---');
}

run().catch(console.error);
