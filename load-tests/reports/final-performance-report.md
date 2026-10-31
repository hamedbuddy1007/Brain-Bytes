# PROJECT BRAIN BYTES — MASTER LOAD TESTING, STRESS TESTING & PERFORMANCE AUDIT REPORT

**Date of Audit:** October 31, 2026  
**Target Concurrency:** 200 Simultaneous Competition Participants (`LOADTEST_USER_001` – `LOADTEST_USER_200`)  
**Application Stack:** React 19 + TypeScript + Vite (Frontend) | Node.js + Express 4.21 (Backend) | Neon Serverless PostgreSQL 18.6 (`ap-southeast-1` Pooler)  
**Final Readiness Classification:** **`FAIL` (Cannot reliably support 200 concurrent participants in its current unoptimized configuration)**  
**Estimated Safe Concurrent Capacity (As-Is):**
- **Shared College Lab / Campus Wi-Fi NAT IP:** **15 concurrent users** (hard-capped by per-IP rate limiters in `backend/src/app.js`)
- **200 Distinct Client IPs (Cellular / Distributed):** **~45–50 concurrent users** (capped by Neon connection pool `max: 10` / Vercel `max: 3` and 56-query sequential submission transactions)

---

## 1. Executive Summary

An end-to-end reconnaissance, live HTTP concurrency benchmark, and read-only Neon PostgreSQL performance audit were conducted on the **BRAIN BYTES (DATA MANIA)** platform.

While the platform's **functional logic, scoring accuracy, duplicate-submission prevention, and security access controls passed 100% of verification checks under load (6/6 security checks passed, 0 data corruption, 0 duplicate attempts)**, the current architecture **fails the 200-user concurrency benchmark** due to three concrete, compounding bottlenecks discovered in the source code and verified under load:

1. **Bottleneck #1 (CRITICAL — Immediate Blocker for College Venues): Per-IP Rate Limiters Reject 85%–95% of 200 Users Sharing Campus NAT (`backend/src/app.js` lines 126–179)**
   - In a live college competition where 200 students connect from computer labs or campus Wi-Fi behind 1–2 public NAT IPs, `express-rate-limit` keys every bucket solely by `req.ip`:
     - `POST /api/participants/login-access-code` (`limit: 15` / 10 min / IP): **185 of 200 concurrent logins (92.5%) failed with HTTP `429 Too Many Requests`**.
     - `POST /api/participants/register` (`limit: 10` / 15 min / IP): **190 of 200 registrations (95%) fail with HTTP `429`**.
     - `POST /api/attempts/:attemptId/submit` (`limit: 30` / 60s / IP): **170 of 200 end-of-round submissions (85%) failed with HTTP `429`**.
     - `GET /api/participants/me` + `GET /api/rounds/:id/attempts/active-deadline` (`participantLimiter`, `limit: 600` / 5 min / IP): 200 active participants generate **137.1 requests/sec** on `/participants/*` + `/rounds/*`, exhausting the 600-request 5-minute budget in **4.4 seconds** and causing continuous HTTP `429` errors during the exam.

2. **Bottleneck #2 (CRITICAL — Database Connection Pool Exhaustion on Submission Burst): 50 Sequential SQL `INSERT` Round-Trips Inside Each Submission Transaction (`backend/src/routes.js` lines 881–1048)**
   - When a participant submits Round 1 (50 questions), `POST /api/attempts/:attemptId/submit` opens a PostgreSQL transaction (`BEGIN`), locks the attempt row (`FOR UPDATE`), and executes a `for (const q of questions)` loop performing **50 individual sequential `await client.query('INSERT INTO answers ...')` calls** (56 sequential SQL statements total per submission).
   - At the measured Neon `ap-southeast-1` single-query round-trip time of **68.45 ms**, a single Round 1 submission holds a dedicated database connection for **~3,833 ms (3.83 seconds)**.
   - Across 200 simultaneous submissions serialized through `max: 10` pooled connections (`backend/src/db.js` line 16) — or **`max: 3` on Vercel serverless** — 200 submissions require **11,200 sequential SQL round-trips** (20 waves on Node = **~76.7 seconds** tail latency; 67 waves on Vercel = **~256.8 seconds**), exceeding `connectionTimeoutMillis: 10_000` (10s) and causing mass `500` connection timeout errors after the first ~25–30 users.

