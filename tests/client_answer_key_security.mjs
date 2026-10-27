import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const round of [1, 2, 3]) {
  const source = fs.readFileSync(path.join(root, `src/data/round${round}Questions.ts`), 'utf8');
  assert.doesNotMatch(source, /^\s*correctAnswer\s*:/m, `Round ${round} client data contains an answer key`);
  assert.doesNotMatch(source, /^\s*explanation\s*:/m, `Round ${round} client data contains answer explanations`);
}
const routes = fs.readFileSync(path.join(root, 'backend/src/routes.js'), 'utf8');
assert.match(routes, /router\.get\('\/admin\/question-bank',\s*requireAuth\('admin'\)/,
  'Official answer key endpoint must require admin authentication');
const participantRoute = routes.match(/router\.get\('\/rounds\/:roundId\/questions',[\s\S]*?\n\}\);/);
assert.ok(participantRoute, 'Participant question route not found');
assert.doesNotMatch(participantRoute[0], /correct_answer|explanation/,
  'Participant endpoint must not select official answer keys or explanations');
console.log('PASS: frontend question banks are keyless; answer-key endpoint is admin-only.');
