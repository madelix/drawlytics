// server/drizzle.config.js
import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load server/.env reliably
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing. Check server/.env');
}

export default defineConfig({
  schema: './drizzle/schema.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },

  // Force drizzle-kit to use *this* migrations table
  migrations: {
    table: '__drizzle_migrations',
    schema: 'drizzle',
  },
});
