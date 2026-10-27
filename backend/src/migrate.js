import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { query } from './db.js';

const migrationsDir = new URL('../migrations', import.meta.url);
const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

for (const file of files) {
  const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
  await query(sql);
  console.info(`Database migration ${file} applied.`);
}
process.exit(0);
