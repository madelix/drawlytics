// server/routes/performance.js
import express from 'express';
import { pool } from '../db.js';
import { MODEL_DISPLAY_NAMES } from '../modelMetadata.js';
import { normalizeModelKey } from '../modelNormalization.js';

const router = express.Router();

/**
 * GET /api/performance/models?lottery=euromillions
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
  WHEN source = 'strategy_mix' THEN 'strategy_mix'
  WHEN model_name_lc LIKE 'make_magic:cold_focused%' THEN 'cold_focused'
            WHEN model_name_lc LIKE 'make_magic:hot_focused%' THEN 'hot_focused'
            WHEN model_name_lc LIKE 'make_magic:balanced_hot_cold%' THEN 'balanced_hot_cold'
            WHEN model_name_lc LIKE 'make_magic:pure_random%' THEN 'pure_random'
            WHEN model_name_lc LIKE 'make_magic:overdue%' THEN 'overdue'

            WHEN model_name_lc LIKE '%cold-focused generator%' THEN 'cold_focused'
            WHEN model_name_lc LIKE '%hot-focused generator%' THEN 'hot_focused'
            WHEN model_name_lc LIKE '%balanced hot/cold generator%' THEN 'balanced_hot_cold'
            WHEN model_name_lc LIKE '%pure random generator%' THEN 'pure_random'
            WHEN model_name_lc LIKE '%overdue-focused generator%' THEN 'overdue'

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
          draw_date,
          status,
          matched_main,
          matched_stars,
          source
        FROM base
      ),
        named AS (
        SELECT
          model_key,
          CASE model_key
  WHEN 'strategy_mix' THEN 'Strategy Mix'
  WHEN 'cold_focused' THEN 'Cold Focused'
            WHEN 'hot_focused' THEN 'Hot Focused'
            WHEN 'balanced_hot_cold' THEN 'Balanced Hot/Cold'
            WHEN 'pure_random' THEN 'Pure Random'
            WHEN 'overdue' THEN 'Overdue'
            WHEN 'ai_ensemble' THEN 'AI Ensemble'
WHEN 'ai_statistical_analysis' THEN 'AI Statistical Analysis'
WHEN 'ai_random_forest' THEN 'AI Random Forest'
WHEN 'ai_decision_tree' THEN 'AI Decision Tree'
WHEN 'ai_gradient_boosting' THEN 'AI Gradient Boosting'
WHEN 'ai_xgboost' THEN 'AI XGBoost'
WHEN 'ai_q_learning' THEN 'AI Q-Learning'
WHEN 'ai_advanced_analysis' THEN 'AI Advanced Analysis'
WHEN 'ai_markov_chain' THEN 'AI Markov Chain'
WHEN 'ai_meta_learning' THEN 'AI Meta Learning'
            ELSE INITCAP(REPLACE(model_key, '_', ' '))
          END AS model_display_name,
          draw_date,
          status,
          matched_main,
          matched_stars,
          source
        FROM normalized
      ),
      ranked_checked AS (
  SELECT
    model_key,
    draw_date,
    matched_main,
    matched_stars,
    ROW_NUMBER() OVER (
      PARTITION BY model_key
      ORDER BY draw_date DESC
    ) AS recency_rank
  FROM named
  WHERE status = 'checked'
),
baseline_compare AS (
  SELECT
    m.model_key,
    COUNT(*)::int AS baseline_compared_draws,
    COUNT(*) FILTER (
      WHERE COALESCE(m.matched_main, 0) + COALESCE(m.matched_stars, 0)
          > COALESCE(b.matched_main, 0) + COALESCE(b.matched_stars, 0)
    )::int AS baseline_wins
  FROM named m
  JOIN named b
    ON b.draw_date = m.draw_date
   AND b.model_key = 'pure_random'
   AND b.status = 'checked'
  WHERE m.status = 'checked'
    AND m.model_key <> 'pure_random'
  GROUP BY m.model_key
)

            SELECT
        named.model_key,
        named.model_display_name,

        COUNT(*)::int AS total_predictions,
        COUNT(*) FILTER (
  WHERE source = 'strategy_mix'
)::int AS strategy_mix_predictions,
        COUNT(*) FILTER (
  WHERE LOWER(TRIM(status)) = 'checked'
)::int AS checked_predictions,

        ROUND(
          100.0 * COUNT(*) FILTER (WHERE status = 'checked')
          / NULLIF(COUNT(*), 0),
          1
        ) AS checked_rate_pct,

        ROUND(AVG(matched_main)::numeric, 2) AS avg_main,
        ROUND(AVG(matched_stars)::numeric, 2) AS avg_stars,

        ROUND((
  SELECT AVG(rc.matched_main + rc.matched_stars)::numeric
  FROM ranked_checked rc
  WHERE rc.model_key = named.model_key
    AND rc.recency_rank <= 5
), 2) AS recent_avg_total_hits,

        COUNT(*) FILTER (
  WHERE status = 'checked'
    AND COALESCE(matched_main, 0) + COALESCE(matched_stars, 0) >= 3
)::int AS high_hit_predictions,

COUNT(*) FILTER (
  WHERE status = 'checked'
    AND COALESCE(matched_main, 0) + COALESCE(matched_stars, 0) >= 4
)::int AS four_plus_hits,

COUNT(*) FILTER (
  WHERE status = 'checked'
    AND COALESCE(matched_main, 0) + COALESCE(matched_stars, 0) >= 5
)::int AS five_plus_hits,

        SUM(
  CASE
    WHEN matched_main = 5 AND matched_stars = 2
    THEN 1 ELSE 0
  END
)::int AS jackpots,

COALESCE(MAX(bc.baseline_wins), 0)::int AS baseline_wins,
COALESCE(MAX(bc.baseline_compared_draws), 0)::int AS baseline_compared_draws

      FROM named
LEFT JOIN baseline_compare bc
  ON bc.model_key = named.model_key
GROUP BY named.model_key, named.model_display_name
      ORDER BY
  (AVG(named.matched_main) + AVG(named.matched_stars)) DESC NULLS LAST,
  COUNT(*) DESC;
      `,
      [lottery],
    );

    res.json({
      ok: true,
      lottery,
      models: rows.map((row) => {
        const normalizedKey = normalizeModelKey(row.model_key);

        return {
          ...row,
          model_key: normalizedKey,
          model_display_name:
            MODEL_DISPLAY_NAMES[normalizedKey] ?? row.model_display_name,
        };
      }),
    });
  } catch (err) {
    console.error('GET /performance/models failed:', err);
    res.status(500).json({ ok: false, error: 'performance_failed' });
  }
});

/**
 * GET /api/performance/model-history?lottery=euromillions&model_key=overdue
 */
