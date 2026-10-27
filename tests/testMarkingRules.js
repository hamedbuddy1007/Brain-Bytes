// Security-safe scoring tests: official answer keys are supplied only as isolated test fixtures.
import assert from 'node:assert/strict';
import {
  calculateRoundScore,
  calculateRound3RawScore,
  compareRound3Rankings,
  compareRankings,
} from '../src/services/scoringService.ts';

const r3 = [
  { id: 1, correctAnswer: 0 },
  { id: 2, correctAnswer: 1 },
  { id: 3, correctAnswer: 2 },
  { id: 4, correctAnswer: 3 },
  { id: 5, correctAnswer: 1 },
  { id: 6, correctAnswer: 0 },
  { id: 7, correctAnswer: 2 },
];
assert.equal(calculateRound3RawScore(4, 2), 16);
const r3Summary = calculateRoundScore(3, {1:0, 2:1, 3:2, 4:3, 5:0, 6:1}, r3);
assert.equal(r3Summary.correctCount, 4);
assert.equal(r3Summary.incorrectCount, 2);
assert.equal(r3Summary.unansweredCount, 1);
assert.equal(r3Summary.score, 16);

const allWrong = calculateRoundScore(3, {1:1,2:2,3:3,4:0,5:2,6:1,7:3}, r3);
assert.equal(allWrong.correctCount, 0);
assert.equal(allWrong.incorrectCount, 7);
assert.equal(allWrong.score, -14);

const r1 = [{id:1, correctAnswer:0}, {id:2, correctAnswer:1}, {id:3, correctAnswer:2}];
assert.equal(calculateRoundScore(1, {1:0,2:0}, r1).score, 1);
assert.equal(calculateRoundScore(1, {}, r1).score, 0);
const r2 = [{id:1, correctAnswer:0}, {id:2, correctAnswer:1}];
assert.equal(calculateRoundScore(2, {1:1,2:1}, r2).score, 1);

const rankings = [
  {name:'Alice', round3Score:16, timeTakenSeconds:90, totalScore:116},
  {name:'Bob', round3Score:25, timeTakenSeconds:110, totalScore:125},
  {name:'Eve', round3Score:16, timeTakenSeconds:70, totalScore:116},
];
rankings.sort(compareRound3Rankings);
assert.deepEqual(rankings.map(x => x.name), ['Bob','Eve','Alice']);
assert.ok(compareRankings({totalScore:10,name:'A'}, {totalScore:9,name:'B'}) < 0);

// Participant-side fallback must not be able to infer scores from a keyless question bank.
const keyless = calculateRoundScore(3, {1:0, 2:1}, [{id:1}, {id:2}]);
assert.equal(keyless.score, 0);
assert.equal(keyless.correctCount, 0);

console.log('PASS: server-key scoring rules, unanswered handling, ranking, and keyless client fallback');
