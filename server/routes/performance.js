// server/routes/performance.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

/**
 * GET /api/performance/models?lottery=euromillions
 *
 * Returns normalized model identity so we don't split the same model across
 * two naming schemes ("make_magic:*" vs "X-focused generator").
 *
 * - model_key: canonical key for grouping (stable, machine-readable)
 * - model_display_name: clean name for UI
 */
router.get('/performance/models', async (req, res) => {
  try {
    const lottery = String(req.query.lottery || 'euromillions');

    const { rows } = await pool.query(
      `
      WITH base AS (
        SELECT
          *,
          LOWER(model_name) AS model_name_lc
        FROM predictions
        WHERE LOWER(lottery) = LOWER($1)
      ),
      normalized AS (
        SELECT
          CASE
            -- Make Magic scheme (canonical)
            WHEN model_name_lc LIKE 'make_magic:cold_focused%' THEN 'cold_focused'
            WHEN model_name_lc LIKE 'make_magic:hot_focused%' THEN 'hot_focused'
            WHEN model_name_lc LIKE 'make_magic:balanced_hot_cold%' THEN 'balanced_hot_cold'
            WHEN model_name_lc LIKE 'make_magic:pure_random%' THEN 'pure_random'
            WHEN model_name_lc LIKE 'make_magic:overdue%' THEN 'overdue'

            -- Older/human scheme (canonical)
            WHEN model_name_lc LIKE '%cold-focused generator%' THEN 'cold_focused'
            WHEN model_name_lc LIKE '%hot-focused generator%' THEN 'hot_focused'
            WHEN model_name_lc LIKE '%balanced hot/cold generator%' THEN 'balanced_hot_cold'
            WHEN model_name_lc LIKE '%pure random generator%' THEN 'pure_random'
            WHEN model_name_lc LIKE '%overdue-focused generator%' THEN 'overdue'

            -- Fallback: try to normalize generically
            ELSE REPLACE(
              REPLACE(
                REPLACE(model_name_lc, 'make_magic:', ''),
                ' generator',
                ''
              ),
              '-focused',
              ''
            )
          END AS model_key,

          status,
          matched_main,
          matched_stars
        FROM base
      )
      SELECT
        model_key,
        CASE model_key
          WHEN 'cold_focused' THEN 'Cold Focused'
          WHEN 'hot_focused' THEN 'Hot Focused'
          WHEN 'balanced_hot_cold' THEN 'Balanced Hot/Cold'
          WHEN 'pure_random' THEN 'Pure Random'
          WHEN 'overdue' THEN 'Overdue'
          ELSE INITCAP(REPLACE(model_key, '_', ' '))
        END AS model_display_name,

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

      FROM normalized
      GROUP BY model_key
      ORDER BY (avg_main + avg_stars) DESC NULLS LAST, total_predictions DESC;
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
