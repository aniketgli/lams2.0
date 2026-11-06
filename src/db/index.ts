import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

if (!process.env.LAMS_PROD_DB_URL) {
  throw new Error('LAMS_PROD_DB_URL is not set. Set it in .env locally, and on the server as an environment variable.');
}

/** Shared connection pool. Also used directly by the session store. */
export const pool = mysql.createPool({
  uri: process.env.NODE_ENV === 'production' ? process.env.LAMS_PROD_DB_URL : process.env.DATABASE_URL,
   // Log the connection options for debugging
   debug: true,
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
