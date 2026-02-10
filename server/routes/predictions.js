// server/routes/predictions.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

/* --------------------------
   Helpers
-------------------------- */
const toNums = (arr) =>
  Array.isArray(arr) ? arr.map((n) => Number(n)).filter(Number.isFinite) : [];

const countMatches = (a, b) => {
  const setB = new Set(b);
  let c = 0;
  for (const x of a) if (setB.has(x)) c++;
  return c;
};

// YYYY-MM-DD in UTC
const toYYYYMMDD = (d) => {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
};

// Case-insensitive “EuroMillions” (covers EuroMillions / Euromillions / EUROMILLIONS)
const EURO_WHERE = `LOWER(lottery) = 'euromillions'`;

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
        result_label
      FROM predictions
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
 * GET /api/predictions/debug-draws
 * Optional: ?date=YYYY-MM-DD
 *
 * Lets you verify draw coverage without Railway SQL.
 */
router.get('/predictions/debug-draws', async (req, res) => {
  try {
    const requested = req.query.date ? String(req.query.date) : null;

    const { rows: countRows } = await pool.query(
      `
      SELECT COUNT(*)::int AS draws_count,
             MAX(draw_date) AS latest_draw
      FROM euromillions_draws
      `,
    );

    let rowForDate = null;

    if (requested) {
      // Try n1..s2 schema
      try {
        const { rows } = await pool.query(
          `
          SELECT draw_date, n1,n2,n3,n4,n5, s1,s2
          FROM euromillions_draws
          WHERE draw_date::date = $1::date
          LIMIT 1
          `,
          [requested],
        );
        if (rows.length) rowForDate = rows[0];
      } catch (_e) {
        // Try arrays schema
        const { rows } = await pool.query(
          `
          SELECT draw_date, main_numbers, star_numbers
          FROM euromillions_draws
          WHERE draw_date::date = $1::date
          LIMIT 1
          `,
          [requested],
        );
        if (rows.length) rowForDate = rows[0];
      }
    }

    res.json({
      ok: true,
      draws_count: countRows?.[0]?.draws_count ?? null,
      latest_draw: countRows?.[0]?.latest_draw ?? null,
      requested_date: requested,
      row_for_date: rowForDate,
    });
  } catch (err) {
    console.error('GET /predictions/debug-draws failed:', err);
    res.status(500).json({ ok: false, error: 'debug_draws_failed' });
  }
});

/**
 * POST /api/predictions/generate
 */
