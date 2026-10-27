// @bb-readonly  GET-only smoke test against an already-running API (default http://localhost:4000/api).
// It issues no writes. It needs Round 2 to be unlocked on the target server; a locked round returns 423.
const apiBase = process.env.BB_TEST_API_BASE || 'http://localhost:4000/api';
async function testApi() {
  const base = apiBase;

  console.log('Testing GET /rounds/2/questions...');
  const res = await fetch(`${base}/rounds/2/questions`);
  if (!res.ok) {
    console.error('Failed to fetch questions:', res.status, await res.text());
    process.exit(1);
  }
  const data = await res.json();
  console.log(`Received ${data.questions.length} questions for Round ${data.roundId}`);
  if (data.questions.length !== 30) {
    throw new Error(`Expected 30 questions, got ${data.questions.length}`);
  }

  // Check no leaks of correct_answer or explanation
  for (const q of data.questions) {
    if ('correct_answer' in q || 'correctAnswer' in q) {
      throw new Error(`SECURITY LEAK: correct_answer exposed on Q${q.sort_order}`);
    }
    if ('explanation' in q) {
      throw new Error(`SECURITY LEAK: explanation exposed on Q${q.sort_order}`);
    }
    if (!q.options || q.options.length !== 4) {
      throw new Error(`Invalid options on Q${q.sort_order}`);
    }
    if (!q.chart_data || !q.chart_data.title) {
      throw new Error(`Missing chart_data on Q${q.sort_order}`);
    }
  }
  console.log('✓ All 30 questions verified: NO correct_answer or explanation leaked; options and chart_data present!');

  process.exit(0);
}

testApi().catch((err) => {
  console.error(err);
  process.exit(1);
});
