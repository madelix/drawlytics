// server/routes/predictions.js
import express from 'express';
import { getAuth } from '@clerk/express';
import { pool } from '../db.js';
import { checkPredictions } from '../services/checkPredictions.js';
import {
  getPredictionLotteryConfig,
  generatePredictionBatch,
} from '../services/predictionGenerator.js';
const router = express.Router();
import { runBenchmarkForDraw } from '../services/benchmarkRunner.js';

async function getCurrentDrawlyticsUser(req) {
  const auth = getAuth(req);

  if (!auth.userId) {
    return null;
  }

  const { rows } = await pool.query(
    `
    SELECT id, clerk_user_id, email
    FROM users
    WHERE clerk_user_id = $1
    LIMIT 1
    `,
    [auth.userId],
  );

  return rows[0] ?? null;
}

/**
 * TEMPORARY
 * POST /api/predictions/benchmark-dry-run
 *
 * Runs the canonical benchmark without saving predictions.
 * Restricted to Drawlytics user ID 1.
 */
router.post('/predictions/benchmark-dry-run', async (req, res) => {
  try {
    const currentUser = await getCurrentDrawlyticsUser(req);

    if (!currentUser) {
      return res.status(401).json({
        ok: false,
        error: 'unauthenticated',
      });
    }

    if (currentUser.id !== 1) {
      return res.status(403).json({
        ok: false,
        error: 'forbidden',
      });
    }

    const lottery = String(req.body?.lottery ?? 'euromillions');

    const drawDate = req.body?.draw_date ?? null;

    const result = await runBenchmarkForDraw({
      lottery,
      drawDate,
      dryRun: true,
    });

    return res.json(result);
  } catch (error) {
    console.error('Benchmark dry run failed:', error);

    return res.status(500).json({
      ok: false,
      error: 'benchmark_dry_run_failed',
      message: error.message,
    });
  }
});

/**
 * TEMPORARY
 * POST /api/predictions/benchmark-run
 *
 * Runs and saves the canonical benchmark.
 * Restricted to Drawlytics user ID 1.
 */
router.post('/predictions/benchmark-run', async (req, res) => {
  try {
    const currentUser = await getCurrentDrawlyticsUser(req);

    if (!currentUser) {
      return res.status(401).json({
        ok: false,
        error: 'unauthenticated',
      });
    }

    if (currentUser.id !== 1) {
      return res.status(403).json({
        ok: false,
        error: 'forbidden',
      });
    }

    const requestedLottery = String(req.body?.lottery ?? 'all')
      .trim()
      .toLowerCase();

    const drawDate = req.body?.draw_date ?? null;

    const lotteries =
      requestedLottery === 'all'
        ? ['euromillions', 'uk_lotto', 'set_for_life']
        : [requestedLottery];

    const results = [];

    for (const lottery of lotteries) {
      const result = await runBenchmarkForDraw({
        lottery,
        drawDate,
        dryRun: false,
      });

      results.push(result);
    }

    return res.json({
      ok: results.every((result) => result.ok === true),
      results,
    });
  } catch (error) {
    console.error('Benchmark run failed:', error);

    return res.status(500).json({
      ok: false,
      error: 'benchmark_run_failed',
      message: error.message,
    });
  }
});

/**
 * TEMPORARY
 * POST /api/predictions/benchmark-check
 *
 * Checks canonical benchmark predictions
 * against available official draw results.
 * Restricted to Drawlytics user ID 1.
 */
router.post('/predictions/benchmark-check', async (req, res) => {
  try {
    const currentUser = await getCurrentDrawlyticsUser(req);

    if (!currentUser) {
      return res.status(401).json({
        ok: false,
        error: 'unauthenticated',
      });
    }

    if (currentUser.id !== 1) {
      return res.status(403).json({
        ok: false,
        error: 'forbidden',
      });
    }

    const result = await checkPredictions({
      lottery: req.body?.lottery ?? null,
      limit: req.body?.limit ?? 500,
      onlyUnchecked: req.body?.onlyUnchecked !== false,
      scope: 'benchmark',
    });

    return res.json(result);
  } catch (error) {
    console.error('Benchmark prediction check failed:', error);

    return res.status(500).json({
      ok: false,
      error: 'benchmark_check_failed',
      message: error.message,
    });
  }
});

/**
 * Resolve EuroMillions draw date:
 * - If client provides draw_date: validate and use it (date-only UTC midnight)
 * - If not provided:
 *    1) try euromillions_draws for a future draw_date (only works if table has future rows)
 *    2) fallback: compute next Tue/Fri
 *       - if today is Tue/Fri AND it's <= 19:20 Europe/London, use TODAY
 *       - otherwise use the next Tue/Fri
 */

