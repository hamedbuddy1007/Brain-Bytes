'use strict';
/**
 * Shared, fail-closed safety toolkit for the Brain Bytes audit scripts.
 *
 * Design rules (see tests/README.md):
 *  - Nothing in here ever prints DATABASE_URL, passwords, tokens or secrets.
 *  - Write-capable tests only run against a database that the operator has
 *    explicitly named (BB_TEST_DATABASE_URL) AND confirmed by typing its
 *    host/database (BB_TEST_CONFIRM_DISPOSABLE). The word "neon" or "localhost"
 *    in a URL is never treated as evidence of safety.
 *  - Write-capable tests never talk to a pre-existing server (e.g. :4000). They
 *    start the Express app in-process, bound to 127.0.0.1 on a random port, so
 *    the database the app writes to is exactly the one that was confirmed.
 *  - Cleanup only removes rows whose ownership is proven (created by this run,
 *    HTTP 201 on registration, with a run-unique roll number).
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_DIR = path.join(ROOT, 'backend');
const BACKEND_ENV_PATH = path.join(BACKEND_DIR, '.env');
const STARTUP_DATABASE_URL = process.env.DATABASE_URL;
let testDatabaseApplied = false;
// backend/src/db.js caches ONE pool per process. Once a process has bound to the configured
// (read-only) database it must never be switched to a disposable one, and vice versa.
let dbMode = null; // null | 'readonly' | 'disposable'

/* ------------------------------------------------------------------ env -- */

function parseEnvText(text) {
  for (const base of [path.join(ROOT, 'node_modules'), path.join(BACKEND_DIR, 'node_modules')]) {
    try {
      const dotenv = require(path.join(base, 'dotenv'));
      if (typeof dotenv.parse === 'function') return dotenv.parse(text);
    } catch { /* try next */ }
  }
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    out[m[1]] = v;
  }
  return out;
}

/** Explicitly loads backend/.env. Existing process env values win. Never logs values. */
function loadBackendEnv() {
  if (!fs.existsSync(BACKEND_ENV_PATH)) return { loaded: false, reason: 'backend/.env not found' };
  const parsed = parseEnvText(fs.readFileSync(BACKEND_ENV_PATH, 'utf8'));
  let applied = 0;
  for (const [key, value] of Object.entries(parsed)) {
    if (key.startsWith('BB_TEST_')) continue; // safety gates must come from the invoking shell, never from .env
    if (process.env[key] === undefined) {
      process.env[key] = value;
      applied += 1;
    }
  }
  return { loaded: true, keys: Object.keys(parsed).length, applied };
}

/* ----------------------------------------------------- database identity -- */

