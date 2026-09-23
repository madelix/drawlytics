import { pool } from '../db.js';
import {
  normalizeModelKey,
  getModelDisplayName,
} from '../modelNormalization.js';
import { getPredictionLotteryConfig } from './predictionGenerator.js';

export async function getModelPerformanceData(
  lottery = 'euromillions',
  beforeDrawDate = null,
) {
  const lotteryConfig = getPredictionLotteryConfig(lottery);

  const topPrizeMainCount = lotteryConfig.mainCount;

  const topPrizeSpecialCount = lotteryConfig.specialCount;
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
          /*
           * Strategy Mix lines retain the underlying generator's
           * model_name, so source takes precedence over model_name.
           */
          WHEN source IN (
            'strategy_mix',
            'benchmark_strategy_mix'
          )
            THEN 'strategy_mix'

          /*
           * Current Make Magic identities.
           */
          WHEN model_name_lc LIKE 'make_magic:%'
            THEN REPLACE(
              REPLACE(
                model_name_lc,
                'make_magic:',
                ''
              ),
              ':',
              '_'
            )

          /*
           * Historical ai:* identities.
           *
           * Keep their canonical historical key while truthful
           * display metadata is handled outside SQL.
           */
          WHEN model_name_lc LIKE 'ai:%'
            THEN REPLACE(
              REPLACE(
                model_name_lc,
                'ai:',
                'ai_'
              ),
              ':',
              '_'
            )

          /*
           * Older human-readable generator identities.
           */
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

          /*
           * Genuine trained models such as xgboost_v2 already
           * arrive with their canonical identity and fall through
           * here unchanged apart from general formatting.
           */
          ELSE REPLACE(
            REPLACE(
              REPLACE(
                model_name_lc,
                ' generator',
                ''
              ),
              '-focused',
              ''
            ),
            ':',
            '_'
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

      FROM normalized
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

      FROM normalized
      WHERE status = 'checked'

      GROUP BY
        model_key,
        draw_date,
        draw_sequence
    ),

    baseline_compare AS (
      SELECT
        model.model_key,

        COUNT(*)::int
          AS baseline_compared_draws,

        COUNT(*) FILTER (
          WHERE model.avg_total_hits >
                baseline.avg_total_hits
        )::int
          AS baseline_wins

      FROM draw_model_scores model

      JOIN draw_model_scores baseline
        ON baseline.draw_date = model.draw_date
       AND baseline.draw_sequence = model.draw_sequence
       AND baseline.model_key = 'pure_random'

      WHERE model.model_key <> 'pure_random'

      GROUP BY model.model_key
    )

    SELECT
      normalized.model_key,

      COUNT(*)::int
        AS total_predictions,

      COUNT(*) FILTER (
        WHERE source IN (
          'strategy_mix',
          'benchmark_strategy_mix'
        )
      )::int
        AS strategy_mix_predictions,

      COUNT(*) FILTER (
        WHERE LOWER(TRIM(status)) = 'checked'
      )::int
        AS checked_predictions,

      ROUND(
        100.0 *
        COUNT(*) FILTER (
          WHERE status = 'checked'
        ) /
        NULLIF(COUNT(*), 0),
        1
      )
        AS checked_rate_pct,

      ROUND(
        AVG(matched_main)::numeric,
        2
      )
        AS avg_main,

      ROUND(
        AVG(matched_stars)::numeric,
        2
      )
        AS avg_stars,

      ROUND(
        (
          SELECT AVG(
            recent.matched_main +
            recent.matched_stars
          )::numeric

          FROM ranked_checked recent

          WHERE recent.model_key =
                normalized.model_key
            AND recent.recency_rank <= 5
        ),
        2
      )
        AS recent_avg_total_hits,

      COUNT(*) FILTER (
        WHERE status = 'checked'
          AND COALESCE(matched_main, 0) +
              COALESCE(matched_stars, 0) >= 3
      )::int
        AS high_hit_predictions,

      COUNT(*) FILTER (
        WHERE status = 'checked'
          AND COALESCE(matched_main, 0) +
              COALESCE(matched_stars, 0) >= 4
      )::int
        AS four_plus_hits,

      COUNT(*) FILTER (
        WHERE status = 'checked'
          AND COALESCE(matched_main, 0) +
              COALESCE(matched_stars, 0) >= 5
      )::int
        AS five_plus_hits,

      SUM(
  CASE
    WHEN COALESCE(matched_main, 0) = $3
     AND COALESCE(matched_stars, 0) = $4
    THEN 1
    ELSE 0
  END
)::int
  AS top_prize_hits,

      COALESCE(
        MAX(baseline_compare.baseline_wins),
        0
      )::int
        AS baseline_wins,

      COALESCE(
        MAX(
          baseline_compare.baseline_compared_draws
        ),
        0
      )::int
        AS baseline_compared_draws

    FROM normalized

    LEFT JOIN baseline_compare
      ON baseline_compare.model_key =
         normalized.model_key

    GROUP BY normalized.model_key

    ORDER BY
      (
        AVG(normalized.matched_main) +
        AVG(normalized.matched_stars)
      ) DESC NULLS LAST,

      COUNT(*) DESC
    `,
    [lottery, beforeDrawDate, topPrizeMainCount, topPrizeSpecialCount],
  );

  return rows.map((row) => {
    const normalizedKey = normalizeModelKey(row.model_key);

    return {
      ...row,

      /*
       * Keep `jackpots` temporarily for backwards compatibility
       * with existing frontend consumers.
       *
       * `top_prize_hits` is the correct lottery-neutral metric.
       */
      jackpots: row.top_prize_hits,

      model_key: normalizedKey,
      model_display_name: getModelDisplayName(normalizedKey),
    };
  });
}
