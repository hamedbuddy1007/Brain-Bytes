import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query, getPool } from '../backend/src/db.js';

async function main() {
  try {
    const existing = await query('SELECT count(*)::int AS count FROM admins');
    if (existing.rows[0]?.count > 0) {
      console.info('Admin account already exists in the database. Provisioning skipped to protect existing data.');
      return;
    }

    const username = process.env.ADMIN_USERNAME?.trim();
    const email = process.env.ADMIN_EMAIL?.trim();
    const password = process.env.ADMIN_PASSWORD;

    if (!username || !email || !password) {
      console.error('Error: ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD environment variables are required to provision an admin.');
      process.exit(1);
    }

    if (password.length < 12) {
      console.error('Error: ADMIN_PASSWORD must be at least 12 characters.');
      process.exit(1);
    }

    const hash = await bcrypt.hash(password, 12);
    await query(
      'INSERT INTO admins(username, email, password_hash) VALUES($1, $2, $3)',
      [username, email.toLowerCase(), hash]
    );

    console.info('Successfully provisioned initial admin account.');
  } catch (err) {
    console.error('Admin provisioning failed:', err.message);
    process.exit(1);
  } finally {
    await getPool().end().catch(() => {});
  }
}

main();
