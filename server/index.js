import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import pkg from 'pg';

dotenv.config(); // load .env when running locally / on Railway

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/**
 * OPTIONAL: Postgres connection
 * We only create the pool if DATABASE_URL is set.
 * That way your API still runs even before the DB is wired.
 */
let pool = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
  });

  pool.on('error', (err) => {
    console.error('Unexpected PG client error', err);
  });
} else {
  console.warn(
    'DATABASE_URL not set. Running without Postgres connection for now.',
  );
}

/**
 * Load EuroMillions CSV:
 * Expected headers: date,n1,n2,n3,n4,n5,s1,s2
 */
function loadEuromillions() {
  const filePath = path.join(__dirname, 'data', 'euromillions.csv');

  if (!fs.existsSync(filePath)) {
    console.warn('euromillions.csv not found at', filePath);
    return [];
  }

  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];

  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
  });

  return records.map((row) => ({
    date: row.date,
    n1: Number(row.n1),
    n2: Number(row.n2),
    n3: Number(row.n3),
    n4: Number(row.n4),
    n5: Number(row.n5),
    s1: Number(row.s1),
    s2: Number(row.s2),
  }));
}

function computeFrequency() {
  const draws = loadEuromillions();

  const main = new Map();
  const stars = new Map();

  for (const d of draws) {
    [d.n1, d.n2, d.n3, d.n4, d.n5].forEach((n) => {
      if (!Number.isNaN(n)) main.set(n, (main.get(n) || 0) + 1);
    });
    [d.s1, d.s2].forEach((n) => {
      if (!Number.isNaN(n)) stars.set(n, (stars.get(n) || 0) + 1);
    });
  }

  const toArr = (m) =>
    Array.from(m.entries())
      .map(([number, count]) => ({ number, count }))
      .sort((a, b) => b.count - a.count || a.number - b.number);

  return {
    main: toArr(main),
    stars: toArr(stars),
    totalDraws: draws.length,
  };
}

/**
 * Health check
 * - Always confirms API is running.
 * - If DATABASE_URL is set, also tries a lightweight DB query.
 */
app.get('/api/health', async (_req, res) => {
  if (!pool) {
    return res.json({
      ok: true,
      service: 'drawlytics-api',
      db: 'not_configured',
    });
  }

  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      ok: true,
      service: 'drawlytics-api',
      db: 'connected',
      time: result.rows[0].now,
    });
  } catch (err) {
    console.error('DB health check failed:', err);
    res.status(500).json({
      ok: false,
      service: 'drawlytics-api',
      db: 'connection_failed',
    });
  }
});

/**
 * Frequency endpoint (EuroMillions demo from CSV)
 */
app.get('/api/frequency', (_req, res) => {
  try {
    const freq = computeFrequency();
    res.json(freq);
  } catch (err) {
    console.error('Frequency error:', err);
    res.status(500).json({ ok: false, error: 'frequency_failed' });
  }
});

/**
 * Root
 */
app.get('/', (_req, res) => {
  res.send('Drawlytics API is running');
});

/**
 * Start server
 */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API running on http://0.0.0.0:${PORT}`);
});
