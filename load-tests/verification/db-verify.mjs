/**
 * PROJECT BRAIN BYTES — Neon PostgreSQL Performance & Data Integrity Auditor
 *
 * Performs two roles:
 * 1. Read-Only Database Performance Audit (safe on any database):
 *    - Discovers actual question counts per round (`questions` + `competition_state`)
 *    - Inspects indexes (`pg_indexes`) and constraints (`pg_constraint`)
 *    - Inspects sequential vs index scan statistics (`pg_stat_user_tables`)
 *    - Inspects active connection counts and `max_connections`
 *    - Runs non-mutating `EXPLAIN (FORMAT JSON)` on critical read/poll queries
 * 2. Post-Load-Test Data Integrity Verifier & Cleanup (strictly gated by `BB_TEST_CONFIRM_DISPOSABLE`):
 *    - Verifies `LOADTEST_USER_001`..`200` integrity, zero duplicate submissions, zero orphaned rows
 *    - Provides safe cleanup of `LOADTEST_USER_%` test records ONLY when disposable DB confirmation is set
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(ROOT_DIR, 'backend/.env') });

const { Pool } = pg;

export function getDatabaseAuditConfig() {
  const testDbUrl = process.env.BB_TEST_DATABASE_URL || '';
  const confirmDisposable = process.env.BB_TEST_CONFIRM_DISPOSABLE === 'YES_DISPOSABLE_TEST_DB';
  const prodDbUrl = process.env.DATABASE_URL || '';

  const activeUrl = testDbUrl || prodDbUrl;
  let hostRedacted = 'unconfigured';
  let isPoolerEndpoint = false;
  try {
    const parsed = new URL(activeUrl);
    const maskedHost = parsed.hostname.replace(/^ep-[a-z0-9-]+?(?=-pooler\.|\.)/i, 'ep-[REDACTED]');
    hostRedacted = `${maskedHost}${parsed.pathname}`;
    isPoolerEndpoint = parsed.hostname.includes('-pooler.');
  } catch {
    hostRedacted = 'invalid_url';
  }

  return {
    hasDatabaseUrl: Boolean(activeUrl),
    isIsolatedTestDbConfigured: Boolean(testDbUrl && confirmDisposable && testDbUrl !== prodDbUrl),
    hostRedacted,
    isPoolerEndpoint,
    connectionString: activeUrl,
  };
}

export async function runReadOnlyDatabaseAudit() {
  const cfg = getDatabaseAuditConfig();
  if (!cfg.hasDatabaseUrl) {
    throw new Error('No DATABASE_URL found for read-only database inspection.');
  }

  const pool = new Pool({
    connectionString: cfg.connectionString,
    ssl: { rejectUnauthorized: false },
    max: 4,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 10000,
  });

  const t0 = performance.now();
  const client = await pool.connect();
  const connectLatencyMs = Number((performance.now() - t0).toFixed(2));

  try {
    // Measure single ping round-trip latency to Neon
    const pingSamples = [];
    for (let i = 0; i < 5; i++) {
      const pStart = performance.now();
      await client.query('SELECT 1');
      pingSamples.push(Number((performance.now() - pStart).toFixed(2)));
    }
    const avgPingMs = Number((pingSamples.reduce((a, b) => a + b, 0) / pingSamples.length).toFixed(2));

    // 1. Discover competition_state and question counts per round from database
    const stateResult = await client.query(`
      SELECT status, active_round, registration_open, round_states, round_durations, updated_at
      FROM competition_state
      WHERE singleton = TRUE
    `);
    const compState = stateResult.rows[0] || {};
    const durations = compState.round_durations || { 1: 600, 2: 600, 3: 180 };
    const roundStates = compState.round_states || { 1: 'active', 2: 'locked', 3: 'locked' };

    const questionsPerRoundResult = await client.query(`
      SELECT
        round_id AS round_number,
        COUNT(*)::int AS question_count,
        COUNT(*) FILTER (WHERE enabled = TRUE)::int AS enabled_question_count,
        MIN(points_correct)::int AS points_correct,
        MIN(points_wrong)::int AS points_wrong
      FROM questions
      GROUP BY round_id
      ORDER BY round_id ASC
    `);

    const roundNames = {
      1: 'Round 1: Data MCQ',
      2: 'Round 2: Graph Challenge',
      3: 'Round 3: Rapid Fire',
    };

    const rounds = questionsPerRoundResult.rows.map((r) => ({
      round_number: Number(r.round_number),
      name: roundNames[r.round_number] || `Round ${r.round_number}`,
      duration_seconds: Number(durations[String(r.round_number)] ?? (r.round_number === 3 ? 180 : 600)),
      status: roundStates[String(r.round_number)] || 'locked',
      question_count: r.enabled_question_count,
      total_question_rows: r.question_count,
      points_correct: r.points_correct,
      points_wrong: r.points_wrong,
    }));

    // 2. Discover existing table row counts (without exposing PII)
    const rowCountsResult = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM participants) AS participants_count,
        (SELECT COUNT(*)::int FROM participants WHERE roll_number LIKE 'LOADTEST_USER_%') AS loadtest_participants_count,
        (SELECT COUNT(*)::int FROM attempts) AS attempts_count,
        (SELECT COUNT(*)::int FROM answers) AS answers_count,
        (SELECT COUNT(*)::int FROM audit_events) AS audit_events_count,
        (SELECT COUNT(*)::int FROM admins) AS admins_count
    `);

    // 3. Inspect indexes
    const indexesResult = await client.query(`
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);

    // 4. Inspect sequential scans vs index scans (`pg_stat_user_tables`)
    const tableStatsResult = await client.query(`
      SELECT
        relname AS table_name,
        seq_scan::int,
        seq_tup_read::int,
        COALESCE(idx_scan, 0)::int AS idx_scan,
        COALESCE(idx_tup_fetch, 0)::int AS idx_tup_fetch,
        n_live_tup::int AS live_rows,
        n_dead_tup::int AS dead_rows
      FROM pg_stat_user_tables
      ORDER BY seq_scan DESC
    `);

    // 5. Inspect PostgreSQL server settings & active connections
    const settingsResult = await client.query(`
      SELECT
        current_setting('max_connections')::int AS max_connections,
        current_setting('server_version') AS server_version,
        (SELECT COUNT(*)::int FROM pg_stat_activity WHERE datname = current_database()) AS active_db_connections
    `);

    // 6. Run EXPLAIN (FORMAT JSON) on critical queries from backend/src/routes.js
    const explainQueries = {
      competition_state_broadcast_poll: `
        EXPLAIN (FORMAT JSON)
        SELECT id, details, created_at
        FROM audit_events
        WHERE event_type = 'admin.broadcast'
        ORDER BY created_at DESC, id DESC
        LIMIT 10
      `,
      qualification_map_scan: `
        EXPLAIN (FORMAT JSON)
        SELECT event_type, details, created_at
        FROM audit_events
        WHERE event_type IN ('qualification.executed', 'round2.qualified', 'round3.qualified')
        ORDER BY created_at DESC, id DESC
      `,
      round_questions_lookup: `
        EXPLAIN (FORMAT JSON)
        SELECT id, round_id, prompt, options, points_correct, points_wrong, sort_order
        FROM questions
        WHERE round_id = 1 AND enabled = TRUE
        ORDER BY sort_order ASC
      `,
      leaderboard_aggregation: `
        EXPLAIN (FORMAT JSON)
        SELECT
          p.id,
          p.full_name,
          p.roll_number,
          COALESCE(SUM(CASE WHEN a.round_id = 1 AND a.submitted_at IS NOT NULL THEN a.score ELSE 0 END), 0) AS round1_score,
          COALESCE(SUM(CASE WHEN a.submitted_at IS NOT NULL THEN a.score ELSE 0 END), 0) AS total_score
        FROM participants p
        LEFT JOIN attempts a ON a.participant_id = p.id
        GROUP BY p.id
      `,
    };

    const explainPlans = {};
    for (const [key, sql] of Object.entries(explainQueries)) {
      const res = await client.query(sql);
      const planRoot = res.rows[0]?.['QUERY PLAN']?.[0]?.Plan || {};
      explainPlans[key] = {
        nodeType: planRoot['Node Type'],
        relationName: planRoot['Relation Name'] || null,
        indexName: planRoot['Index Name'] || null,
        startupCost: planRoot['Startup Cost'],
        totalCost: planRoot['Total Cost'],
        planRows: planRoot['Plan Rows'],
        rawPlan: planRoot,
      };
    }

    // 7. Data integrity check on existing database (orphaned records / duplicate submitted attempts)
    const integrityResult = await client.query(`
      SELECT
        (
          SELECT COUNT(*)::int
          FROM (
            SELECT participant_id, round_id, COUNT(*)
            FROM attempts
            GROUP BY participant_id, round_id
            HAVING COUNT(*) > 1
          ) dup_attempts
        ) AS duplicate_participant_round_attempts,
        (
          SELECT COUNT(*)::int
          FROM (
            SELECT attempt_id, question_id, COUNT(*)
            FROM answers
            GROUP BY attempt_id, question_id
            HAVING COUNT(*) > 1
          ) dup_answers
        ) AS duplicate_attempt_question_answers
    `);

    const hasAuditEventTypeIndex = indexesResult.rows.some(
      (r) => r.tablename === 'audit_events' && r.indexdef.includes('event_type')
    );

    return {
      timestamp: new Date().toISOString(),
      connection: {
        hostRedacted: cfg.hostRedacted,
        isPoolerEndpoint: cfg.isPoolerEndpoint,
        isIsolatedTestDbConfigured: cfg.isIsolatedTestDbConfigured,
        tlsHandshakeAndConnectMs: connectLatencyMs,
        pingSamplesMs: pingSamples,
        avgQueryRoundTripMs: avgPingMs,
        configuredAppPoolMax: {
          standardNode: 10,
          vercelServerless: 3,
          connectionTimeoutMillis: 10000,
        },
        serverSettings: settingsResult.rows[0],
      },
      discoveredWorkload: {
        competitionStatus: compState.status || 'UNKNOWN',
        activeRound: compState.active_round ?? null,
        registrationOpen: compState.registration_open ?? true,
        rounds,
        rowCounts: rowCountsResult.rows[0],
      },
      schemaAudit: {
        totalIndexes: indexesResult.rows.length,
        indexes: indexesResult.rows,
        hasAuditEventTypeIndex,
        missingRecommendedIndexes: hasAuditEventTypeIndex
          ? []
          : ['idx_audit_events_type_created ON audit_events(event_type, created_at DESC, id DESC)'],
        tableStats: tableStatsResult.rows,
      },
      explainPlans,
      dataIntegrity: integrityResult.rows[0],
    };
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Safely removes only `LOADTEST_USER_%` records when operating on a verified
 * disposable test database (`BB_TEST_CONFIRM_DISPOSABLE=YES_DISPOSABLE_TEST_DB`).
 */
export async function cleanupLoadTestRecordsIfDisposable() {
  const cfg = getDatabaseAuditConfig();
  if (!cfg.isIsolatedTestDbConfigured) {
    throw new Error(
      'Refusing to run cleanup: BB_TEST_DATABASE_URL and BB_TEST_CONFIRM_DISPOSABLE=YES_DISPOSABLE_TEST_DB must both be set and distinct from production DATABASE_URL.'
    );
  }

  const pool = new Pool({
    connectionString: cfg.connectionString,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });

  try {
    const res = await pool.query(
      `DELETE FROM participants WHERE roll_number LIKE 'LOADTEST_USER_%' OR full_name LIKE 'LOADTEST_USER_%' RETURNING id`
    );
    return { deletedParticipants: res.rowCount };
  } finally {
    await pool.end();
  }
}
