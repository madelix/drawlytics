// server/routes/draws.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

/**
 * Admin auth (simple header key)
 * - set ADMIN_KEY in Railway Variables (and locally in server/.env)
 * - call with:  -H "x-admin-key: <your key>"
 */
function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_KEY || '';
  const got = String(req.header('x-admin-key') || '');

  if (!expected) {
    // safer default: if not configured, block admin endpoints
    return res
      .status(500)
      .json({ ok: false, error: 'admin_key_not_configured' });
  }

  if (got !== expected) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  return next();
}

function toDateOnlyUTC(input) {
  // Accepts "YYYY-MM-DD" or any date string. Returns "YYYY-MM-DD" (UTC) or null.
  if (!input) return null;
  const dt = new Date(String(input));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function toMidnightUTCISOString(dateOnlyYYYYMMDD) {
  // "YYYY-MM-DD" -> Date at 00:00:00.000Z
  return `${dateOnlyYYYYMMDD}T00:00:00.000Z`;
}

/**
 * GET /api/draws/euromillions/latest
 */
router.get('/draws/euromillions/latest', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT draw_date, n1,n2,n3,n4,n5, s1,s2
      FROM euromillions_draws
      ORDER BY draw_date DESC
      LIMIT 1
      `,
    );

    const r = rows[0] ?? null;
    return res.json({
      ok: true,
      draw: r
        ? {
            draw_date: r.draw_date,
            main: [r.n1, r.n2, r.n3, r.n4, r.n5],
            stars: [r.s1, r.s2],
            raw: r,
          }
        : null,
    });
  } catch (err) {
    console.error('GET /draws/euromillions/latest failed:', err);
    return res.status(500).json({ ok: false, error: 'latest_failed' });
  }
});

/**
 * GET /api/draws/euromillions/all?limit=20&offset=0
 */
router.get('/draws/euromillions/all', async (req, res) => {
  try {
    let limit = parseInt(String(req.query.limit ?? '20'), 10);
    let offset = parseInt(String(req.query.offset ?? '0'), 10);

    if (Number.isNaN(limit) || limit <= 0) limit = 20;
    if (limit > 200) limit = 200;
    if (Number.isNaN(offset) || offset < 0) offset = 0;

    const { rows: draws } = await pool.query(
      `
      SELECT draw_date, n1,n2,n3,n4,n5, s1,s2
      FROM euromillions_draws
      ORDER BY draw_date DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset],
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM euromillions_draws`,
    );
    const total = countRows?.[0]?.total ?? 0;

    return res.json({
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
    console.error('GET /draws/euromillions/all failed:', err);
    return res.status(500).json({ ok: false, error: 'draws_all_failed' });
  }
});

/**
 * GET /api/draws/euromillions/by-date?date=YYYY-MM-DD
 * (handy for debugging)
 */
router.get('/draws/euromillions/by-date', async (req, res) => {
  try {
    const day = toDateOnlyUTC(req.query.date);
    if (!day) return res.status(400).json({ ok: false, error: 'invalid_date' });

    const { rows } = await pool.query(
      `
      SELECT draw_date, n1,n2,n3,n4,n5, s1,s2
      FROM euromillions_draws
      WHERE draw_date::date = $1::date
      ORDER BY draw_date DESC
      `,
      [day],
    );

    return res.json({ ok: true, date: day, rows });
  } catch (err) {
    console.error('GET /draws/euromillions/by-date failed:', err);
    return res.status(500).json({ ok: false, error: 'by_date_failed' });
  }
});

/**
 * GET /api/draws/euromillions/debug-draws?date=YYYY-MM-DD
 * - returns count, latest_draw, and the row for that exact date (if any)
 * - also returns nearest prev/next draw dates
 */
router.get('/draws/euromillions/debug-draws', async (req, res) => {
  try {
    const requested = req.query.date ? toDateOnlyUTC(req.query.date) : null;

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS draws_count FROM euromillions_draws`,
    );
    const draws_count = countRows?.[0]?.draws_count ?? 0;

    const { rows: latestRows } = await pool.query(
      `
      SELECT draw_date
      FROM euromillions_draws
      ORDER BY draw_date DESC
      LIMIT 1
      `,
    );
    const latest_draw = latestRows?.[0]?.draw_date ?? null;

    let row_for_date = null;
    let nearest = { prev: null, next: null };

    if (requested) {
      const { rows } = await pool.query(
        `
        SELECT draw_date, n1,n2,n3,n4,n5, s1,s2
        FROM euromillions_draws
        WHERE draw_date::date = $1::date
        ORDER BY draw_date DESC
        LIMIT 1
        `,
        [requested],
      );
      row_for_date = rows[0] ?? null;

      const { rows: prevRows } = await pool.query(
        `
        SELECT draw_date
        FROM euromillions_draws
        WHERE draw_date::date < $1::date
        ORDER BY draw_date DESC
        LIMIT 1
        `,
        [requested],
      );
      const { rows: nextRows } = await pool.query(
        `
        SELECT draw_date
        FROM euromillions_draws
        WHERE draw_date::date > $1::date
        ORDER BY draw_date ASC
        LIMIT 1
        `,
        [requested],
      );

      nearest = {
        prev: prevRows?.[0]?.draw_date ?? null,
        next: nextRows?.[0]?.draw_date ?? null,
      };
    }

    return res.json({
      ok: true,
      draws_count,
      latest_draw,
      requested_date: requested,
      row_for_date,
      nearest,
    });
  } catch (err) {
    console.error('GET /draws/euromillions/debug-draws failed:', err);
    return res.status(500).json({ ok: false, error: 'debug_draws_failed' });
  }
});

