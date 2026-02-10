// server/routes/predictions.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

function toNums(arr) {
  return Array.isArray(arr)
    ? arr.map((n) => Number(n)).filter(Number.isFinite)
    : [];
}

function countMatches(a, b) {
  const setB = new Set(b);
  let c = 0;
  for (const x of a) if (setB.has(x)) c++;
  return c;
}

function toYYYYMMDD(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// Get "Europe/London" clock parts for a given Date
function getLondonParts(date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = fmt.formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  // weekday is like "Tue", "Fri"
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: map.weekday,
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

// Compute next EuroMillions draw date (Tue/Fri) with a cutoff on draw day.
// If today is Tue/Fri and before cutoff -> use today, else next Tue/Fri.
function nextEuroMillionsDrawDate(
  now = new Date(),
  cutoffHour = 19,
  cutoffMinute = 0,
) {
  const london = getLondonParts(now);
  const isDrawDay = london.weekday === 'Tue' || london.weekday === 'Fri';
  const beforeCutoff =
    london.hour < cutoffHour ||
    (london.hour === cutoffHour && london.minute < cutoffMinute);

  // Base date at London "today"
  const base = new Date(
    Date.UTC(london.year, london.month - 1, london.day, 0, 0, 0),
  );

  if (isDrawDay && beforeCutoff) {
    return base; // today (as UTC midnight date)
  }

  // Move forward day by day until Tue/Fri
  let d = new Date(base);
  for (let i = 0; i < 7; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      weekday: 'short',
    }).format(d);
    if (w === 'Tue' || w === 'Fri') return d;
  }

  return d;
}

/* ──────────────────────────────────────────────
   GET /api/predictions
   ────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────
   GET /api/predictions/debug-draws?date=YYYY-MM-DD
   (useful when you can’t run SQL in Railway)
   ────────────────────────────────────────────── */
router.get('/predictions/debug-draws', async (req, res) => {
  try {
    const requested = req.query.date ? String(req.query.date) : null;

    const qCount = await pool.query(
      `SELECT COUNT(*)::int AS draws_count FROM euromillions_draws`,
    );
    const qLatest = await pool.query(
      `SELECT draw_date FROM euromillions_draws ORDER BY draw_date DESC LIMIT 1`,
    );

    let rowForDate = null;
    let nearest = null;

    if (requested) {
      const qRow = await pool.query(
        `
        SELECT draw_date, n1,n2,n3,n4,n5,s1,s2
        FROM euromillions_draws
        WHERE draw_date::date = $1::date
        LIMIT 1
        `,
        [requested],
      );

      rowForDate = qRow.rows?.[0] ?? null;

      // nearest prev/next
      const qPrev = await pool.query(
        `
        SELECT draw_date
        FROM euromillions_draws
        WHERE draw_date::date < $1::date
        ORDER BY draw_date DESC
        LIMIT 1
        `,
        [requested],
      );

      const qNext = await pool.query(
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
        prev: qPrev.rows?.[0]?.draw_date ?? null,
        next: qNext.rows?.[0]?.draw_date ?? null,
      };
    }

    return res.json({
      ok: true,
      draws_count: qCount.rows?.[0]?.draws_count ?? null,
      latest_draw: qLatest.rows?.[0]?.draw_date ?? null,
      requested_date: requested,
      row_for_date: rowForDate,
      nearest,
    });
  } catch (err) {
    console.error('GET /predictions/debug-draws failed:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'debug_draws_failed', message: err?.message });
  }
});

/* ──────────────────────────────────────────────
   POST /api/predictions/generate
   - draw date is automatic (next Tue/Fri), with cutoff on draw day
   - still allows optional override via body.draw_date if you want
   ────────────────────────────────────────────── */
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

    // If draw_date provided, use it. Otherwise compute next draw day.
    let draw_date;
    if (drawDateRaw) {
      const parsed = new Date(drawDateRaw);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ ok: false, error: 'invalid_draw_date' });
      }
      draw_date = parsed;
    } else {
      // cutoff: 19:00 London on Tue/Fri
      draw_date = nextEuroMillionsDrawDate(new Date(), 19, 0);
    }

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

    // Store predictions
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
          result_label,
          status
        )
        VALUES ($1, $2, $3, $4::smallint[], $5::smallint[], $6, NOW(), NULL, NULL, NULL, 'pending')
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

