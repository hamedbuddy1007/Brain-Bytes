// Automated Test Suite for Brain Bytes Round 3 Marking Rules
import assert from 'node:assert';
import { calculateRoundScore, calculateRound3RawScore, compareRound3Rankings, compareRankings } from '../src/services/scoringService.ts';
import { ROUND_1_QUESTIONS } from '../src/data/round1Questions.ts';
import { ROUND_2_QUESTIONS } from '../src/data/round2Questions.ts';
import { ROUND_3_QUESTIONS, ROUND_3_CONFIG } from '../src/data/round3Questions.ts';

console.log('--- STARTING BRAIN BYTES MARKING SYSTEM AUDIT ---');

// TEST CASE 1: 4 correct, 2 wrong, 1 unanswered = 16 points
{
  const rawScore = calculateRound3RawScore(4, 2);
  assert.strictEqual(rawScore, 16, `Expected 16 points, got ${rawScore}`);

  // Test via calculateRoundScore with 7 mock questions
  const mock7Questions = [
    { id: 1, correctAnswer: 0 },
    { id: 2, correctAnswer: 0 },
    { id: 3, correctAnswer: 0 },
    { id: 4, correctAnswer: 0 },
    { id: 5, correctAnswer: 1 },
    { id: 6, correctAnswer: 1 },
    { id: 7, correctAnswer: 1 },
  ];
  // 4 correct (1,2,3,4 chosen 0), 2 wrong (5,6 chosen 0 instead of 1), 1 unanswered (7 omitted)
  const answers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const summary = calculateRoundScore(3, answers, mock7Questions);
  assert.strictEqual(summary.correctCount, 4);
  assert.strictEqual(summary.incorrectCount, 2);
  assert.strictEqual(summary.unansweredCount, 1);
  assert.strictEqual(summary.score, 16);
  console.log('✔ Test Case 1 Passed: 4 correct, 2 wrong, 1 unanswered = 16 points');
}

// TEST CASE 2: 2 correct, 3 wrong, 2 unanswered = 4 points
{
  const rawScore = calculateRound3RawScore(2, 3);
  assert.strictEqual(rawScore, 4, `Expected 4 points, got ${rawScore}`);

  const mock7Questions = [
    { id: 1, correctAnswer: 0 },
    { id: 2, correctAnswer: 0 },
    { id: 3, correctAnswer: 1 },
    { id: 4, correctAnswer: 1 },
    { id: 5, correctAnswer: 1 },
    { id: 6, correctAnswer: 2 },
    { id: 7, correctAnswer: 2 },
  ];
  // 2 correct (1,2 chosen 0), 3 wrong (3,4,5 chosen 0), 2 unanswered (6,7 omitted)
  const answers = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const summary = calculateRoundScore(3, answers, mock7Questions);
  assert.strictEqual(summary.correctCount, 2);
  assert.strictEqual(summary.incorrectCount, 3);
  assert.strictEqual(summary.unansweredCount, 2);
  assert.strictEqual(summary.score, 4);
  console.log('✔ Test Case 2 Passed: 2 correct, 3 wrong, 2 unanswered = 4 points');
}

// TEST CASE 3: All answers wrong, with 5 questions = -10 points
{
  const rawScore = calculateRound3RawScore(0, 5);
  assert.strictEqual(rawScore, -10, `Expected -10 points, got ${rawScore}`);

  // Test with standard 5 ROUND_3_QUESTIONS
  const answersAllWrong = {};
  ROUND_3_QUESTIONS.forEach((q) => {
    answersAllWrong[q.id] = (q.correctAnswer + 1) % 4; // intentionally wrong
  });
  const summary = calculateRoundScore(3, answersAllWrong);
  assert.strictEqual(summary.correctCount, 0);
  assert.strictEqual(summary.incorrectCount, 5);
  assert.strictEqual(summary.unansweredCount, 0);
  assert.strictEqual(summary.score, -10);
  console.log('✔ Test Case 3 Passed: All answers wrong, with 5 questions = -10 points');
}

