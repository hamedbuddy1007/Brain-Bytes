/**
 * Static checks: NO database access and NO HTTP calls. Safe to run anywhere, any time.
 *
 * Run with:  npm run test:static
 * (uses the tsx loader that ships in backend/node_modules so the .ts question banks can be imported)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const kit = createRequire(import.meta.url)('./lib/testkit.cjs');
const rep = new kit.Reporter('BRAIN BYTES - STATIC CHECKS (no DB, no HTTP)');
const ROOT = kit.ROOT;
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

/* 1. Question banks: seed keys stay server-side; frontend question content is keyless. */
rep.section('Question bank separation and structure');
const banks = {};
for (const [label, dir] of [['seed', 'backend/src/seedData'], ['frontend', 'src/data']]) {
  for (const r of [1, 2, 3]) {
    await rep.step(`load ${label} round ${r}`, async () => {
      const mod = await load(`${dir}/round${r}Questions.ts`);
      banks[`${label}${r}`] = mod[`ROUND_${r}_QUESTIONS`];
    });
  }
}
for (const r of [1, 2, 3]) {
  const seed = banks[`seed${r}`] || [];
  const front = banks[`frontend${r}`] || [];
  rep.check(seed.length === kit.EXPECTED_COUNTS[r], `Seed data round ${r} has ${kit.EXPECTED_COUNTS[r]} questions`, `got ${seed.length}`);
  rep.check(front.length === kit.EXPECTED_COUNTS[r], `Frontend data round ${r} has ${kit.EXPECTED_COUNTS[r]} questions`, `got ${front.length}`);
  const brokenSeed = seed.filter((q) => !Array.isArray(q.options) || q.options.length < 2 || !Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer >= q.options.length);
  rep.check(brokenSeed.length === 0, `Seed round ${r}: official keys remain valid on server-side source`, `${brokenSeed.length} invalid`);
  const leaked = front.filter((q) => Object.hasOwn(q, 'correctAnswer') || Object.hasOwn(q, 'explanation'));
  rep.check(leaked.length === 0, `Frontend round ${r}: no correctAnswer or explanation fields`, `${leaked.length} leaked`);
  const sameContent = seed.length === front.length && seed.every((q, i) =>
    q.prompt === front[i]?.prompt &&
    JSON.stringify(q.options) === JSON.stringify(front[i]?.options)
  );
  rep.check(sameContent, `Seed round ${r} and frontend round ${r} agree on prompts and options`);
}
const routesText = fs.readFileSync(path.join(ROOT, 'backend/src/routes.js'), 'utf8');
rep.check(/router\.get\('\/admin\/question-bank',\s*requireAuth\('admin'\)/.test(routesText),
  'Official answer keys are exposed only by an admin-authenticated endpoint');
const publicQuestionsRoute = routesText.match(/router\.get\('\/rounds\/:roundId\/questions',[\s\S]*?\n\}\);/);
rep.check(Boolean(publicQuestionsRoute) && !/correct_answer|explanation/.test(publicQuestionsRoute?.[0] || ''),
  'Participant question endpoint does not select official answer keys');

/* 2. Marking rules the database is seeded with */
rep.section('Seeded marking rules (backend/src/seedQuestions.js, read as text)');
const seedText = fs.readFileSync(path.join(ROOT, 'backend/src/seedQuestions.js'), 'utf8');
for (const [round, correct, wrong] of [[1, 1, 0], [2, 1, 0], [3, 5, -2]]) {
  const re = new RegExp(`id:\\s*${round},[^}]*correct:\\s*${correct},\\s*wrong:\\s*${wrong}\\s*}`);
  rep.check(re.test(seedText), `Round ${round} is seeded as +${correct} correct / ${wrong} wrong (unanswered never scores)`);
}

/* 3. Client scoring service marking rules */
rep.section('Client scoring rules (tests/testMarkingRules.js)');
await rep.step('testMarkingRules', async () => {
  await import(pathToFileURL(path.join(here, 'testMarkingRules.js')).href);
  rep.pass('Scoring fixture assertions passed; production grading remains server-side');
});

/* 4. Lint the test scripts themselves for the hazards this audit was written to remove */
rep.section('Test-script safety lint');
const testFiles = fs.readdirSync(here).filter((f) => /\.(c|m)?js$/.test(f) && f !== 'static_checks.mjs');
const credLiteral = new RegExp(['pass', 'word', '123'].join(''), 'i');
const resetCall = /admin\/(reset-all|rounds\/[^'"`\s]*reset)/;
const writeOrServer = /localhost:4000|127\.0\.0\.1:4000|DELETE FROM|INSERT INTO|UPDATE\s+\w+\s+SET|\bPOST\b|\bPATCH\b|\bPUT\b/;
const guarded = /testkit|requireDisposableOrExit/;
for (const f of testFiles) {
  const code = fs.readFileSync(path.join(here, f), 'utf8').split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const full = fs.readFileSync(path.join(here, f), 'utf8');
  rep.check(!credLiteral.test(code), `${f}: no hardcoded default admin password`);
  rep.check(!resetCall.test(code), `${f}: does not call reset endpoints`);
  const risky = writeOrServer.test(code) || /backend\/src\/db\.js/.test(code);
  const isReadOnlyMarked = /@bb-readonly/.test(full) && !/\bPOST\b|\bPATCH\b|\bPUT\b|\bDELETE\b|INSERT INTO|UPDATE\s+\w+\s+SET/.test(code);
  rep.check(!risky || guarded.test(code) || isReadOnlyMarked, `${f}: write/server/DB access is behind the fail-closed gate (or is marked read-only)`);
}

process.exitCode = rep.finish();
