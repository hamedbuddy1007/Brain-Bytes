# Brain Bytes: Senior Code Review (bugs and unfinished work)

Reviewed: `backend/src/*`, migrations, `src/App.tsx`, services, hooks, round components, admin components.
Method: static reading plus `tsc -b` (passes, 0 errors). Nothing here was exercised against a running event, and the DB-backed scripts in `tests/` were not run.
Severity: **P0** = can corrupt results or break the event, **P1** = serious, fix before go-live, **P2** = cleanup.

---

## P0: Fix before any real event

### 1. Anyone can log in as any participant (impersonation)
`POST /api/participants/login` ([routes.js:150](../backend/src/routes.js#L150)) issues a session from a roll number alone. There is no PIN, no join code and no rate limit (the limiter only covers `/api/auth`). Roll numbers are guessable and are exposed publicly by `GET /api/leaderboard`.
`/participants/register` has the same weakness: it accepts a matching *name*, and `req.auth` is never populated there because no auth middleware is attached, so the `sessionMatches` check is dead code.
**Fix:** require join code (or the unused `pin_hash`) on login, rate-limit `/api/participants/*`, drop or protect `/participants/login`.

### 2. Qualification is not enforced by the backend
`/rounds/:id/attempts/start` ([routes.js:252](../backend/src/routes.js#L252)) only checks that earlier rounds were *submitted*. It never checks the `round2.qualified` / `round3.qualified` audit events. An eliminated participant can call the API directly and play Round 2 or 3. `GET /admin/participants` shows the eligibility, but the start endpoint ignores it.
Related: `POST /admin/qualify/:id` only appends audit events. Running it twice (or with a larger limit) *adds* qualifiers and never revokes anyone, and it can be run before everyone has submitted.

### 3. Answer keys ship in the frontend bundle
`Round1MCQ`, `Round2GraphChallenge`, `Round3RapidFire` and `scoringService.ts` import `src/data/round*Questions.ts`, which contain `correctAnswer` and `explanation` for every question. Anyone can read them from DevTools. `GET /api/rounds/:id/questions` (which correctly hides answers) is **never called** by the frontend.
**Fix:** render questions from the API and delete `correctAnswer`/`explanation` from the client data. Keep the full files only for the seeder (move them under `backend/`).

### 4. Infinite request loop after submitting
In `Round1MCQ.tsx` the start-attempt effect depends on `onRecordScore` ([line 94](../src/components/rounds/Round1MCQ.tsx#L94)), and `App.tsx` passes a **new inline arrow each render**. After a round is submitted: effect runs → `POST /attempts/start` → `onRecordScore` → `setLeaderboard` → App re-renders → new callback → effect runs again. This repeats indefinitely, and it also fires on any App re-render before submission. With 200 users that is a self-inflicted DoS on the Neon pool (max 20 connections). Rounds 2 and 3 use the same pattern.
**Fix:** keep `onRecordScore` in a ref, depend only on the participant id.

### 5. Leaderboard, projector and results are fake / browser-local
- `getUnifiedLeaderboard()` seeds `INITIAL_LEADERBOARD` demo participants from `mockData.ts` and adds scores from **localStorage** submissions ([competitionStateService.ts:480](../src/services/competitionStateService.ts#L480)).
- I found no frontend call to `GET /api/leaderboard`, so the projector, admin leaderboard and results page never show database scores. Each browser shows only its own submissions plus demo names.
- `AdminResultsReports` and `AdminOverview` use `ADMIN_PROJECTOR_LEADERBOARD` / `ADMIN_AUDIT_LOGS` mock data.
**Fix:** drive all three views from `/api/leaderboard` (poll) and `/api/admin/*`; delete the mock seed.

### 6. Global competition state (LIVE / PAUSED / COMPLETED) never reaches the server
`AdminRoundControl` calls `setGlobalCompetitionState` which writes **localStorage only**. The backend's `status` and `active_round` columns are never updated by the UI, so "Pause" does nothing for participants on other machines. The backend also treats `NOT_STARTED` as startable.
**Fix:** send `status`/`activeRound` through `PATCH /admin/competition/state` and have participants poll `/competition/state`.

### 7. Client timer is not the server deadline
`useExamTimer` uses `getOrInitRoundTimer`, which stores the deadline in **localStorage**. The `deadline_at` returned by `/attempts/start` is ignored. Consequences: clearing storage or switching device restarts the clock; the timer starts on mount, before the server attempt exists; the UI can disagree with the server by the time spent loading. The server will still reject late submits (deadline + 15s), but a participant may see time left that no longer exists.
**Fix:** compute the countdown from `attempt.deadline_at` minus a server-clock offset.

---

## P1: Serious

8. **Admin "reset round" only clears localStorage** (`resetRoundState`), not the database. Attempts and scores remain, so participants stay "Response Already Submitted". There is no admin endpoint to delete or reset an attempt.
9. **Qualification failures are swallowed.** `AdminRoundControl` ([line 148](../src/components/admin/AdminRoundControl.tsx#L148)) logs the API error, then runs the *local* qualification and shows "Successfully qualified…". The admin can believe qualification worked when the backend rejected it (for example, session expired). Thresholds 15 and 8 are hard-coded; `ROUND1_QUALIFY_COUNT` in `.env` is unused.
10. **Fake proctoring data.** `GET /admin/participants` returns constant `pingMs: 12`, `tabFocusPct: 100`, `confidence: 'HIGH'` ([routes.js:580](../backend/src/routes.js#L580)). Admins will read these as real. Remove or implement.
11. **No answer autosave to the server.** Answers live in React state / localStorage until submit; the `answers` table is filled only at submit time. A crash or device change loses work. (This is listed as an open gate in PRODUCTION_AUDIT.md.)
12. **Join codes are split in two places.** The admin "Settings" join codes are stored in localStorage; the backend reads `EVENT_JOIN_CODES` from env (default `BYTE2026,DATAMANIA26,SOLAR26`, not in `.env`). Changing codes in the admin UI has no effect on registration.
13. **Station numbers collide.** `assigned_seat = ((id-1) % 60) + 1` gives duplicate stations after 60 participants (up to 200 expected).
14. **Round 1 starts with demo state.** `markedForReview = {4, 6}` and `visitedQuestions = {1..6}` are hard-coded initial values ([Round1MCQ.tsx:29-36](../src/components/rounds/Round1MCQ.tsx#L29)). Every participant opens the paper with Q4 and Q6 flagged.
15. **CSRF/Origin check is bypassable.** [server.js:19](../backend/src/server.js#L19) only rejects a bad `Origin` when one is present. In production cookies are `SameSite=None`, so this needs a real CSRF token.
16. **Public PII.** `GET /api/leaderboard` is unauthenticated and returns roll number and college for up to 500 people. `GET /rounds/:id/questions` is unauthenticated and serves questions as soon as a round is `active`, before the participant starts an attempt.
17. **Secrets handling.** Keep local environment files and authentication secrets out of version control. The staged filename check found no `.env` files or `AUTH_SECRET.txt`; this does not independently prove that no credentials appear in file contents or Git history. Verify hosting environment variables before deployment. If real credentials were previously shared, rotate them through the relevant provider.
18. **Dev and prod share one database.** The `tests/test_r2_scoring.mjs` script registers `TEST-R2-*` participants and submits attempts against whatever `DATABASE_URL` points to, which is the Neon DB in `backend/.env`. Clean those rows before the event and use a separate branch/DB for tests.
19. **Migrations have no version table.** `migrate.js` re-runs every `.sql` file on each run. It works today only because every statement is idempotent; add a `schema_migrations` table before the next non-idempotent change.
20. **Re-seeding is destructive mid-event.** `seedQuestions.js` upserts by `(round_id, sort_order)`, overwriting prompts, options and correct answers even while attempts exist, and it never disables questions removed from the source files.
21. **Weak submit validation.** `selectedOption` is not bounded by `options.length`; out-of-range values are counted as wrong and stored. The `hasDbIds` heuristic ([routes.js:323](../backend/src/routes.js#L323)) guesses whether the client sent DB ids or sort orders. The client should send one agreed id type.

## P2: Cleanup and unfinished work

- **Unfinished admin features:** Question Bank add/edit is not persisted (no admin question endpoints); Settings and Results are local/mock; no participant remove/reset API (`onRemoveParticipant` only edits local React state).
- **Dead / legacy UI** not reachable from `App.tsx`: `JoinModal`, `RoundArenaModal`, `RoundCard`, `Hero`, `Navbar`, `Footer`, `FAQSection`, `CompetitionRounds`, `CompetitionInfo`; `mockData.ts` and `adminMockData.ts` are largely demo-only.
- **Stale comments/strings:** `scoringService.ts` header says Round 1 = 20 questions and Round 2 = 5 questions (real: 50 and 30); `resetRegistryForRound` writes `RESET [0/20]`.
- **Dead code in routes:** `roundId` accepted but unused by `/participants/register`; `/participants/login` is labelled "backwards-compatible" with no caller I could find.
- **`useExamTimer`:** the interval effect depends on `secondsRemaining`, so the interval is torn down and recreated every second; `Math.round` can fire `onExpire` up to 0.5s early.
- **ESLint currently fails with 3 errors** (`npx eslint .`): unused `_err` in `App.tsx:149`; `react-hooks/set-state-in-effect` in `AdminParticipants.tsx:36` and `useExamTimer.ts:41`. `npm run lint` is a release gate.
- **No participant logout**, 24h non-revocable JWT, no `statement_timeout` on the pool, pg SSL-mode deprecation warning (use `sslmode=verify-full`).
- **No automated tests**: `package.json` now includes `test` and `test:audit`; `tests/*.mjs` are manual and need a live DB. No load test at 200 users (still an open item in PRODUCTION_AUDIT.md).
- **Housekeeping:** package name typo `brai-bytes`; `README.md` is still the Vite template plus setup notes; `PRODUCTION_AUDIT.md` is out of date (it says registration/login are not wired to the API, which is no longer true).

---

## Suggested order of work

1. P0 #4 (request loop), #1 (auth), #2 (qualification gate), #3 (answer keys): small, contained changes.
2. P0 #5-#7: move leaderboard, state and timer to server data. This is the largest chunk.
3. P1 #8-#12, then #17-#18 before touching real data.
4. Add an integration test suite (register → R1 → qualify → R2 → R3 → leaderboard) against a throw-away DB, then a 200-user load run.