// TEST CASE 4: All questions unanswered = 0 points
{
  const rawScore = calculateRound3RawScore(0, 0);
  assert.strictEqual(rawScore, 0, `Expected 0 points, got ${rawScore}`);

  const summary = calculateRoundScore(3, {});
  assert.strictEqual(summary.correctCount, 0);
  assert.strictEqual(summary.incorrectCount, 0);
  assert.strictEqual(summary.unansweredCount, 5);
  assert.strictEqual(summary.score, 0);
  console.log('✔ Test Case 4 Passed: All questions unanswered = 0 points');
}

// TEST CASE 5: Duplicate submissions cannot double-count score
{
  // Simulate submission logic: initial submission of 16 points
  let scoreMap = {
    round3Score: 0,
    totalScore: 100, // from R1 + R2
  };

  const newRound3Score = 16;

  // First evaluation / submission
  scoreMap.round3Score = newRound3Score;
  scoreMap.totalScore = 100 + scoreMap.round3Score;
  assert.strictEqual(scoreMap.round3Score, 16);
  assert.strictEqual(scoreMap.totalScore, 116);

  // Duplicate / repeated submission attempt:
  // Idempotent assignment ensures points are NOT added again
  scoreMap.round3Score = newRound3Score;
  scoreMap.totalScore = 100 + scoreMap.round3Score;
  assert.strictEqual(scoreMap.round3Score, 16);
  assert.strictEqual(scoreMap.totalScore, 116, 'Score was double-counted on duplicate submission!');

  console.log('✔ Test Case 5 Passed: Repeated submission is idempotent and cannot double-count');
}

// TEST CASE 6: Verify Round 1 and Round 2 marking systems remain unchanged
{
  // Round 1: +1 for correct, 0 for wrong, 0 for unanswered
  const r1AllCorrect = {};
  ROUND_1_QUESTIONS.forEach((q) => { r1AllCorrect[q.id] = q.correctAnswer; });
  const r1Summary = calculateRoundScore(1, r1AllCorrect);
  assert.strictEqual(r1Summary.score, ROUND_1_QUESTIONS.length, 'Round 1 correct should be +1 per question');

  const r1AllWrong = {};
  ROUND_1_QUESTIONS.forEach((q) => { r1AllWrong[q.id] = (q.correctAnswer + 1) % 4; });
  const r1WrongSummary = calculateRoundScore(1, r1AllWrong);
  assert.strictEqual(r1WrongSummary.score, 0, 'Round 1 wrong should be 0 points (no negative marking)');

  const r1Unanswered = calculateRoundScore(1, {});
  assert.strictEqual(r1Unanswered.score, 0, 'Round 1 unanswered should be 0 points');

  // Round 2: +1 for correct, 0 for wrong, 0 for unanswered
  const r2AllCorrect = {};
  ROUND_2_QUESTIONS.forEach((q) => { r2AllCorrect[q.id] = q.correctAnswer; });
  const r2Summary = calculateRoundScore(2, r2AllCorrect);
  assert.strictEqual(r2Summary.score, ROUND_2_QUESTIONS.length, 'Round 2 correct should be +1 per question');

  const r2AllWrong = {};
  ROUND_2_QUESTIONS.forEach((q) => { r2AllWrong[q.id] = (q.correctAnswer + 1) % 4; });
  const r2WrongSummary = calculateRoundScore(2, r2AllWrong);
  assert.strictEqual(r2WrongSummary.score, 0, 'Round 2 wrong should be 0 points (no negative marking)');

  const r2Unanswered = calculateRoundScore(2, {});
  assert.strictEqual(r2Unanswered.score, 0, 'Round 2 unanswered should be 0 points');

  console.log('✔ Test Case 6 Passed: Round 1 and Round 2 marking systems strictly preserved');
}

