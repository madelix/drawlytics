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
import drawsRouter from './routes/draws.js';
import { clerkClient, clerkMiddleware, getAuth } from '@clerk/express';

const app = express();
const PORT = process.env.PORT || 3000;

// Pull tables from the Drizzle schema
const { euromillions_draws, uk_lotto_draws, set_for_life_draws } = schema;

function getLotteryAnalysisConfig(rawLottery) {
  const lottery = String(rawLottery ?? 'euromillions')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (lottery === 'uk_lotto') {
    return {
      key: 'uk_lotto',
      table: uk_lotto_draws,
      mainColumns: [
        uk_lotto_draws.n1,
        uk_lotto_draws.n2,
        uk_lotto_draws.n3,
        uk_lotto_draws.n4,
        uk_lotto_draws.n5,
        uk_lotto_draws.n6,
      ],
      specialColumns: [uk_lotto_draws.bonus_ball],
      mainMax: 59,
      specialMax: 59,
      specialResponseKey: 'stars',
    };
  }

  if (lottery === 'set_for_life') {
    return {
      key: 'set_for_life',
      table: set_for_life_draws,
      mainColumns: [
        set_for_life_draws.n1,
        set_for_life_draws.n2,
        set_for_life_draws.n3,
        set_for_life_draws.n4,
        set_for_life_draws.n5,
      ],
      specialColumns: [set_for_life_draws.life_ball],
      mainMax: 47,
      specialMax: 10,
      specialResponseKey: 'stars',
    };
  }

  return {
    key: 'euromillions',
    table: euromillions_draws,
    mainColumns: [
      euromillions_draws.n1,
      euromillions_draws.n2,
      euromillions_draws.n3,
      euromillions_draws.n4,
      euromillions_draws.n5,
    ],
    specialColumns: [euromillions_draws.s1, euromillions_draws.s2],
    mainMax: 50,
    specialMax: 12,
    specialResponseKey: 'stars',
  };
}

app.use(
  cors({
    origin: true, // reflect request origin
  }),
);

app.use(clerkMiddleware());
app.use(express.json());

app.get('/api/auth-test', (req, res) => {
  const auth = getAuth(req);

  res.json({
    ok: true,
    isAuthenticated: auth.isAuthenticated,
    userId: auth.userId ?? null,
  });
});

