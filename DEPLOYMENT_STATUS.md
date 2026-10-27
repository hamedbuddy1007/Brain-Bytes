# Brain Bytes deployment audit status

This archive is a sanitized source copy of the supplied project. It excludes Git metadata, installed dependencies, generated build output, and private environment files.

## NOT CLEARED FOR LIVE DEPLOYMENT

This is not a production-ready certification. Before live use, the following code-level work remains:

1. Move all official question answer keys out of browser-delivered TypeScript/JavaScript bundles. The round question files and admin question-bank UI currently include correct answers; merely removing a file from the ZIP is not a fix because a fresh build bundles imported source again.
2. Ensure all scoring and submission validation use server-side question keys and DB state only, and remove client-side/demo fallback paths from authoritative results.
3. Complete a security review of participant session recovery, registration, admin authentication, join-code configuration, and all admin endpoints.
4. Verify round qualification, timing, duplicate submissions, and leaderboard data end-to-end against the existing Neon database.
5. Run `npm ci`, `npm run build`, and non-destructive tests in a normal Node.js environment, then deploy to a preview and test `/api/health`, login, participant flows, and submissions.

## Secrets

Never commit or distribute `.env` files. The source archive supplied for audit contained a real `backend/.env`; treat its database password, session secret, and admin password as exposed and rotate them before any deployment. Configure replacements only in the hosting provider's environment settings and local ignored `.env` files. Do not paste secrets into chat.

## Database safety

The existing Neon database is assumed to contain live event data. Do not run migrations, question seeding, wipe scripts, reset endpoints, or any destructive database operation as part of deployment without explicit review and approval.

## Environment configuration

Use `backend/.env.example` only as a template. Configure `DATABASE_URL`, a fresh random `SESSION_SECRET` of at least 32 characters, `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `EVENT_JOIN_CODES`, and `FRONTEND_ORIGINS` in the deployment environment as appropriate. Use a Neon pooled connection URL for serverless deployment if required.