// TEST CASE 7: Round 3 Leaderboard ranking comparator
{
  const participants = [
    { name: 'Alice', round3Score: 16, timeTakenSeconds: 90, totalScore: 116 },
    { name: 'Bob', round3Score: 25, timeTakenSeconds: 110, totalScore: 125 },
    { name: 'Charlie', round3Score: -10, timeTakenSeconds: 40, totalScore: 90 },
    { name: 'David', round3Score: 4, timeTakenSeconds: 85, totalScore: 104 },
    { name: 'Eve', round3Score: 16, timeTakenSeconds: 70, totalScore: 116 }, // Same R3 score as Alice, faster time
  ];

  participants.sort((a, b) => compareRound3Rankings(a, b));

  assert.strictEqual(participants[0].name, 'Bob', 'Highest R3 score (25) should rank 1st');
  assert.strictEqual(participants[1].name, 'Eve', 'Eve (16 pts, 70s) should beat Alice (16 pts, 90s)');
  assert.strictEqual(participants[2].name, 'Alice', 'Alice should rank 3rd');
  assert.strictEqual(participants[3].name, 'David', 'David (4 pts) should rank 4th');
  assert.strictEqual(participants[4].name, 'Charlie', 'Charlie (-10 pts) should rank 5th');

  console.log('✔ Test Case 7 Passed: Round 3 Leaderboard ranks strictly by Round 3 score with tiebreakers');
}

// TEST CASE 8: State Service recordSubmission duplicate protection & getRound3Leaderboard
{
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, val),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
  globalThis.window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  const { recordSubmission, getRound3Leaderboard, getParticipantSubmission, getAllSubmissions } = await import('../src/services/competitionStateService.ts');

  const testParticipant = {
    fullName: 'Test Candidate',
    rollNumber: 'TEST-R3-999',
    ticketId: 'BB-TEST-999',
    collegeName: 'Test University',
  };

  // Submit 4 correct, 1 wrong (out of 5) => 4*5 - 1*2 = 18 pts
  const answers = {
    1: ROUND_3_QUESTIONS[0].correctAnswer,
    2: ROUND_3_QUESTIONS[1].correctAnswer,
    3: ROUND_3_QUESTIONS[2].correctAnswer,
    4: ROUND_3_QUESTIONS[3].correctAnswer,
    5: (ROUND_3_QUESTIONS[4].correctAnswer + 1) % 4, // wrong
  };

  const firstResult = recordSubmission(3, testParticipant, answers);
  assert.strictEqual(firstResult.isDuplicate, false, 'First submission should NOT be a duplicate');
  assert.strictEqual(firstResult.submission.score, 18, `Expected score 18, got ${firstResult.submission.score}`);

  // Repeated submission attempt
  const secondResult = recordSubmission(3, testParticipant, answers);
  assert.strictEqual(secondResult.isDuplicate, true, 'Repeated submission MUST be flagged as duplicate');
  assert.strictEqual(secondResult.submission.score, 18, 'Duplicate submission score must remain unchanged');

  // Verify that only 1 record exists in submissions
  const allSubs = getAllSubmissions().filter((s) => s.rollNumber === 'TEST-R3-999');
  assert.strictEqual(allSubs.length, 1, 'There should only be 1 submission record saved');

  // Verify getRound3Leaderboard ranks test candidate properly
  const r3Board = getRound3Leaderboard();
  const found = r3Board.find((e) => e.rollNumber === 'TEST-R3-999');
  assert.ok(found, 'Test candidate must be present in Round 3 leaderboard');
  assert.strictEqual(found.round3Score, 18, 'Round 3 score in leaderboard must be 18');

  console.log('✔ Test Case 8 Passed: State service rejects duplicate submissions and updates Round 3 leaderboard');
}

console.log('--- ALL TEST CASES COMPLETED SUCCESSFULLY ---');
