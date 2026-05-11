// server/routes/draws.js
import express from 'express';
import { desc, eq, sql, lt, gt, asc } from 'drizzle-orm';
import { db } from '../db.js';
import * as schema from '../drizzle/schema.js';
import { XMLParser } from 'fast-xml-parser';

const router = express.Router();
const { euromillions_draws, uk_lotto_draws, set_for_life_draws } = schema;

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

  const raw = typeof input === 'string' ? input.trim() : input;

  // Already YYYY-MM-DD
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;

  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function asStringOrNull(v) {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return null;
}

function getAdminKeyFromReq(req) {
  // header is preferred (safer), query is useful when proxies strip headers
  const headerKey = asStringOrNull(req.headers['x-admin-key']);
  const queryKey =
    typeof req.query.adminKey === 'string' ? req.query.adminKey : null;

  const got = (headerKey ?? queryKey ?? '').trim();
  const gotFrom = headerKey ? 'header' : queryKey ? 'query' : 'none';

  return { got: got || null, gotFrom };
}

function requireAdmin(req, res, next) {
  const expected = (process.env.ADMIN_KEY || '').trim();
  const { got } = getAdminKeyFromReq(req);

  if (!expected) {
    return res
      .status(500)
      .json({ ok: false, error: 'admin_key_not_configured' });
  }

  if (!got || got !== expected) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  next();
}

/**
 * Shared upsert logic (used by manual upsert + feed fetch)
 */
async function upsertEuroMillionsDraw(payload) {
  const { draw_date, n1, n2, n3, n4, n5, s1, s2 } = payload ?? {};

  const day = normalizeDayString(draw_date);
  if (!day) return { ok: false, status: 400, error: 'invalid_draw_date' };

  const nums = [n1, n2, n3, n4, n5];
  const stars = [s1, s2];

  // type check
  if (
    nums.some((v) => typeof v !== 'number' || !Number.isFinite(v)) ||
    stars.some((v) => typeof v !== 'number' || !Number.isFinite(v))
  ) {
    return { ok: false, status: 400, error: 'invalid_numbers' };
  }

  // range check
  const inRange = (x, min, max) => x >= min && x <= max;
  if (
    nums.some((x) => !inRange(x, 1, 50)) ||
    stars.some((x) => !inRange(x, 1, 12))
  ) {
    return { ok: false, status: 400, error: 'numbers_out_of_range' };
  }

  // UPSERT by draw_date (relies on UNIQUE(draw_date))
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

  return { ok: true, status: 200, day, draw: rows[0] ?? null };
}

async function upsertUkLottoDraw(payload) {
  const { draw_date, n1, n2, n3, n4, n5, n6, bonus_ball } = payload ?? {};

  const day = normalizeDayString(draw_date);
  if (!day) {
    return { ok: false, status: 400, error: 'invalid_draw_date' };
  }

  const nums = [n1, n2, n3, n4, n5, n6];

  // type check
  if (
    nums.some((v) => typeof v !== 'number' || !Number.isFinite(v)) ||
    typeof bonus_ball !== 'number' ||
    !Number.isFinite(bonus_ball)
  ) {
    return { ok: false, status: 400, error: 'invalid_numbers' };
  }

  // range check
  const inRange = (x, min, max) => x >= min && x <= max;

  if (nums.some((x) => !inRange(x, 1, 59)) || !inRange(bonus_ball, 1, 59)) {
    return { ok: false, status: 400, error: 'numbers_out_of_range' };
  }

  // UPSERT by draw_date
  await db
    .insert(uk_lotto_draws)
    .values({
      draw_date: day,
      n1,
      n2,
      n3,
      n4,
      n5,
      n6,
      bonus_ball,
    })
    .onConflictDoUpdate({
      target: uk_lotto_draws.draw_date,
      set: {
        n1,
        n2,
        n3,
        n4,
        n5,
        n6,
        bonus_ball,
      },
    });

  const rows = await db
    .select()
    .from(uk_lotto_draws)
    .where(eq(uk_lotto_draws.draw_date, day))
    .limit(1);

  return {
    ok: true,
    status: 200,
    day,
    draw: rows[0] ?? null,
  };
}
/**
 * Fetch + parse latest EuroMillions draw from XML feed.
 * Returns a normalized payload ready for upsertEuroMillionsDraw.
 */
