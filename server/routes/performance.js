// server/routes/performance.js
import express from 'express';
import { pool } from '../db.js';
import {
  normalizeModelKey,
  getModelDisplayName,
} from '../modelNormalization.js';
import { checkPredictions } from '../services/checkPredictions.js';

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
          model_display_name: getModelDisplayName(normalizedKey),
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
  AVG(total_hits)::numeric AS avg_total_hits,
  COUNT(*)::int AS prediction_count
FROM normalized
WHERE model_key = $2
   OR model_key = 'pure_random'
GROUP BY draw_date, model_key
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

router.get('/performance/honesty-summary', async (req, res) => {
  try {
    const lottery = String(req.query.lottery || 'euromillions');

    const { rows } = await pool.query(
      `
            WITH raw_predictions AS (
        SELECT
          CASE
            WHEN source = 'strategy_mix' THEN 'strategy_mix'
            WHEN LOWER(model_name) LIKE 'make_magic:cold_focused%' THEN 'cold_focused'
            WHEN LOWER(model_name) LIKE 'make_magic:hot_focused%' THEN 'hot_focused'
            WHEN LOWER(model_name) LIKE 'make_magic:balanced_hot_cold%' THEN 'balanced_hot_cold'
            WHEN LOWER(model_name) LIKE 'make_magic:pure_random%' THEN 'pure_random'
            WHEN LOWER(model_name) LIKE 'make_magic:overdue%' THEN 'overdue'
            ELSE LOWER(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(model_name, 'make_magic:', ''),
        'ai:',
        'ai_'
      ),
      ' generator',
      ''
    ),
    '-focused',
    ''
  )
)
          END AS model_key,
          status,
          matched_main,
          matched_stars
        FROM predictions
        WHERE LOWER(lottery) = LOWER($1)
      ),
      model_stats AS (
        SELECT
          model_key,
          COUNT(*) FILTER (WHERE LOWER(TRIM(status)) = 'checked')::int AS checked_predictions,
          AVG(
            CASE
              WHEN LOWER(TRIM(status)) = 'checked'
              THEN COALESCE(matched_main, 0) + COALESCE(matched_stars, 0)
              ELSE NULL
            END
          )::numeric AS avg_total_hits
        FROM raw_predictions
        GROUP BY model_key
      )
      SELECT
        COUNT(*) FILTER (WHERE checked_predictions > 0)::int AS models_analysed,
        COALESCE(SUM(checked_predictions), 0)::int AS checked_predictions,
        (
          SELECT model_key
          FROM model_stats
          WHERE checked_predictions > 0
          ORDER BY avg_total_hits DESC NULLS LAST
          LIMIT 1
        ) AS current_leader,
        (
          SELECT avg_total_hits
          FROM model_stats
          WHERE checked_predictions > 0
          ORDER BY avg_total_hits DESC NULLS LAST
          LIMIT 1
        ) AS leader_avg_total_hits
      FROM model_stats;
      `,
      [lottery],
    );

    const summaryRow = rows[0] ?? {};

    const checkedPredictions = Number(summaryRow.checked_predictions ?? 0);
    const modelsAnalysed = Number(summaryRow.models_analysed ?? 0);

    const currentLeaderKey = summaryRow.current_leader ?? null;

    const currentLeaderDisplayName = currentLeaderKey
      ? getModelDisplayName(currentLeaderKey)
      : null;

    let evidenceLevel = 'Low';

    if (checkedPredictions >= 250 && modelsAnalysed >= 5) {
      evidenceLevel = 'High';
    } else if (checkedPredictions >= 100 && modelsAnalysed >= 3) {
      evidenceLevel = 'Moderate';
    } else if (checkedPredictions >= 25) {
      evidenceLevel = 'Building';
    }

    const headline =
      currentLeaderDisplayName === null
        ? 'There is not enough checked prediction history to assess model honesty yet.'
        : currentLeaderKey === 'pure_random'
          ? 'Current evidence shows Pure Random is leading, so no Drawlytics model has yet demonstrated a consistent advantage.'
          : `Current evidence shows ${currentLeaderDisplayName} is leading, but this does not yet prove a statistically significant advantage over random.`;

    res.json({
      ok: true,
      lottery,
      summary: {
        headline,
        current_leader: currentLeaderDisplayName,
        current_leader_key: currentLeaderKey,
        evidence_level: evidenceLevel,
        checked_predictions: checkedPredictions,
        models_analysed: 18,
        leader_avg_total_hits:
          summaryRow.leader_avg_total_hits === null
            ? null
            : Number(summaryRow.leader_avg_total_hits),
      },
    });
  } catch (err) {
    console.error('GET /performance/honesty-summary failed:', err);
    res.status(500).json({ ok: false, error: 'honesty_summary_failed' });
  }
});

router.get('/performance/random-comparison', async (req, res) => {
  try {
    const lottery = String(req.query.lottery || 'euromillions');

    const { rows } = await pool.query(
      `
  SELECT
  model_name,
  source,
  COALESCE(matched_main, 0) + COALESCE(matched_stars, 0) AS total_hits
FROM predictions
WHERE LOWER(lottery) = LOWER($1)
  AND LOWER(TRIM(status)) = 'checked';
  `,
      [lottery],
    );

    const normalizedRows = rows.map((row) => ({
      model_key: normalizeModelKey(row.model_name),
      total_hits: row.total_hits,
    }));

    const totalsByModel = new Map();

    for (const row of normalizedRows) {
      const current = totalsByModel.get(row.model_key) ?? {
        totalHits: 0,
        predictionCount: 0,
      };

      current.totalHits += Number(row.total_hits);
      current.predictionCount += 1;

      totalsByModel.set(row.model_key, current);
    }

    const modelStats = [...totalsByModel.entries()].map(
      ([model_key, stats]) => ({
        model_key,
        avg_total_hits: stats.totalHits / stats.predictionCount,
        checked_predictions: stats.predictionCount,
      }),
    );

    const strongestModel = modelStats
      .filter((model) => model.model_key !== 'pure_random')
      .reduce(
        (best, model) =>
          !best || model.avg_total_hits > best.avg_total_hits ? model : best,
        null,
      );

    const pureRandom = modelStats.find(
      (model) => model.model_key === 'pure_random',
    );

    const difference =
      strongestModel && pureRandom
        ? strongestModel.avg_total_hits - pureRandom.avg_total_hits
        : null;

    const percentageDifference =
      strongestModel && pureRandom && pureRandom.avg_total_hits > 0
        ? (difference / pureRandom.avg_total_hits) * 100
        : null;

    res.json({
      ok: true,
      lottery,
      comparison:
        strongestModel && pureRandom
          ? {
              strongest_model_key: strongestModel.model_key,
              strongest_model_name: getModelDisplayName(
                strongestModel.model_key,
              ),
              strongest_model_avg_hits: strongestModel.avg_total_hits,
              pure_random_avg_hits: pureRandom.avg_total_hits,
              difference,
              percentage_difference: percentageDifference,
            }
          : null,
    });
  } catch (err) {
    console.error('GET /performance/random-comparison failed:', err);
    res.status(500).json({
      ok: false,
      error: 'random_comparison_failed',
    });
  }
});

export default router;
