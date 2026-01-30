// server/routes/performance.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

/**
 * GET /api/performance/models?lottery=euromillions&limit=500
 */
router.get('/performance/models', async (req, res) => {
  try {
    const lottery = String(req.query.lottery || 'euromillions');
    const limit = Math.min(Number(req.query.limit || 500), 2000);

    // Minimal “safe” response. If you already have your performance SQL, put it here.
    // This prevents 404 loops and makes debugging easier.
    const { rows } = await pool.query(
      `
      SELECT
        model_name,
        COUNT(*) AS total_predictions,
        COUNT(*) FILTER (WHERE status = 'checked') AS checked_predictions
      FROM predictions
      WHERE LOWER(lottery) = LOWER($1)
      GROUP BY model_name
      ORDER BY total_predictions DESC
      LIMIT $2
      `,
      [lottery, limit],
    );

    res.json({
      ok: true,
      lottery,
      limit,
      models: rows,
    });
  } catch (err) {
    console.error('GET /performance/models failed:', err);
    res.status(500).json({ ok: false, error: 'performance_failed' });
  }
});

export default router;
