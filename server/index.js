// server/index.js
import express from 'express';
import cors from 'cors';
import { desc } from 'drizzle-orm';

import { db, pool } from './db.js';
import * as schema from './drizzle/schema.js';

const app = express();
const PORT = process.env.PORT || 3000;

const { euromillions_draws } = schema;

app.use(cors());
app.use(express.json());

/**
 * Health check
 * - Confirms API is running.
 * - Pings the DB using the shared pool from db.js.
 */
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');

    res.json({
      ok: true,
      service: 'drawlytics-api',
      db: 'connected',
      time: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Healthcheck DB error:', err);
    res.status(500).json({
      ok: false,
      service: 'drawlytics-api',
      db: 'connection_failed',
    });
  }
});

/**
 * Frequency endpoint (EuroMillions) – full history
 */
app.get('/api/frequency', async (_req, res) => {
  try {
    // Fetch all draws from the database
    const draws = await db.select().from(euromillions_draws);

    const main = new Map();
    const stars = new Map();

    for (const d of draws) {
      [d.n1, d.n2, d.n3, d.n4, d.n5].forEach((n) => {
        if (n != null) main.set(n, (main.get(n) || 0) + 1);
      });
      [d.s1, d.s2].forEach((n) => {
        if (n != null) stars.set(n, (stars.get(n) || 0) + 1);
      });
    }

    const toArr = (m) =>
      Array.from(m.entries())
        .map(([number, count]) => ({ number, count }))
        .sort((a, b) => b.count - a.count || a.number - b.number);

    res.json({
      ok: true,
      main: toArr(main),
      stars: toArr(stars),
      totalDraws: draws.length,
    });
  } catch (err) {
    console.error('Frequency error (db):', err);
    res.status(500).json({ ok: false, error: 'frequency_db_failed' });
  }
});

/**
 * NEW: Frequency on the last N draws (most recent first)
 * GET /api/frequency/latest-n?n=100
 */
app.get('/api/frequency/latest-n', async (req, res) => {
  try {
    // Parse n from query, with sane defaults and limits
    const raw = req.query.n;
    let n = parseInt(raw != null ? String(raw) : '100', 10);

    if (Number.isNaN(n) || n <= 0) n = 100;
    // Hard cap to avoid silly values hitting the DB
    if (n > 1000) n = 1000;

    // Fetch last N draws ordered by date DESC
    const draws = await db
      .select()
      .from(euromillions_draws)
      .orderBy(desc(euromillions_draws.draw_date))
      .limit(n);

    const main = new Map();
    const stars = new Map();

    for (const d of draws) {
      [d.n1, d.n2, d.n3, d.n4, d.n5].forEach((num) => {
        if (num != null) main.set(num, (main.get(num) || 0) + 1);
      });
      [d.s1, d.s2].forEach((num) => {
        if (num != null) stars.set(num, (stars.get(num) || 0) + 1);
      });
    }

    const toArr = (m) =>
      Array.from(m.entries())
        .map(([number, count]) => ({ number, count }))
        .sort((a, b) => b.count - a.count || a.number - b.number);

    res.json({
      ok: true,
      main: toArr(main),
      stars: toArr(stars),
      requestedN: n,
      totalDrawsConsidered: draws.length,
    });
  } catch (err) {
    console.error('Frequency latest-n error:', err);
    res.status(500).json({ ok: false, error: 'frequency_latest_n_db_failed' });
  }
});

/**
 * Latest draw endpoint
 */
app.get('/api/draws/latest', async (_req, res) => {
  try {
    const latestDraw = await db
      .select()
      .from(euromillions_draws)
      .orderBy(desc(euromillions_draws.draw_date))
      .limit(1);

    if (!latestDraw.length) {
      return res.status(404).json({
        ok: false,
        error: 'no_draws_found',
      });
    }

    const d = latestDraw[0];

    const numbers = [d.n1, d.n2, d.n3, d.n4, d.n5].filter(
      (n) => n !== null && n !== undefined,
    );
    const stars = [d.s1, d.s2].filter((n) => n !== null && n !== undefined);

    res.json({
      ok: true,
      draw: {
        id: d.id,
        draw_date: d.draw_date,
        numbers,
        stars,
        raw: d,
      },
    });
  } catch (err) {
    console.error('Latest draw error:', err);
    res.status(500).json({ ok: false, error: 'latest_draw_db_failed' });
  }
});

/**
 * Draws collection with pagination
 * GET /api/draws/all?limit=20&offset=0
 */
app.get('/api/draws/all', async (req, res) => {
  try {
    const rawLimit = req.query.limit;
    const rawOffset = req.query.offset;

    let limit = parseInt(rawLimit != null ? String(rawLimit) : '20', 10);
    let offset = parseInt(rawOffset != null ? String(rawOffset) : '0', 10);

    if (Number.isNaN(limit) || limit <= 0) limit = 20;
    if (limit > 200) limit = 200;

    if (Number.isNaN(offset) || offset < 0) offset = 0;

    const draws = await db
      .select()
      .from(euromillions_draws)
      .orderBy(desc(euromillions_draws.draw_date))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql`COUNT(*)`.as('count') })
      .from(euromillions_draws);

    const total = Number(count);
    const hasMore = offset + draws.length < total;

    res.json({
      ok: true,
      draws,
      pagination: {
        limit,
        offset,
        total,
        hasMore,
      },
    });
  } catch (err) {
    console.error('Draws/all error:', err);
    res.status(500).json({ ok: false, error: 'draws_all_db_failed' });
  }
});

// Simple root route
app.get('/', (_req, res) => {
  res.send('Drawlytics API is running');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API running on http://0.0.0.0:${PORT}`);
});