async function fetchLatestEuroMillionsFromFeed() {
  const url = (process.env.EUROMILLIONS_FEED_URL || '').trim();
  if (!url) {
    return { ok: false, status: 500, error: 'feed_url_not_configured' };
  }

  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), 10_000);

  let r;
  try {
    r = await fetch(url, {
      headers: { Accept: 'application/xml,text/xml,*/*' },
      signal: ac.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!r.ok) {
    return {
      ok: false,
      status: 502,
      error: 'feed_fetch_failed',
      meta: { status: r.status },
    };
  }

  const xml = await r.text();

  // Basic sanity check: avoid parsing HTML/error pages as XML
  const head = xml.trim().slice(0, 200).toLowerCase();
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
    return {
      ok: false,
      status: 502,
      error: 'feed_not_xml',
      meta: { status: r.status },
    };
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true,
  });

  const parsed = parser.parse(xml);

  const game = parsed?.['draw-results']?.game;
  const drawDateRaw = game?.draw?.['draw-date'];
  const balls = game?.balls;

  const ballNodes = Array.isArray(balls?.ball)
    ? balls.ball
    : balls?.ball
      ? [balls.ball]
      : [];

  // Each <ball number="1">21</ball> might parse as:
  // { number: "1", "#text": "21" }  OR sometimes just "21"
  const mainNums = ballNodes
    .map((b) => {
      const ord = Number(b?.number);
      const val = Number(b?.['#text'] ?? b);
      return { ord, val };
    })
    .filter((x) => Number.isFinite(x.ord) && Number.isFinite(x.val))
    .sort((a, b) => a.ord - b.ord)
    .map((x) => x.val);

  const bonusNodes = Array.isArray(balls?.['bonus-ball'])
    ? balls['bonus-ball']
    : balls?.['bonus-ball']
      ? [balls['bonus-ball']]
      : [];

  const starNums = bonusNodes
    .filter((bb) => String(bb?.type ?? '').toLowerCase() === 'luckystar')
    .map((bb) => {
      const ord = Number(bb?.number);
      const val = Number(bb?.['#text'] ?? bb);
      return { ord, val };
    })
    .filter((x) => Number.isFinite(x.ord) && Number.isFinite(x.val))
    .sort((a, b) => a.ord - b.ord)
    .map((x) => x.val);

  const draw_date = normalizeDayString(drawDateRaw);

  if (!draw_date || mainNums.length < 5 || starNums.length < 2) {
    return {
      ok: false,
      status: 500,
      error: 'feed_parse_failed',
      meta: {
        draw_date_raw: drawDateRaw ?? null,
        parsed_main_count: mainNums.length,
        parsed_star_count: starNums.length,
      },
    };
  }

  const [n1, n2, n3, n4, n5] = mainNums.slice(0, 5);
  const [s1, s2] = starNums.slice(0, 2);

  return {
    ok: true,
    status: 200,
    url,
    payload: { draw_date, n1, n2, n3, n4, n5, s1, s2 },
  };
}

