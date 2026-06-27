import { Pool, PoolClient } from 'pg';
import { env } from './env';
import { logger } from '../utils/logger';

const pool = new Pool({
  host:     env.db.host,
  port:     env.db.port,
  database: env.db.name,
  user:     env.db.user,
  password: env.db.password,
  min:      env.db.poolMin,
  max:      env.db.poolMax,
  ssl:      env.db.ssl ? { rejectUnauthorized: false } : false,
  idleTimeoutMillis:       25_000, // retire idle connections before network drops them
  connectionTimeoutMillis:  8_000,
  keepAlive:                    true,
  keepAliveInitialDelayMillis: 10_000, // send TCP keepalive after 10 s idle
});

pool.on('connect', () => logger.debug('DB pool: new client connected'));
pool.on('error', (err) => logger.error('DB pool error', { error: err.message }));

const TRANSIENT_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'ECONNREFUSED']);

async function runQuery<T>(text: string, params?: unknown[]): Promise<T[]> {
  const start  = Date.now();
  const client = await pool.connect();
  try {
    const result = await client.query<T>(text, params);
    logger.debug('DB query', { text: text.substring(0, 80), duration: Date.now() - start, rows: result.rowCount });
    return result.rows;
  } catch (err: any) {
    // Release as errored so pg discards this connection instead of returning it to the pool
    client.release(err);
    throw err;
  } finally {
    // release() is a no-op if already called with an error above
    try { client.release(); } catch { /* already released */ }
  }
}

export async function query<T = any>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  try {
    return await runQuery<T>(text, params);
  } catch (err: any) {
    if (TRANSIENT_CODES.has(err.code)) {
      logger.warn('DB transient error — retrying once', { code: err.code });
      return runQuery<T>(text, params); // one retry with a fresh connection from pool
    }
    throw err;
  }
}

export async function queryOne<T = any>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function testConnection(): Promise<void> {
  const rows = await query<{ now: Date }>('SELECT NOW()');
  logger.info('DB connected', { serverTime: rows[0].now });
}

export { pool };