app.get('/api/me', async (req, res) => {
  try {
    const auth = getAuth(req);

    if (!auth.userId) {
      return res.status(401).json({
        ok: false,
        error: 'unauthenticated',
      });
    }

    const clerkUser = await clerkClient.users.getUser(auth.userId);

    const primaryEmail =
      clerkUser.emailAddresses.find(
        (email) => email.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress ?? null;

    const { rows } = await pool.query(
      `
  WITH existing_user AS (
    UPDATE users
    SET
      clerk_user_id = $1,
      email = $2,
      updated_at = now()
    WHERE id = (
  SELECT id
  FROM users
  WHERE LOWER(email) = LOWER($2)
  ORDER BY id
  LIMIT 1
)
    RETURNING id, clerk_user_id, email, created_at, updated_at
  ),
  inserted_user AS (
    INSERT INTO users (clerk_user_id, email)
    SELECT $1, $2
    WHERE NOT EXISTS (SELECT 1 FROM existing_user)
    ON CONFLICT (clerk_user_id)
    DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = now()
    RETURNING id, clerk_user_id, email, created_at, updated_at
  )
  SELECT * FROM existing_user
  UNION ALL
  SELECT * FROM inserted_user
  LIMIT 1
  `,
      [auth.userId, primaryEmail],
    );

    return res.json({
      ok: true,
      user: rows[0],
    });
  } catch (err) {
    console.error('GET /api/me failed:', err);

    return res.status(500).json({
      ok: false,
      error: 'user_sync_failed',
    });
  }
});

// ✅ Mount routers (all under /api)
app.use('/api', predictionsRouter);
app.use('/api', performanceRouter);
app.use('/api', playedPredictionsRouter);
app.use('/api', drawsRouter);

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
    const config = getLotteryAnalysisConfig(req.query.lottery);
    const rawN = req.query.n;

    let n = parseInt(rawN != null ? String(rawN) : '100', 10);

    const useAllDraws = n === -1;

    if (Number.isNaN(n)) n = 100;

    if (!useAllDraws) {
      if (n <= 0) n = 100;
      if (n > 1000) n = 1000;
    }

    let query = db
      .select()
      .from(config.table)
      .orderBy(desc(config.table.draw_date));

    if (!useAllDraws) {
      query = query.limit(n);
    }

    const draws = await query;

    const main = new Map();
    const stars = new Map();

    for (const d of draws) {
      config.mainColumns.forEach((col) => {
        const num = d[col.name];
        if (num != null) main.set(num, (main.get(num) || 0) + 1);
      });

      config.specialColumns.forEach((col) => {
        const num = d[col.name];
        if (num != null) stars.set(num, (stars.get(num) || 0) + 1);
      });
    }

    const toArr = (m) =>
      Array.from(m.entries())
        .map(([number, count]) => ({ number, count }))
        .sort((a, b) => b.count - a.count || a.number - b.number);

    res.json({
      ok: true,
      lottery: config.key,
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
    const config = getLotteryAnalysisConfig(req.query.lottery);

    const rawN = req.query.n;
    const rawTop = req.query.top;

    let n = parseInt(rawN != null ? String(rawN) : '100', 10);

    const useAllDraws = n === -1;

    if (Number.isNaN(n)) n = 100;

    if (!useAllDraws) {
      if (n <= 0) n = 100;
      if (n > 1000) n = 1000;
    }

    let top = parseInt(rawTop != null ? String(rawTop) : '5', 10);
    if (Number.isNaN(top) || top <= 0) top = 5;
    if (top > 25) top = 25;

    let query = db
      .select()
      .from(config.table)
      .orderBy(desc(config.table.draw_date));

    if (!useAllDraws) {
      query = query.limit(n);
    }

    const draws = await query;

    const main = new Map();
    const stars = new Map();

    for (const d of draws) {
      config.mainColumns.forEach((col) => {
        const num = d[col.name];
        if (num != null) main.set(num, (main.get(num) || 0) + 1);
      });

      config.specialColumns.forEach((col) => {
        const num = d[col.name];
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
      lottery: config.key,
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
app.get('/api/gaps', async (req, res) => {
  try {
    const config = getLotteryAnalysisConfig(req.query.lottery);

    const draws = await db
      .select()
      .from(config.table)
      .orderBy(desc(config.table.draw_date));

    const totalDraws = draws.length;
    const mainLastSeen = new Map();
    const starLastSeen = new Map();

    draws.forEach((d, index) => {
      const drawDate = d.draw_date;

      config.mainColumns.forEach((col) => {
        const num = d[col.name];

        if (num != null && !mainLastSeen.has(num)) {
          mainLastSeen.set(num, { gap: index, lastSeen: drawDate });
        }
      });

      config.specialColumns.forEach((col) => {
        const num = d[col.name];

        if (num != null && !starLastSeen.has(num)) {
          starLastSeen.set(num, { gap: index, lastSeen: drawDate });
        }
      });
    });

    const mainGaps = [];
    for (let n = 1; n <= config.mainMax; n++) {
      const info = mainLastSeen.get(n);
      mainGaps.push({
        number: n,
        gap: info ? info.gap : totalDraws,
        lastSeen: info ? info.lastSeen : null,
      });
    }

    const starGaps = [];
    for (let n = 1; n <= config.specialMax; n++) {
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
      lottery: config.key,
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

    const config = getLotteryAnalysisConfig(req.query.lottery);

    const draws = await db
      .select({
        id: config.table.id,
        draw_date: config.table.draw_date,

        n1: config.table.n1,
        n2: config.table.n2,
        n3: config.table.n3,
        n4: config.table.n4,
        n5: config.table.n5,

        n6: config.table.n6,

        s1: config.table.s1,
        s2: config.table.s2,

        bonus_ball: config.table.bonus_ball,
        life_ball: config.table.life_ball,
      })
      .from(config.table)
      .orderBy(desc(config.table.draw_date))
      .limit(limit)
      .offset(offset);

    const allRows = await db.select().from(config.table);

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
