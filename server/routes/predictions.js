// server/routes/predictions.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

/**
 * TEMP: GET /api/predictions/debug-schema
 * Returns columns for predictions table.
 */
router.get('/predictions/debug-schema', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'predictions'
      ORDER BY ordinal_position;
      `,
    );
    return res.json({ ok: true, columns: rows });
  } catch (err) {
    console.error('debug-schema error:', err);
    return res.status(500).json({ ok: false, error: 'debug_schema_failed' });
  }
});

/**
 * TEMP: POST /api/predictions/debug-migrate-user
 * Adds user_id to predictions and backfills existing rows.
 */
router.post('/predictions/debug-migrate-user', async (_req, res) => {
  try {
    await pool.query(
      `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS user_id integer;`,
    );
    await pool.query(
      `UPDATE predictions SET user_id = 1 WHERE user_id IS NULL;`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id);`,
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('debug-migrate-user error:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'debug_migrate_user_failed' });
  }
});

/**
 * TEMP: POST /api/predictions/debug-migrate-source
 * Adds source to predictions so strategy-mix lines can be labelled.
 */
router.post('/predictions/debug-migrate-source', async (_req, res) => {
  try {
    await pool.query(
      `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS source text;`,
    );

    await pool.query(
      `UPDATE predictions SET source = 'manual' WHERE source IS NULL;`,
    );

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_predictions_source ON predictions(source);`,
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('debug-migrate-source error:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'debug_migrate_source_failed' });
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
async function resolveEuroMillionsDrawDate(drawDateRaw) {
  // 1) Client provided draw date -> validate and use it
  if (drawDateRaw) {
    const parsed = new Date(String(drawDateRaw));
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: 'invalid_draw_date' };
    }

    // Normalize to date-only (UTC midnight) to avoid timezone drift
    const yyyyMmDd = parsed.toISOString().slice(0, 10);
    const dt = new Date(`${yyyyMmDd}T00:00:00.000Z`);
    return { ok: true, draw_date: dt };
  }

  // 2) Try next draw from draws table (only works if table includes future dates)
  try {
    const next = await pool.query(
      `
      SELECT draw_date
      FROM euromillions_draws
      WHERE draw_date >= CURRENT_DATE
      ORDER BY draw_date ASC
      LIMIT 1
      `,
    );

    if (next.rows?.length) {
      return { ok: true, draw_date: next.rows[0].draw_date };
    }
  } catch (e) {
    // If the table doesn't exist or query fails, we still have the fallback below.
    console.error('resolveEuroMillionsDrawDate: draw table lookup failed:', e);
  }

  // 3) Fallback: compute next Tuesday/Friday (EuroMillions draws)
  // Use UTC for date math, but apply cutoff time using Europe/London.
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const day = todayUtc.getUTCDay(); // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  const isDrawDay = day === 2 || day === 5; // Tue/Fri

  // Cutoff: 19:20 Europe/London on draw days
  const cutoffHour = 19;
  const cutoffMinute = 20;

  const londonParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);

  const hStr = londonParts.find((p) => p.type === 'hour')?.value ?? '00';
  const mStr = londonParts.find((p) => p.type === 'minute')?.value ?? '00';
  const londonHour = Number(hStr);
  const londonMinute = Number(mStr);

  const beforeCutoff =
    londonHour < cutoffHour ||
    (londonHour === cutoffHour && londonMinute <= cutoffMinute);

  // If today is a draw day and it's before cutoff, use TODAY (date-only)
  if (isDrawDay && beforeCutoff) {
    return { ok: true, draw_date: todayUtc };
  }

  // Otherwise, compute the next draw day after today
  const daysUntil = (target) => {
    const diff = (target - day + 7) % 7;
    return diff === 0 ? 7 : diff;
  };

  const toTue = daysUntil(2);
  const toFri = daysUntil(5);
  const add = Math.min(toTue, toFri);

  const nextDraw = new Date(todayUtc);
  nextDraw.setUTCDate(nextDraw.getUTCDate() + add);

  return { ok: true, draw_date: nextDraw };
}

/**
 * GET /api/predictions
 */
router.get('/predictions', async (_req, res) => {
  try {
    const { rows } = await pool.query(
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
  source
      FROM predictions
WHERE user_id = 1
ORDER BY created_at DESC
LIMIT 500
      `,
    );

    res.json({ ok: true, predictions: rows });
  } catch (err) {
    console.error('GET /predictions failed:', err);
    res.status(500).json({ ok: false, error: 'predictions_failed' });
  }
});

