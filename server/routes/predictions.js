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
 */
router.post('/predictions/check', async (_req, res) => {
  try {
    res.json({ ok: true, checked: 0, updated: 0, skipped: 0 });
  } catch (err) {
    console.error('POST /predictions/check failed:', err);
    res.status(500).json({ ok: false, error: 'check_failed' });
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
