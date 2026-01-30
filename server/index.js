// server/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { desc } from 'drizzle-orm';

import { db, pool } from './db.js';
import * as schema from './drizzle/schema.js';

import predictionsRouter from './routes/predictions.js';
import performanceRouter from './routes/performance.js';
import playedPredictionsRouter from './routes/playedPredictions.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Pull tables from the Drizzle schema
const { euromillions_draws } = schema;

app.use(
  cors({
    origin: true, // reflect request origin
  }),
);
app.use(express.json());

// ✅ Mount routers (all under /api)
app.use('/api', predictionsRouter);
app.use('/api', performanceRouter);
app.use('/api', playedPredictionsRouter);

/* ──────────────────────────────────────────────
   Health check
   GET /api/health
   ────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────
   Frequency – full history
   GET /api/frequency
   ────────────────────────────────────────────── */
app.get('/api/frequency', async (_req, res) => {
  try {
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

/* ──────────────────────────────────────────────
   Frequency on last N draws
   GET /api/frequency/latest-n?n=100
   ────────────────────────────────────────────── */
app.get('/api/frequency/latest-n', async (req, res) => {
  try {
    const rawN = req.query.n;
    let n = parseInt(rawN != null ? String(rawN) : '100', 10);
    if (Number.isNaN(n) || n <= 0) n = 100;
    if (n > 1000) n = 1000;

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
    res.status(500).json({ ok: false, error: 'frequency_latest_n_failed' });
  }
});

/* ──────────────────────────────────────────────
   Hot/Cold numbers on the last N draws
   GET /api/hot-cold?n=100&top=5
   ────────────────────────────────────────────── */
app.get('/api/hot-cold', async (req, res) => {
  try {
    const rawN = req.query.n;
    const rawTop = req.query.top;

    let n = parseInt(rawN != null ? String(rawN) : '100', 10);
    if (Number.isNaN(n) || n <= 0) n = 100;
    if (n > 1000) n = 1000;

    let top = parseInt(rawTop != null ? String(rawTop) : '5', 10);
    if (Number.isNaN(top) || top <= 0) top = 5;
    if (top > 25) top = 25;

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

    const toSortedArray = (m) =>
      Array.from(m.entries())
        .map(([number, count]) => ({ number, count }))
        .sort((a, b) => b.count - a.count || a.number - b.number);

    const mainArr = toSortedArray(main);
    const starsArr = toSortedArray(stars);

    const hotMain = mainArr.slice(0, top);
    const hotStars = starsArr.slice(0, top);

    const coldMain = mainArr
      .slice()
      .reverse()
      .filter((item) => item.count > 0)
      .slice(0, top);

    const coldStars = starsArr
      .slice()
      .reverse()
      .filter((item) => item.count > 0)
      .slice(0, top);

    res.json({
      ok: true,
      requestedN: n,
      totalDrawsConsidered: draws.length,
      top,
      hot: { main: hotMain, stars: hotStars },
      cold: { main: coldMain, stars: coldStars },
    });
  } catch (err) {
    console.error('Hot/Cold error:', err);
    res.status(500).json({ ok: false, error: 'hot_cold_db_failed' });
  }
});

/* ──────────────────────────────────────────────
   Gap / Overdue analysis (full history)
   GET /api/gaps
   ────────────────────────────────────────────── */
app.get('/api/gaps', async (_req, res) => {
  try {
    const draws = await db
      .select()
      .from(euromillions_draws)
      .orderBy(desc(euromillions_draws.draw_date));

    const totalDraws = draws.length;
    const mainLastSeen = new Map();
    const starLastSeen = new Map();

    draws.forEach((d, index) => {
      const drawDate = d.draw_date;

      [d.n1, d.n2, d.n3, d.n4, d.n5].forEach((num) => {
        if (num != null && !mainLastSeen.has(num)) {
          mainLastSeen.set(num, { gap: index, lastSeen: drawDate });
        }
      });

      [d.s1, d.s2].forEach((num) => {
        if (num != null && !starLastSeen.has(num)) {
          starLastSeen.set(num, { gap: index, lastSeen: drawDate });
        }
      });
    });

    const mainGaps = [];
    for (let n = 1; n <= 50; n++) {
      const info = mainLastSeen.get(n);
      mainGaps.push({
        number: n,
        gap: info ? info.gap : totalDraws,
        lastSeen: info ? info.lastSeen : null,
      });
    }

    const starGaps = [];
    for (let n = 1; n <= 12; n++) {
      const info = starLastSeen.get(n);
      starGaps.push({
        number: n,
        gap: info ? info.gap : totalDraws,
        lastSeen: info ? info.lastSeen : null,
      });
    }

    mainGaps.sort((a, b) => b.gap - a.gap || a.number - b.number);
    starGaps.sort((a, b) => b.gap - a.gap || a.number - b.number);

    res.json({
      ok: true,
      main: mainGaps,
      stars: starGaps,
      totalDrawsConsidered: totalDraws,
    });
  } catch (err) {
    console.error('Gaps error:', err);
    res.status(500).json({ ok: false, error: 'gaps_db_failed' });
  }
});

/* ──────────────────────────────────────────────
   Latest draw
   GET /api/draws/latest
   ────────────────────────────────────────────── */
app.get('/api/draws/latest', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(euromillions_draws)
      .orderBy(desc(euromillions_draws.draw_date))
      .limit(1);

    const latest = rows[0] ?? null;
    if (!latest) return res.json({ ok: true, draw: null });

    const { id, draw_date, n1, n2, n3, n4, n5, s1, s2 } = latest;

    res.json({
      ok: true,
      draw: {
        id,
        draw_date,
        numbers: [n1, n2, n3, n4, n5],
        stars: [s1, s2],
        raw: latest,
      },
    });
  } catch (err) {
    console.error('Latest draw error:', err);
    res.status(500).json({ ok: false, error: 'latest_draw_failed' });
  }
});

/* ──────────────────────────────────────────────
   Draws collection with pagination
   GET /api/draws/all?limit=20&offset=0
   ────────────────────────────────────────────── */
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

    const allRows = await db.select().from(euromillions_draws);
    const total = allRows.length;
    const hasMore = offset + draws.length < total;

    res.json({
      ok: true,
      draws,
      pagination: { limit, offset, total, hasMore },
    });
  } catch (err) {
    console.error('Draws/all error:', err);
    res.status(500).json({ ok: false, error: 'draws_all_db_failed' });
  }
});

/* ──────────────────────────────────────────────
   Root
   ────────────────────────────────────────────── */
app.get('/', (_req, res) => {
  res.send('Drawlytics API is running');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API running on http://0.0.0.0:${PORT}`);
});
