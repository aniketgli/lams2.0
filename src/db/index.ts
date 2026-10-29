import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and configure the database.');
}

/** Shared connection pool. Also used directly by the session store. */
export const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
});

export const db = drizzle(pool, { schema, mode: 'default' });
