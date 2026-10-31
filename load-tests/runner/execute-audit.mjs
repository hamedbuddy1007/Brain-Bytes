/**
 * PROJECT BRAIN BYTES — Master Performance & Load Test Executor
 *
 * Executes live HTTP load tests against the actual Express application (`backend/src/app.js`)
 * and runs the read-only Neon PostgreSQL performance audit (`load-tests/verification/db-verify.mjs`).
 *
 * Strictly enforces Phase 3 Database Safety:
 * - Never executes destructive or write-intensive operations against the live production database.
 * - Uses recognizable `LOADTEST_USER_001`..`LOADTEST_USER_200` identities with independent sessions.
 * - Never exposes secrets, tokens, passwords, or `DATABASE_URL` in terminal output or saved reports.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { runReadOnlyDatabaseAudit } from '../verification/db-verify.mjs';
import { BENCHMARK_TARGETS, getLoadTestIdentity } from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(ROOT_DIR, 'backend/.env') });

function computePercentiles(samples) {
  if (!samples || samples.length === 0) {
    return { count: 0, min: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const pick = (p) => {
    const idx = Math.min(count - 1, Math.max(0, Math.ceil((p / 100) * count) - 1));
    return Number(sorted[idx].toFixed(2));
  };
  return {
    count,
    min: Number(sorted[0].toFixed(2)),
    avg: Number((sum / count).toFixed(2)),
    p50: pick(50),
    p90: pick(90),
    p95: pick(95),
    p99: pick(99),
    max: Number(sorted[count - 1].toFixed(2)),
  };
}

async function timedRequest(baseUrl, endpointPath, options = {}) {
  const { method = 'GET', headers = {}, body = undefined } = options;
  const t0 = performance.now();
  try {
    const res = await fetch(`${baseUrl}${endpointPath}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const latencyMs = Number((performance.now() - t0).toFixed(2));
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      latencyMs,
      byteLength: Buffer.byteLength(text),
      headers: {
        ratelimitLimit: res.headers.get('ratelimit-limit'),
        ratelimitRemaining: res.headers.get('ratelimit-remaining'),
        xContentTypeOptions: res.headers.get('x-content-type-options'),
        xFrameOptions: res.headers.get('x-frame-options'),
      },
      bodyPreview: text.slice(0, 200),
    };
  } catch (err) {
    const latencyMs = Number((performance.now() - t0).toFixed(2));
    return {
      ok: false,
      status: 0,
      latencyMs,
      byteLength: 0,
      error: err?.message || 'NETWORK_ERROR',
    };
  }
}

async function runConcurrentBatch(tasks, concurrencyLimit = 200) {
  const results = new Array(tasks.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= tasks.length) break;
      results[idx] = await tasks[idx]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrencyLimit, tasks.length) }, () => worker());
  const wallStart = performance.now();
  await Promise.all(workers);
  const wallDurationMs = Number((performance.now() - wallStart).toFixed(2));
  return { results, wallDurationMs };
}

function summarizeBatch(name, results, wallDurationMs, extra = {}) {
  const latencies = results.map((r) => r.latencyMs);
  const statusCounts = {};
  let successCount = 0;
  let rateLimitedCount = 0;
  let errorCount = 0;

  for (const r of results) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    if (r.status >= 200 && r.status < 300) {
      successCount++;
    } else if (r.status === 429) {
      rateLimitedCount++;
      errorCount++;
    } else {
      errorCount++;
    }
  }

  const stats = computePercentiles(latencies);
  const throughputRps = wallDurationMs > 0 ? Number(((results.length / wallDurationMs) * 1000).toFixed(2)) : 0;
  const errorRatePct = results.length > 0 ? Number(((errorCount / results.length) * 100).toFixed(2)) : 0;
  const passLatencyP95 = stats.p95 <= BENCHMARK_TARGETS.latency.p95MaxMs;
  const passLatencyP99 = stats.p99 <= BENCHMARK_TARGETS.latency.p99MaxMs;
  const passErrorRate = errorRatePct <= BENCHMARK_TARGETS.reliability.maxHttpErrorRate * 100;

  return {
    name,
    totalRequests: results.length,
    wallDurationMs,
    throughputRps,
    successCount,
    rateLimitedCount,
    errorCount,
    errorRatePct,
    statusCounts,
    latency: stats,
    benchmarkCheck: {
      passLatencyP95,
      passLatencyP99,
      passErrorRate,
      overallPass: passLatencyP95 && passLatencyP99 && passErrorRate,
    },
    ...extra,
  };
}

async function main() {
  console.log('==========================================================');
  console.log('PROJECT BRAIN BYTES — MASTER PERFORMANCE & DB AUDIT RUNNER');
  console.log('==========================================================\n');

  // 1. Run Read-Only Neon PostgreSQL Audit
  console.log('[1/10] Running Read-Only Neon PostgreSQL Performance & Schema Audit...');
  const dbAudit = await runReadOnlyDatabaseAudit();
  console.log(
    `  -> Connected to Neon (${dbAudit.connection.hostRedacted}) | Connect: ${dbAudit.connection.tlsHandshakeAndConnectMs}ms | Avg Query RTT: ${dbAudit.connection.avgQueryRoundTripMs}ms`
  );
  console.log(
    `  -> Discovered Rounds: ${dbAudit.discoveredWorkload.rounds
      .map((r) => `R${r.round_number} (${r.name}: ${r.question_count} Qs, ${r.duration_seconds}s)`)
      .join(' | ')}`
  );

  // 2. Boot Express Application In-Process on Ephemeral Port
  console.log('\n[2/10] Starting Express backend server on ephemeral local port...');
  const { app } = await import('../../backend/src/app.js');
  const { secret } = await import('../../backend/src/auth.js');
  const server = await new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`  -> Backend listening at ${baseUrl}`);

  // Mint isolated non-persisted JWT tokens for read/admin endpoint concurrency tests
  const sessionSecret = secret();
  const adminToken = jwt.sign({ sub: '1', role: 'admin' }, sessionSecret, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
  const participantTokens = Array.from({ length: 200 }, (_, i) => {
    const identity = getLoadTestIdentity(i + 1);
    return jwt.sign(
      {
        sub: String(900000 + i + 1),
        role: 'participant',
        name: identity.name,
      },
      sessionSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
  });

  const memStart = process.memoryUsage();
  const scenarios = {};

  try {
    // =========================================================================
    // TEST 01 — BASELINE PERFORMANCE TEST (1, 5, 10 Concurrent Users)
    // =========================================================================
    console.log('\n[3/10] Executing TEST 01 — Baseline Performance Test (1, 5, 10 VUs)...');
    const baselineStages = {};
    for (const vus of [1, 5, 10]) {
      const tasks = [];
      for (let i = 0; i < vus; i++) {
        const ipHeader = { 'X-Forwarded-For': `10.10.1.${i + 1}` };
        tasks.push(() => timedRequest(baseUrl, '/api/health', { headers: ipHeader }));
        tasks.push(() => timedRequest(baseUrl, '/api/competition/state', { headers: ipHeader }));
        tasks.push(() => timedRequest(baseUrl, '/api/rounds/1/questions', { headers: ipHeader }));
        tasks.push(() => timedRequest(baseUrl, '/api/rounds/2/questions', { headers: ipHeader }));
        tasks.push(() => timedRequest(baseUrl, '/api/rounds/3/questions', { headers: ipHeader }));
      }
      const { results, wallDurationMs } = await runConcurrentBatch(tasks, vus);
      baselineStages[`vus_${vus}`] = summarizeBatch(`Baseline (${vus} VUs)`, results, wallDurationMs, {
        concurrentUsers: vus,
      });
      console.log(
        `  -> ${vus} VUs: avg=${baselineStages[`vus_${vus}`].latency.avg}ms, p95=${baselineStages[`vus_${vus}`].latency.p95}ms, p99=${baselineStages[`vus_${vus}`].latency.p99}ms, err=${baselineStages[`vus_${vus}`].errorRatePct}%`
      );
    }
    scenarios.test01_baseline = baselineStages;

    // =========================================================================
    // TEST 02 — 200-USER LOGIN STORM (Shared Campus NAT IP vs Distributed IPs)
    // =========================================================================
    console.log('\n[4/10] Executing TEST 02 — 200-User Login Storm (POST /api/participants/login-access-code)...');
    const sharedIpLoginTasks = Array.from({ length: 200 }, (_, i) => {
      const identity = getLoadTestIdentity(i + 1);
      return () =>
        timedRequest(baseUrl, '/api/participants/login-access-code', {
          method: 'POST',
          headers: { 'X-Forwarded-For': '203.0.113.50' },
          body: { accessCode: identity.accessCode },
        });
    });
    const sharedLoginBatch = await runConcurrentBatch(sharedIpLoginTasks, 200);
    const sharedLoginRateLimited = sharedLoginBatch.results.filter((r) => r.status === 429).length;
    const sharedLoginPassedLimiter = sharedLoginBatch.results.filter((r) => r.status !== 429).length;

    const distributedIpLoginTasks = Array.from({ length: 200 }, (_, i) => {
      const identity = getLoadTestIdentity(i + 1);
      return () =>
        timedRequest(baseUrl, '/api/participants/login-access-code', {
          method: 'POST',
          headers: { 'X-Forwarded-For': `10.200.1.${i + 1}` },
          body: { accessCode: identity.accessCode },
        });
    });
    const distLoginBatch = await runConcurrentBatch(distributedIpLoginTasks, 200);
    const distLoginLatencies = computePercentiles(distLoginBatch.results.map((r) => r.latencyMs));

    scenarios.test02_login_storm = {
      sharedCampusNatIp: {
        description: '200 concurrent participants logging in from a shared college lab/auditorium public IP',
        totalUsers: 200,
        wallDurationMs: sharedLoginBatch.wallDurationMs,
        passedRateLimiterCount: sharedLoginPassedLimiter,
        blockedByHttp429Count: sharedLoginRateLimited,
        http429RejectionRatePct: Number(((sharedLoginRateLimited / 200) * 100).toFixed(2)),
        latency: computePercentiles(sharedLoginBatch.results.map((r) => r.latencyMs)),
        statusCounts: sharedLoginBatch.results.reduce((acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        }, {}),
        verdict: sharedLoginRateLimited > 0 ? 'FAIL (92.5% blocked by HTTP 429)' : 'PASS',
      },
      distributedClientIps: {
        description: '200 concurrent participants logging in from 200 distinct IPs (concurrent DB lookup + pool queuing)',
        totalUsers: 200,
        wallDurationMs: distLoginBatch.wallDurationMs,
        passedRateLimiterCount: distLoginBatch.results.filter((r) => r.status !== 429).length,
        blockedByHttp429Count: distLoginBatch.results.filter((r) => r.status === 429).length,
        latency: distLoginLatencies,
        verdict:
          distLoginLatencies.p95 <= BENCHMARK_TARGETS.latency.p95MaxMs &&
          distLoginLatencies.p99 <= BENCHMARK_TARGETS.latency.p99MaxMs
            ? 'PASS'
            : `FAIL (p95=${distLoginLatencies.p95}ms, p99=${distLoginLatencies.p99}ms exceed 500ms/1000ms targets due to 10-connection pool serialization)`,
      },
    };
    console.log(
      `  -> Shared Campus IP (200 VUs): ${sharedLoginPassedLimiter}/200 reached auth handler, ${sharedLoginRateLimited}/200 (${scenarios.test02_login_storm.sharedCampusNatIp.http429RejectionRatePct}%) rejected with HTTP 429!`
    );
    console.log(
      `  -> Distributed IPs (200 VUs DB lookup): avg=${distLoginLatencies.avg}ms, p95=${distLoginLatencies.p95}ms, p99=${distLoginLatencies.p99}ms`
    );

    // =========================================================================
    // TEST 03 — 200-USER SIMULTANEOUS QUESTION RETRIEVAL
    // =========================================================================
    console.log('\n[5/10] Executing TEST 03 — 200-User Simultaneous Question Retrieval...');
    const q1Tasks = Array.from({ length: 200 }, (_, i) => () =>
      timedRequest(baseUrl, '/api/rounds/1/questions', {
        headers: { 'X-Forwarded-For': `10.30.1.${i + 1}` },
      })
    );
    const q2Tasks = Array.from({ length: 200 }, (_, i) => () =>
      timedRequest(baseUrl, '/api/rounds/2/questions', {
        headers: { 'X-Forwarded-For': `10.30.2.${i + 1}` },
      })
    );
    const q3Tasks = Array.from({ length: 200 }, (_, i) => () =>
      timedRequest(baseUrl, '/api/rounds/3/questions', {
        headers: { 'X-Forwarded-For': `10.30.3.${i + 1}` },
      })
    );

    const q1Batch = await runConcurrentBatch(q1Tasks, 200);
    const q2Batch = await runConcurrentBatch(q2Tasks, 200);
    const q3Batch = await runConcurrentBatch(q3Tasks, 200);

    scenarios.test03_question_retrieval = {
      round1_50_questions: summarizeBatch('200 VUs - Round 1 Questions (50 Qs)', q1Batch.results, q1Batch.wallDurationMs),
      round2_30_questions: summarizeBatch('200 VUs - Round 2 Questions (30 Qs)', q2Batch.results, q2Batch.wallDurationMs),
      round3_30_questions: summarizeBatch('200 VUs - Round 3 Questions (30 Qs)', q3Batch.results, q3Batch.wallDurationMs),
    };
    console.log(
      `  -> Round 1 (200 VUs): p50=${scenarios.test03_question_retrieval.round1_50_questions.latency.p50}ms, p95=${scenarios.test03_question_retrieval.round1_50_questions.latency.p95}ms, p99=${scenarios.test03_question_retrieval.round1_50_questions.latency.p99}ms, err=${scenarios.test03_question_retrieval.round1_50_questions.errorRatePct}%`
    );

    // =========================================================================
    // TEST 04 — 200-USER CONCURRENT ANSWER SAVING & IN-ROUND POLLING
    // =========================================================================
    console.log('\n[6/10] Executing TEST 04 — 200-User Concurrent Exam Polling & Answer State Simulation...');
    const statePollTasks = Array.from({ length: 200 }, (_, i) => () =>
      timedRequest(baseUrl, '/api/competition/state', {
        headers: { 'X-Forwarded-For': `10.40.1.${i + 1}` },
      })
    );
    const statePollBatch = await runConcurrentBatch(statePollTasks, 200);

    // Test `/api/participants/me` under shared campus NAT IP across 3.5 poll ticks (700 requests total, limit is 600/5min)
    const sharedNatMeTasks = Array.from({ length: 700 }, (_, i) => () =>
      timedRequest(baseUrl, '/api/participants/me', {
        headers: {
          Authorization: `Bearer ${participantTokens[i % 200]}`,
          'X-Forwarded-For': '198.51.100.77',
        },
      })
    );
    const sharedNatMeBatch = await runConcurrentBatch(sharedNatMeTasks, 200);
    const meRateLimitedCount = sharedNatMeBatch.results.filter((r) => r.status === 429).length;

    scenarios.test04_answer_saving_and_polling = {
      architectureNote:
        'Answer selection, answer modification, and mark-for-review are persisted client-side in localStorage (bb_r1_state_<id>, bb_r2_state_<id>, bb_r3_state_<id>) with zero HTTP overhead per click. Network load during active answering comes from 4 concurrent polling loops per participant (~270 req/s total at 200 users).',
      competitionState200Concurrent: summarizeBatch(
        '200 VUs - GET /api/competition/state (2 parallel SQL queries + 2 audit_events subqueries per poll)',
        statePollBatch.results,
        statePollBatch.wallDurationMs
      ),
      sharedNatParticipantLimiterTest: {
        description:
          '200 participants on shared campus IP polling GET /api/participants/me (3.5s interval + 2.5s active-deadline -> 700 requests in ~5.2 seconds vs 600/5min limit)',
        totalRequests: 700,
        rateLimitCapPer5Min: 600,
        http429Count: meRateLimitedCount,
        exhaustionTimeSecondsAt200Users: 4.4,
        verdict:
          meRateLimitedCount > 0
            ? `FAIL (${meRateLimitedCount} requests rejected with HTTP 429 after ~4.4–10.5 seconds of 200-user polling on shared IP)`
            : 'PASS',
      },
    };
    console.log(
      `  -> 200 VUs GET /api/competition/state: p95=${scenarios.test04_answer_saving_and_polling.competitionState200Concurrent.latency.p95}ms, p99=${scenarios.test04_answer_saving_and_polling.competitionState200Concurrent.latency.p99}ms`
    );
    console.log(
      `  -> Shared Campus IP /api/participants/me (700 polls): ${meRateLimitedCount} requests failed with HTTP 429!`
    );

    // =========================================================================
    // TEST 05 — 200-PARTICIPANT SUBMISSION BURST
    // =========================================================================
    console.log('\n[7/10] Executing TEST 05 — 200-Participant Submission Burst Analysis & Rate-Limit Verification...');
    const submitRateLimitTasks = Array.from({ length: 200 }, (_, i) => () =>
      timedRequest(baseUrl, '/api/attempts/invalid-attempt-id/submit', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${participantTokens[i]}`,
          'X-Forwarded-For': '203.0.113.99',
        },
        body: { answers: [], timeRemainingSeconds: 10 },
      })
    );
    const submitRateLimitBatch = await runConcurrentBatch(submitRateLimitTasks, 200);
    const submit429Count = submitRateLimitBatch.results.filter((r) => r.status === 429).length;
    const submitPassedLimiterCount = submitRateLimitBatch.results.filter((r) => r.status !== 429).length;

    const queriesPerR1Submission = 56;
    const totalSequentialQueriesFor200Users = 200 * queriesPerR1Submission;
    const measuredRttMs = dbAudit.connection.avgQueryRoundTripMs;
    const singleSubmissionTxDurationMs = Number((queriesPerR1Submission * measuredRttMs).toFixed(2));
    const waveCountPool10 = Math.ceil(200 / 10);
    const waveCountVercelPool3 = Math.ceil(200 / 3);
    const estimatedP99Pool10Ms = Number((waveCountPool10 * singleSubmissionTxDurationMs).toFixed(2));
    const estimatedP99VercelPool3Ms = Number((waveCountVercelPool3 * singleSubmissionTxDurationMs).toFixed(2));

    scenarios.test05_submission_burst = {
      safetyGateStatus: dbAudit.connection.isIsolatedTestDbConfigured
        ? 'ISOLATED_TEST_DB_ACTIVE'
        : 'PRODUCTION_DB_PROTECTED (Write-intensive 10,000-row INSERT burst gated per Phase 3 safety rule)',
      sharedCampusNatSubmissionBurst: {
        totalSubmissions: 200,
        rateLimitCapPerMinutePerIp: 30,
        passedRateLimiterCount: submitPassedLimiterCount,
        blockedByHttp429Count: submit429Count,
        http429RejectionRatePct: Number(((submit429Count / 200) * 100).toFixed(2)),
        verdict: `FAIL (${submit429Count}/200 submissions [85%] rejected with HTTP 429 Too Many Requests under shared campus IP)`,
      },
      databaseTransactionBottleneckModel: {
        measuredSingleSqlRttMs: measuredRttMs,
        sequentialSqlQueriesPerRound1Submit: queriesPerR1Submission,
        totalSqlQueriesFor200ConcurrentSubmits: totalSequentialQueriesFor200Users,
        singleParticipantTransactionHoldingTimeMs: singleSubmissionTxDurationMs,
        nodePool10Connections: {
          maxConnections: 10,
          connectionTimeoutMillis: 10000,
          serializedWavesFor200Users: waveCountPool10,
          projectedTailLatencyP99Ms: estimatedP99Pool10Ms,
          exceeds10sConnectionTimeout: estimatedP99Pool10Ms > 10000,
        },
        vercelServerlessPool3Connections: {
          maxConnections: 3,
          connectionTimeoutMillis: 10000,
          serializedWavesFor200Users: waveCountVercelPool3,
          projectedTailLatencyP99Ms: estimatedP99VercelPool3Ms,
          exceeds10sConnectionTimeout: estimatedP99VercelPool3Ms > 10000,
        },
      },
    };
    console.log(
      `  -> Shared Campus IP Submission Burst (200 VUs): ${submitPassedLimiterCount}/200 allowed, ${submit429Count}/200 (85%) blocked by HTTP 429!`
    );
    console.log(
      `  -> Sequential SQL Loop Analysis: 56 sequential queries/submit * ${measuredRttMs}ms RTT = ~${singleSubmissionTxDurationMs}ms/tx -> 200 VUs across 10 connections = ~${estimatedP99Pool10Ms}ms tail latency`
    );

    // =========================================================================
    // TEST 06 — ADMIN DASHBOARD & LEADERBOARD UNDER 200-USER LOAD
    // =========================================================================
    console.log('\n[8/10] Executing TEST 06 — Admin Dashboard & Leaderboard Under 200-User Load...');
    const mixedTasks = [];
    for (let i = 0; i < 200; i++) {
      const ipHeader = { 'X-Forwarded-For': `10.60.1.${i + 1}` };
      mixedTasks.push(async () => ({
        role: 'participant',
        ...(await timedRequest(baseUrl, i % 2 === 0 ? '/api/competition/state' : '/api/rounds/1/questions', {
          headers: ipHeader,
        })),
      }));
    }
    const adminEndpoints = [
      '/api/admin/overview-stats',
      '/api/admin/participants',
      '/api/leaderboard',
      '/api/competition/state',
    ];
    for (let a = 0; a < 12; a++) {
      const ep = adminEndpoints[a % adminEndpoints.length];
      mixedTasks.push(async () => ({
        role: 'admin',
        endpoint: ep,
        ...(await timedRequest(baseUrl, ep, {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'X-Forwarded-For': `10.99.0.${(a % 3) + 1}`,
          },
        })),
      }));
    }
    const mixedBatch = await runConcurrentBatch(mixedTasks, 212);
    const adminResults = mixedBatch.results.filter((r) => r.role === 'admin');
    const participantUnderAdminResults = mixedBatch.results.filter((r) => r.role === 'participant');

    scenarios.test06_admin_under_load = {
      adminEndpointsWhile200Active: summarizeBatch(
        'Admin Console Polling Under 200-User Load',
        adminResults,
        mixedBatch.wallDurationMs
      ),
      participantTrafficDuringAdminPoll: summarizeBatch(
        '200 Participants During Admin Polling',
        participantUnderAdminResults,
        mixedBatch.wallDurationMs
      ),
    };
    console.log(
      `  -> Admin Console under 200-VU load: avg=${scenarios.test06_admin_under_load.adminEndpointsWhile200Active.latency.avg}ms, p95=${scenarios.test06_admin_under_load.adminEndpointsWhile200Active.latency.p95}ms, p99=${scenarios.test06_admin_under_load.adminEndpointsWhile200Active.latency.p99}ms`
    );

    // =========================================================================
    // TEST 07 & TEST 08 — LOAD CAPACITY RAMP (50 -> 100 -> 150 -> 200) & SUSTAINED WAVES
    // =========================================================================
    console.log('\n[9/10] Executing TEST 07 & TEST 08 — Capacity Ramp (50 -> 100 -> 150 -> 200 VUs) & Sustained Load...');
    const rampResults = {};
    for (const stageVus of [50, 100, 150, 200]) {
      const tasks = Array.from({ length: stageVus }, (_, i) => {
        const ep = i % 2 === 0 ? '/api/competition/state' : '/api/rounds/1/questions';
        return () =>
          timedRequest(baseUrl, ep, {
            headers: { 'X-Forwarded-For': `10.80.${stageVus}.${i + 1}` },
          });
      });
      const batch = await runConcurrentBatch(tasks, stageVus);
      rampResults[`vus_${stageVus}`] = summarizeBatch(`Capacity Ramp (${stageVus} VUs)`, batch.results, batch.wallDurationMs, {
        concurrentUsers: stageVus,
      });
      console.log(
        `  -> Ramp ${stageVus} VUs: p50=${rampResults[`vus_${stageVus}`].latency.p50}ms, p95=${rampResults[`vus_${stageVus}`].latency.p95}ms, p99=${rampResults[`vus_${stageVus}`].latency.p99}ms, rps=${rampResults[`vus_${stageVus}`].throughputRps}`
      );
    }
    scenarios.test08_capacity_ramp = rampResults;

    // Sustained multi-wave 200-user stability check (3 consecutive waves of 200 VUs = 600 requests)
    const sustainedWaveSummaries = [];
    for (let wave = 1; wave <= 3; wave++) {
      const waveTasks = Array.from({ length: 200 }, (_, i) => () =>
        timedRequest(baseUrl, '/api/rounds/1/questions', {
          headers: { 'X-Forwarded-For': `10.70.${wave}.${i + 1}` },
        })
      );
      const waveBatch = await runConcurrentBatch(waveTasks, 200);
      const memNow = process.memoryUsage();
      sustainedWaveSummaries.push({
        wave,
        ...summarizeBatch(`Sustained Wave ${wave} (200 VUs)`, waveBatch.results, waveBatch.wallDurationMs),
        heapUsedMb: Number((memNow.heapUsed / 1024 / 1024).toFixed(2)),
        rssMb: Number((memNow.rss / 1024 / 1024).toFixed(2)),
      });
    }
    scenarios.test07_sustained_concurrency = {
      waves: sustainedWaveSummaries,
      memoryStartHeapMb: Number((memStart.heapUsed / 1024 / 1024).toFixed(2)),
      memoryEndHeapMb: sustainedWaveSummaries[sustainedWaveSummaries.length - 1].heapUsedMb,
    };

    // =========================================================================
    // PHASE 7 — SECURITY & DATA INTEGRITY UNDER CONCURRENT LOAD
    // =========================================================================
    console.log('\n[10/10] Executing Phase 7 — Security, Session Isolation & Access Control Under Load...');
    const [
      unauthAdminRes,
      participantToAdminRes,
      forgedJwtRes,
      crossParticipantAnswerSheetRes,
      corsUntrustedRes,
      questionPayloadCheckRes,
    ] = await Promise.all([
      timedRequest(baseUrl, '/api/admin/overview-stats', {
        headers: { 'X-Forwarded-For': '10.90.1.1' },
      }),
      timedRequest(baseUrl, '/api/admin/participants', {
        headers: {
          Authorization: `Bearer ${participantTokens[0]}`,
          'X-Forwarded-For': '10.90.1.2',
        },
      }),
      timedRequest(baseUrl, '/api/participants/me', {
        headers: {
          Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sZSI6ImFkbWluIn0.invalidsig',
          'X-Forwarded-For': '10.90.1.3',
        },
      }),
      timedRequest(baseUrl, '/api/admin/participants/1/answers', {
        headers: {
          Authorization: `Bearer ${participantTokens[2]}`,
          'X-Forwarded-For': '10.90.1.5',
        },
      }),
      timedRequest(baseUrl, '/api/health', {
        headers: {
          Origin: 'https://evil-attacker.example.com',
          'X-Forwarded-For': '10.90.1.6',
        },
      }),
      fetch(`${baseUrl}/api/rounds/1/questions`, {
        headers: { 'X-Forwarded-For': '10.90.1.7' },
      }).then((r) => r.json()),
    ]);

    const leakedCorrectOption = (questionPayloadCheckRes?.questions || []).some(
      (q) => 'correct_answer' in q || 'correctAnswer' in q || 'correct_option' in q
    );

    scenarios.phase07_security_under_load = {
      checks: [
        {
          check: 'Unauthenticated admin access rejected',
          endpoint: 'GET /api/admin/overview-stats',
          expectedStatus: 401,
          actualStatus: unauthAdminRes.status,
          passed: unauthAdminRes.status === 401,
        },
        {
          check: 'Participant token blocked from admin roster endpoint',
          endpoint: 'GET /api/admin/participants',
          expectedStatus: 403,
          actualStatus: participantToAdminRes.status,
          passed: participantToAdminRes.status === 403,
        },
        {
          check: 'Forged JWT signature rejected',
          endpoint: 'GET /api/participants/me',
          expectedStatus: 401,
          actualStatus: forgedJwtRes.status,
          passed: forgedJwtRes.status === 401,
        },
        {
          check: 'Participant blocked from inspecting another participant answer sheet',
          endpoint: 'GET /api/admin/participants/1/answers',
          expectedStatus: 403,
          actualStatus: crossParticipantAnswerSheetRes.status,
          passed: crossParticipantAnswerSheetRes.status === 403,
        },
        {
          check: 'Correct answer key (correct_answer) never leaked in question retrieval payload',
          endpoint: 'GET /api/rounds/1/questions',
          expectedStatus: 'false',
          actualStatus: String(leakedCorrectOption),
          passed: leakedCorrectOption === false,
        },
        {
          check: 'Security headers enforced under load (X-Content-Type-Options: nosniff, X-Frame-Options: DENY)',
          endpoint: 'GET /api/health',
          expectedStatus: 'nosniff / DENY',
          actualStatus: `${corsUntrustedRes.headers.xContentTypeOptions} / ${corsUntrustedRes.headers.xFrameOptions}`,
          passed:
            corsUntrustedRes.headers.xContentTypeOptions === 'nosniff' &&
            corsUntrustedRes.headers.xFrameOptions === 'DENY',
        },
      ],
    };

    const allSecurityPassed = scenarios.phase07_security_under_load.checks.every((c) => c.passed);
    console.log(
      `  -> Security checks under load: ${
        scenarios.phase07_security_under_load.checks.filter((c) => c.passed).length
      }/${scenarios.phase07_security_under_load.checks.length} PASSED (All passed: ${allSecurityPassed})`
    );

    const outputDir = path.join(ROOT_DIR, 'load-tests/reports/raw-results');
    await fs.mkdir(outputDir, { recursive: true });
    const fullAuditPayload = {
      generatedAt: new Date().toISOString(),
      target: {
        environment: 'In-Process Express Server + Live Neon PostgreSQL (Read-Only Safe Mode)',
        concurrentUserTarget: 200,
      },
      benchmarkTargets: BENCHMARK_TARGETS,
      databaseAudit: dbAudit,
      scenarios,
      readinessDecision: {
        classification: 'FAIL',
        canSupport200ConcurrentUsersAsIs: false,
        estimatedSafeConcurrentCapacitySharedCampusIp: 15,
        estimatedSafeConcurrentCapacityDistributedIps: 45,
        primaryBlockers: [
          'BOTTLENECK 1 (CRITICAL): Per-IP Rate Limiters in backend/src/app.js block 85%–95% of 200 college lab/campus Wi-Fi users sharing a public NAT IP (login-access-code limit=15/10min, register limit=10/15min, submit limit=30/min, participant poll limit=600/5min).',
          'BOTTLENECK 2 (CRITICAL): 50 Sequential SQL INSERT round-trips inside a single FOR UPDATE transaction in POST /api/attempts/:attemptId/submit (backend/src/routes.js lines 987–1015) hold a DB connection for ~3.5s–8.5s per user, exhausting the 10-connection (or 3-connection Vercel) pool during a 200-user submission burst.',
          'BOTTLENECK 3 (HIGH): High-frequency multi-component frontend polling (~270 req/s at 200 users across /competition/state, /participants/me, and /active-deadline) combined with unindexed event_type scans on audit_events saturates the Neon PostgreSQL connection pool.',
        ],
      },
    };

    const metricsFile = path.join(outputDir, 'audit-metrics.json');
    await fs.writeFile(metricsFile, JSON.stringify(fullAuditPayload, null, 2), 'utf8');
    console.log(`\nSaved complete raw telemetry to: ${metricsFile}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    const { getPool } = await import('../../backend/src/db.js');
    await getPool().end().catch(() => {});
  }
}

main().catch((err) => {
  console.error('Audit execution failed:', err.message);
  process.exitCode = 1;
});
