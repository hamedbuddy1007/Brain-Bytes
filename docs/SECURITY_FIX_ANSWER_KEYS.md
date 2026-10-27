# Brain Bytes answer-key separation fix

## Changes made
- Removed `correctAnswer` and `explanation` values from the three participant-facing question-bank modules in `src/data/`.
- Kept official answer keys in backend seed data and PostgreSQL only.
- Added `GET /api/admin/question-bank`, protected by `requireAuth('admin')`, for the authenticated admin question-bank screen.
- Updated the admin question-bank screen to load official answers from that protected endpoint rather than bundling them.
- Updated the scoring utility so keyless client data cannot calculate official scores; submission scores/counts must come from server-provided details.
- Reworked marking-rule fixtures to test scoring rules with isolated test-only answer-key fixtures.
- Updated static checks to verify server/client separation.
- Added `npm run test:security:client`, a no-database, no-network source check.

## Validation performed in this environment
- TypeScript project check: `node node_modules/typescript/bin/tsc -b` **passed**.
- Backend syntax checks (`routes.js`, `app.js`, `server.js`, `auth.js`, `db.js`): **passed**.
- Client answer-key source check: see `npm run test:security:client`.
- Full Vite production build could not run here because the uploaded `node_modules` contained Windows-only/missing native Rolldown bindings and fresh dependency installation timed out. Run `npm ci` and `npm run build` in a clean Windows or Linux deployment environment.
- Database integration tests were not run and no database was contacted, migrated, seeded, or reset.

## Important deployment steps
1. From the project root, run `npm ci`.
2. Run `npm run test:security:client`.
3. Run `npm run build`. If it succeeds, deploy the newly generated `dist/` together with the backend service.
4. Install backend dependencies separately with `npm ci --prefix backend`.
5. Ensure the backend uses the intended production `DATABASE_URL`, `SESSION_SECRET`, and `EVENT_JOIN_CODES`. Never include `.env` files in the ZIP.
6. Verify the admin can load the question bank and a participant can load questions, submit once, and see the expected submitted screen in a staging database before the event.

Do not deploy the previous `dist/` bundle. This ZIP intentionally excludes generated `dist/`; create a fresh bundle from the patched source.
