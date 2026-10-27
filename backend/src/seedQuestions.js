import 'dotenv/config';
import { ROUND_1_QUESTIONS } from './seedData/round1Questions.ts';
import { ROUND_2_QUESTIONS } from './seedData/round2Questions.ts';
import { ROUND_3_QUESTIONS } from './seedData/round3Questions.ts';

import { query, withTransaction } from './db.js';

const rounds = [
  { id: 1, questions: ROUND_1_QUESTIONS, correct: 1, wrong: 0 },
  { id: 2, questions: ROUND_2_QUESTIONS, correct: 1, wrong: 0 },
  { id: 3, questions: ROUND_3_QUESTIONS, correct: 5, wrong: -2 },
];

await withTransaction(async (client) => {
  for (const round of rounds) {
    for (const [index, question] of round.questions.entries()) {
      const options = question.options.map((option) => option.label);
      const explanation = question.explanation || null;
      const chartData = question.chartData ? JSON.stringify(question.chartData) : null;
      await client.query(
        `INSERT INTO questions(round_id,prompt,options,correct_answer,points_correct,points_wrong,sort_order,enabled,explanation,chart_data)
         VALUES($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9)
         ON CONFLICT(round_id,sort_order) DO UPDATE SET prompt=EXCLUDED.prompt, options=EXCLUDED.options,
         correct_answer=EXCLUDED.correct_answer, points_correct=EXCLUDED.points_correct,
         points_wrong=EXCLUDED.points_wrong, enabled=TRUE, explanation=EXCLUDED.explanation,
         chart_data=EXCLUDED.chart_data`,
        [round.id, question.prompt, JSON.stringify(options), question.correctAnswer, round.correct, round.wrong, index + 1, explanation, chartData],
      );
    }
  }
});
console.info('Question bank synced from the existing frontend question files.');
process.exit(0);