/**
 * GET /api/predictions
 */
router.get('/predictions', async (req, res) => {
  try {
    const currentUser = await getCurrentDrawlyticsUser(req);

    if (!currentUser) {
      return res.status(401).json({
        ok: false,
        error: 'unauthenticated',
      });
    }

    const userId = currentUser.id;
    const limitRaw = Number(req.query.limit ?? 20);
    const offsetRaw = Number(req.query.offset ?? 0);

    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(100, Math.floor(limitRaw)))
      : 20;

    const offset = Number.isFinite(offsetRaw)
      ? Math.max(0, Math.floor(offsetRaw))
      : 0;

    const lotteryRaw = req.query.lottery
      ? String(req.query.lottery).trim()
      : null;

    const lotteryFilter =
      lotteryRaw && lotteryRaw !== 'all'
        ? getPredictionLotteryConfig(lotteryRaw).key
        : null;

    const dateRows = await pool.query(
      `
  SELECT DISTINCT draw_date
  FROM predictions
  WHERE user_id = $4
    AND (
      $3::text IS NULL
      OR lower(replace(lottery, ' ', '_')) = $3::text
    )
  ORDER BY draw_date DESC
  LIMIT $1
  OFFSET $2
  `,
      [limit, offset, lotteryFilter, userId],
    );

    const drawDates = dateRows.rows.map((row) => row.draw_date);

    const { rows } =
      drawDates.length === 0
        ? { rows: [] }
        : await pool.query(
            `
        SELECT
          id,
          lottery,
          draw_date,
          model_name,
          main_numbers,
          star_numbers,
          confidence,
          status,
          created_at,
          matched_main,
          matched_stars,
          result_label,
          source,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'draw_date', pdr.draw_date,
                  'draw_sequence', pdr.draw_sequence,
                  'matched_main', pdr.matched_main,
                  'matched_special', pdr.matched_special
                )
                ORDER BY pdr.draw_date, pdr.draw_sequence
              )
              FROM prediction_draw_results pdr
              WHERE pdr.prediction_id = predictions.id
            ),
            '[]'::json
          ) AS draw_results
        FROM predictions
        WHERE user_id = $3
          AND draw_date = ANY($1::date[])
          AND (
            $2::text IS NULL
            OR lower(replace(lottery, ' ', '_')) = $2::text
          )
        ORDER BY draw_date DESC, created_at DESC
        `,
            [drawDates, lotteryFilter, userId],
          );

    const countResult = await pool.query(
      `
  SELECT COUNT(DISTINCT draw_date)::int AS total
  FROM predictions
  WHERE user_id = $2
    AND (
      $1::text IS NULL
      OR lower(replace(lottery, ' ', '_')) = $1::text
    )
  `,
      [lotteryFilter, userId],
    );

    const total = countResult.rows?.[0]?.total ?? 0;

    return res.json({
      ok: true,
      predictions: rows,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (err) {
    console.error('GET /predictions failed:', err);
    res.status(500).json({ ok: false, error: 'predictions_failed' });
  }
});

/**
 * GET /api/predictions/usage
 * Returns usage for current user (temporary: user_id = 1).
 */
router.get('/predictions/usage', async (req, res) => {
  try {
    const currentUser = await getCurrentDrawlyticsUser(req);

    if (!currentUser) {
      return res.status(401).json({
        ok: false,
        error: 'unauthenticated',
      });
    }

    const userId = currentUser.id;

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS used FROM predictions WHERE user_id = $1`,
      [userId],
    );

    return res.json({
      ok: true,
      used: rows?.[0]?.used ?? 0,
      limit: null,
      limits_disabled: true,
    });
  } catch (err) {
    console.error('GET /predictions/usage failed:', err);
    return res.status(500).json({ ok: false, error: 'usage_failed' });
  }
});

/**
 * POST /api/predictions/generate
 * If draw_date is not provided, save for:
 * - today's draw if Tue/Fri and <= 19:20 UK time
 * - otherwise the next Tue/Fri draw
 */
router.post('/predictions/generate', async (req, res) => {
  try {
    const currentUser = await getCurrentDrawlyticsUser(req);

    if (!currentUser) {
      return res.status(401).json({
        ok: false,
        error: 'unauthenticated',
      });
    }

    const userId = currentUser.id;
    const lotteryRaw = String(req.body?.lottery ?? '').trim();
    const strategy = String(req.body?.strategy ?? 'pure_random').trim();
    const source = String(req.body?.source ?? 'manual').trim();
    const linesRaw = Number(req.body?.lines ?? 1);
    const drawDateRaw = req.body?.draw_date ? String(req.body.draw_date) : null;

    const lottery = lotteryRaw.toLowerCase();

    const supportedLotteries = [
      'euromillions',
      'euro millions',
      'euro-millions',
      'uk_lotto',
      'uk lotto',
      'uk-lotto',
      'set_for_life',
      'set for life',
      'set-for-life',
    ];

    if (!supportedLotteries.includes(lottery)) {
      return res.status(400).json({
        ok: false,
        error: 'unsupported_lottery',
      });
    }

    const canonicalLottery = getPredictionLotteryConfig(lotteryRaw).key;

    const lotteryConfig = getPredictionLotteryConfig(canonicalLottery);

    const lines = Number.isFinite(linesRaw) ? Math.floor(linesRaw) : 1;
    if (lines < 1 || lines > 5) {
      return res.status(400).json({ ok: false, error: 'invalid_lines' });
    }

    const generatedBatch = await generatePredictionBatch({
      lotteryRaw,
      strategy,
      lines,
      drawDateRaw,
    });

    if (!generatedBatch.ok) {
      return res.status(400).json({
        ok: false,
        error: generatedBatch.error,
      });
    }

    const draw_date = generatedBatch.draw_date;
    const generatedLines = generatedBatch.predictions;

    const saved = [];

    for (let i = 0; i < lines; i++) {
      const line = generatedLines[i];
      const { confidence, model_name } = line;

      const { rows } = await pool.query(
        `
        INSERT INTO predictions (
  lottery,
  draw_date,
  model_name,
  main_numbers,
  star_numbers,
  confidence,
  created_at,
  matched_main,
  matched_stars,
  result_label,
  status,
user_id,
source,
benchmark_eligible
)
VALUES (
  $1,
  $2,
  $3,
  $4::smallint[],
  $5::smallint[],
  $6,
  NOW(),
  NULL,
  NULL,
  NULL,
  'pending',
  $7,
  $8,
  false
)
        RETURNING
  id,
  lottery,
  draw_date,
  model_name,
  main_numbers,
  star_numbers,
  confidence,
  status,
  created_at,
  matched_main,
  matched_stars,
  result_label,
  source
        `,
        [
          lotteryConfig.key,
          draw_date,
          model_name,
          line.main,
          line.stars,
          confidence,
          userId,
          source,
        ],
      );

      saved.push(rows[0]);
    }

    return res.json({
      ok: true,
      created: saved.length,
      draw_date_used: draw_date,
      predictions: saved,
    });
  } catch (err) {
    console.error('POST /predictions/generate failed:', err);
    res.status(500).json({
      ok: false,
      error: 'generate_failed',
      message: err?.message,
    });
  }
});

/**
 * GET /api/predictions/debug-draws?date=YYYY-MM-DD
 */
router.get('/predictions/debug-draws', async (req, res) => {
  try {
    const date = req.query.date ? String(req.query.date) : null;

    const c = await pool.query(
      `SELECT COUNT(*)::int AS draws_count, MAX(draw_date) AS latest_draw FROM euromillions_draws`,
    );

    let rowForDate = null;
    let nearest = null;

    if (date) {
      const r = await pool.query(
        `
        SELECT draw_date, n1,n2,n3,n4,n5, s1,s2
        FROM euromillions_draws
        WHERE draw_date = $1::date
        LIMIT 1
        `,
        [date],
      );
      rowForDate = r.rows?.[0] ?? null;

      const prev = await pool.query(
        `
        SELECT draw_date
        FROM euromillions_draws
        WHERE draw_date < $1::date
        ORDER BY draw_date DESC
        LIMIT 1
        `,
        [date],
      );
      const next = await pool.query(
        `
        SELECT draw_date
        FROM euromillions_draws
        WHERE draw_date > $1::date
        ORDER BY draw_date ASC
        LIMIT 1
        `,
        [date],
      );

      nearest = {
        prev: prev.rows?.[0]?.draw_date ?? null,
        next: next.rows?.[0]?.draw_date ?? null,
      };
    }

    return res.json({
      ok: true,
      draws_count: c.rows?.[0]?.draws_count ?? null,
      latest_draw: c.rows?.[0]?.latest_draw ?? null,
      requested_date: date,
      row_for_date: rowForDate,
      nearest,
    });
  } catch (err) {
    console.error('debug-draws error:', err);
    return res.status(500).json({ ok: false, error: 'debug_failed' });
  }
});

/**
 * POST /api/predictions/check
 * (unchanged)
 */
router.post('/predictions/check', async (req, res) => {
  try {
    const currentUser = await getCurrentDrawlyticsUser(req);

    if (!currentUser) {
      return res.status(401).json({
        ok: false,
        error: 'unauthenticated',
      });
    }

    const result = await checkPredictions({
      userId: currentUser.id,
      lottery: req.body?.lottery ?? null,
      limit: req.body?.limit ?? 200,
      onlyUnchecked: req.body?.onlyUnchecked !== false,
    });

    return res.json(result);

    const debug = String(req.query.debug ?? '') === '1';

    const limitRaw = Number(req.body?.limit ?? 200);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(500, Math.floor(limitRaw)))
      : 200;

    const onlyUnchecked = req.body?.onlyUnchecked !== false;

    const lotteryRaw = req.body?.lottery ? String(req.body.lottery) : null;
    const lotteryFilter = lotteryRaw
      ? getPredictionLotteryConfig(lotteryRaw).key
      : null;

    const { rows: preds } = await pool.query(
      `
      SELECT
        id,
        lottery,
        draw_date,
        main_numbers,
        star_numbers,
        matched_main,
        matched_stars,
        result_label,
        status
      FROM predictions
WHERE lower(replace(lottery, ' ', '_')) IN ('euromillions', 'uk_lotto', 'set_for_life')
  AND (
    $3::text IS NULL
    OR lower(replace(lottery, ' ', '_')) = $3::text
  )
  AND (
          $2::boolean = false
          OR matched_main IS NULL
          OR matched_stars IS NULL
          OR result_label IS NULL
          OR result_label = ''
          OR result_label LIKE 'no_draw%'
          OR status IS NULL
          OR status = 'pending'
        )
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit, onlyUnchecked, lotteryFilter],
    );

    let predictionsToCheck = preds;

    if (!predictionsToCheck.length) {
      return res.json({ ok: true, checked: 0, updated: 0, skipped: 0 });
    }

    const toNums = (arr) =>
      Array.isArray(arr)
        ? arr.map((n) => Number(n)).filter(Number.isFinite)
        : [];

    const countMatches = (a, b) => {
      const setB = new Set(b);
      let c = 0;
      for (const x of a) if (setB.has(x)) c++;
      return c;
    };

    const toYYYYMMDD = (d) => {
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return null;
      return dt.toISOString().slice(0, 10);
    };

    const addDays = (yyyyMmDd, plusDays) => {
      const dt = new Date(`${yyyyMmDd}T00:00:00.000Z`);
      dt.setUTCDate(dt.getUTCDate() + plusDays);
      return dt.toISOString().slice(0, 10);
    };

    const dateSet = new Set();
    const predMeta = [];
    for (const p of predictionsToCheck) {
      const day = toYYYYMMDD(p.draw_date);
      if (day) dateSet.add(day);
      predMeta.push({
        id: p.id,
        draw_date: p.draw_date,
        day,
        lottery: p.lottery,
      });
    }
    const days = Array.from(dateSet);

    const expandedDays = new Set(days);
    for (const d of days) {
      expandedDays.add(addDays(d, 1));
      expandedDays.add(addDays(d, 2));
      expandedDays.add(addDays(d, 3));
    }
    const daysQuery = Array.from(expandedDays);

    const drawsByDay = new Map();
    const drawsByLotteryAndDay = new Map();

    const put = (lottery, day, main, stars) => {
      if (!day) return;

      const key = `${lottery}:${day}`;
      drawsByLotteryAndDay.set(key, { main, stars });
    };

    try {
      const euromillionsRows = await pool.query(
        `
  SELECT draw_date, n1,n2,n3,n4,n5, s1,s2
  FROM euromillions_draws
  WHERE draw_date::date = ANY($1::date[])
  `,
        [daysQuery],
      );

      for (const r of euromillionsRows.rows) {
        const day = toYYYYMMDD(r.draw_date);

        const main = [r.n1, r.n2, r.n3, r.n4, r.n5]
          .map(Number)
          .filter(Number.isFinite);

        const stars = [r.s1, r.s2].map(Number).filter(Number.isFinite);

        put('euromillions', day, main, stars);
      }

      const ukLottoRows = await pool.query(
        `
  SELECT draw_date, n1,n2,n3,n4,n5,n6, bonus_ball
  FROM uk_lotto_draws
  WHERE draw_date::date = ANY($1::date[])
  `,
        [daysQuery],
      );

      for (const r of ukLottoRows.rows) {
        const day = toYYYYMMDD(r.draw_date);

        const main = [r.n1, r.n2, r.n3, r.n4, r.n5, r.n6]
          .map(Number)
          .filter(Number.isFinite);

        const stars = [r.bonus_ball].map(Number).filter(Number.isFinite);

        put('uk_lotto', day, main, stars);
      }

      const setForLifeRows = await pool.query(
        `
  SELECT draw_date, n1,n2,n3,n4,n5, life_ball
  FROM set_for_life_draws
  WHERE draw_date::date = ANY($1::date[])
  `,
        [daysQuery],
      );

      for (const r of setForLifeRows.rows) {
        const day = toYYYYMMDD(r.draw_date);

        const main = [r.n1, r.n2, r.n3, r.n4, r.n5]
          .map(Number)
          .filter(Number.isFinite);

        const stars = [r.life_ball].map(Number).filter(Number.isFinite);

        put('set_for_life', day, main, stars);
      }
    } catch (e) {
      console.error('Draw fetch failed (n1..s2).', e);
      return res.status(500).json({ ok: false, error: 'draw_fetch_failed' });
    }

    let checked = 0;
    let updated = 0;
    let skipped = 0;

    const shifted = [];
    const findDrawDay = (lottery, day) => {
      if (drawsByLotteryAndDay.has(`${lottery}:${day}`)) return day;

      for (let i = 1; i <= 3; i++) {
        const d2 = addDays(day, i);
        if (drawsByLotteryAndDay.has(`${lottery}:${d2}`)) return d2;
      }

      return null;
    };

    for (const p of predictionsToCheck) {
      checked++;

      const pMain = toNums(p.main_numbers);
      const pStars = toNums(p.star_numbers);

      const predictionConfig = getPredictionLotteryConfig(p.lottery);

      if (
        pMain.length !== predictionConfig.mainCount ||
        pStars.length !== predictionConfig.specialCount
      ) {
        skipped++;
        continue;
      }

      const day = toYYYYMMDD(p.draw_date);
      if (!day) {
        await pool.query(
          `
          UPDATE predictions
          SET matched_main = NULL,
              matched_stars = NULL,
              result_label = 'invalid_prediction_draw_date',
              status = 'checked'
          WHERE id = $1
          `,
          [p.id],
        );
        updated++;
        continue;
      }

      const predictionLottery = getPredictionLotteryConfig(p.lottery).key;
      const drawDay = findDrawDay(predictionLottery, day);
      if (!drawDay) {
        await pool.query(
          `
          UPDATE predictions
SET matched_main = NULL,
    matched_stars = NULL,
    result_label = 'no_draw_for_date',
    status = 'pending'
WHERE id = $1
          `,
          [p.id],
        );
        updated++;
        continue;
      }

      if (drawDay !== day) shifted.push([day, drawDay]);

      const draw = drawsByLotteryAndDay.get(`${predictionLottery}:${drawDay}`);
      const mMain = countMatches(pMain, draw.main);
      const mStars = countMatches(pStars, draw.stars);
      const label =
        drawDay !== day
          ? `${mMain}+${mStars} (draw:${drawDay})`
          : `${mMain}+${mStars}`;

      await pool.query(
        `
        UPDATE predictions
        SET matched_main = $2,
            matched_stars = $3,
            result_label = $4,
            status = 'checked'
        WHERE id = $1
        `,
        [p.id, mMain, mStars, label],
      );

      updated++;
    }

    const payload = { ok: true, checked, updated, skipped };

    if (debug) {
      return res.json({
        ...payload,
        debug: {
          shiftedCount: shifted.length,
          samplePredictions: predMeta.slice(0, 10),
          sampleShifted: shifted.slice(0, 10),
        },
      });
    }

    return res.json(payload);
  } catch (err) {
    console.error('POST /predictions/check failed:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'check_failed', message: err?.message });
  }
});

/**
 * DELETE /api/predictions/:id
 */
router.delete('/predictions/:id', async (req, res) => {
  try {
    const currentUser = await getCurrentDrawlyticsUser(req);

    if (!currentUser) {
      return res.status(401).json({
        ok: false,
        error: 'unauthenticated',
      });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'invalid_id',
      });
    }

    const result = await pool.query(
      `
      DELETE FROM predictions
      WHERE id = $1
        AND user_id = $2
      RETURNING id
      `,
      [id, currentUser.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        error: 'prediction_not_found',
      });
    }

    return res.status(204).send();
  } catch (err) {
    console.error('DELETE /predictions/:id failed:', err);

    return res.status(500).json({
      ok: false,
      error: 'delete_failed',
    });
  }
});

export default router;