/* ──────────────────────────────────────────────
   POST /api/predictions/check
   - fetches draws for all needed dates in one go
   - if a prediction was saved on a non-draw day (e.g. Wed/Thu),
     it can SHIFT to the nearest NEXT available draw date (within a few days)
   - supports ?debug=1
   Body:
     { limit?: number, onlyUnchecked?: boolean, shiftToNextDraw?: boolean }
   ────────────────────────────────────────────── */
router.post('/predictions/check', async (req, res) => {
  try {
    const debug = String(req.query.debug ?? '') === '1';

    const limitRaw = Number(req.body?.limit ?? 200);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(500, Math.floor(limitRaw)))
      : 200;

    // default true
    const onlyUnchecked = req.body?.onlyUnchecked !== false;

    // default true (this is the “you saved on Wed/Thu -> use next Tue/Fri draw” fix)
    const shiftToNextDraw = req.body?.shiftToNextDraw !== false;

    // IMPORTANT: handle both "EuroMillions" and "Euromillions" old rows
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
      WHERE lower(lottery) = 'euromillions'
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

    let predictionsToCheck = preds ?? [];
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
        WHERE lower(lottery) = 'euromillions'
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

    // Fetch draws for those days (n1..s2 schema)
    const drawsByDay = new Map(); // day -> { drawDay, main, stars }
    let drawSchema = 'unknown';

    const put = (day, main, stars) => {
      if (day && main.length === 5 && stars.length === 2) {
        drawsByDay.set(day, { drawDay: day, main, stars });
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
        put(day, main, stars);
      }
      drawSchema = 'n1..s2';
    } catch (e) {
      // if your draws table schema ever changes, you’ll see it here
      console.error('draw fetch failed:', e);
      return res
        .status(500)
        .json({ ok: false, error: 'draw_fetch_failed', message: e?.message });
    }

    // Optional: shift missing days to nearest NEXT draw day (within 4 days)
    const shifted = [];
    if (shiftToNextDraw) {
      for (const day of days) {
        if (drawsByDay.has(day)) continue;

        const q = await pool.query(
          `
          SELECT draw_date, n1,n2,n3,n4,n5, s1,s2
          FROM euromillions_draws
          WHERE draw_date::date > $1::date
            AND draw_date::date <= ($1::date + INTERVAL '4 days')
          ORDER BY draw_date ASC
          LIMIT 1
          `,
          [day],
        );

        const r = q.rows?.[0];
        if (r) {
          const nextDay = toYYYYMMDD(r.draw_date);
          const main = [r.n1, r.n2, r.n3, r.n4, r.n5]
            .map(Number)
            .filter(Number.isFinite);
          const stars = [r.s1, r.s2].map(Number).filter(Number.isFinite);
          put(day, main, stars); // store under original day, but note it’s nextDay draw numbers
          // overwrite drawDay so label can show the real draw date
          drawsByDay.set(day, { drawDay: nextDay, main, stars });
          shifted.push([day, nextDay]);
        }
      }
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

      const realDrawDay =
        draw.drawDay && draw.drawDay !== day ? draw.drawDay : null;
      const label = realDrawDay
        ? `${mMain}+${mStars} (draw:${realDrawDay})`
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
      const foundDays = Array.from(drawsByDay.keys()).sort();
      const missingDays = days.filter((d) => !drawsByDay.has(d)).sort();

      return res.json({
        ...payload,
        debug: {
          drawSchema,
          daysRequested: days.length,
          foundDaysCount: foundDays.length,
          missingDaysCount: missingDays.length,
          shiftedCount: shifted.length,
          samplePredictions: predMeta.slice(0, 10),
          sampleMissingDays: missingDays.slice(0, 10),
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

/* ──────────────────────────────────────────────
   DELETE /api/predictions/:id
   ────────────────────────────────────────────── */
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