async function fetchLatestUkLottoFromFeed() {
  const url = (process.env.UK_LOTTO_FEED_URL || '').trim();
  if (!url) {
    return { ok: false, status: 500, error: 'feed_url_not_configured' };
  }

  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), 10_000);

  let r;
  try {
    r = await fetch(url, {
      headers: { Accept: 'application/xml,text/xml,*/*' },
      signal: ac.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!r.ok) {
    return {
      ok: false,
      status: 502,
      error: 'feed_fetch_failed',
      meta: { status: r.status },
    };
  }

  const xml = await r.text();

  const head = xml.trim().slice(0, 200).toLowerCase();
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
    return {
      ok: false,
      status: 502,
      error: 'feed_not_xml',
      meta: { status: r.status },
    };
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true,
  });

  const parsed = parser.parse(xml);

  const game = parsed?.['draw-results']?.game;
  const drawDateRaw = game?.draw?.['draw-date'];
  const balls = game?.balls;

  const ballNodes = Array.isArray(balls?.ball)
    ? balls.ball
    : balls?.ball
      ? [balls.ball]
      : [];

  const mainNums = ballNodes
    .map((b) => {
      const ord = Number(b?.number);
      const val = Number(b?.['#text'] ?? b);
      return { ord, val };
    })
    .filter((x) => Number.isFinite(x.ord) && Number.isFinite(x.val))
    .sort((a, b) => a.ord - b.ord)
    .map((x) => x.val);

  const bonusNodes = Array.isArray(balls?.['bonus-ball'])
    ? balls['bonus-ball']
    : balls?.['bonus-ball']
      ? [balls['bonus-ball']]
      : [];

  const bonusNums = bonusNodes
    .map((bb) => {
      const ord = Number(bb?.number);
      const val = Number(bb?.['#text'] ?? bb);
      return { ord, val };
    })
    .filter((x) => Number.isFinite(x.ord) && Number.isFinite(x.val))
    .sort((a, b) => a.ord - b.ord)
    .map((x) => x.val);

  const draw_date = normalizeDayString(drawDateRaw);

  if (!draw_date || mainNums.length < 6 || bonusNums.length < 1) {
    return {
      ok: false,
      status: 500,
      error: 'feed_parse_failed',
      meta: {
        draw_date_raw: drawDateRaw ?? null,
        parsed_main_count: mainNums.length,
        parsed_bonus_count: bonusNums.length,
      },
    };
  }

  const [n1, n2, n3, n4, n5, n6] = mainNums.slice(0, 6);
  const [bonus_ball] = bonusNums.slice(0, 1);

  return {
    ok: true,
    status: 200,
    url,
    payload: { draw_date, n1, n2, n3, n4, n5, n6, bonus_ball },
  };
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
   Requires: x-admin-key OR ?adminKey=
   ────────────────────────────────────────────── */
router.post('/draws/euromillions/upsert', requireAdmin, async (req, res) => {
  try {
    const result = await upsertEuroMillionsDraw(req.body ?? {});
    if (!result.ok)
      return res.status(result.status).json({ ok: false, error: result.error });

    res.json({ ok: true, mode: 'upsert', draw: result.draw });
  } catch (e) {
    console.error('POST /draws/euromillions/upsert failed:', e);
    res.status(500).json({ ok: false, error: 'upsert_failed' });
  }
});

/* ──────────────────────────────────────────────
   GET /api/draws/euromillions/debug?date=YYYY-MM-DD
   Requires: x-admin-key OR ?adminKey=
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

/* ──────────────────────────────────────────────
   POST /api/draws/euromillions/fetch-latest
   Admin-only.
   Pulls latest draw from EUROMILLIONS_FEED_URL (XML), then upserts it.
   ────────────────────────────────────────────── */
router.post(
  '/draws/euromillions/fetch-latest',
  requireAdmin,
  async (_req, res) => {
    try {
      const fetched = await fetchLatestEuroMillionsFromFeed();
      if (!fetched.ok) {
        return res.status(fetched.status).json({
          ok: false,
          error: fetched.error,
          ...(fetched.meta ? fetched.meta : {}),
        });
      }

      const { url, payload } = fetched;
      const { draw_date, n1, n2, n3, n4, n5, s1, s2 } = payload;

      // If we already have this draw and numbers match, skip write
      const existingRows = await db
        .select()
        .from(euromillions_draws)
        .where(eq(euromillions_draws.draw_date, draw_date))
        .limit(1);

      const existing = existingRows[0] ?? null;

      if (
        existing &&
        existing.n1 === n1 &&
        existing.n2 === n2 &&
        existing.n3 === n3 &&
        existing.n4 === n4 &&
        existing.n5 === n5 &&
        existing.s1 === s1 &&
        existing.s2 === s2
      ) {
        return res.json({
          ok: true,
          mode: 'no_change',
          source: url,
          draw: existing,
        });
      }

      const result = await upsertEuroMillionsDraw(payload);

      if (!result.ok) {
        return res
          .status(result.status)
          .json({ ok: false, error: result.error });
      }

      res.json({
        ok: true,
        mode: 'fetched_and_upserted',
        source: url,
        draw: result.draw,
      });
    } catch (e) {
      console.error('POST /draws/euromillions/fetch-latest failed:', e);
      res.status(500).json({ ok: false, error: 'fetch_latest_failed' });
    }
  },
);

