// server/routes/predictions.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

/**
 * Helpers: EuroMillions draws are Tue + Fri.
 * We store draw_date as a DATE-like timestamp at 00:00:00.000Z.
 *
 * Cutoff rule:
 * - If it's a draw day (Tue/Fri) AND current time is BEFORE cutoff => use today
 * - Otherwise => use next draw day
 *
 * Configure cutoff with env:
 *   EUROMILLIONS_CUTOFF_UTC_HOUR (default 18)
 *   EUROMILLIONS_CUTOFF_UTC_MINUTE (default 0)
 *
 * Example:
 *   18:00 UTC means after that time, saving should roll to next draw.
 */
function getEuroMillionsCutoffUTC() {
  const h = Number(process.env.EUROMILLIONS_CUTOFF_UTC_HOUR ?? 18);
  const m = Number(process.env.EUROMILLIONS_CUTOFF_UTC_MINUTE ?? 0);

  const hour = Number.isFinite(h)
    ? Math.max(0, Math.min(23, Math.floor(h)))
    : 18;
  const minute = Number.isFinite(m)
    ? Math.max(0, Math.min(59, Math.floor(m)))
    : 0;

  return { hour, minute };
}

function startOfDayUTC(d) {
  const dt = new Date(d);
  return new Date(
    Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()),
  );
}

function isTueOrFriUTC(d) {
  const dow = d.getUTCDay(); // 0 Sun ... 2 Tue ... 5 Fri
  return dow === 2 || dow === 5;
}

function addDaysUTC(d, days) {
  const dt = new Date(d);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt;
}

function getNextEuroMillionsDrawDateUTC(now = new Date()) {
  const { hour, minute } = getEuroMillionsCutoffUTC();

  const nowUTC = new Date(now);
  const todayUTC0 = startOfDayUTC(nowUTC);

  // time check vs cutoff
  const cutoff = new Date(todayUTC0);
  cutoff.setUTCHours(hour, minute, 0, 0);

  const isDrawDay = isTueOrFriUTC(nowUTC);
  const beforeCutoff = nowUTC.getTime() < cutoff.getTime();

  // If it's draw day and we're before cutoff => use today
  if (isDrawDay && beforeCutoff) {
    return todayUTC0; // 00:00Z for the draw day
  }

  // Otherwise find the next Tue/Fri
  let d = todayUTC0;
  for (let i = 1; i <= 7; i++) {
    d = addDaysUTC(todayUTC0, i);
    if (isTueOrFriUTC(d)) return startOfDayUTC(d);
  }

  // Fallback (should never happen)
  return addDaysUTC(todayUTC0, 2);
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
 * POST /api/predictions/generate
 *
 * IMPORTANT:
 * - draw_date is computed on the server (next Tue/Fri with cutoff)
 * - client should NOT send draw_date (and if it does, we ignore it)
 */
router.post('/predictions/generate', async (req, res) => {
  try {
    const lotteryRaw = String(req.body?.lottery ?? '').trim();
    const strategy = String(req.body?.strategy ?? 'pure_random').trim();
    const linesRaw = Number(req.body?.lines ?? 1);

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

    // ✅ SERVER decides draw_date (00:00Z of next draw day)
    const draw_date = getNextEuroMillionsDrawDateUTC(new Date());

    // Helpers
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

    return res.json({
      ok: true,
      created: saved.length,
      draw_date_used: draw_date.toISOString(),
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
 * POST /api/predictions/check
 *
 * (Keeping your existing "robust + debuggable" version exactly as-is)
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
        result_label
      FROM predictions
      WHERE lottery IN ('EuroMillions','Euromillions')
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
        WHERE lottery IN ('EuroMillions','Euromillions')
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

    let drawsByDay = new Map();
    let drawSchema = 'unknown';

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

    // Optional “shift” support (like you’ve been using)
    let shiftedCount = 0;
    const shiftedPairs = [];

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

      // normal: exact day
      let draw = drawsByDay.get(day);
      let usedDay = day;

      // shift: next draw day (only if exact day missing)
      if (!draw) {
        // try +1, +2, +3 days to find the next draw in DB (covers your “saved on Wed/Thu => Fri” case)
        const base = new Date(day + 'T00:00:00.000Z');
        for (let i = 1; i <= 3; i++) {
          const tryDay = toYYYYMMDD(addDaysUTC(base, i));
          const maybe = drawsByDay.get(tryDay);
          if (maybe) {
            draw = maybe;
            usedDay = tryDay;
            shiftedCount++;
            shiftedPairs.push([day, tryDay]);
            break;
          }
        }
      }

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

      const label =
        usedDay === day
          ? `${mMain}+${mStars}`
          : `${mMain}+${mStars} (draw:${usedDay})`;

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
          shiftedCount,
          samplePredictions: predMeta.slice(0, 10),
          sampleMissingDays: missingDays.slice(0, 10),
          sampleShifted: shiftedPairs.slice(0, 10),
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
 * GET /api/predictions/debug-draws?date=YYYY-MM-DD
 * (Optional helper endpoint — keep if you’re using it)
 */
router.get('/predictions/debug-draws', async (req, res) => {
  try {
    const requested = req.query.date ? String(req.query.date) : null;

    const { rows: cntRows } = await pool.query(
      `SELECT COUNT(*)::int AS draws_count, MAX(draw_date) AS latest_draw FROM euromillions_draws`,
    );
    const draws_count = cntRows?.[0]?.draws_count ?? 0;
    const latest_draw = cntRows?.[0]?.latest_draw ?? null;

    let row_for_date = null;
    let nearest = null;

    if (requested) {
      const { rows } = await pool.query(
        `
        SELECT draw_date, n1,n2,n3,n4,n5,s1,s2
        FROM euromillions_draws
        WHERE draw_date::date = $1::date
        LIMIT 1
        `,
        [requested],
      );
      row_for_date = rows?.[0] ?? null;

      const prev = await pool.query(
        `SELECT draw_date FROM euromillions_draws WHERE draw_date::date < $1::date ORDER BY draw_date DESC LIMIT 1`,
        [requested],
      );
      const next = await pool.query(
        `SELECT draw_date FROM euromillions_draws WHERE draw_date::date > $1::date ORDER BY draw_date ASC LIMIT 1`,
        [requested],
      );

      nearest = {
        prev: prev.rows?.[0]?.draw_date ?? null,
        next: next.rows?.[0]?.draw_date ?? null,
      };
    }

    return res.json({
      ok: true,
      draws_count,
      latest_draw,
      requested_date: requested,
      row_for_date,
      ...(nearest ? { nearest } : {}),
    });
  } catch (err) {
    console.error('GET /predictions/debug-draws failed:', err);
    return res.status(500).json({ ok: false, error: 'debug_draws_failed' });
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
