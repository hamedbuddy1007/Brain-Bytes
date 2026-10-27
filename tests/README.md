# Brain Bytes — Audit & Test Safety Architecture

This directory contains the verification suites for Brain Bytes / Data Mania.
All tests follow strict **fail-closed** rules so existing production data in Neon PostgreSQL is never wiped, mutated, or corrupted.

---

## Safety Guarantees

1. **Zero Production Mutation by Default**:
   - Running any test script directly will **never** alter competition settings, register uncleaned users, delete attempts, or call `/admin/reset-all` / `/admin/rounds/:id/reset`.
2. **Never Infer Safety From Hostnames**:
   - Strings like `neon.tech` or `localhost` are **never** assumed to be safe or disposable.
3. **No Hardcoded Secrets or Credentials**:
   - `DATABASE_URL` is never printed or echoed to logs.
   - Tests require explicit admin credentials via environment variables (`BB_TEST_ADMIN_USERNAME` / `BB_TEST_ADMIN_PASSWORD`) or skip admin-authenticated tests with clear explanations.
4. **Isolated Fixture Tracking & Safe Cleanup**:
   - When integration tests run against a confirmed disposable test database, each participant is tagged with a unique run token.
   - Cleanup only removes records created by that specific run (attempts, answers, and audit events), using transactions.
   - No broad `LIKE 'PREFIX_%'` deletes that could wipe data belonging to other runs.
5. **Exact Scoring Rule Alignment**:
   - **Round 1 (50 questions)**: +1 correct, 0 incorrect, 0 unanswered.
   - **Round 2 (30 questions)**: +1 correct, 0 incorrect, 0 unanswered.
   - **Round 3 (30 questions)**: +5 correct, -2 incorrect, 0 unanswered.

---

## Safe Commands to Run (No Disposable Database Required)

### 1. Static Checks (No DB, No Network)
Validates question bank counts (50/30/30), answer keys, option formats, seeded marking rules, client scoring service, ranking tiebreakers, and lints all test files for unsafe patterns.
```bash
npm run test:static
# or
npm test
```

### 2. Read-Only Database Checks
Inspects the question bank and public endpoints against your configured database without writing or updating any state.
```bash
# In PowerShell:
$env:BB_TEST_ALLOW_READONLY = "1"
npm run test:all
Remove-Item env:BB_TEST_ALLOW_READONLY
```

---

## Running Full Integration Tests (Requires Confirmed Disposable Database)

To execute full participant registration, question submission, timer expiration, proctor auto-submit, and leaderboard verification:

1. Provision a dedicated disposable test database (e.g. a separate branch or test instance).
2. Set the following environment variables in your shell (do **not** put them in `backend/.env`):
```bash
# In PowerShell:
$env:BB_TEST_DATABASE_URL = "postgresql://user:pass@ep-test-xyz.neon.tech/test_db?sslmode=require"
# Must match the host/database exactly to confirm disposal authorization:
$env:BB_TEST_CONFIRM_DISPOSABLE = "ep-test-xyz.neon.tech/test_db"

# Optional: provide credentials of a test admin inside the disposable DB
$env:BB_TEST_ADMIN_USERNAME = "testadmin"
$env:BB_TEST_ADMIN_PASSWORD = "testpassword"

# Run the complete lifecycle integration audit:
npm run test:all

# Run the brutal audit runner:
npm run test:audit
```

If `BB_TEST_DATABASE_URL` matches the production database in `backend/.env`, the suite will immediately refuse execution to protect production data.