router.post('/draws/uk-lotto/fetch-latest', requireAdmin, async (_req, res) => {
  try {
    const fetched = await fetchLatestUkLottoFromFeed();

    if (!fetched.ok) {
      return res.status(fetched.status).json({
        ok: false,
        error: fetched.error,
        ...(fetched.meta ? fetched.meta : {}),
      });
    }

    const { url, payload } = fetched;
    const { draw_date, n1, n2, n3, n4, n5, n6, bonus_ball } = payload;

    const existingRows = await db
      .select()
      .from(uk_lotto_draws)
      .where(eq(uk_lotto_draws.draw_date, draw_date))
      .limit(1);

    const existing = existingRows[0] ?? null;

    if (
      existing &&
      existing.n1 === n1 &&
      existing.n2 === n2 &&
      existing.n3 === n3 &&
      existing.n4 === n4 &&
      existing.n5 === n5 &&
      existing.n6 === n6 &&
      existing.bonus_ball === bonus_ball
    ) {
      return res.json({
        ok: true,
        lottery: 'uk_lotto',
        mode: 'no_change',
        source: url,
        draw: existing,
      });
    }

    const result = await upsertUkLottoDraw(payload);

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        error: result.error,
      });
    }

    return res.json({
      ok: true,
      lottery: 'uk_lotto',
      mode: 'fetched_and_upserted',
      source: url,
      draw: result.draw,
    });
  } catch (e) {
    console.error('POST /draws/uk-lotto/fetch-latest failed:', e);
    return res.status(500).json({ ok: false, error: 'fetch_latest_failed' });
  }
});

/* ──────────────────────────────────────────────
   POST /api/cron/euromillions/sync
   Admin-only. Intended for Railway Cron.
   ────────────────────────────────────────────── */
router.post('/cron/euromillions/sync', requireAdmin, async (_req, res) => {
  try {
    const fetched = await fetchLatestEuroMillionsFromFeed();
    if (!fetched.ok) {
      return res.status(fetched.status).json({
        ok: false,
        error: fetched.error,
        ...(fetched.meta ? fetched.meta : {}),
      });
    }

    const { url, payload } = fetched;
    const { draw_date, n1, n2, n3, n4, n5, s1, s2 } = payload;

    const existingRows = await db
      .select()
      .from(euromillions_draws)
      .where(eq(euromillions_draws.draw_date, draw_date))
      .limit(1);

    const existing = existingRows[0] ?? null;

    if (
      existing &&
      existing.n1 === n1 &&
      existing.n2 === n2 &&
      existing.n3 === n3 &&
      existing.n4 === n4 &&
      existing.n5 === n5 &&
      existing.s1 === s1 &&
      existing.s2 === s2
    ) {
      return res.json({
        ok: true,
        mode: 'no_change',
        source: url,
        draw: existing,
      });
    }

    const result = await upsertEuroMillionsDraw(payload);
    if (!result.ok) {
      return res.status(result.status).json({ ok: false, error: result.error });
    }

    return res.json({
      ok: true,
      mode: 'fetched_and_upserted',
      source: url,
      draw: result.draw,
    });
  } catch (e) {
    console.error('POST /cron/euromillions/sync failed:', e);
    res.status(500).json({ ok: false, error: 'cron_sync_failed' });
  }
});

/* ──────────────────────────────────────────────
   POST /api/cron/uk-lotto/sync
   Admin-only. Intended for Railway Cron.
   ────────────────────────────────────────────── */
router.post('/cron/uk-lotto/sync', requireAdmin, async (_req, res) => {
  try {
    return res.json({
      ok: true,
      lottery: 'uk_lotto',
      mode: 'not_implemented_yet',
      message:
        'UK Lotto cron route is wired, but live sync is not implemented yet.',
    });
  } catch (e) {
    console.error('POST /cron/uk-lotto/sync failed:', e);
    res.status(500).json({ ok: false, error: 'cron_sync_failed' });
  }
});

/* ──────────────────────────────────────────────
   POST /api/cron/set-for-life/sync
   Admin-only. Intended for Railway Cron.
   ────────────────────────────────────────────── */
router.post('/cron/set-for-life/sync', requireAdmin, async (_req, res) => {
  try {
    return res.json({
      ok: true,
      lottery: 'set_for_life',
      mode: 'not_implemented_yet',
      message:
        'Set For Life cron route is wired, but live sync is not implemented yet.',
    });
  } catch (e) {
    console.error('POST /cron/set-for-life/sync failed:', e);
    res.status(500).json({ ok: false, error: 'cron_sync_failed' });
  }
});

export default router;