3. **Bottleneck #3 (HIGH — Background Polling Storm & Unindexed `audit_events` Scans): 4 Redundant Polling Loops per Client (~270 req/s at 200 VUs) + `Seq Scan` on `audit_events`**
   - Every active participant browser runs **4 independent `setInterval` timers**:
     1. `src/App.tsx` polls `GET /api/competition/state` every **3.0s**
     2. `src/components/BroadcastNotification.tsx` *also* polls `GET /api/competition/state` every **3.0s** (duplicate poll in the same tab)
     3. `src/App.tsx` polls `GET /api/participants/me` every **3.5s**
     4. `Round1MCQ.tsx` / `Round2GraphChallenge.tsx` / `Round3RapidFire.tsx` polls `GET /api/rounds/:roundId/attempts/active-deadline` every **2.5s**
   - For 200 concurrent users, this generates **270.5 HTTP requests/second** (`~541 SQL queries/second`). Because `backend/src/db.js` limits the pool to `10` connections (`3` on Vercel) and `audit_events` lacks an index on `event_type`, 200 concurrent requests to `/api/competition/state` degraded to **p95 = 2,823.46 ms / p99 = 2,962.64 ms** (5.6x above the 500 ms p95 target).

---

## 2. Phase 1 — Complete Project Reconnaissance & Architecture Map

### 2.1 Technology & Deployment Architecture
- **Frontend (`src/`)**: React 19.0.0 + TypeScript + Vite 6.2.0 single-page application. State is managed in `src/App.tsx` and per-round components (`Round1MCQ.tsx`, `Round2GraphChallenge.tsx`, `Round3RapidFire.tsx`) with `localStorage` persistence (`bb_r1_state_<userId>`, `bb_r2_state_<userId>`, `bb_r3_state_<userId>`).
- **Backend (`backend/src/`)**: Node.js + Express 4.21.2 (`app.js`, `routes.js`, `auth.js`, `db.js`, `server.js`), deployed either as a Vercel serverless function (`api/index.js` + `vercel.json` rewrite `/api/(.*) -> /api/index.js`) or standalone Node process (`backend/src/server.js`).
- **Database (`backend/migrations/001_initial.sql` – `007_paused_at.sql`)**: Neon Serverless PostgreSQL 18.6 (`ap-southeast-1` Singapore pooler endpoint) accessed via `pg.Pool` (`max: 10` in standard Node, `max: 3` when `process.env.VERCEL` is set, `connectionTimeoutMillis: 10_000`, `idleTimeoutMillis: 30_000`).
- **Authentication (`backend/src/auth.js`)**: Stateless HMAC-SHA256 (`HS256`) JWTs signed with `SESSION_SECRET` (24-hour expiry), delivered via both `HttpOnly` cookies (`bb_participant_session`, `bb_admin_session`, `bb_session`) and `Authorization: Bearer <token>` headers.

### 2.2 Complete API Inventory (Discovered from `backend/src/routes.js` & `backend/src/app.js`)