/**
 * GET /api/predictions/usage
 * Returns usage for current user (temporary: user_id = 1).
 */
router.get('/predictions/usage', async (_req, res) => {
  try {
    const LIMIT_FREE = 50;
    const disableLimits =
      String(process.env.DISABLE_LIMITS ?? '').trim() === '1';

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS used FROM predictions WHERE user_id = 1`,
    );

    return res.json({
      ok: true,
      used: rows?.[0]?.used ?? 0,
      limit: disableLimits ? null : LIMIT_FREE,
      limits_disabled: disableLimits,
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
    const lotteryRaw = String(req.body?.lottery ?? '').trim();
    const strategy = String(req.body?.strategy ?? 'pure_random').trim();
    const source = String(req.body?.source ?? 'manual').trim();
    const linesRaw = Number(req.body?.lines ?? 1);
    const drawDateRaw = req.body?.draw_date ? String(req.body.draw_date) : null;

    const lottery = lotteryRaw.toLowerCase();
    const isEuroMillions =
      lottery === 'euromillions' ||
      lottery === 'euro millions' ||
      lottery === 'euro-millions' ||
      lotteryRaw === 'EuroMillions' ||
      lotteryRaw === 'Euromillions';

    if (!isEuroMillions) {
      return res.status(400).json({ ok: false, error: 'unsupported_lottery' });
    }

    const lines = Number.isFinite(linesRaw) ? Math.floor(linesRaw) : 1;
    if (lines < 1 || lines > 5) {
      return res.status(400).json({ ok: false, error: 'invalid_lines' });
    }

    const resolved = await resolveEuroMillionsDrawDate(drawDateRaw);
    if (!resolved.ok) {
      return res.status(400).json({ ok: false, error: resolved.error });
    }
    const draw_date = resolved.draw_date;
    const { rows: historyRows } = await pool.query(
      `
  SELECT n1, n2, n3, n4, n5, s1, s2
  FROM euromillions_draws
  ORDER BY draw_date DESC
  LIMIT 200
  `,
    );

    const randInt = (min, max) =>
      Math.floor(Math.random() * (max - min + 1)) + min;

    const sampleUnique = (min, max, count) => {
      const set = new Set();
      while (set.size < count) set.add(randInt(min, max));
      return Array.from(set).sort((a, b) => a - b);
    };

    const weightedSampleUnique = (weights, count) => {
      const picked = new Set();

      while (picked.size < count) {
        const available = weights.filter((item) => !picked.has(item.n));
        const totalWeight = available.reduce(
          (sum, item) => sum + item.weight,
          0,
        );

        let roll = Math.random() * totalWeight;

        for (const item of available) {
          roll -= item.weight;
          if (roll <= 0) {
            picked.add(item.n);
            break;
          }
        }
      }

      return Array.from(picked).sort((a, b) => a - b);
    };

    const buildLinearWeights = (min, max, direction = 'ascending') => {
      const weights = [];

      for (let n = min; n <= max; n++) {
        const base = direction === 'descending' ? max - n + 1 : n - min + 1;

        weights.push({ n, weight: base });
      }

      return weights;
    };

    const buildFrequencyWeights = (min, max, rows, keys) => {
      const counts = new Map();

      for (let n = min; n <= max; n++) {
        counts.set(n, 1); // small baseline so every number remains possible
      }

      for (const row of rows) {
        for (const key of keys) {
          const n = Number(row[key]);
          if (Number.isFinite(n)) {
            counts.set(n, (counts.get(n) ?? 1) + 1);
          }
        }
      }

      return Array.from(counts.entries()).map(([n, weight]) => ({
        n,
        weight,
      }));
    };

    const generateOneLine = () => {
      if (strategy === 'ai:xgboost') {
        return {
          main: weightedSampleUnique(
            buildFrequencyWeights(1, 50, historyRows, [
              'n1',
              'n2',
              'n3',
              'n4',
              'n5',
            ]),
            5,
          ),
          stars: weightedSampleUnique(
            buildFrequencyWeights(1, 12, historyRows, ['s1', 's2']),
            2,
          ),
        };
      }

      return {
        main: sampleUnique(1, 50, 5),
        stars: sampleUnique(1, 12, 2),
      };
    };

    const saved = [];
    // Free plan limit (temporary)
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM predictions WHERE user_id = 1`,
    );

    const currentCount = countRows[0]?.count ?? 0;
    const LIMIT_FREE = 50;

    // Owner/dev override (set DISABLE_LIMITS=1)
    const disableLimits =
      String(process.env.DISABLE_LIMITS ?? '').trim() === '1';

    if (!disableLimits && currentCount + lines > LIMIT_FREE) {
      return res.status(403).json({
        ok: false,
        error: 'prediction_limit_reached',
        message: `Free plan allows up to ${LIMIT_FREE} saved predictions.`,
      });
    }

    for (let i = 0; i < lines; i++) {
      const line = generateOneLine();
      const model_name = strategy.startsWith('ai:')
        ? strategy
        : `make_magic:${strategy}`;

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
source
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
1,
$7
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
          result_label
        `,
        [
          'EuroMillions',
          draw_date,
          model_name,
          line.main,
          line.stars,
          0,
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
    const debug = String(req.query.debug ?? '') === '1';

    const limitRaw = Number(req.body?.limit ?? 200);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(500, Math.floor(limitRaw)))
      : 200;

    const onlyUnchecked = req.body?.onlyUnchecked !== false;

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
      WHERE (lottery = 'EuroMillions' OR lottery = 'Euromillions')
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
      [limit, onlyUnchecked],
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

    const put = (day, main, stars) => {
      if (main.length === 5 && stars.length === 2) {
        drawsByDay.set(day, { main, stars });
      }
    };

    try {
      const { rows: drawRows } = await pool.query(
        `
        SELECT draw_date, n1,n2,n3,n4,n5, s1,s2
        FROM euromillions_draws
        WHERE draw_date::date = ANY($1::date[])
        `,
        [daysQuery],
      );

      for (const r of drawRows) {
        const day = toYYYYMMDD(r.draw_date);
        const main = [r.n1, r.n2, r.n3, r.n4, r.n5]
          .map(Number)
          .filter(Number.isFinite);
        const stars = [r.s1, r.s2].map(Number).filter(Number.isFinite);
        if (day) put(day, main, stars);
      }
    } catch (e) {
      console.error('Draw fetch failed (n1..s2).', e);
      return res.status(500).json({ ok: false, error: 'draw_fetch_failed' });
    }

    let checked = 0;
    let updated = 0;
    let skipped = 0;

    const shifted = [];
    const findDrawDay = (day) => {
      if (drawsByDay.has(day)) return day;
      for (let i = 1; i <= 3; i++) {
        const d2 = addDays(day, i);
        if (drawsByDay.has(d2)) return d2;
      }
      return null;
    };

    for (const p of predictionsToCheck) {
      checked++;

      const pMain = toNums(p.main_numbers);
      const pStars = toNums(p.star_numbers);

      if (pMain.length !== 5 || pStars.length !== 2) {
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

      const drawDay = findDrawDay(day);
      if (!drawDay) {
        await pool.query(
          `
          UPDATE predictions
          SET matched_main = NULL,
              matched_stars = NULL,
              result_label = 'no_draw_for_date',
              status = 'checked'
          WHERE id = $1
          `,
          [p.id],
        );
        updated++;
        continue;
      }

      if (drawDay !== day) shifted.push([day, drawDay]);

      const draw = drawsByDay.get(drawDay);
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
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'invalid_id' });
    }

    await pool.query(`DELETE FROM predictions WHERE id = $1`, [id]);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /predictions/:id failed:', err);
    res.status(500).json({ ok: false, error: 'delete_failed' });
  }
});

export default router;
