// server/routes/predictions.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

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

    // --- Create + store predictions (local schema = smallint[], confidence NOT NULL)
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
 * Fixes:
 * - Avoids "0/0/0" when DB defaults are NOT NULL (e.g. matched_main=0)
 * - Handles prediction draw_date stored as timestamptz (e.g. ...Z)
 *   while euromillions_draws.draw_date is DATE
 *
 * Optional body:
 * { limit?: number, onlyUnchecked?: boolean }
 */
router.post('/predictions/check', async (req, res) => {
  try {
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
        draw_date,
        main_numbers,
        star_numbers,
        matched_main,
        matched_stars,
        result_label
      FROM predictions
      WHERE lottery = 'EuroMillions'
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

    // If nothing qualifies but onlyUnchecked=true, fall back to checking latest anyway
    let predictionsToCheck = preds;
    if (predictionsToCheck.length === 0 && onlyUnchecked) {
      const fallback = await pool.query(
        `
        SELECT
          id,
          draw_date,
          main_numbers,
          star_numbers,
          matched_main,
          matched_stars,
          result_label
        FROM predictions
        WHERE lottery = 'EuroMillions'
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

      // Look up draw by DATE using prediction timestamptz normalized to UTC date
      let drawMain = [];
      let drawStars = [];

      // Try n1..n5 / s1..s2 schema
      try {
        const d1 = await pool.query(
          `
          SELECT n1, n2, n3, n4, n5, s1, s2
          FROM euromillions_draws
          WHERE draw_date = ($1::timestamptz AT TIME ZONE 'UTC')::date
          LIMIT 1
          `,
          [p.draw_date],
        );

        if (d1.rows?.length) {
          const r = d1.rows[0];
          drawMain = [r.n1, r.n2, r.n3, r.n4, r.n5]
            .map(Number)
            .filter(Number.isFinite);
          drawStars = [r.s1, r.s2].map(Number).filter(Number.isFinite);
        }
      } catch (_e) {
        // ignore
      }

      // Try array schema main_numbers/star_numbers
      if (drawMain.length !== 5 || drawStars.length !== 2) {
        try {
          const d2 = await pool.query(
            `
            SELECT main_numbers, star_numbers
            FROM euromillions_draws
            WHERE draw_date = ($1::timestamptz AT TIME ZONE 'UTC')::date
            LIMIT 1
            `,
            [p.draw_date],
          );

          if (d2.rows?.length) {
            const r = d2.rows[0];
            drawMain = toNums(r.main_numbers);
            drawStars = toNums(r.star_numbers);
          }
        } catch (_e2) {
          // ignore
        }
      }

      if (drawMain.length !== 5 || drawStars.length !== 2) {
        await pool.query(
          `
          UPDATE predictions
          SET matched_main = NULL,
              matched_stars = NULL,
              result_label = 'no_draw_for_date'
          WHERE id = $1
          `,
          [p.id],
        );
        updated++;
        continue;
      }

      const mMain = countMatches(pMain, drawMain);
      const mStars = countMatches(pStars, drawStars);
      const label = `${mMain}+${mStars}`;

      await pool.query(
        `
        UPDATE predictions
        SET matched_main = $2,
            matched_stars = $3,
            result_label = $4
        WHERE id = $1
        `,
        [p.id, mMain, mStars, label],
      );

      updated++;
    }

    return res.json({ ok: true, checked, updated, skipped });
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
