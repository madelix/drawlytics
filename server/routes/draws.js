// server/routes/draws.js
import express from 'express';
import { desc, eq, sql, lt, gt, asc } from 'drizzle-orm';
import { db } from '../db.js';
import * as schema from '../drizzle/schema.js';

const router = express.Router();
const { euromillions_draws } = schema;

/**
 * Convert input into YYYY-MM-DD (UTC day).
 * Accepts:
 *  - "YYYY-MM-DD"
 *  - ISO strings
 *  - Date
 *
 * Returns: "YYYY-MM-DD" or null
 */
function normalizeDayString(input) {
  if (!input) return null;

  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;

  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

/**
 * Admin auth:
 * - Prefer header: x-admin-key
 * - Fallback: query param ?admin_key=...
 *
 * Why: some proxies (Vercel rewrites) can drop custom headers.
 */
function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_KEY;

  // accept either header OR query param (useful when proxies drop headers)
  const gotHeader = req.headers['x-admin-key'];
  const gotQuery = req.query?.admin_key;

  const got =
    (typeof gotHeader === 'string' && gotHeader.trim()) ||
    (typeof gotQuery === 'string' && gotQuery.trim()) ||
    null;

  if (!expected) {
    return res
      .status(500)
      .json({ ok: false, error: 'admin_key_not_configured' });
  }

  if (!got || got !== expected) {
    return res.status(401).json({
      ok: false,
      error: 'unauthorized',
      // tiny diagnostics (safe: no secrets revealed)
      expected_set: true,
      got_from: gotHeader ? 'header' : gotQuery ? 'query' : 'missing',
    });
  }

  next();
}

/* ──────────────────────────────────────────────
   GET /api/draws/latest
   ────────────────────────────────────────────── */
router.get('/draws/latest', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(euromillions_draws)
      .orderBy(desc(euromillions_draws.draw_date))
      .limit(1);

    res.json({ ok: true, draw: rows[0] ?? null });
  } catch (e) {
    console.error('GET /draws/latest failed:', e);
    res.status(500).json({ ok: false, error: 'latest_draw_failed' });
  }
});

/* ──────────────────────────────────────────────
   GET /api/draws/all?limit=20&offset=0
   Uses COUNT(*) instead of loading all ids.
   ────────────────────────────────────────────── */
router.get('/draws/all', async (req, res) => {
  try {
    let limit = parseInt(String(req.query.limit ?? '20'), 10);
    let offset = parseInt(String(req.query.offset ?? '0'), 10);

    if (Number.isNaN(limit) || limit <= 0) limit = 20;
    if (limit > 200) limit = 200;
    if (Number.isNaN(offset) || offset < 0) offset = 0;

    const draws = await db
      .select()
      .from(euromillions_draws)
      .orderBy(desc(euromillions_draws.draw_date))
      .limit(limit)
      .offset(offset);

    const countRows = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(euromillions_draws);

    const total = countRows?.[0]?.count ?? 0;
    const hasMore = offset + draws.length < total;

    res.json({
      ok: true,
      draws,
      pagination: { limit, offset, total, hasMore },
    });
  } catch (e) {
    console.error('GET /draws/all failed:', e);
    res.status(500).json({ ok: false, error: 'draws_all_failed' });
  }
});

/* ──────────────────────────────────────────────
   POST /api/draws/euromillions/upsert
   Requires: x-admin-key header OR ?admin_key=...
   Body: { draw_date:"YYYY-MM-DD", n1..n5, s1..s2 }

   NOTE: relies on UNIQUE(draw_date) in DB.
   ────────────────────────────────────────────── */
