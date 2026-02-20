// server/routes/performance.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

/**
 * GET /api/performance/models?lottery=euromillions
 */
router.get('/performance/models', async (req, res) => {
  try {
    const lottery = String(req.query.lottery || 'euromillions');

    const { rows } = await pool.query(
      `
      SELECT
        model_name,
        COUNT(*)::int AS total_predictions,
        COUNT(*) FILTER (WHERE status='checked')::int AS checked_predictions,

        ROUND(
          100.0 * COUNT(*) FILTER (WHERE status='checked')
          / NULLIF(COUNT(*),0),
          1
        ) AS checked_rate_pct,

        ROUND(AVG(matched_main)::numeric, 2) AS avg_main,
        ROUND(AVG(matched_stars)::numeric, 2) AS avg_stars,

        SUM(
          CASE
            WHEN matched_main=5 AND matched_stars=2
            THEN 1 ELSE 0
          END
        )::int AS jackpots

      FROM predictions
      WHERE LOWER(lottery) = LOWER($1)
      GROUP BY model_name
      ORDER BY avg_main DESC NULLS LAST, total_predictions DESC;
      `,
      [lottery],
    );

    res.json({
      ok: true,
      lottery,
      models: rows,
    });
  } catch (err) {
    console.error('GET /performance/models failed:', err);
    res.status(500).json({ ok: false, error: 'performance_failed' });
  }
});

export default router;
