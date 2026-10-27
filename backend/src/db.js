import pg from 'pg';

const { Pool } = pg;
let pool = null;

export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required');
    }

    const isNeon = process.env.DATABASE_URL.includes('neon.tech');
    const requiresSsl = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL.includes('sslmode=') || isNeon;

    // Use smaller pool size in serverless (e.g., Vercel) to prevent connection exhaustion
    const defaultMax = process.env.VERCEL ? 3 : 10;
    const maxPool = process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : defaultMax;

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: requiresSsl ? { rejectUnauthorized: false } : false,
      max: Number.isInteger(maxPool) && maxPool > 0 ? maxPool : defaultMax,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    pool.on('error', (error) => {
      // Safe server logging without exposing credentials or queries
      console.error('PostgreSQL pool error:', error?.message || 'Unknown database error');
    });
  }
  return pool;
}

export async function query(text, values = []) {
  return getPool().query(text, values);
}

export async function withTransaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