function parseDb(url) {
  try {
    const u = new URL(url);
    const database = decodeURIComponent(u.pathname.replace(/^\//, ''));
    if (!u.hostname || !database) return null;
    return { host: u.host.toLowerCase(), database };
  } catch {
    return null;
  }
}
const fingerprint = (url) => {
  const p = parseDb(url);
  return p ? `${p.host}/${p.database}` : null;
};
/** Neon pooled and direct hostnames reach the same database, so compare them as equal. */
const normalizedFingerprint = (url) => {
  const f = fingerprint(url);
  return f ? f.replace(/-pooler(?=\.)/, '') : null;
};
/** Short, non-reversible id that is safe to print so operators can tell targets apart. */
const shortId = (url) => {
  const f = normalizedFingerprint(url);
  return f ? crypto.createHash('sha256').update(f).digest('hex').slice(0, 8) : 'unknown';
};

function productionFingerprints() {
  const set = new Set();
  const add = (u) => { const f = u && normalizedFingerprint(u); if (f) set.add(f); };
  add(STARTUP_DATABASE_URL);
  if (fs.existsSync(BACKEND_ENV_PATH)) add(parseEnvText(fs.readFileSync(BACKEND_ENV_PATH, 'utf8')).DATABASE_URL);
  if (!testDatabaseApplied) add(process.env.DATABASE_URL);
  return set;
}

/* ------------------------------------------------------------------ gates -- */

/**
 * Write gate. Returns { ok: true, url, joinCode } or { ok: false, reason }.
 * Requires BOTH an explicit test database URL and a typed confirmation of its host/database,
 * and refuses anything that resolves to the production DATABASE_URL.
 */
function getWriteGate() {
  if (fs.existsSync(BACKEND_ENV_PATH)) {
    const fromFile = parseEnvText(fs.readFileSync(BACKEND_ENV_PATH, 'utf8'));
    if (Object.keys(fromFile).some((k) => k.startsWith('BB_TEST_'))) {
      return { ok: false, reason: 'backend/.env defines BB_TEST_* variables. Safety confirmations must come from the invoking shell, never from the production env file. Remove them from backend/.env.' };
    }
  }
  const url = process.env.BB_TEST_DATABASE_URL;
  if (!url) {
    return {
      ok: false,
      reason: 'BB_TEST_DATABASE_URL is not set. Write-capable tests only run against a dedicated disposable database that you name explicitly (never the production DATABASE_URL).',
    };
  }
  const parsed = parseDb(url);
  if (!parsed) return { ok: false, reason: 'BB_TEST_DATABASE_URL could not be parsed as a database URL.' };
  const confirm = (process.env.BB_TEST_CONFIRM_DISPOSABLE || '').trim().toLowerCase();
  if (confirm !== fingerprint(url)) {
    return {
      ok: false,
      reason: 'BB_TEST_CONFIRM_DISPOSABLE must be set to the exact host[:port]/database of BB_TEST_DATABASE_URL to confirm that database may be modified and cleaned up.',
    };
  }
  if (productionFingerprints().has(normalizedFingerprint(url))) {
    return {
      ok: false,
      reason: 'BB_TEST_DATABASE_URL resolves to the same host/database as the configured production DATABASE_URL. Refusing to run write-capable tests.',
    };
  }
  return { ok: true, url, joinCode: `BBT${crypto.randomBytes(4).toString('hex').toUpperCase()}` };
}

/** Read-only gate: reading the configured DATABASE_URL still needs an explicit opt-in. */
function getReadOnlyGate() {
  if (process.env.BB_TEST_ALLOW_READONLY !== '1') {
    return { ok: false, reason: 'Set BB_TEST_ALLOW_READONLY=1 to allow SELECT/GET-only checks against the database configured in backend/.env.' };
  }
  if (!process.env.DATABASE_URL) {
    return { ok: false, reason: 'DATABASE_URL is not set (backend/.env missing or empty).' };
  }
  return { ok: true, url: process.env.DATABASE_URL };
}

/** Points all backend/db.js usage in this process at the confirmed disposable database. */
function applyTestDatabase(gate) {
  if (!gate || gate.ok !== true) throw new Error('applyTestDatabase called without a passed write gate.');
  process.env.DATABASE_URL = gate.url;
  process.env.NODE_ENV = 'test';
  process.env.EVENT_JOIN_CODES = gate.joinCode;
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.DB_POOL_MAX = '4';
  delete process.env.VERCEL;
  testDatabaseApplied = true;
}

/**
 * Guard for legacy scripts that hit a pre-existing server (e.g. http://localhost:4000).
 * Fail closed: requires the write gate AND an explicit statement that the server is attached to the same database.
 */
function requireDisposableOrExit(scriptName, { usesServer = true } = {}) {
  const gate = getWriteGate();
  const fail = (why) => {
    console.error(`[REFUSED] ${scriptName} writes data and was not run.\n  ${why}\n  See tests/README.md. Prefer: npm run test:audit:integration`);
    process.exit(2);
  };
  if (!gate.ok) fail(gate.reason);
  if (usesServer && (process.env.BB_TEST_SERVER_USES_TEST_DB || '').trim().toLowerCase() !== fingerprint(gate.url)) {
    fail('This script calls an already-running API server. Set BB_TEST_SERVER_USES_TEST_DB to the host/database of BB_TEST_DATABASE_URL to confirm that server is connected to that disposable database (the script cannot verify it).');
  }
  process.env.DATABASE_URL = gate.url; // any direct SQL in the script goes to the disposable DB only
  testDatabaseApplied = true;
  dbMode = 'disposable';
  return gate;
}

function requireAdminCredsOrNull() {
  const username = process.env.BB_TEST_ADMIN_USERNAME;
  const password = process.env.BB_TEST_ADMIN_PASSWORD;
  return username && password ? { username, password } : null;
}

/* --------------------------------------------------------------- reporter -- */

class Reporter {
  constructor(title) {
    this.title = title;
    this.passed = 0;
    this.failed = 0;
    this.skipped = [];
    this.failures = [];
    console.log('====================================================');
    console.log(`  ${title}`);
    console.log('====================================================');
  }
  section(name) { console.log(`\n${name}`); }
  info(msg) { console.log(`  [INFO] ${msg}`); }
  pass(msg) { this.passed += 1; console.log(`  [PASS] ${msg}`); }
  fail(msg, detail = '') {
    this.failed += 1;
    this.failures.push({ msg, detail });
    console.error(`  [FAIL] ${msg}${detail ? `  -> ${detail}` : ''}`);
  }
  skip(msg, reason) {
    this.skipped.push({ msg, reason });
    console.log(`  [SKIP] ${msg}\n         reason: ${reason}`);
  }
  check(condition, msg, detail = '') { condition ? this.pass(msg) : this.fail(msg, detail); return Boolean(condition); }
  status(res, expected, msg) {
    const list = Array.isArray(expected) ? expected : [expected];
    return this.check(list.includes(res.status), msg, `expected status ${list.join('|')}, got ${describe(res)}`);
  }
  /** Runs fn; any thrown error is recorded as a failure with its message (never swallowed). */
  async step(name, fn) {
    try { return await fn(); } catch (error) { this.fail(`${name} threw an error`, error?.message || String(error)); return undefined; }
  }
  /** Prints the summary and returns the process exit code. */
  finish() {
    console.log('\n====================================================');
    console.log(`  RESULT: ${this.passed} passed, ${this.failed} failed, ${this.skipped.length} skipped`);
    if (this.failed) {
      console.log('  FAILURES:');
      this.failures.forEach((f) => console.log(`   - ${f.msg}${f.detail ? `: ${f.detail}` : ''}`));
    }
    if (this.skipped.length) {
      console.log('  SKIPPED (NOT verified):');
      this.skipped.forEach((s) => console.log(`   - ${s.msg} (${s.reason})`));
    }
    if (!this.passed && !this.failed) console.log('  NO CHECKS WERE EXECUTED.');
    console.log('====================================================\n');
    if (this.failed) return 1;
    if (this.skipped.length && process.env.BB_TEST_REQUIRE_INTEGRATION === '1') return 2;
    return 0;
  }
}

function describe(res) {
  const err = res?.body && typeof res.body === 'object' ? res.body.error : undefined;
  return `${res?.status}${err ? ` (error: ${err})` : ''}`;
}

/* -------------------------------------------------------------- http/api -- */

function makeCaller(base) {
  return async function call(method, route, { token, body, headers } = {}) {
    const h = { ...(headers || {}) };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    if (token) h.Authorization = `Bearer ${token}`;
    const res = await fetch(base + route, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let parsed = text;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* keep text */ }
    return { status: res.status, body: parsed };
  };
}

const importBackend = (file) => import(pathToFileURL(path.join(BACKEND_DIR, 'src', file)).href);

/** Starts the Express app in-process on 127.0.0.1:<random>. Uses whatever DATABASE_URL is set now. */
async function startInProcessApi() {
  const { app } = await importBackend('app.js');
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  return { base, call: makeCaller(base), close: () => new Promise((resolve) => server.close(resolve)) };
}

/* ------------------------------------------- disposable-db state & fixtures -- */

const REQUIRED_TABLES = ['admins', 'participants', 'attempts', 'answers', 'questions', 'competition_state', 'audit_events'];
const EXPECTED_COUNTS = { 1: 50, 2: 30, 3: 30 };
const EXPECTED_POINTS = { 1: { correct: 1, wrong: 0 }, 2: { correct: 1, wrong: 0 }, 3: { correct: 5, wrong: -2 } };

/** Read-only question-bank checks, safe for production or disposable databases. */
async function runQuestionBankChecks(rep, db) {
  rep.section('Question bank integrity (read-only)');
  const tables = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map((r) => r.tablename);
  for (const t of REQUIRED_TABLES) rep.check(tables.includes(t), `Table ${t} exists`);

  const counts = (await db.query('SELECT round_id, COUNT(*)::int AS n FROM questions WHERE enabled=TRUE GROUP BY round_id')).rows;
  for (const round of [1, 2, 3]) {
    const n = counts.find((r) => Number(r.round_id) === round)?.n ?? 0;
    rep.check(n === EXPECTED_COUNTS[round], `Round ${round} has ${EXPECTED_COUNTS[round]} enabled questions`, `got ${n}`);
  }

  const pts = (await db.query('SELECT round_id, points_correct, points_wrong, COUNT(*)::int AS n FROM questions WHERE enabled=TRUE GROUP BY 1,2,3')).rows;
  for (const round of [1, 2, 3]) {
    const groups = pts.filter((r) => Number(r.round_id) === round);
    const want = EXPECTED_POINTS[round];
    const ok = groups.length === 1 && Number(groups[0].points_correct) === want.correct && Number(groups[0].points_wrong) === want.wrong;
    rep.check(ok, `Round ${round} marking is +${want.correct} correct / ${want.wrong} wrong / 0 unanswered`,
      `found ${groups.map((g) => `${g.n}x(+${g.points_correct}/${g.points_wrong})`).join(', ') || 'no questions'}`);
  }

  const bad = (await db.query(`SELECT round_id, sort_order FROM questions WHERE enabled=TRUE AND (
      jsonb_typeof(options) <> 'array' OR jsonb_array_length(options) < 2 OR correct_answer >= jsonb_array_length(options))
      ORDER BY round_id, sort_order`)).rows;
  rep.check(bad.length === 0, 'Every enabled question has >=2 options and a correct_answer inside the option range',
    bad.map((b) => `R${b.round_id}#${b.sort_order}`).join(', '));
}

async function preflightTestDatabase(db, gate) {
  const current = (await db.query('SELECT current_database() AS name')).rows[0].name;
  if (current !== parseDb(gate.url).database) return { ok: false, reason: 'Connected database name does not match BB_TEST_DATABASE_URL.' };
  const tables = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map((r) => r.tablename);
  const missing = REQUIRED_TABLES.filter((t) => !tables.includes(t));
  if (missing.length) return { ok: false, reason: `Test database is not provisioned (missing tables: ${missing.join(', ')}). Provision the TEST database yourself; this suite never runs migrations or seeds.` };
  const cols = (await db.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND ((table_name='competition_state' AND column_name='round_durations') OR (table_name='questions' AND column_name IN ('explanation','chart_data')))")).rows;
  if (cols.length < 3) return { ok: false, reason: 'Test database schema is behind the backend migrations (missing round_durations/explanation/chart_data). Migrate the TEST database yourself.' };
  const counts = (await db.query('SELECT round_id, COUNT(*)::int AS n FROM questions WHERE enabled=TRUE GROUP BY round_id')).rows;
  for (const round of [1, 2, 3]) {
    const n = counts.find((r) => Number(r.round_id) === round)?.n ?? 0;
    if (n !== EXPECTED_COUNTS[round]) return { ok: false, reason: `Test database question bank is not seeded to 50/30/30 (round ${round} has ${n}). Seed the TEST database yourself.` };
  }
  const state = (await db.query('SELECT COUNT(*)::int AS n FROM competition_state WHERE singleton=TRUE')).rows[0].n;
  if (state !== 1) return { ok: false, reason: 'Test database has no competition_state row.' };
  return { ok: true };
}

const snapshotCompetitionState = async (db) => (await db.query('SELECT * FROM competition_state WHERE singleton=TRUE')).rows[0];

async function restoreCompetitionState(db, s) {
  await db.query(
    `UPDATE competition_state SET status=$1, active_round=$2, registration_open=$3, round_states=$4::jsonb, round_durations=$5::jsonb, updated_at=$6 WHERE singleton=TRUE`,
    [s.status, s.active_round, s.registration_open, JSON.stringify(s.round_states), JSON.stringify(s.round_durations), s.updated_at],
  );
}

/** Direct SQL state setup. Only ever reachable from withDisposableEnvironment (disposable DB). */
async function setCompetitionState(db, { status = 'LIVE', registrationOpen = true, roundStates, roundDurations = { 1: 600, 2: 600, 3: 180 } }) {
  await db.query(
    `UPDATE competition_state SET status=$1, registration_open=$2, round_states=$3::jsonb, round_durations=$4::jsonb, updated_at=NOW() WHERE singleton=TRUE`,
    [status, registrationOpen, JSON.stringify(roundStates), JSON.stringify(roundDurations)],
  );
}

const tableCounts = async (db) => (await db.query(
  'SELECT (SELECT COUNT(*)::int FROM participants) AS participants, (SELECT COUNT(*)::int FROM attempts) AS attempts, (SELECT COUNT(*)::int FROM answers) AS answers',
)).rows[0];

/** Tracks rows created by THIS run and deletes only those (ownership = 201 on register + run-unique roll number). */
class FixtureTracker {
  constructor(db, gate, call) {
    if (!gate || gate.ok !== true || process.env.DATABASE_URL !== gate.url) {
      throw new Error('FixtureTracker refuses to operate outside a confirmed disposable database.');
    }
    this.db = db;
    this.call = call;
    this.joinCode = gate.joinCode;
    this.runId = `${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`.toUpperCase();
    this.issuedRolls = [];
    this.owned = new Map(); // participant id -> roll number
    this.counter = 0;
  }
  nextRoll(label) {
    this.counter += 1;
    const roll = `BBT-${this.runId}-${label}-${this.counter}`.toUpperCase();
    this.issuedRolls.push(roll);
    return roll;
  }
  /** Registers a fixture participant. Only a 201 (row created by us) is adopted for cleanup. */
  async register(label, extra = {}) {
    const rollNumber = extra.rollNumber || this.nextRoll(label);
    const res = await this.call('POST', '/participants/register', {
      body: { fullName: 'BBT Audit Fixture', collegeName: 'BBT Audit Lab', joinCode: this.joinCode, rollNumber, ...extra.body },
    });
    if (res.status === 201 && res.body?.id && String(res.body.rollNumber).toUpperCase() === rollNumber) {
      this.owned.set(Number(res.body.id), rollNumber);
    }
    return { res, rollNumber, id: Number(res.body?.id), token: res.body?.token };
  }
  async cleanup(rep) {
    const ids = [...this.owned.keys()];
    const rolls = [...this.owned.values()];
    if (ids.length) {
      await this.db.withTransaction(async (c) => {
        const owned = (await c.query('SELECT id FROM participants WHERE id = ANY($1::bigint[]) AND roll_number = ANY($2::text[])', [ids, rolls])).rows.map((r) => String(r.id));
        if (!owned.length) return;
        await c.query(
          `DELETE FROM audit_events WHERE (actor_type='participant' AND actor_id = ANY($1::bigint[]))
              OR (actor_type='system' AND details->>'participantId' = ANY($2::text[]))`, [owned, owned]);
        await c.query('DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE participant_id = ANY($1::bigint[]))', [owned]);
        await c.query('DELETE FROM attempts WHERE participant_id = ANY($1::bigint[])', [owned]);
        const del = await c.query('DELETE FROM participants WHERE id = ANY($1::bigint[]) RETURNING id', [owned]);
        rep.info(`Cleanup removed ${del.rowCount} fixture participant(s) created by this run (plus their attempts, answers and audit events).`);
      });
    }
    // Anything with one of our roll numbers that we did NOT adopt is reported, never deleted.
    const stray = (await this.db.query('SELECT roll_number FROM participants WHERE roll_number = ANY($1::text[])', [this.issuedRolls])).rows;
    if (stray.length) rep.fail('Cleanup left unowned rows that were NOT deleted (ownership unproven, manual review needed)', stray.map((r) => r.roll_number).join(', '));
  }
}

/**
 * Runs fn(ctx) against a confirmed disposable database. Skips (with the reason) when the gate is not satisfied.
 * Always cleans up tracked fixtures, restores competition_state, and closes server + pool.
 */
async function withDisposableEnvironment(rep, label, fn) {
  const gate = getWriteGate();
  if (!gate.ok) { rep.skip(label, gate.reason); return false; }
  if (dbMode === 'readonly') {
    rep.skip(label, 'This process already opened the configured (read-only) database; db.js caches its pool, so switching targets in-process is unsafe. Run the integration tier in a separate process.');
    return false;
  }
  applyTestDatabase(gate);
  dbMode = 'disposable';
  const db = await importBackend('db.js');
  const pool = db.getPool();
  let api; let tracker; let snapshot; let before;
  try {
    const pre = await preflightTestDatabase(db, gate);
    if (!pre.ok) { rep.skip(label, pre.reason); return false; }
    rep.info(`Disposable test database confirmed (id ${shortId(gate.url)}). Server runs in-process; localhost:4000 is never contacted.`);
    snapshot = await snapshotCompetitionState(db);
    before = await tableCounts(db);
    api = await startInProcessApi();
    tracker = new FixtureTracker(db, gate, api.call);
    await fn({ rep, db, call: api.call, tracker, gate, setState: (s) => setCompetitionState(db, s) });
    return true;
  } finally {
    if (tracker) await tracker.cleanup(rep).catch((e) => rep.fail('Fixture cleanup failed', e.message));
    if (snapshot) await restoreCompetitionState(db, snapshot).catch((e) => rep.fail('Restoring competition_state failed', e.message));
    if (before) {
      const after = await tableCounts(db).catch(() => null);
      if (after) rep.check(['participants', 'attempts', 'answers'].every((k) => after[k] === before[k]),
        'Row counts (participants/attempts/answers) match their pre-test values after cleanup', `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
    }
    if (api) await api.close();
    await pool.end().catch(() => { });
  }
}

/** Runs fn(ctx) with read-only access to the configured DATABASE_URL (opt-in gate). */
async function withReadOnlyEnvironment(rep, label, fn) {
  const gate = getReadOnlyGate();
  if (!gate.ok) { rep.skip(label, gate.reason); return false; }
  if (dbMode === 'disposable') {
    rep.skip(label, 'This process is already bound to the disposable test database; run read-only checks in a separate process.');
    return false;
  }
  dbMode = 'readonly';
  process.env.DB_POOL_MAX = process.env.DB_POOL_MAX || '2';
  const db = await importBackend('db.js');
  const pool = db.getPool();
  let api;
  try {
    rep.info(`Read-only mode against configured database (id ${shortId(gate.url)}). Only SELECT / GET / rejected-auth requests are issued.`);
    api = await startInProcessApi();
    await fn({ rep, db, call: api.call });
    return true;
  } finally {
    if (api) await api.close();
    await pool.end().catch(() => { });
  }
}

/* ---------------------------------------------------------- static helpers -- */

/** Scans dist/assets JS for answer keys / explanations shipped to every browser. Handles minified output. */
function scanBundle(distDir = path.join(ROOT, 'dist', 'assets')) {
  if (!fs.existsSync(distDir)) return { exists: false, files: [] };
  const files = fs.readdirSync(distDir).filter((f) => f.endsWith('.js')).map((name) => {
    const text = fs.readFileSync(path.join(distDir, name), 'utf8');
    const count = (re) => (text.match(re) || []).length;
    return {
      name,
      bytes: Buffer.byteLength(text),
      answerKeyLiterals: count(/correct(?:Answer|_answer)\s*:\s*\d+/g),
      explanationLiterals: count(/explanation\s*:\s*[`'"]/g),
    };
  });
  return { exists: true, files };
}

/* ------------------------------------------------- scoring-rule helpers -- */

/** Marking rules from the requirements: R1/R2 +1 correct, 0 wrong, 0 unanswered; R3 +5 correct, -2 wrong, 0 unanswered. */
const expectedScore = (round, correct, wrong) => (round === 3 ? correct * 5 - wrong * 2 : correct);

async function loadQuestionRows(db, round) {
  return (await db.query(
    'SELECT id, sort_order, correct_answer, jsonb_array_length(options) AS n FROM questions WHERE round_id=$1 AND enabled=TRUE ORDER BY sort_order',
    [round],
  )).rows;
}

/** First `correct` questions answered correctly, next `wrong` answered wrongly, the rest left out (unanswered). */
function buildAnswers(rows, correct, wrong) {
  const item = (q, selectedOption) => ({ questionId: Number(q.id), sortOrder: Number(q.sort_order), selectedOption });
  return [
    ...rows.slice(0, correct).map((q) => item(q, q.correct_answer)),
    ...rows.slice(correct, correct + wrong).map((q) => item(q, (q.correct_answer + 1) % Number(q.n))),
  ];
}

module.exports = {
  expectedScore, loadQuestionRows, buildAnswers,
  ROOT, BACKEND_DIR, EXPECTED_COUNTS, EXPECTED_POINTS,
  loadBackendEnv, parseDb, fingerprint, shortId,
  getWriteGate, getReadOnlyGate, applyTestDatabase, requireDisposableOrExit, requireAdminCredsOrNull,
  Reporter, describe, makeCaller, importBackend, startInProcessApi,
  runQuestionBankChecks, preflightTestDatabase, FixtureTracker,
  withDisposableEnvironment, withReadOnlyEnvironment, scanBundle,
};
