# Brain Bytes: Data Mania 2026 â€” Production Release

A full-stack, high-concurrency competition and evaluation platform engineered for live arena tournaments (100â€“200 participants).

---

## ðŸŒŸ Architecture Overview

- **Frontend:** React 19 + TypeScript + Vite. Highly styled, responsive competition arena and administrative control dashboard.
- **Backend:** Node.js + Express with secure HTTP-only cookie sessions, rate limiting, and CORS allowlisting.
- **Database:** Neon Serverless PostgreSQL with connection pooling (`pg.Pool`), transaction safety (`withTransaction`), and strict data constraints.
- **Anti-Cheat:** Proctoring sensor engine (`useProctorGuard`) with 2 warnings and automatic termination & submission on the 3rd infraction; deterministic question shuffling to block screen-peeking; server-only grading with zero answers in client bundles.

---

## ðŸš€ Running the Platform

### 1. Backend Server
```bash
cd backend
npm install
npm run dev
# Listens on port 4000
```

### 2. Frontend Arena & Admin Center
```bash
# In the root directory:
npm install
npm run dev
# Accessible at http://localhost:5173
```

### 3. Production Build & Type Checking
```bash
npx tsc -b          # Type check (0 errors)
npm run build       # Vite production bundle
```

---

## ðŸ† Key Features & Verification

1. **110-Question Authoritative Question Bank:**
   - Round 1 (Data MCQ): 50 Questions (+1 / 0)
   - Round 2 (Graph Challenge): 30 Questions (+1 / 0)
   - Round 3 (Rapid Fire): 30 Questions (+5 / -2)
   - Questions and explanations are securely stored in Neon PostgreSQL and never sent to candidate terminals prior to official submission.

2. **3-Warning Automatic Submission:**
   - Infractions 1 & 2: Warning modals displayed and logged to server audit trail.
   - Infraction 3: Exam locks immediately; candidate's responses are committed automatically to `/attempts/:id/submit`; candidate is flagged as `AUTO-SUBMITTED (3 VIOLATIONS)` on the admin monitor.

3. **Strict Progression & Qualification:**
   - All participants must start in Round 1. Direct registrations into Round 2 or 3 are rejected with `403 Forbidden`.
   - Organizers execute qualification cutoffs manually in Admin Round Control.

4. **Event-Day Reliability:**
   - In-progress answers cached in browser `localStorage` and restored automatically on refresh.
   - Window `beforeunload` interceptor blocks accidental browser closure.
   - Disconnected network banner reassures candidate that responses remain safe on terminal.
   - Server-enforced 45-second submission grace period accommodates Wi-Fi latency.

---

## ðŸ› ï¸ Verification & Audit Suite

Run the full system audit to verify all 46 system gates:
```bash
npm run test:audit
# or: node tests/brutal_audit_runner.cjs
```

Run marking rules unit tests:
```bash
npm test
# or: npx tsx tests/testMarkingRules.js
```

To purge test candidates and restore the database to spotless Day-1 readiness:
```bash
npm run db:wipe-test
# or: node scripts/wipe_test_data.cjs
```