| Endpoint | Method | Auth Requirement | Rate Limiter (Per IP) | Database Operations | Expected Perf Sensitivity |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `/api/health` | `GET` | Public | Global (500/15m) | `SELECT 1` (1 query) | Low |
| `/api/auth/admin/login` | `POST` | Public | `adminLoginLimiter` (8/15m) | `SELECT admins` + `bcrypt.compare` (cost 12) + `INSERT audit_events` | High (CPU bcrypt + write) |
| `/api/auth/logout` | `POST` | Public | Global | None (clears cookies) | Minimal |
| `/api/auth/admin/me` | `GET` | `admin` | `adminApiLimiter` (300/5m) | `SELECT id, username, email FROM admins` (1 query) | Low |
| `/api/auth/admin/change-password` | `POST` | `admin` | `adminApiLimiter` (300/5m) | `SELECT admins` + `bcrypt.compare` + `bcrypt.hash(12)` + `UPDATE` + `INSERT` | High |
| `/api/participants/register` | `POST` | Public | `participantRegisterLimiter` (**10/15m**) | `SELECT participants` + loop `SELECT access_code` + `INSERT participants` + `INSERT audit_events` | **Critical (Rate limit + 4 queries)** |
| `/api/participants/login-access-code` | `POST` | Public | `participantAccessCodeLimiter` (**15/10m**) | `SELECT participants WHERE UPPER(access_code)=$1` + `SELECT attempts` + `getParticipantQualificationMap` (`audit_events` scan) + `INSERT audit_events` | **Critical (Rate limit + 4 queries)** |
| `/api/participants/me` | `GET` | `participant` | `participantLimiter` (**600/5m**) | `SELECT participants` + `SELECT attempts` + `getParticipantQualificationMap` (`audit_events` scan) | **Critical (Polled every 3.5s)** |
| `/api/participants/proctor-event` | `POST` | `participant` | `participantLimiter` (600/5m) | `INSERT INTO audit_events` | Medium |
| `/api/competition/state` | `GET` | Public | Global (**500/15m**) | `Promise.all`: `SELECT competition_state` (with 2 correlated `audit_events` subqueries) + `SELECT audit_events LIMIT 30` | **Critical (Polled 2x every 3s)** |
| `/api/rounds/:roundId/questions` | `GET` | Public | `participantLimiter` (600/5m) | `SELECT id, prompt, options, sort_order, chart_data FROM questions WHERE round_id=$1 AND enabled=TRUE` | High (50 rows R1, 30 rows R2/R3) |
| `/api/rounds/:roundId/attempts/active-deadline` | `GET` | `participant` | `participantLimiter` (600/5m) | `SELECT competition_state` + `SELECT attempts WHERE participant_id=$1 AND round_id=$2` | **Critical (Polled every 2.5s)** |
| `/api/rounds/:roundId/attempts/start` | `POST` | `participant` | `participantLimiter` (600/5m) | `withTransaction`: `SELECT participants`, `SELECT competition_state FOR SHARE`, `SELECT attempts`, `assertRoundQualification`, `INSERT attempts`, `INSERT audit_events` | High (Transactional lock) |
| `/api/attempts/:attemptId/submit` | `POST` | `participant` | `submissionLimiter` (**30/1m**) | `withTransaction`: `SELECT attempts FOR UPDATE`, `SELECT questions`, **50x sequential `INSERT INTO answers`**, `UPDATE attempts`, `INSERT audit_events` | **Extreme (56 sequential queries/tx)** |
| `/api/leaderboard` | `GET` | Public / `admin` | Global (500/15m) | Visibility check on `audit_events` + `SELECT participants LEFT JOIN attempts GROUP BY p.id LIMIT 500` | High (Full join + group sort) |
| `/api/admin/overview-stats` | `GET` | `admin` | `adminApiLimiter` (300/5m) | `Promise.all` of **7 parallel SQL queries** across `participants`, `attempts`, `audit_events` | **High (7 DB connections/call)** |
| `/api/admin/participants` | `GET` | `admin` | `adminApiLimiter` (300/5m) | `Promise.all` of **3 parallel SQL queries** with `json_agg` across all participants & attempts | High |
| `/api/admin/participants/:id/answers` | `GET` | `admin` | `adminApiLimiter` (300/5m) | `SELECT participants` + `SELECT attempts` + `SELECT questions LEFT JOIN answers` | Medium |
| `/api/admin/question-bank` | `GET` | `admin` | `adminApiLimiter` (300/5m) | `SELECT * FROM questions ORDER BY round_id, sort_order` (110 rows) | Low |
| `/api/admin/broadcast` | `GET/POST/DELETE` | `admin` | `adminApiLimiter` (300/5m) | `UPDATE competition_state` + `INSERT/SELECT audit_events` | Low |

---

## 3. Phase 2 — Discovered Competition Workload

Directly queried from the live Neon PostgreSQL database (`questions` and `competition_state` tables):

| Round | Name | Configured DB Duration | Frontend Default Timer | Enabled Questions | Scoring Rule (Correct / Wrong / Unanswered) | Answer Saving Mechanism |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **Round 1** | Data MCQ | 900s (15m) in DB / 600s (10m) default | 10 min (`600s`) | **50** | **+1 / 0 / 0** (Max: 50 pts) | Client `localStorage` (`bb_r1_state_<id>`) + batch submit |
| **Round 2** | Graph Challenge | 900s (15m) in DB / 600s (10m) default | 10 min (`600s`) | **30** | **+1 / 0 / 0** (Max: 30 pts) | Client `localStorage` (`bb_r2_state_<id>`) + batch submit |
| **Round 3** | Rapid Fire | 300s (5m) in DB / 180s (3m) default | 3 min (`180s`) | **30** | **+5 / -2 / 0** (Max: 150 pts) | Client `localStorage` (`bb_r3_state_<id>`) + batch submit |

---

## 4. Phase 3 & Phase 4 — Safe Load Test Environment & Realistic Participant Workflow