router.post('/predictions/generate', async (req, res) => {
  try {
    const lotteryRaw = String(req.body?.lottery ?? '').trim();
    const strategy = String(req.body?.strategy ?? 'pure_random').trim();
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

    const parsedDrawDate = drawDateRaw ? new Date(drawDateRaw) : null;
    if (drawDateRaw && Number.isNaN(parsedDrawDate.getTime())) {
      return res.status(400).json({ ok: false, error: 'invalid_draw_date' });
    }
    const draw_date = parsedDrawDate ?? new Date();

    const randInt = (min, max) =>
      Math.floor(Math.random() * (max - min + 1)) + min;

    const sampleUnique = (min, max, count) => {
      const set = new Set();
      while (set.size < count) set.add(randInt(min, max));
      return Array.from(set).sort((a, b) => a - b);
    };

    const generateOneLine = () => ({
      main: sampleUnique(1, 50, 5),
      stars: sampleUnique(1, 12, 2),
    });

    const saved = [];
    for (let i = 0; i < lines; i++) {
      const line = generateOneLine();
      const model_name = `make_magic:${strategy}`;

      // local schema: smallint[] and confidence NOT NULL
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
          result_label
        )
        VALUES ($1, $2, $3, $4::smallint[], $5::smallint[], $6, NOW(), NULL, NULL, NULL)
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
        ['EuroMillions', draw_date, model_name, line.main, line.stars, 0],
      );

      saved.push(rows[0]);
    }

    return res.json({ ok: true, created: saved.length, predictions: saved });
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
 * POST /api/predictions/check
 *
 * Fixes:
 * ✅ includes old rows where lottery is "Euromillions"
 * ✅ avoids timezone issues by normalizing to YYYY-MM-DD (UTC)
 * ✅ bulk fetches draws for those dates
 *
 * Query params:
 *  ?debug=1 -> returns debug payload
 *
 * Body:
 *  { limit?: number, onlyUnchecked?: boolean }
 */
router.post('/predictions/check', async (req, res) => {
  try {
    const debug = String(req.query.debug ?? '') === '1';

    const limitRaw = Number(req.body?.limit ?? 200);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(500, Math.floor(limitRaw)))
      : 200;

    // default true
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
        result_label
      FROM predictions
      WHERE ${EURO_WHERE}
        AND (
          $2::boolean = false
          OR matched_main IS NULL
          OR matched_stars IS NULL
          OR result_label IS NULL
          OR result_label = ''
          OR result_label LIKE 'no_draw%'
        )
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit, onlyUnchecked],
    );

    let predictionsToCheck = preds;

    if (predictionsToCheck.length === 0 && onlyUnchecked) {
      const fallback = await pool.query(
        `
        SELECT
          id,
          lottery,
          draw_date,
          main_numbers,
          star_numbers,
          matched_main,
          matched_stars,
          result_label
        FROM predictions
        WHERE ${EURO_WHERE}
        ORDER BY created_at DESC
        LIMIT $1
        `,
        [limit],
      );
      predictionsToCheck = fallback.rows ?? [];
    }

    if (!predictionsToCheck.length) {
      return res.json({ ok: true, checked: 0, updated: 0, skipped: 0 });
    }

    // Build unique date list
    const dateSet = new Set();
    const predMeta = []; // debug
    for (const p of predictionsToCheck) {
      const day = toYYYYMMDD(p.draw_date);
      if (day) dateSet.add(day);
      predMeta.push({ id: p.id, draw_date: p.draw_date, day });
    }
    const days = Array.from(dateSet);

    // Fetch draws for those days (bulk)
    let drawsByDay = new Map(); // day -> { main, stars }
    let drawSchema = 'unknown';

    const put = (day, main, stars) => {
      if (main.length === 5 && stars.length === 2) {
        drawsByDay.set(day, { main, stars });
      }
    };

    // Try n1..s2 schema first
    try {
      const { rows: drawRows } = await pool.query(
        `
        SELECT draw_date, n1,n2,n3,n4,n5, s1,s2
        FROM euromillions_draws
        WHERE draw_date::date = ANY($1::date[])
        `,
        [days],
      );

      for (const r of drawRows) {
        const day = toYYYYMMDD(r.draw_date);
        const main = [r.n1, r.n2, r.n3, r.n4, r.n5]
          .map(Number)
          .filter(Number.isFinite);
        const stars = [r.s1, r.s2].map(Number).filter(Number.isFinite);
        if (day) put(day, main, stars);
      }
      drawSchema = 'n1..s2';
    } catch (_e) {
      // Fallback arrays schema
      const { rows: drawRows } = await pool.query(
        `
        SELECT draw_date, main_numbers, star_numbers
        FROM euromillions_draws
        WHERE draw_date::date = ANY($1::date[])
        `,
        [days],
      );

      for (const r of drawRows) {
        const day = toYYYYMMDD(r.draw_date);
        const main = toNums(r.main_numbers);
        const stars = toNums(r.star_numbers);
        if (day) put(day, main, stars);
      }
      drawSchema = 'arrays';
    }

    let checked = 0;
    let updated = 0;
    let skipped = 0;

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

      const draw = drawsByDay.get(day);
      if (!draw) {
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

      const mMain = countMatches(pMain, draw.main);
      const mStars = countMatches(pStars, draw.stars);
      const label = `${mMain}+${mStars}`;

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
      const foundDays = Array.from(drawsByDay.keys()).sort();
      const missingDays = days.filter((d) => !drawsByDay.has(d)).sort();

      return res.json({
        ...payload,
        debug: {
          drawSchema,
          daysRequested: days.length,
          foundDaysCount: foundDays.length,
          missingDaysCount: missingDays.length,
          samplePredictions: predMeta.slice(0, 10),
          sampleFoundDays: foundDays.slice(0, 10),
          sampleMissingDays: missingDays.slice(0, 10),
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
