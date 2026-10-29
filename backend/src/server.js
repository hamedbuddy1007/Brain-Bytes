import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { app } from './app.js';
import { query, getPool } from './db.js';

const port = Number(process.env.PORT || 4000);

export function validateEnvironment() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required.');
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    if (isProd) {
      throw new Error('SESSION_SECRET must contain at least 32 characters in production.');
    } else {
      console.warn('⚠️  Security Warning: SESSION_SECRET is shorter than 32 characters. Use a strong secret in production.');
    }
  }

  if (isProd && (sessionSecret?.includes('insecure') || sessionSecret?.includes('replace_with'))) {
    throw new Error('Insecure default SESSION_SECRET detected in production. Rotate SESSION_SECRET immediately.');
  }
}

export async function startServer() {
  validateEnvironment();
  await query('SELECT 1');
  return new Promise((resolve) => {
    const server = app.listen(port, '0.0.0.0', () => {
      console.info(`Brain Bytes API listening on port ${port}`);
      resolve(server);
    });
  });
}

// Only start the server when run directly (e.g. node src/server.js), not when imported
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  startServer().catch((error) => {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      await getPool().end().catch(() => {});
      process.exit(0);
    });
  }
}

export { app };
export default app;
