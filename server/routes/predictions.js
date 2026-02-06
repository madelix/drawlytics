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
 * Behavior:
 * - Finds pending predictions (or ones without match fields)
 * - For each prediction, tries to find a matching draw by draw_date (DATE)
 * - If not found, falls back to latest draw
 * - Computes matched_main + matched_stars and updates the prediction row
 *
 * Optional body:
 * { limit?: number, onlyPending?: boolean, useLatestFallback?: boolean }
 */
router.post('/predictions/check', async (req, res) => {
  try {
    const limitRaw = Number(req.body?.limit ?? 200);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(500, Math.floor(limitRaw)))
      : 200;

    const onlyPending = req.body?.onlyPending !== false; // default true
    const useLatestFallback = req.body?.useLatestFallback !== false; // default true

    // 1) Load predictions to check
    const { rows: preds } = await pool.query(
      `
      SELECT
        id,
        lottery,
        draw_date,
        main_numbers,
        star_numbers,
        status,
        matched_main,
        matched_stars,
        result_label
      FROM predictions
      WHERE lottery = 'EuroMillions'
        AND (
          ${
            onlyPending
              ? "status IS NULL OR status = 'pending' OR status = 'played'"
              : 'TRUE'
          }
        )
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit],
    );

    if (!preds.length) {
      return res.json({
        ok: true,
        checked: 0,
        updated: 0,
        skipped: 0,
        note: 'no_predictions_to_check',
      });
    }

    // 2) Try to get latest draw once (fallback)
    let latestDraw = null;
    try {
      // Attempt schema: n1..n5, s1..s2
      const q1 = await pool.query(
        `
        SELECT draw_date, n1, n2, n3, n4, n5, s1, s2
        FROM euromillions_draws
        ORDER BY draw_date DESC
        LIMIT 1
        `,
      );
      if (q1.rows?.length) latestDraw = q1.rows[0];
    } catch (_e) {
      // Attempt schema: main_numbers/star_numbers arrays
      try {
        const q2 = await pool.query(
          `
          SELECT draw_date, main_numbers, star_numbers
          FROM euromillions_draws
          ORDER BY draw_date DESC
          LIMIT 1
          `,
        );
        if (q2.rows?.length) latestDraw = q2.rows[0];
      } catch (_e2) {
        latestDraw = null;
      }
    }

    const normalizeDraw = (d) => {
      if (!d) return null;

      // array-style
      if (Array.isArray(d.main_numbers) && Array.isArray(d.star_numbers)) {
        return {
          draw_date: d.draw_date,
          main: d.main_numbers.map(Number).filter((n) => Number.isFinite(n)),
          stars: d.star_numbers.map(Number).filter((n) => Number.isFinite(n)),
        };
      }

      // n1..n5 style
      const main = [d.n1, d.n2, d.n3, d.n4, d.n5]
        .map(Number)
        .filter((n) => Number.isFinite(n));
      const stars = [d.s1, d.s2].map(Number).filter((n) => Number.isFinite(n));
      if (main.length === 5 && stars.length === 2) {
        return { draw_date: d.draw_date, main, stars };
      }

      return null;
    };

    const latest = normalizeDraw(latestDraw);

    // helper compare
    const countMatches = (a, b) => {
      const setB = new Set(b);
      let c = 0;
      for (const x of a) if (setB.has(x)) c++;
      return c;
    };

    let checked = 0;
    let updated = 0;
    let skipped = 0;

    for (const p of preds) {
      checked++;

      const pMain = Array.isArray(p.main_numbers)
        ? p.main_numbers.map(Number)
        : [];
      const pStars = Array.isArray(p.star_numbers)
        ? p.star_numbers.map(Number)
        : [];

      if (pMain.length !== 5 || pStars.length !== 2) {
        skipped++;
        continue;
      }

      // 3) Find draw for this prediction date (date match), else fallback to latest
      let draw = null;

      // If prediction draw_date exists, try matching draw
      if (p.draw_date) {
        try {
          // Try schema with n1..n5
          const d1 = await pool.query(
            `
            SELECT draw_date, n1, n2, n3, n4, n5, s1, s2
            FROM euromillions_draws
            WHERE draw_date = ($1::timestamptz AT TIME ZONE 'UTC')::date
            LIMIT 1
            `,
            [p.draw_date],
          );
          draw = normalizeDraw(d1.rows?.[0]);
        } catch (_e) {
          try {
            // Try schema with arrays
            const d2 = await pool.query(
              `
              SELECT draw_date, main_numbers, star_numbers
              FROM euromillions_draws
              WHERE draw_date = ($1::timestamptz AT TIME ZONE 'UTC')::date
              LIMIT 1
              `,
              [p.draw_date],
            );
            draw = normalizeDraw(d2.rows?.[0]);
          } catch (_e2) {
            draw = null;
          }
        }
      }

      if (!draw && useLatestFallback) {
        draw = latest;
      }

      if (!draw) {
        // No draw data at all in DB
        await pool.query(
          `
          UPDATE predictions
          SET
            matched_main = NULL,
            matched_stars = NULL,
            result_label = 'no_draw_data'
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
        SET
          matched_main = $2,
          matched_stars = $3,
          result_label = $4
        WHERE id = $1
        `,
        [p.id, mMain, mStars, label],
      );

      updated++;
    }

    return res.json({
      ok: true,
      checked,
      updated,
      skipped,
      usedLatestFallback: useLatestFallback,
      hasLatestDraw: !!latest,
    });
  } catch (err) {
    console.error('POST /predictions/check failed:', err);
    res
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