/**
 * POST /api/draws/euromillions/upsert
 * Admin-only.
 *
 * IMPORTANT:
 * Your DB currently allows duplicates for the same date (you saw multiple 2026-02-10 rows).
 * This endpoint:
 * - normalizes draw_date to UTC date-only
 * - if NO rows for that date -> INSERT
 * - if rows exist -> UPDATE the oldest row, and DELETE the extra duplicates
 */
router.post('/draws/euromillions/upsert', requireAdmin, async (req, res) => {
  const body = req.body ?? {};

  const day = toDateOnlyUTC(body.draw_date);
  if (!day) return res.status(400).json({ ok: false, error: 'invalid_date' });

  const n1 = Number(body.n1);
  const n2 = Number(body.n2);
  const n3 = Number(body.n3);
  const n4 = Number(body.n4);
  const n5 = Number(body.n5);
  const s1 = Number(body.s1);
  const s2 = Number(body.s2);

  const allNums = [n1, n2, n3, n4, n5];
  const allStars = [s1, s2];

  const isInt = (x) => Number.isInteger(x);

  if (!allNums.every(isInt) || !allStars.every(isInt)) {
    return res.status(400).json({ ok: false, error: 'numbers_must_be_ints' });
  }
  if (
    allNums.some((x) => x < 1 || x > 50) ||
    allStars.some((x) => x < 1 || x > 12)
  ) {
    return res.status(400).json({ ok: false, error: 'numbers_out_of_range' });
  }

  // optional: enforce uniqueness within the set
  const uniq = (arr) => new Set(arr).size === arr.length;
  if (!uniq(allNums))
    return res.status(400).json({ ok: false, error: 'duplicate_main_numbers' });
  if (!uniq(allStars))
    return res.status(400).json({ ok: false, error: 'duplicate_star_numbers' });

  const drawDateISO = toMidnightUTCISOString(day);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Grab ALL rows for that date (duplicates included)
    const { rows: existing } = await client.query(
      `
      SELECT id, draw_date, n1,n2,n3,n4,n5, s1,s2
      FROM euromillions_draws
      WHERE draw_date::date = $1::date
      ORDER BY id ASC
      `,
      [day],
    );

    if (!existing.length) {
      // Insert
      const { rows: inserted } = await client.query(
        `
        INSERT INTO euromillions_draws (draw_date, n1,n2,n3,n4,n5, s1,s2)
        VALUES ($1::timestamptz, $2,$3,$4,$5,$6, $7,$8)
        RETURNING draw_date, n1,n2,n3,n4,n5, s1,s2
        `,
        [drawDateISO, n1, n2, n3, n4, n5, s1, s2],
      );

      await client.query('COMMIT');
      return res.json({
        ok: true,
        mode: 'insert',
        draw: inserted[0],
        normalized_date: day,
        deleted_duplicates: 0,
      });
    }

    // Update the FIRST/OLDEST row, delete the rest
    const keepId = existing[0].id;
    const dupIds = existing.slice(1).map((r) => r.id);

    const { rows: updated } = await client.query(
      `
      UPDATE euromillions_draws
      SET draw_date = $1::timestamptz,
          n1 = $2, n2 = $3, n3 = $4, n4 = $5, n5 = $6,
          s1 = $7, s2 = $8
      WHERE id = $9
      RETURNING draw_date, n1,n2,n3,n4,n5, s1,s2
      `,
      [drawDateISO, n1, n2, n3, n4, n5, s1, s2, keepId],
    );

    let deleted = 0;
    if (dupIds.length) {
      const del = await client.query(
        `DELETE FROM euromillions_draws WHERE id = ANY($1::int[])`,
        [dupIds],
      );
      deleted = del.rowCount ?? 0;
    }

    await client.query('COMMIT');
    return res.json({
      ok: true,
      mode: 'update',
      normalized_date: day,
      kept_id: keepId,
      deleted_duplicates: deleted,
      draw: updated[0] ?? null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /draws/euromillions/upsert failed:', err);
    return res.status(500).json({
      ok: false,
      error: 'upsert_failed',
      message: err?.message,
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/draws/euromillions/cleanup-duplicates
 * Admin-only.
 *
 * If you already have duplicates for many dates, this will:
 * - keep the lowest id per date
 * - delete the other ids per date
 *
 * (It does NOT change numbers; it just dedupes rows.)
 */
router.post(
  '/draws/euromillions/cleanup-duplicates',
  requireAdmin,
  async (_req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Find duplicate groups (by date)
      const { rows: groups } = await client.query(
        `
        SELECT draw_date::date AS day, COUNT(*)::int AS cnt
        FROM euromillions_draws
        GROUP BY draw_date::date
        HAVING COUNT(*) > 1
        ORDER BY day DESC
        `,
      );

      let deletedTotal = 0;

      for (const g of groups) {
        const day = g.day; // date
        const { rows } = await client.query(
          `
          SELECT id
          FROM euromillions_draws
          WHERE draw_date::date = $1::date
          ORDER BY id ASC
          `,
          [day],
        );

        const keepId = rows[0]?.id;
        const toDelete = rows.slice(1).map((r) => r.id);

        if (keepId && toDelete.length) {
          const del = await client.query(
            `DELETE FROM euromillions_draws WHERE id = ANY($1::int[])`,
            [toDelete],
          );
          deletedTotal += del.rowCount ?? 0;
        }
      }

      await client.query('COMMIT');
      return res.json({
        ok: true,
        duplicate_days: groups.length,
        deleted: deletedTotal,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('POST /draws/euromillions/cleanup-duplicates failed:', err);
      return res.status(500).json({
        ok: false,
        error: 'cleanup_failed',
        message: err?.message,
      });
    } finally {
      client.release();
    }
  },
);

export default router;