router.get('/performance/model-history', async (req, res) => {
  try {
    const lottery = String(req.query.lottery || 'euromillions');
    const modelKey = String(req.query.model_key || '');

    if (!modelKey) {
      return res.status(400).json({
        ok: false,
        error: 'missing_model_key',
      });
    }

    const { rows } = await pool.query(
      `
      WITH base AS (
        SELECT
          *,
          LOWER(model_name) AS model_name_lc
        FROM predictions
        WHERE LOWER(lottery) = LOWER($1)
          AND LOWER(TRIM(status)) = 'checked'
      ),
      normalized AS (
        SELECT
          CASE
            WHEN model_name_lc LIKE 'make_magic:cold_focused%' THEN 'cold_focused'
            WHEN model_name_lc LIKE 'make_magic:hot_focused%' THEN 'hot_focused'
            WHEN model_name_lc LIKE 'make_magic:balanced_hot_cold%' THEN 'balanced_hot_cold'
            WHEN model_name_lc LIKE 'make_magic:pure_random%' THEN 'pure_random'
            WHEN model_name_lc LIKE 'make_magic:overdue%' THEN 'overdue'
            WHEN model_name_lc LIKE 'ai:ensemble%' THEN 'ai_ensemble'
WHEN model_name_lc LIKE 'ai:statistical_analysis%' THEN 'ai_statistical_analysis'
WHEN model_name_lc LIKE 'ai:random_forest%' THEN 'ai_random_forest'
WHEN model_name_lc LIKE 'ai:decision_tree%' THEN 'ai_decision_tree'
WHEN model_name_lc LIKE 'ai:gradient_boosting%' THEN 'ai_gradient_boosting'
WHEN model_name_lc LIKE 'ai:xgboost%' THEN 'ai_xgboost'
WHEN model_name_lc LIKE 'ai:q_learning%' THEN 'ai_q_learning'
WHEN model_name_lc LIKE 'ai:advanced_analysis%' THEN 'ai_advanced_analysis'
WHEN model_name_lc LIKE 'ai:markov_chain%' THEN 'ai_markov_chain'
WHEN model_name_lc LIKE 'ai:meta_learning%' THEN 'ai_meta_learning'

            WHEN model_name_lc LIKE '%cold-focused generator%' THEN 'cold_focused'
            WHEN model_name_lc LIKE '%hot-focused generator%' THEN 'hot_focused'
            WHEN model_name_lc LIKE '%balanced hot/cold generator%' THEN 'balanced_hot_cold'
            WHEN model_name_lc LIKE '%pure random generator%' THEN 'pure_random'
            WHEN model_name_lc LIKE '%overdue-focused generator%' THEN 'overdue'

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
          draw_date,
          COALESCE(matched_main, 0) + COALESCE(matched_stars, 0) AS total_hits
        FROM base
      )
      SELECT
  draw_date,
  model_key,
  total_hits::numeric AS avg_total_hits
FROM normalized
WHERE model_key = $2
   OR model_key = 'pure_random'
ORDER BY draw_date ASC;
      `,
      [lottery, modelKey],
    );

    res.json({
      ok: true,
      model_key: modelKey,
      baseline_model_key: 'pure_random',
      history: rows.filter((r) => r.model_key === modelKey),
      baseline_history: rows.filter((r) => r.model_key === 'pure_random'),
    });
  } catch (err) {
    console.error('GET /performance/model-history failed:', err);
    res.status(500).json({ ok: false, error: 'model_history_failed' });
  }
});

export default router;
