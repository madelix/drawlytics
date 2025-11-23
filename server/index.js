// server/index.js
import express from 'express';
import cors from 'cors';

import { db, pool } from './db.js';
import * as schema from './drizzle/schema.js';
import { desc, count } from 'drizzle-orm';

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
 * Frequency endpoint (EuroMillions) – now using Postgres via Drizzle
 */
app.get('/api/frequency', async (_req, res) => {
  try {
    // Fetch all draws from the database
    const draws = await db.select().from(euromillions_draws);

    const main = new Map();
    const stars = new Map();

    for (const d of draws) {
      // adjust these field names if they differ in schema.js
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
 * Latest draw endpoint – returns the most recent EuroMillions draw
 */
app.get('/api/draws/latest', async (_req, res) => {
  try {
    // Get the most recent draw (by draw_date) from the database
    const rows = await db
      .select()
      .from(euromillions_draws)
      .orderBy(desc(euromillions_draws.draw_date))
      .limit(1);

    const latest = rows[0];

    if (!latest) {
      return res.status(404).json({
        ok: false,
        error: 'No draws found in database',
      });
    }

    const response = {
      ok: true,
      draw: {
        id: latest.id,
        draw_date: latest.draw_date, // adjust if your column is named differently in schema.js
        numbers: [latest.n1, latest.n2, latest.n3, latest.n4, latest.n5],
        stars: [latest.s1, latest.s2],
        raw: latest, // full row for flexibility on the frontend
      },
    };

    return res.json(response);
  } catch (err) {
    console.error('Error fetching latest draw:', err);
    return res.status(500).json({
      ok: false,
      error: 'latest_draw_db_failed',
    });
  }
});

/**
 * All draws endpoint – paginated EuroMillions draw history
 *
 * GET /api/draws/all?limit=100&offset=0
 *
 * - limit:  how many rows to return (default 100, max 500)
 * - offset: how many rows to skip (default 0)
 *
 * Response shape:
 * {
 *   ok: true,
 *   draws: [...],
 *   pagination: {
 *     limit: number,
 *     offset: number,
 *     total: number,
 *     hasMore: boolean
 *   }
 * }
 */
app.get('/api/draws/all', async (req, res) => {
  try {
    // 1) Parse and sanitise query params
    const limitParam = req.query.limit;
    const offsetParam = req.query.offset;

    let limit = parseInt(
      typeof limitParam === 'string' ? limitParam : '100',
      10,
    );
    let offset = parseInt(
      typeof offsetParam === 'string' ? offsetParam : '0',
      10,
    );

    if (Number.isNaN(limit) || limit <= 0) limit = 100;
    if (limit > 500) limit = 500; // hard safety cap

    if (Number.isNaN(offset) || offset < 0) offset = 0;

    // 2) Fetch paginated draws (ordered by most recent first)
    const draws = await db
      .select()
      .from(euromillions_draws)
      .orderBy(desc(euromillions_draws.draw_date))
      .limit(limit)
      .offset(offset);

    // 3) Get total count for pagination UI
    const countResult = await db
      .select({ value: count() })
      .from(euromillions_draws);

    const total = Number(countResult[0]?.value ?? 0);

    res.json({
      ok: true,
      draws,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + draws.length < total,
      },
    });
  } catch (err) {
    console.error('Error fetching all draws:', err);
    res.status(500).json({
      ok: false,
      error: 'draws_all_db_failed',
    });
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
