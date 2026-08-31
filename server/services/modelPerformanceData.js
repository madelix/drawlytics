import { pool } from '../db.js';
import {
  normalizeModelKey,
  getModelDisplayName,
} from '../modelNormalization.js';

export async function getModelPerformanceData(
  lottery = 'euromillions',
  beforeDrawDate = null,
) {
  const { rows } = await pool.query(
    `
    WITH base AS (
      SELECT
        p.id,
        p.model_name,
        p.source,
        p.status,
        pdr.draw_date,
        pdr.draw_sequence,
        pdr.matched_main,
        pdr.matched_special AS matched_stars,
        LOWER(p.model_name) AS model_name_lc
      FROM predictions p
      INNER JOIN prediction_draw_results pdr
        ON pdr.prediction_id = p.id
      WHERE LOWER(p.lottery) = LOWER($1)
  AND p.benchmark_eligible = true
  AND (
    $2::date IS NULL
    OR pdr.draw_date < $2::date
  )
    ),
    normalized AS (
      SELECT
        CASE
          WHEN source = 'strategy_mix' THEN 'strategy_mix'

          WHEN model_name_lc LIKE 'make_magic:cold_focused%'
            THEN 'cold_focused'
          WHEN model_name_lc LIKE 'make_magic:hot_focused%'
            THEN 'hot_focused'
          WHEN model_name_lc LIKE 'make_magic:balanced_hot_cold%'
            THEN 'balanced_hot_cold'
          WHEN model_name_lc LIKE 'make_magic:pure_random%'
            THEN 'pure_random'
          WHEN model_name_lc LIKE 'make_magic:overdue%'
            THEN 'overdue'

          WHEN model_name_lc LIKE '%cold-focused generator%'
            THEN 'cold_focused'
          WHEN model_name_lc LIKE '%hot-focused generator%'
            THEN 'hot_focused'
          WHEN model_name_lc LIKE '%balanced hot/cold generator%'
            THEN 'balanced_hot_cold'
          WHEN model_name_lc LIKE '%pure random generator%'
            THEN 'pure_random'
          WHEN model_name_lc LIKE '%overdue-focused generator%'
            THEN 'overdue'

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
        draw_sequence,
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
        draw_sequence,
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
        draw_sequence,
        matched_main,
        matched_stars,
        ROW_NUMBER() OVER (
          PARTITION BY model_key
          ORDER BY draw_date DESC, draw_sequence DESC
        ) AS recency_rank
      FROM named
      WHERE status = 'checked'
    ),
    draw_model_scores AS (
      SELECT
        model_key,
        draw_date,
        draw_sequence,
        AVG(
          COALESCE(matched_main, 0) +
          COALESCE(matched_stars, 0)
        ) AS avg_total_hits
      FROM named
      WHERE status = 'checked'
      GROUP BY model_key, draw_date, draw_sequence
    ),
    baseline_compare AS (
      SELECT
        m.model_key,
        COUNT(*)::int AS baseline_compared_draws,
        COUNT(*) FILTER (
          WHERE m.avg_total_hits > b.avg_total_hits
        )::int AS baseline_wins
      FROM draw_model_scores m
      JOIN draw_model_scores b
        ON b.draw_date = m.draw_date
       AND b.draw_sequence = m.draw_sequence
       AND b.model_key = 'pure_random'
      WHERE m.model_key <> 'pure_random'
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
        100.0 * COUNT(*) FILTER (
          WHERE status = 'checked'
        ) / NULLIF(COUNT(*), 0),
        1
      ) AS checked_rate_pct,

      ROUND(AVG(matched_main)::numeric, 2) AS avg_main,
      ROUND(AVG(matched_stars)::numeric, 2) AS avg_stars,

      ROUND((
        SELECT AVG(
          rc.matched_main + rc.matched_stars
        )::numeric
        FROM ranked_checked rc
        WHERE rc.model_key = named.model_key
          AND rc.recency_rank <= 5
      ), 2) AS recent_avg_total_hits,

      COUNT(*) FILTER (
        WHERE status = 'checked'
          AND COALESCE(matched_main, 0) +
              COALESCE(matched_stars, 0) >= 3
      )::int AS high_hit_predictions,

      COUNT(*) FILTER (
        WHERE status = 'checked'
          AND COALESCE(matched_main, 0) +
              COALESCE(matched_stars, 0) >= 4
      )::int AS four_plus_hits,

      COUNT(*) FILTER (
        WHERE status = 'checked'
          AND COALESCE(matched_main, 0) +
              COALESCE(matched_stars, 0) >= 5
      )::int AS five_plus_hits,

      SUM(
        CASE
          WHEN matched_main = 5
           AND matched_stars = 2
          THEN 1
          ELSE 0
        END
      )::int AS jackpots,

      COALESCE(MAX(bc.baseline_wins), 0)::int
        AS baseline_wins,

      COALESCE(
        MAX(bc.baseline_compared_draws),
        0
      )::int AS baseline_compared_draws

    FROM named

    LEFT JOIN baseline_compare bc
      ON bc.model_key = named.model_key

    GROUP BY
      named.model_key,
      named.model_display_name

    ORDER BY
      (
        AVG(named.matched_main) +
        AVG(named.matched_stars)
      ) DESC NULLS LAST,
      COUNT(*) DESC
    `,
    [lottery, beforeDrawDate],
  );

  return rows.map((row) => {
    const normalizedKey = normalizeModelKey(row.model_key);

    return {
      ...row,
      model_key: normalizedKey,
      model_display_name: getModelDisplayName(normalizedKey),
    };
  });
}
