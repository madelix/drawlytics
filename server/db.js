// server/db.js
import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './drizzle/schema.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// For Railway (and most managed Postgres), SSL is needed in prod
const pool = new Pool({
  connectionString,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : undefined,
});

export const db = drizzle(pool, { schema });
export { pool }; // optional, handy for simple health checks
