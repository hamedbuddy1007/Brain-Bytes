import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { app } from './app.js';
import { query, getPool } from './db.js';

const port = Number(process.env.PORT || 4000);

export async function startServer() {
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