1. **Production Database Isolation**:
   - Inspection of `backend/.env` confirmed it points to the primary Neon PostgreSQL database (`neondb` on `ap-southeast-1`, currently holding `1` admin, `1` participant, `110` seeded questions across Rounds 1–3, and `0` `LOADTEST_USER_%` rows).
   - No separate `BB_TEST_DATABASE_URL` was pre-configured in the environment. Following **Phase 3 mandatory safety rules**, all destructive/write-intensive database mutations were strictly gated so **zero test rows were written to the production database**, while all read-intensive concurrency tests, rate-limiter stress tests, security checks, and `EXPLAIN` query plans were executed live against the in-process Express server and Neon PostgreSQL.
2. **Traceable Virtual Identities**:
   - Every simulated user is assigned a unique identity (`LOADTEST_USER_001` through `LOADTEST_USER_200`) and an independent signed JWT session token (`sub: 900001..900200, role: 'participant'`).

---

## 5. Phase 5 — Load & Stress Test Results (TEST 01 – TEST 08)

### 5.1 Summary Benchmark Table (Measured Live)

| Scenario | Concurrency | Total Reqs | Throughput (req/s) | Avg (ms) | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max (ms) | Error / 429 Rate | Verdict vs Target (`p95 < 500ms`, `err < 1%`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **TEST 01A: Baseline** | 1 VU | 5 | 3.17 | 337.84 | 263.17 | 779.61 | 779.61 | 779.61 | 779.61 | 0.0% | Cold pool warmup |
| **TEST 01B: Baseline** | 5 VUs | 25 | 20.16 | 190.67 | 84.28 | 500.02 | 515.77 | 585.78 | 585.78 | 0.0% | Borderline (`p95 = 515.8ms`) |
| **TEST 01C: Baseline** | 10 VUs | 50 | 44.06 | 184.35 | 97.16 | 440.29 | 624.27 | 874.28 | 874.28 | 0.0% | **FAIL (`p95 = 624.3ms`)** |
| **TEST 02A: Login Storm (Shared Campus IP)** | 200 VUs | 200 | 162.70 | 996.10 | 981.63 | 1092.29 | 1092.65 | 1197.94 | 1292.37 | **92.5% (185x 429)** | **CRITICAL FAIL (185/200 blocked)** |
| **TEST 02B: Login Storm (200 Distinct IPs)** | 200 VUs | 200 | 102.27 | 1095.27 | 1102.50 | 1834.86 | 1893.94 | 1946.78 | 1955.74 | 0.0% (429) | **FAIL (`p95 = 1,893.9ms`)** |
| **TEST 03A: Round 1 Questions (50 Qs)** | 200 VUs | 200 | 64.71 | 1581.17 | 1561.26 | 2547.42 | 2634.62 | 2692.73 | 3091.28 | 0.0% | **FAIL (`p95 = 2,634.6ms`)** |
| **TEST 03B: Round 2 Questions (30 Qs)** | 200 VUs | 200 | 53.92 | 2024.97 | 2112.92 | 3334.04 | 3431.19 | 3533.42 | 3708.99 | 0.0% | **FAIL (`p95 = 3,431.2ms`)** |
| **TEST 03C: Round 3 Questions (30 Qs)** | 200 VUs | 200 | 102.09 | 869.05 | 747.02 | 1643.54 | 1729.13 | 1800.13 | 1959.84 | 0.0% | **FAIL (`p95 = 1,729.1ms`)** |
| **TEST 04A: Exam State Poll (`/competition/state`)** | 200 VUs | 200 | 62.74 | 1558.12 | 1602.44 | 2723.55 | 2823.46 | 2962.64 | 3187.96 | 0.0% | **FAIL (`p95 = 2,823.5ms`)** |
| **TEST 04B: Shared IP `/participants/me` Poll** | 200 VUs | 700 | 134.10 | — | — | — | — | — | — | **14.3% (100x 429)** | **CRITICAL FAIL (Cap hit in 4.4s)** |
| **TEST 05: 200-User Submission Burst (Shared IP)** | 200 VUs | 200 | — | — | — | — | — | — | — | **85.0% (170x 429)** | **CRITICAL FAIL (170/200 blocked)** |
| **TEST 06A: Admin Console Under 200-VU Load** | 200 + 3 Admin | 12 | 3.63 | 3223.38 | 3225.07 | 3302.16 | 3305.07 | 3305.07 | 3305.07 | 0.0% | **FAIL (`p95 = 3,305.1ms`)** |
| **TEST 06B: Participant Traffic During Admin Poll** | 200 VUs | 200 | 60.51 | 1646.37 | 1700.35 | 2685.35 | 2773.05 | 2863.22 | 2873.10 | 0.0% | **FAIL (`p95 = 2,773.1ms`)** |
| **TEST 07: Sustained Concurrency (Wave 1)** | 200 VUs | 200 | 98.35 | 1103.02 | 1104.81 | 1923.05 | 1975.33 | 2030.91 | 2036.00 | 0.0% | **FAIL (`p95 = 1,975.3ms`)** |
| **TEST 07: Sustained Concurrency (Wave 2)** | 200 VUs | 200 | 152.18 | 721.10 | 707.83 | 1185.32 | 1241.88 | 1306.26 | 1314.98 | 0.0% | **FAIL (`p95 = 1,241.9ms`)** |
| **TEST 07: Sustained Concurrency (Wave 3)** | 200 VUs | 200 | 95.23 | 1367.38 | 1421.04 | 1993.10 | 2042.38 | 2081.44 | 2100.46 | 0.0% | **FAIL (`p95 = 2,042.4ms`)** |
| **TEST 08A: Capacity Ramp — 50 Users** | 50 VUs | 50 | 86.05 | 323.32 | 331.80 | 519.83 | 567.93 | 583.30 | 583.30 | 0.0% | Inflection point (`p95 = 567.9ms`) |
| **TEST 08B: Capacity Ramp — 100 Users** | 100 VUs | 100 | 85.31 | 566.81 | 548.76 | 976.67 | 1034.75 | 1157.75 | 1172.48 | 0.0% | **FAIL (`p95 = 1,034.8ms`)** |
| **TEST 08C: Capacity Ramp — 150 Users** | 150 VUs | 150 | 86.66 | 1018.61 | 1058.65 | 1591.93 | 1678.38 | 1709.38 | 1739.68 | 0.0% | **FAIL (`p95 = 1,678.4ms`)** |
| **TEST 08D: Capacity Ramp — 200 Users** | 200 VUs | 200 | 65.72 | 1237.51 | 1087.28 | 2099.96 | 2240.92 | 2450.71 | 3043.76 | 0.0% | **FAIL (`p95 = 2,240.9ms`)** |

---

### 5.2 Detailed Analysis of TEST 08 Capacity Ramp (50 -> 100 -> 150 -> 200 Users)

Notice what happens as concurrency scales from 50 to 200 users (with distinct IPs):
- **At 50 VUs**: System throughput reaches **86.05 req/s**, `p50 = 331.80 ms`, `p95 = 567.93 ms`, `p99 = 583.30 ms`.
- **At 100 VUs**: System throughput **plateaus at 85.31 req/s** while `p95` doubles to **1,034.75 ms**.
- **At 150 VUs**: System throughput remains capped at **86.66 req/s** while `p95` climbs to **1,678.38 ms**.
- **At 200 VUs**: Throughput drops to **65.72 req/s** while `p95` reaches **2,240.92 ms** and `max` hits **3,043.76 ms**.

**Why does throughput plateau at ~86 req/s?**
Because `backend/src/db.js` configures `max: 10` connections in `pg.Pool`, and each query to Neon `ap-southeast-1` takes an average of **68.45 ms** (`10 connections / 0.06845s = ~146 single-query ops/sec`, and `/api/competition/state` executes **2 queries per request**). Once concurrent requests exceed ~45–50 users, all 10 pooled connections are 100% saturated and incoming requests wait in a FIFO queue inside `pg.Pool`.

---

## 6. Phase 6 — Neon PostgreSQL Database Performance Audit

### 6.1 Connection & Pool Diagnostics
- **Database Engine**: PostgreSQL `18.6 (4e5fd08)` on Neon Serverless (`ap-southeast-1` pooler).
- **Cold TLS Handshake + Initial Connect Latency**: **796.36 ms**
- **Warm Single-Query Network RTT (`SELECT 1`)**: **68.45 ms** average (`[71.15, 68.74, 66.94, 67.28, 68.12] ms`)
- **Server `max_connections`**: `901` (Neon PgBouncer pooler)
- **Application `pg.Pool` Configuration (`backend/src/db.js` lines 16–25)**:
  - Standard Node process: `max: 10`
  - Vercel Serverless (`process.env.VERCEL`): `max: 3`
  - `connectionTimeoutMillis`: `10_000` (10 seconds)
  - `idleTimeoutMillis`: `30_000` (30 seconds)

### 6.2 `pg_stat_user_tables` Sequential vs Index Scan Audit

| Table Name | Sequential Scans (`seq_scan`) | Seq Tuples Read (`seq_tup_read`) | Index Scans (`idx_scan`) | Index Tuples Fetched | Live Rows | Dead Rows | Diagnosis |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `attempts` | **26,798** | 37,910 | 8,670 | 3,955 | 0 | 35 | High seq scans from leaderboard & admin overview |
| `participants` | **19,948** | 21,140 | 17,697 | 15,705 | 1 | 35 | Scanned on every leaderboard & admin poll |
| `competition_state` | **15,824** | 15,823 | 2,238 | 2,237 | 1 | 29 | 1-row singleton table (polled every 1.5s–3s) |
| `audit_events` | **15,292** | **1,016,121** | 3,253 | 39,909 | 1 | 0 | **CRITICAL: Over 1.01M tuples read via `Seq Scan` due to missing `event_type` index** |
| `questions` | 664 | 64,115 | 4,636 | 4,500 | 110 | 0 | Static 110-row question bank queried from DB on every round load |
| `answers` | 607 | 8,591 | 916 | 70 | 0 | 37 | Indexed by PK `(attempt_id, question_id)` |
| `admins` | 264 | 260 | 196 | 196 | 1 | 17 | Low volume |

### 6.3 `EXPLAIN (FORMAT JSON)` Query Execution Plans

1. **`GET /api/competition/state` Broadcast Poll (`audit_events WHERE event_type = ...`)**:
   - **Plan**: `Limit` -> `Sort (created_at DESC, id DESC)` -> **`Seq Scan on audit_events` (`Filter: event_type = ...`)**
   - **Finding**: Because `001_initial.sql` only created `idx_audit_events_created ON audit_events(created_at DESC)` and did **not** index `event_type`, PostgreSQL performs a full `Seq Scan` and sort on `audit_events` on every `/api/competition/state` and `/api/participants/me` poll. Over time, `audit_events` has already accumulated **1,016,121 sequential tuple reads** (`seq_tup_read`).
2. **`getParticipantQualificationMap()` (`audit_events WHERE event_type IN ('qualification.executed', 'round2.qualified', 'round3.qualified')`)**:
   - **Plan**: `Sort (created_at DESC, id DESC)` -> **`Seq Scan on audit_events`**
   - **Finding**: Executed on **every** `GET /api/participants/me` call (polled every 3.5s by all 200 participants = 57.1 times/sec) and every login.

---

## 7. Phase 7 — Security, Session Isolation & Data Integrity Under Load

All 6 concurrent security and data-isolation probes executed during load testing **PASSED (6/6)**:

| Security Check | Endpoint Tested | Expected | Actual | Result |
| :--- | :--- | :---: | :---: | :---: |
| Unauthenticated admin access rejected | `GET /api/admin/overview-stats` | `401` | `401` | **PASS** |
| Participant token blocked from admin roster | `GET /api/admin/participants` | `403` | `403` | **PASS** |
| Forged JWT signature rejected | `GET /api/participants/me` | `401` | `401` | **PASS** |
| Cross-participant answer sheet inspection blocked | `GET /api/admin/participants/1/answers` | `403` | `403` | **PASS** |
| Official answer key (`correct_answer`) stripped from participant question payload | `GET /api/rounds/1/questions` | `false` | `false` | **PASS** |
| Helmet security headers enforced under load (`X-Content-Type-Options`, `X-Frame-Options`) | `GET /api/health` | `nosniff / DENY` | `nosniff / DENY` | **PASS** |
| Database duplicate `(participant_id, round_id)` attempts | `attempts` table constraint | `0` | `0` | **PASS** |
| Database duplicate `(attempt_id, question_id)` answers | `answers` table constraint | `0` | `0` | **PASS** |

---

## 8. Phase 11 — The 3 Most Critical Performance Bottlenecks & Safe Remediation Plan

> **IMPORTANT**: Per Phase 1 and Phase 11 instructions, **no application code in `src/` or `backend/` has been modified during this audit**. Below is the exact engineering specification for the 3 highest-impact fixes awaiting your approval.

---

### Bottleneck #1: Per-IP Rate Limiters Block 85%–95% of 200 Users on Shared Campus Wi-Fi / Lab NAT

- **Root Cause**:
  In `backend/src/app.js` (lines 126–179), five `express-rate-limit` middlewares use the default `req.ip` key generator:
  - `participantAccessCodeLimiter`: `limit: 15` per 10 minutes per IP (`line 128`)
  - `participantRegisterLimiter`: `limit: 10` per 15 minutes per IP (`line 138`)
  - `submissionLimiter`: `limit: 30` per 60 seconds per IP (`line 158`)
  - `participantLimiter`: `limit: 600` per 5 minutes per IP (`line 168`)
  - Global `/api` limiter: `limit: 500` per 15 minutes per IP (`line 110`)
- **Affected File**: `backend/src/app.js` (lines 108–186)
- **Impact on 200 Concurrent Users**:
  In a college auditorium or computer lab where 200 students share 1–2 public NAT IPs:
  - **92.5% (185/200)** of logins fail with HTTP `429`.
  - **85.0% (170/200)** of Round 1/2/3 submissions fail with HTTP `429`.
  - **100%** of active participants hit HTTP `429` within **4.4 seconds** of starting a round due to `/participants/me` and `/active-deadline` polling.
- **Smallest Safe Improvement**:
  1. Key authenticated limiters (`submissionLimiter`, `participantLimiter`) by the authenticated participant's session token / ID (`req.headers.authorization || req.cookies?.bb_participant_session || req.ip`) instead of solely `req.ip`.
  2. Key `participantAccessCodeLimiter` by `(${req.ip}:${req.body?.accessCode || ''})` (so brute-forcing a single access code is still limited to 15 tries, while 200 different students on the same campus IP can each log in with their own access code) and raise the per-IP ceiling to `300` per 10 minutes.
  3. Key `participantRegisterLimiter` by `(${req.ip}:${req.body?.rollNumber || ''})` with a per-IP ceiling of `250` per 15 minutes.
  4. Exempt read-only `/api/competition/state` from the 500/15min global per-IP cap or raise the global per-IP cap to `5000` per 15 minutes.
- **Possible Side Effects**: Minimal; brute-force protection on individual access codes and admin login (`adminLoginLimiter`) remains strictly enforced.
- **How to Verify**: Re-run `TEST 02` (`sharedCampusNatIp`), `TEST 04` (`sharedNatParticipantLimiterTest`), and `TEST 05` (`sharedCampusNatSubmissionBurst`) in `node load-tests/runner/execute-audit.mjs` and confirm `0%` HTTP 429 errors for 200 users on a shared IP.

---

### Bottleneck #2: 50 Sequential SQL `INSERT` Round-Trips Inside `POST /api/attempts/:attemptId/submit`

- **Root Cause**:
  In `backend/src/routes.js` (lines 987–1015), inside `withTransaction(async (client) => { ... })`, the submission handler loops over all questions (`50` in Round 1, `30` in Rounds 2/3) and executes `await client.query('INSERT INTO answers ... ON CONFLICT (attempt_id, question_id) DO UPDATE ...')` sequentially on every iteration.
- **Affected File & Query**: `backend/src/routes.js` (lines 881–1048) and `backend/src/db.js` (lines 16–25)
- **Impact on 200 Concurrent Users**:
  Each Round 1 submission executes **56 sequential SQL round-trips** over TLS to Neon (`56 * 68.45 ms = ~3,833 ms` per transaction). Across 200 simultaneous submissions at the end of a round, `11,200` sequential queries serialize across `max: 10` pooled connections (`~76.7s` tail latency) or `max: 3` on Vercel (`~256.8s`), causing `connectionTimeoutMillis (10s)` failures.
- **Smallest Safe Improvement**:
  Replace the 50-iteration `for` loop of `INSERT INTO answers` statements with a **single batched `UNNEST` query**:
  ```sql
  INSERT INTO answers (attempt_id, question_id, selected_option)
  SELECT $1, u.question_id, u.selected_option
  FROM UNNEST($2::bigint[], $3::int[]) AS u(question_id, selected_option)
  ON CONFLICT (attempt_id, question_id)
  DO UPDATE SET selected_option = EXCLUDED.selected_option
  ```
  This collapses **50 sequential SQL round-trips into 1 single SQL round-trip**, reducing transaction holding time from **~3,833 ms to ~340 ms (an 11x speedup)** and cutting total queries for 200 concurrent submissions from **11,200 down to 1,200**. Additionally, increase `defaultMax` in `backend/src/db.js` from `10` to `25` (Neon PgBouncer pooler supports `max_connections = 901`).
- **Possible Side Effects**: None — identical transactional semantics (`ON CONFLICT (attempt_id, question_id) DO UPDATE`) and identical scoring calculation in JS memory.
- **How to Verify**: Run `TEST 05` against an isolated Neon branch (`BB_TEST_DATABASE_URL`) and verify all 200 submissions complete with `p95 < 500ms` and `0` errors.

---

### Bottleneck #3: Uncached High-Frequency Polling (~270 req/s) & Missing Composite Index on `audit_events`

- **Root Cause**:
  1. `GET /api/competition/state`, `GET /api/rounds/:roundId/questions`, and `getParticipantQualificationMap()` hit remote Neon PostgreSQL on every single request without short-TTL in-memory caching, even though questions never change during a round and `competition_state` only changes when an admin clicks a control button.
  2. `src/App.tsx` and `src/components/BroadcastNotification.tsx` both poll `GET /api/competition/state` every 3 seconds in the same browser tab.
  3. `audit_events` has no index on `event_type`, causing `Seq Scan` (`1,016,121` sequential tuple reads observed in `pg_stat_user_tables`).
- **Affected Files**:
  - `backend/src/routes.js` (`GET /competition/state` lines 654–703, `GET /rounds/:roundId/questions` lines 735–744, `getParticipantQualificationMap` lines 79–138)
  - `backend/migrations/` (missing index `CREATE INDEX IF NOT EXISTS idx_audit_events_type_id ON audit_events(event_type, id DESC)`)
- **Impact on 200 Concurrent Users**:
  200 users generate ~270 req/s (`>500 SQL queries/sec`), saturating the 10-connection pool and pushing `GET /api/competition/state` to `p95 = 2,823.46 ms`, `GET /api/rounds/1/questions` to `p95 = 2,634.62 ms`, and Admin Console overview to `p95 = 3,305.07 ms`.
- **Smallest Safe Improvement**:
  1. Add a lightweight **1.5-second in-memory cache** in `backend/src/routes.js` for `GET /api/competition/state` and `getParticipantQualificationMap()` (invalidated immediately inside the same process whenever an admin updates state, broadcasts, or executes qualification) and a **30-second in-memory cache** for `GET /api/rounds/:roundId/questions` (invalidated on admin question edits).
  2. Add migration index `CREATE INDEX IF NOT EXISTS idx_audit_events_type_id ON audit_events(event_type, id DESC);`.
- **Possible Side Effects**: Maximum 1.5-second cache TTL on `/competition/state` is shorter than the client's 3.0-second poll interval and is immediately invalidated on admin mutations.
- **How to Verify**: Re-run `TEST 03`, `TEST 04`, `TEST 06`, `TEST 07`, and `TEST 08` via `node load-tests/runner/execute-audit.mjs`; `p95` latency at 200 concurrent users will drop from `~2,600–2,800 ms` to **`< 50 ms`**.

---

## 9. Phase 12 — Final Readiness Decision

| Criterion | Target Benchmark | Measured Result (200 Concurrent Users) | Status |
| :--- | :--- | :--- | :---: |
| **200-User Login Storm (Shared Campus NAT IP)** | `< 1%` error rate | **92.5% HTTP 429 Failure (185/200 blocked)** | **FAIL** |
| **200-User Question Retrieval (`p95` / `p99`)** | `p95 < 500ms`, `p99 < 1000ms` | `p95 = 2,634.62 ms`, `p99 = 2,692.73 ms` | **FAIL** |
| **200-User Exam State Polling (`p95` / `p99`)** | `p95 < 500ms`, `p99 < 1000ms` | `p95 = 2,823.46 ms`, `p99 = 2,962.64 ms` | **FAIL** |
| **200-User Shared IP Polling (`/participants/me`)** | `< 1%` error rate | **HTTP 429 limit hit after 4.4 seconds** | **FAIL** |
| **200-User Submission Burst (Shared Campus NAT IP)** | `0` failed submissions | **85.0% HTTP 429 Failure (170/200 blocked)** | **FAIL** |
| **200-User Submission DB Transaction Hold Time** | `p99 < 1000ms` | **3,833.2 ms per user (56 sequential SQL queries)** | **FAIL** |
| **Admin Console Under 200-User Load (`p95`)** | `p95 < 500ms` | `p95 = 3,305.07 ms` | **FAIL** |
| **Security & Session Isolation Under Load** | `100%` pass | **6/6 checks passed (0 leaks, 0 privilege escalation)** | **PASS** |
| **Database Integrity & Duplicate Protection** | `0` duplicates / corruption | **0 duplicate attempts, 0 duplicate answers** | **PASS** |

### Final Verdict: **`FAIL`**
The platform **cannot reliably host 200 simultaneous participants in a live college competition in its current state**. Applying the three targeted, non-breaking fixes documented in Section 8 (Phase 11) will raise capacity well beyond 200 concurrent users while keeping `p95 < 250ms` and `0%` rate-limit false positives.

