import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';
import { envConfig } from '../../server/config/env.config';

if (!envConfig.databaseUrl) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and configure the database.');
}

/** Shared connection pool. Also used directly by the session store. */
export const pool = mysql.createPool({
  uri: envConfig.databaseUrl,
  // Thousands of people use the portal together, so the pool is sized for that (MySQL's
  // max_connections must be higher than this number times the number of server processes).
  connectionLimit: envConfig.dbPoolSize,
  // When every connection is busy, up to this many requests wait; more are refused at once
  // (a clear error) instead of piling up without limit until the server runs out of memory.
  queueLimit: envConfig.dbQueueLimit,
  connectTimeout: 10_000,
  enableKeepAlive: true,
  maxIdle: 10,
  idleTimeout: 60_000,
});

// A SELECT that runs longer than this is stopped by MySQL, so one huge report cannot hold the database.
const queryTimeoutMs = envConfig.dbQueryTimeoutMs;
pool.pool.on('connection', (connection) => {
  connection.query(`SET SESSION max_execution_time = ${Math.trunc(queryTimeoutMs)}`);
});

export const db = drizzle(pool, { schema, mode: 'default' });
