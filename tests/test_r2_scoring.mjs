import { createRequire } from 'node:module';
import { query } from '../backend/src/db.js';

// SAFETY: registers a participant, submits attempts and DELETEs by id. Refuses to run unless a disposable database
// is confirmed (see tests/README.md). Runs before the first query; backend/src/db.js creates its pool lazily.
createRequire(import.meta.url)('./lib/testkit.cjs').requireDisposableOrExit('test_r2_scoring.mjs');

async function testR2Scoring() {
  const base = 'http://localhost:4000/api';
  const rollNumber = `TEST-R2-${Date.now()}`;
  const fullName = 'Round2 Automated Tester';
  const joinCode = 'BYTE2026';

  console.log(`Registering test participant ${rollNumber}...`);
  const regRes = await fetch(`${base}/participants/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName, rollNumber, joinCode }),
  });

  if (!regRes.ok) throw new Error(`Registration failed: ${regRes.status} ${await regRes.text()}`);
  const cookie = regRes.headers.get('set-cookie');
  const participant = await regRes.json();
  console.log(`Test participant registered with ID: ${participant.id}`);

  // Step 1: Start and submit Round 1 attempt (since backend requires R1 completed before R2)
  console.log('Starting Round 1 attempt...');
  const r1StartRes = await fetch(`${base}/rounds/1/attempts/start`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  if (!r1StartRes.ok) throw new Error(`R1 start failed: ${r1StartRes.status} ${await r1StartRes.text()}`);
  const r1Attempt = await r1StartRes.json();

  console.log('Submitting Round 1 attempt...');
  const r1SubRes = await fetch(`${base}/attempts/${r1Attempt.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ answers: [] }),
  });
  if (!r1SubRes.ok) throw new Error(`R1 submit failed: ${r1SubRes.status} ${await r1SubRes.text()}`);

  // Step 2: Start Round 2 attempt
  console.log('Starting Round 2 attempt...');
  const r2StartRes = await fetch(`${base}/rounds/2/attempts/start`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  if (!r2StartRes.ok) throw new Error(`R2 start failed: ${r2StartRes.status} ${await r2StartRes.text()}`);
  const r2Attempt = await r2StartRes.json();
  console.log(`Round 2 attempt started with ID: ${r2Attempt.id}`);

  // Step 3: Fetch Round 2 questions to prepare answer map
  const qRes = await query('SELECT id, sort_order, correct_answer FROM questions WHERE round_id=2 ORDER BY sort_order');
  const questions = qRes.rows;

  // Answer first 10 questions correctly, next 5 incorrectly, leave last 15 unanswered
  const answersToSubmit = [];
  for (let i = 0; i < 30; i++) {
    const q = questions[i];
    if (i < 10) {
      // Correct
      answersToSubmit.push({ questionId: Number(q.sort_order), selectedOption: q.correct_answer });
    } else if (i < 15) {
      // Incorrect (choose an option different from correct_answer)
      const wrong = (q.correct_answer + 1) % 4;
      answersToSubmit.push({ questionId: Number(q.sort_order), selectedOption: wrong });
    } else {
      // Unanswered
      answersToSubmit.push({ questionId: Number(q.sort_order), selectedOption: null });
    }
  }

  // Step 4: Submit Round 2 attempt
  console.log('Submitting Round 2 answers...');
  const r2SubRes = await fetch(`${base}/attempts/${r2Attempt.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ answers: answersToSubmit }),
  });
  if (!r2SubRes.ok) throw new Error(`R2 submit failed: ${r2SubRes.status} ${await r2SubRes.text()}`);
  const r2Result = await r2SubRes.json();
  console.log('Submission result:', r2Result);

  if (r2Result.score !== 10) throw new Error(`Score expected 10, got ${r2Result.score}`);
  if (r2Result.correct_count !== 10) throw new Error(`Correct count expected 10, got ${r2Result.correct_count}`);
  if (r2Result.incorrect_count !== 5) throw new Error(`Incorrect count expected 5, got ${r2Result.incorrect_count}`);
  if (r2Result.unanswered_count !== 15) throw new Error(`Unanswered count expected 15, got ${r2Result.unanswered_count}`);
  console.log('✓ Round 2 scoring verified (+1 per correct, 0 for incorrect, 0 for unanswered)');

  // Step 5: Duplicate submission test
  console.log('Testing duplicate submission...');
  const dupSubRes = await fetch(`${base}/attempts/${r2Attempt.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ answers: answersToSubmit }),
  });
  const dupResult = await dupSubRes.json();
  console.log('Duplicate submission response:', dupResult);
  if (!dupResult.alreadySubmitted) throw new Error('Duplicate submission protection failed!');
  if (dupResult.score !== 10) throw new Error('Score altered on duplicate submission!');
  console.log('✓ Duplicate submission protection verified: alreadySubmitted returned without altering score');

  // Step 6: Verify answers persisted in DB
  const ansCount = await query('SELECT count(*)::int as count FROM answers WHERE attempt_id=$1', [r2Attempt.id]);
  console.log(`Persisted answers count: ${ansCount.rows[0].count}`);
  if (ansCount.rows[0].count !== 15) throw new Error('Answers persistence count mismatch');
  console.log('✓ Answers persisted in Neon PostgreSQL');

  // Step 7: Clean up test participant records
  console.log('Cleaning up test participant records...');
  await query('DELETE FROM participants WHERE id=$1', [participant.id]);
  console.log('✓ Test participant cleaned up cleanly.');

  process.exit(0);
}

testR2Scoring().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
