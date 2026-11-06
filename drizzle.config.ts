import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();
import { databaseTarget } from './src/db/connection';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'mysql',
  dbCredentials: databaseTarget(),
});
