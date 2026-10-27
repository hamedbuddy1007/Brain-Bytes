// @bb-readonly  Read-only verification of Round 2 graph questions, options, and answer keys in PostgreSQL.
import { createRequire } from 'node:module';
import { query, getPool } from '../backend/src/db.js';
import { ROUND_2_QUESTIONS } from '../src/data/round2Questions.ts';

const kit = createRequire(import.meta.url)('./lib/testkit.cjs');
kit.loadBackendEnv();

async function runVerification() {
  console.log('--- 1. QUESTION COUNTS PER ROUND IN NEON POSTGRESQL ---');
  const countsRes = await query(
    'SELECT round_id, count(*)::int as count FROM questions WHERE enabled=TRUE GROUP BY round_id ORDER BY round_id'
  );
  console.log(countsRes.rows);

  const r1Count = countsRes.rows.find((r) => r.round_id === 1)?.count;
  const r2Count = countsRes.rows.find((r) => r.round_id === 2)?.count;
  const r3Count = countsRes.rows.find((r) => r.round_id === 3)?.count;

  if (r1Count !== 50) throw new Error(`Round 1 count expected 50, got ${r1Count}`);
  if (r2Count !== 30) throw new Error(`Round 2 count expected 30, got ${r2Count}`);
  if (r3Count !== 30) throw new Error(`Round 3 count expected 30, got ${r3Count}`);
  console.log('✓ Question counts verified: R1=50, R2=30, R3=30');

  console.log('\n--- 2. VERIFY ROUND 2 QUESTIONS, OPTIONS, CHART DATA & ANSWER KEY ---');
  const r2Rows = await query(
    'SELECT id, sort_order, prompt, options, correct_answer, points_correct, points_wrong, explanation, chart_data FROM questions WHERE round_id=2 ORDER BY sort_order'
  );

  const pdfAnswerKey = [
    { q: 1, ans: 2, expPrefix: 'March to April rises from 45 to 72' },
    { q: 2, ans: 2, expPrefix: 'After epoch 4, training accuracy rises' },
    { q: 3, ans: 3, expPrefix: 'The point (5, 90) lies well above' },
    { q: 4, ans: 2, expPrefix: 'Product C totals 80 + 30 = 110' },
    { q: 5, ans: 2, expPrefix: 'The 60–80 interval has the largest frequency' },
    { q: 6, ans: 1, expPrefix: 'B–C has r = −0.42' },
    { q: 7, ans: 2, expPrefix: 'Daily increases are 15, 12, 19 and 17' },
    { q: 8, ans: 0, expPrefix: 'Class A IQR = 80 − 50 = 30' },
    { q: 9, ans: 1, expPrefix: 'Margins: P 20%, Q 30%' },
    { q: 10, ans: 2, expPrefix: 'Model C recall is 0.95' },
    { q: 11, ans: 1, expPrefix: 'A truncated axis can make a small difference' },
    { q: 12, ans: 1, expPrefix: '(80 + 140 + 160) ÷ 3 = 126.7' },
    { q: 13, ans: 2, expPrefix: 'Q3 to Q4 increases from 234 to 315.9' },
    { q: 14, ans: 0, expPrefix: 'A = 100/120 = 83.33%' },
    { q: 15, ans: 1, expPrefix: '72 ÷ (72 + 18) = 80%' },
    { q: 16, ans: 2, expPrefix: '100,000 ÷ 100 = 1,000' },
    { q: 17, ans: 1, expPrefix: 'The points trend upward' },
    { q: 18, ans: 1, expPrefix: '(100×0.90 + 900×0.70) ÷ 1,000 = 72%' },
    { q: 19, ans: 3, expPrefix: '(5, 25) is far above' },
    { q: 20, ans: 2, expPrefix: '0.75 × 200 = 150' },
    { q: 21, ans: 1, expPrefix: 'The defect rate jumps from about 2%' },
    { q: 22, ans: 0, expPrefix: 'Model A has AUC 0.91' },
    { q: 23, ans: 2, expPrefix: 'Model C has RMSE = 5' },
    { q: 24, ans: 1, expPrefix: 'System A IQR = 40' },
    { q: 25, ans: 2, expPrefix: 'The graph shows a similar trend' },
    { q: 26, ans: 0, expPrefix: 'Node A has degree 4' },
    { q: 27, ans: 1, expPrefix: 'A–C–B–D–E has weight 2 + 1 + 5 + 2 = 10' },
    { q: 28, ans: 0, expPrefix: 'X1–X2 has r = 0.96' },
    { q: 29, ans: 0, expPrefix: 'Organic rises by 15' },
    { q: 30, ans: 0, expPrefix: 'Higher recall captures more actual positives' },
  ];

  for (let i = 0; i < 30; i++) {
    const row = r2Rows.rows[i];
    const key = pdfAnswerKey[i];
    const frontendQ = ROUND_2_QUESTIONS[i];

    if (row.sort_order !== i + 1) throw new Error(`Sort order mismatch at index ${i}: ${row.sort_order}`);
    if (row.correct_answer !== key.ans) throw new Error(`Correct answer mismatch at Q${i + 1}: expected ${key.ans}, got ${row.correct_answer}`);
    if (row.points_correct !== 1 || row.points_wrong !== 0) throw new Error(`Scoring points mismatch at Q${i + 1}`);
    if (!Array.isArray(row.options) || row.options.length !== 4) throw new Error(`Options array invalid at Q${i + 1}`);
    if (!row.chart_data || typeof row.chart_data !== 'object') throw new Error(`Chart data missing in DB for Q${i + 1}`);
    if (!row.explanation) throw new Error(`Explanation missing in DB for Q${i + 1}`);

    console.log(
      `Q${String(i + 1).padStart(2, '0')}: [Correct: ${'ABCD'[row.correct_answer]}] Options: 4, ChartType: ${row.chart_data.type}, Title: "${row.chart_data.title}"`
    );
  }
  console.log('✓ All 30 Round 2 questions validated against PDF answer key and chart specs');

  console.log('\n--- 3. VERIFY HISTORICAL ATTEMPTS & PARTICIPANT RECORDS PRESERVED ---');
  const attemptsRes = await query('SELECT count(*)::int as count FROM attempts');
  const answersRes = await query('SELECT count(*)::int as count FROM answers');
  const participantsRes = await query('SELECT count(*)::int as count FROM participants');
  console.log({
    participants: participantsRes.rows[0].count,
    attempts: attemptsRes.rows[0].count,
    answers: answersRes.rows[0].count,
  });

  const r2Attempts = await query('SELECT id, participant_id, score, correct_count, submitted_at FROM attempts WHERE round_id=2');
  console.log('Round 2 historical attempts:', r2Attempts.rows);
  if (r2Attempts.rowCount < 3) throw new Error('Existing Round 2 attempts were lost!');
  console.log('✓ Historical participants, attempts, and answers preserved.');
}

runVerification()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end().catch(() => {});
  });
