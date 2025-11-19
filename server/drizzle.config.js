// server/drizzle.config.js
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Path to your schema file
  schema: './drizzle/schema.js',

  // Where generated SQL / migrations will live
  out: './drizzle',

  // Tell Drizzle we're using PostgreSQL
  dialect: 'postgresql',

  // Use the DATABASE_URL from Railway / .env
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