router.post('/draws/euromillions/upsert', requireAdmin, async (req, res) => {
  try {
    const { draw_date, n1, n2, n3, n4, n5, s1, s2 } = req.body ?? {};

    const day = normalizeDayString(draw_date);
    if (!day) {
      return res.status(400).json({ ok: false, error: 'invalid_draw_date' });
    }

    const nums = [n1, n2, n3, n4, n5];
    const stars = [s1, s2];

    if (
      nums.some((v) => typeof v !== 'number' || !Number.isFinite(v)) ||
      stars.some((v) => typeof v !== 'number' || !Number.isFinite(v))
    ) {
      return res.status(400).json({ ok: false, error: 'invalid_numbers' });
    }

    const inRange = (x, min, max) => x >= min && x <= max;
    if (
      nums.some((x) => !inRange(x, 1, 50)) ||
      stars.some((x) => !inRange(x, 1, 12))
    ) {
      return res.status(400).json({ ok: false, error: 'numbers_out_of_range' });
    }

    await db
      .insert(euromillions_draws)
      .values({ draw_date: day, n1, n2, n3, n4, n5, s1, s2 })
      .onConflictDoUpdate({
        target: euromillions_draws.draw_date,
        set: { n1, n2, n3, n4, n5, s1, s2 },
      });

    const rows = await db
      .select()
      .from(euromillions_draws)
      .where(eq(euromillions_draws.draw_date, day))
      .limit(1);

    res.json({ ok: true, mode: 'upsert', draw: rows[0] ?? null });
  } catch (e) {
    console.error('POST /draws/euromillions/upsert failed:', e);
    res.status(500).json({ ok: false, error: 'upsert_failed' });
  }
});

/* ──────────────────────────────────────────────
   GET /api/draws/euromillions/debug?date=YYYY-MM-DD
   Admin-only. Helps you verify data without Railway SQL.
   Accepts admin key via header OR query param.
   ────────────────────────────────────────────── */
router.get('/draws/euromillions/debug', requireAdmin, async (req, res) => {
  try {
    const raw = String(req.query.date ?? '').trim();
    const day = normalizeDayString(raw);

    const countRows = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(euromillions_draws);
    const total = countRows?.[0]?.count ?? 0;

    const latestRows = await db
      .select({ draw_date: euromillions_draws.draw_date })
      .from(euromillions_draws)
      .orderBy(desc(euromillions_draws.draw_date))
      .limit(1);
    const latest = latestRows?.[0]?.draw_date ?? null;

    if (!day) {
      return res.json({
        ok: true,
        draws_count: total,
        latest_draw: latest ?? null,
        requested_date: raw || null,
        row_for_date: null,
        note: 'invalid_date_param',
      });
    }

    const rowForDate = await db
      .select({
        draw_date: euromillions_draws.draw_date,
        n1: euromillions_draws.n1,
        n2: euromillions_draws.n2,
        n3: euromillions_draws.n3,
        n4: euromillions_draws.n4,
        n5: euromillions_draws.n5,
        s1: euromillions_draws.s1,
        s2: euromillions_draws.s2,
      })
      .from(euromillions_draws)
      .where(eq(euromillions_draws.draw_date, day))
      .limit(1);

    const prev = await db
      .select({ draw_date: euromillions_draws.draw_date })
      .from(euromillions_draws)
      .where(lt(euromillions_draws.draw_date, day))
      .orderBy(desc(euromillions_draws.draw_date))
      .limit(1);

    const next = await db
      .select({ draw_date: euromillions_draws.draw_date })
      .from(euromillions_draws)
      .where(gt(euromillions_draws.draw_date, day))
      .orderBy(asc(euromillions_draws.draw_date))
      .limit(1);

    res.json({
      ok: true,
      draws_count: total,
      latest_draw: latest ?? null,
      requested_date: day,
      row_for_date: rowForDate[0] ?? null,
      nearest: {
        prev: prev[0]?.draw_date ?? null,
        next: next[0]?.draw_date ?? null,
      },
    });
  } catch (e) {
    console.error('GET /draws/euromillions/debug failed:', e);
    res.status(500).json({ ok: false, error: 'debug_failed' });
  }
});

export default router;
