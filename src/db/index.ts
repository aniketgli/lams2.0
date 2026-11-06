import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';
import { databaseTarget } from './connection';

/** Which database this server uses (from DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME). */
export const dbTarget = databaseTarget();

/** Shared connection pool. Also used directly by the session store. */
export const pool = mysql.createPool({
  ...dbTarget,
  // Thousands of people use the portal together, so the pool is sized for that (MySQL's
  // max_connections must be higher than this number times the number of server processes).
  connectionLimit: Number(process.env.DB_POOL_SIZE || 40),
  // When every connection is busy, up to this many requests wait; more are refused at once
  // (a clear error) instead of piling up without limit until the server runs out of memory.
  queueLimit: Number(process.env.DB_QUEUE_LIMIT || 500),
  connectTimeout: 10_000,
  enableKeepAlive: true,
  maxIdle: 10,
  idleTimeout: 60_000,
});

// A SELECT that runs longer than this is stopped by MySQL, so one huge report cannot hold the database.
const queryTimeoutMs = Math.max(1000, Number(process.env.DB_QUERY_TIMEOUT_MS || 30_000));
pool.pool.on('connection', (connection) => {
  connection.query(`SET SESSION max_execution_time = ${Math.trunc(queryTimeoutMs)}`);
});

export const db = drizzle(pool, { schema, mode: 'default' });
