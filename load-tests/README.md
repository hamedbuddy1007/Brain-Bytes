# PROJECT BRAIN BYTES — Load Testing & Performance Audit Suite (`load-tests/`)

This directory contains the complete load-testing, stress-testing, database performance audit, and automated reporting suite for the **BRAIN BYTES (DATA MANIA)** competition platform, designed to evaluate readiness for **200 concurrent participants**.

---

## Directory Structure

```text
load-tests/
├── config/
│   └── config.js                        # Target URL, round workloads (50/30/30 Qs), benchmark targets, LOADTEST_USER_001..200 generator
├── helpers/
│   ├── auth.js                          # Per-VU registration & login helpers (independent JWT sessions per participant)
│   ├── participant.js                   # 17-step realistic participant competition workflow
│   ├── questions.js                     # Competition state, round questions, and active-deadline polling helpers
│   ├── submissions.js                   # Client answer selection/modification/review simulation & submission helpers
│   └── admin.js                         # Admin dashboard overview-stats, roster, answer-sheet, and leaderboard helpers
├── scenarios/
│   ├── test01-baseline.k6.js            # TEST 01: Baseline Performance Test (1, 5, 10 VUs)
│   ├── test02-login-storm.k6.js         # TEST 02: 200-User Login Storm within 30s (shared campus NAT vs distributed IPs)
│   ├── test03-question-retrieval.k6.js  # TEST 03: 200-User Simultaneous Question Retrieval within 5s
│   ├── test04-answer-saving.k6.js       # TEST 04: 200-User Concurrent Exam Polling & Answer State Simulation
│   ├── test05-submission-burst.k6.js    # TEST 05: 200-Participant Submission Burst within 5–10s (safety-gated)
│   ├── test06-admin-under-load.k6.js    # TEST 06: Admin Dashboard & Leaderboard Monitoring Under 200-User Load
│   ├── test07-sustained-concurrency.k6.js # TEST 07: Sustained 200-User Concurrency Over Round Timer
│   └── test08-capacity-ramp.k6.js       # TEST 08: Load Capacity Ramp (50 -> 100 -> 150 -> 200 VUs)
├── verification/
│   └── db-verify.mjs                    # Read-only Neon PostgreSQL performance/schema/EXPLAIN auditor & disposable-DB cleanup
├── runner/
│   └── execute-audit.mjs                # Self-contained Node.js load test & Neon DB audit runner (outputs raw JSON metrics)
└── reports/
    ├── final-performance-report.md      # Comprehensive Markdown engineering performance audit report
    ├── summary.html                     # Standalone visual HTML executive & engineering dashboard
    └── raw-results/
        └── audit-metrics.json           # Raw latency percentiles, throughput, DB EXPLAIN plans, and security checks
```

---

## Database Safety & Isolation Rules (Phase 3)

1. **Zero Production Mutation by Default**:
   - Running `node load-tests/runner/execute-audit.mjs` or any k6 scenario **without** explicit disposable database variables runs strictly in **Read-Only / Non-Mutating Safe Mode**.
   - It never overwrites, deletes, or inserts competition records into your production `DATABASE_URL`.
2. **Traceable Virtual Identities**:
   - Every virtual participant uses an isolated identity (`LOADTEST_USER_001` through `LOADTEST_USER_200`) and its own independent JWT session token.
3. **Enabling Write-Intensive Tests on an Isolated Neon Branch**:
   - Create an isolated Neon branch (e.g., `loadtest-branch`) in the Neon console.
   - Export both environment variables in your terminal before running write-intensive tests (`TEST 05` full database write burst):
     ```powershell
     $env:BB_TEST_DATABASE_URL="postgresql://<user>:<password>@<isolated-branch-endpoint>.neon.tech/neondb?sslmode=require"
     $env:BB_TEST_CONFIRM_DISPOSABLE="YES_DISPOSABLE_TEST_DB"
     ```

---

## Running the Load Tests

### Option A: Self-Contained Node.js Audit Executor (No External Binary Required)

Runs all 8 load test scenarios in-process against `backend/src/app.js` plus the read-only Neon PostgreSQL performance & `EXPLAIN` audit, and writes telemetry to `load-tests/reports/raw-results/audit-metrics.json`:

```powershell
node load-tests/runner/execute-audit.mjs
```

### Option B: Running Individual Scenarios with Grafana `k6` CLI

If you have the [Grafana k6 CLI](https://grafana.com/docs/k6/latest/set-up/install-k6/) installed (`winget install k6 --source winget`):

```powershell
# 1. Start the backend server against your target environment
npm --prefix backend run start

# 2. Run Baseline Test (1 -> 5 -> 10 VUs)
k6 run -e BASE_URL=http://127.0.0.1:4000 load-tests/scenarios/test01-baseline.k6.js

# 3. Run 200-User Login Storm (Shared Campus NAT IP mode)
k6 run -e BASE_URL=http://127.0.0.1:4000 -e CAMPUS_NAT_MODE=shared_ip load-tests/scenarios/test02-login-storm.k6.js

# 4. Run 200-User Simultaneous Question Retrieval
k6 run -e BASE_URL=http://127.0.0.1:4000 load-tests/scenarios/test03-question-retrieval.k6.js

# 5. Run 200-User Concurrent Answer State & Polling Simulation
k6 run -e BASE_URL=http://127.0.0.1:4000 load-tests/scenarios/test04-answer-saving.k6.js

# 6. Run 200-User Submission Burst (REQUIRES ISOLATED NEON BRANCH)
k6 run -e BASE_URL=http://127.0.0.1:4000 -e BB_TEST_CONFIRM_DISPOSABLE=YES_DISPOSABLE_TEST_DB load-tests/scenarios/test05-submission-burst.k6.js

# 7. Run Admin Dashboard & Leaderboard Under 200-User Load
k6 run -e BASE_URL=http://127.0.0.1:4000 load-tests/scenarios/test06-admin-under-load.k6.js

# 8. Run Sustained 200-User Concurrency Test
k6 run -e BASE_URL=http://127.0.0.1:4000 -e SUSTAINED_DURATION=180s load-tests/scenarios/test07-sustained-concurrency.k6.js

# 9. Run Capacity Ramp Test (50 -> 100 -> 150 -> 200 VUs)
k6 run -e BASE_URL=http://127.0.0.1:4000 load-tests/scenarios/test08-capacity-ramp.k6.js
```

