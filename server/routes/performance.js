// server/routes/performance.js
import express from 'express';
import { pool } from '../db.js';
import {
  normalizeModelKey,
  getModelDisplayName,
} from '../modelNormalization.js';
import { checkPredictions } from '../services/checkPredictions.js';
import {
  analyseLeaderStability,
  buildLeaderboardHistory,
} from '../services/leaderboardHistory.js';
import {
  calculateBootstrapConfidence,
  calculateEvidenceScore,
  calculateModelEvidenceScore,
} from '../services/evidenceEngine.js';
import { getModelProfile, MODEL_REGISTRY } from '../modelRegistry.js';

const router = express.Router();

const FINDING_PRIORITIES = {
  SAMPLE_SIZE: 100,
  BOOTSTRAP_SIGNIFICANCE: 98,
  STATISTICAL_SIGNIFICANCE: 95,
  BASELINE_COMPETITIVENESS: 90,
  LEADER_STABILITY: 85,
  MODEL_CLUSTER: 70,
  MILESTONE: 40,
};

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
),
normalized AS (
        SELECT
          CASE
  WHEN source IN (
  'strategy_mix',
  'benchmark_strategy_mix'
) THEN 'strategy_mix'
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
      COALESCE(matched_main, 0) + COALESCE(matched_stars, 0)
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
  WHERE source IN (
  'strategy_mix',
  'benchmark_strategy_mix'
)
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
    p.model_name,
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
  AND LOWER(TRIM(p.status)) = 'checked'
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
draw_sequence,
COALESCE(matched_main, 0) + COALESCE(matched_stars, 0) AS total_hits
FROM base
      )
      SELECT
  draw_date,
  draw_sequence,
  model_key,
  AVG(total_hits)::numeric AS avg_total_hits,
  COUNT(*)::int AS prediction_count
FROM normalized
WHERE model_key = $2
   OR model_key = 'pure_random'
GROUP BY draw_date, draw_sequence, model_key
ORDER BY draw_date ASC, draw_sequence ASC;
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
    const leaderboardHistory = await buildLeaderboardHistory(lottery);
    const leaderStability = analyseLeaderStability(leaderboardHistory);

    const { rows } = await pool.query(
      `
           SELECT
  p.model_name,
  p.source,
  p.status,
  pdr.draw_date,
  pdr.draw_sequence,
  pdr.matched_main,
  pdr.matched_special AS matched_stars
FROM predictions p
INNER JOIN prediction_draw_results pdr
  ON pdr.prediction_id = p.id
WHERE LOWER(p.lottery) = LOWER($1)
  AND p.benchmark_eligible = true;
      `,
      [lottery],
    );

    const checkedRows = rows
      .filter((row) => String(row.status).trim().toLowerCase() === 'checked')
      .map((row) => ({
        model_key: normalizeModelKey(row.model_name),
        total_hits:
          Number(row.matched_main ?? 0) + Number(row.matched_stars ?? 0),
      }));

    const hitsByModel = new Map();

    for (const row of checkedRows) {
      const hits = hitsByModel.get(row.model_key) ?? [];
      hits.push(row.total_hits);
      hitsByModel.set(row.model_key, hits);
    }

    const totalsByModel = new Map();

    for (const row of checkedRows) {
      const current = totalsByModel.get(row.model_key) ?? {
        totalHits: 0,
        predictionCount: 0,
      };

      current.totalHits += row.total_hits;
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

    const rankedModels = [...modelStats].sort(
      (a, b) => b.avg_total_hits - a.avg_total_hits,
    );

    const pureRandomRank =
      rankedModels.findIndex((model) => model.model_key === 'pure_random') + 1;

    const topThreeModels = rankedModels
      .filter((model) => model.model_key !== 'pure_random')
      .slice(0, 3);

    const pureRandom = modelStats.find(
      (model) => model.model_key === 'pure_random',
    );

    const currentLeader = modelStats.reduce(
      (best, model) =>
        !best || model.avg_total_hits > best.avg_total_hits ? model : best,
      null,
    );

    const strongestNonRandom = modelStats
      .filter((model) => model.model_key !== 'pure_random')
      .reduce(
        (best, model) =>
          !best || model.avg_total_hits > best.avg_total_hits ? model : best,
        null,
      );

    const summaryRow = {
      checked_predictions: checkedRows.length,
      models_analysed: modelStats.length,
      current_leader: currentLeader?.model_key ?? null,
      leader_avg_total_hits: currentLeader?.avg_total_hits ?? null,
    };

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

    const findings = [];

    if (strongestNonRandom) {
      const leaderSampleSize = strongestNonRandom.checked_predictions;

      findings.push({
        id: 'leader-sample-size',
        type: leaderSampleSize < 25 ? 'warning' : 'info',
        category: 'Sample size',
        priority: FINDING_PRIORITIES.SAMPLE_SIZE,
        title:
          leaderSampleSize < 25
            ? `${getModelDisplayName(strongestNonRandom.model_key)} currently leads, but its result is based on only ${leaderSampleSize} checked predictions.`
            : `${getModelDisplayName(strongestNonRandom.model_key)} is supported by ${leaderSampleSize} checked predictions.`,
      });
    }

    let percentageDifference = null;
    if (strongestNonRandom && pureRandom) {
      const difference =
        strongestNonRandom.avg_total_hits - pureRandom.avg_total_hits;

      percentageDifference = percentageDifference =
        pureRandom.avg_total_hits > 0
          ? (difference / pureRandom.avg_total_hits) * 100
          : null;

      findings.push({
        id: 'performance-gap',
        type: Math.abs(percentageDifference ?? 0) < 10 ? 'warning' : 'info',
        category: 'Performance gap',
        priority: FINDING_PRIORITIES.STATISTICAL_SIGNIFICANCE,
        title:
          percentageDifference === null
            ? `${getModelDisplayName(strongestNonRandom.model_key)} cannot yet be compared reliably with Pure Random.`
            : Math.abs(percentageDifference) < 10
              ? 'The observed performance gap remains small and may change as more predictions are checked.'
              : 'The current performance gap is notable, but it is still based on a limited model-specific sample.',
      });
    }

    if (pureRandomRank > 0) {
      const modelsBelowRandom = modelStats.length - pureRandomRank;
      const modelsAboveRandom = pureRandomRank - 1;

      findings.push({
        id: 'pure-random-competitiveness',
        type: pureRandomRank <= 3 ? 'warning' : 'info',
        category: 'Random baseline',
        priority: FINDING_PRIORITIES.BASELINE_COMPETITIVENESS,
        title:
          pureRandomRank <= 3
            ? `Only ${modelsAboveRandom} of the ${modelStats.length} evaluated model${modelStats.length === 1 ? '' : 's'} currently outperform Pure Random.`
            : `Pure Random currently outperforms ${modelsBelowRandom} of the ${modelStats.length} evaluated models.`,
      });
    }

    if (topThreeModels.length === 3) {
      const topRange =
        topThreeModels[0].avg_total_hits - topThreeModels[2].avg_total_hits;

      if (topRange <= 0.1) {
        findings.push({
          id: 'top-model-cluster',
          type: 'info',
          category: 'Model cluster',
          priority: FINDING_PRIORITIES.MODEL_CLUSTER,
          title: `The top three models are separated by only ${topRange.toFixed(2)} average hits, so the current ranking remains tightly clustered.`,
        });
      }
    }

    if (leaderStability.evaluated_draws > 1) {
      findings.push({
        id: 'leader-stability',
        type: leaderStability.leader_changes_last_20 >= 5 ? 'warning' : 'info',
        category: 'Leader stability',
        priority: FINDING_PRIORITIES.LEADER_STABILITY,
        title:
          leaderStability.leader_changes_last_20 >= 5
            ? `The leading model has changed ${leaderStability.leader_changes_last_20} times during the latest 20 evaluated draws, indicating that rankings remain volatile.`
            : `${getModelDisplayName(leaderStability.current_leader_key)} has remained the leading model for ${leaderStability.consecutive_draws} consecutive evaluated draw${leaderStability.consecutive_draws === 1 ? '' : 's'}.`,
      });
    }

    const bootstrapConfidence =
      strongestNonRandom && pureRandom
        ? calculateBootstrapConfidence({
            modelHits: hitsByModel.get(strongestNonRandom.model_key) ?? [],
            pureRandomHits: hitsByModel.get('pure_random') ?? [],
          })
        : null;

    if (
      bootstrapConfidence?.status === 'calculated' &&
      bootstrapConfidence.interpretation
    ) {
      findings.push({
        id: 'bootstrap-significance',
        type:
          bootstrapConfidence.interpretation.level === 'strong'
            ? 'positive'
            : 'warning',
        category: 'Statistical evidence',
        priority: FINDING_PRIORITIES.BOOTSTRAP_SIGNIFICANCE,
        title:
          bootstrapConfidence.interpretation.level === 'strong'
            ? `Bootstrap analysis indicates strong evidence that ${currentLeaderDisplayName} currently outperforms Pure Random.`
            : `Current bootstrap analysis does not provide strong evidence that ${currentLeaderDisplayName} outperforms Pure Random.`,
      });
    }

    const evidenceScore = calculateEvidenceScore({
      leaderSampleSize: strongestNonRandom?.checked_predictions ?? 0,
      percentageDifference,
      leaderChangesLast20: leaderStability.leader_changes_last_20,
      bootstrapResult: bootstrapConfidence,
    });

    const selectedFindings = findings
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 4);

    res.json({
      ok: true,
      lottery,
      summary: {
        headline,
        current_leader: currentLeaderDisplayName,
        current_leader_key: currentLeaderKey,
        evidence_level: evidenceLevel,
        checked_predictions: checkedPredictions,
        models_analysed: modelStats.length,
        leader_avg_total_hits:
          summaryRow.leader_avg_total_hits === null
            ? null
            : Number(summaryRow.leader_avg_total_hits),
        evidence: {
          ...evidenceScore,
          bootstrap: bootstrapConfidence,
        },
        findings: selectedFindings,
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
  p.model_name,
  p.source,
  COALESCE(pdr.matched_main, 0) + COALESCE(pdr.matched_special, 0) AS total_hits
FROM predictions p
INNER JOIN prediction_draw_results pdr
  ON pdr.prediction_id = p.id
WHERE LOWER(p.lottery) = LOWER($1)
  AND p.benchmark_eligible = true
  AND LOWER(TRIM(p.status)) = 'checked';
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

router.get('/performance/leaderboard-history', async (req, res) => {
  try {
    const lottery = String(req.query.lottery || 'euromillions');
    const history = await buildLeaderboardHistory(lottery);
    const stability = analyseLeaderStability(history);

    res.json({
      ok: true,
      lottery,
      history,
      stability,
    });
  } catch (err) {
    console.error('GET /performance/leaderboard-history failed:', err);
    res.status(500).json({
      ok: false,
      error: 'leaderboard_history_failed',
    });
  }
});

router.get('/performance/model-registry', async (_req, res) => {
  try {
    res.json({
      ok: true,
      models: MODEL_REGISTRY,
    });
  } catch (err) {
    console.error('GET /performance/model-registry failed:', err);
    res.status(500).json({
      ok: false,
      error: 'model_registry_failed',
    });
  }
});

router.get('/performance/model-registry/:modelKey', async (req, res) => {
  try {
    const modelKey = String(req.params.modelKey || '').trim();
    const model = getModelProfile(modelKey);

    if (!model) {
      return res.status(404).json({
        ok: false,
        error: 'model_not_found',
      });
    }

    res.json({
      ok: true,
      model,
    });
  } catch (err) {
    console.error('GET /performance/model-registry/:modelKey failed:', err);
    res.status(500).json({
      ok: false,
      error: 'model_registry_detail_failed',
    });
  }
});

router.get(
  '/performance/model-registry/:modelKey/performance',
  async (req, res) => {
    try {
      const modelKey = String(req.params.modelKey || '').trim();
      const lottery = String(req.query.lottery || 'euromillions');

      const { rows } = await pool.query(
        `
      SELECT
  p.model_name,
  p.status,
  pdr.matched_main,
  pdr.matched_special AS matched_stars
FROM predictions p
INNER JOIN prediction_draw_results pdr
  ON pdr.prediction_id = p.id
WHERE LOWER(p.lottery) = LOWER($1)
  AND p.benchmark_eligible = true
  AND LOWER(TRIM(p.status)) = 'checked';
      `,
        [lottery],
      );

      const checkedRows = rows.map((row) => ({
        model_key: normalizeModelKey(row.model_name),
        total_hits:
          Number(row.matched_main ?? 0) + Number(row.matched_stars ?? 0),
      }));

      const statsByModel = new Map();

      for (const row of checkedRows) {
        const current = statsByModel.get(row.model_key) ?? {
          total_hits: 0,
          checked_predictions: 0,
        };

        current.total_hits += row.total_hits;
        current.checked_predictions += 1;

        statsByModel.set(row.model_key, current);
      }

      const rankedModels = [...statsByModel.entries()]
        .map(([key, stats]) => ({
          model_key: key,
          avg_total_hits:
            stats.checked_predictions > 0
              ? stats.total_hits / stats.checked_predictions
              : 0,
          checked_predictions: stats.checked_predictions,
        }))
        .sort(
          (a, b) =>
            b.avg_total_hits - a.avg_total_hits ||
            b.checked_predictions - a.checked_predictions ||
            a.model_key.localeCompare(b.model_key),
        );

      const modelIndex = rankedModels.findIndex(
        (model) => model.model_key === modelKey,
      );

      if (modelIndex === -1) {
        return res.status(404).json({
          ok: false,
          error: 'model_performance_not_found',
        });
      }

      const model = rankedModels[modelIndex];
      const pureRandom = rankedModels.find(
        (entry) => entry.model_key === 'pure_random',
      );

      const difference = pureRandom
        ? model.avg_total_hits - pureRandom.avg_total_hits
        : null;

      const percentageDifference =
        pureRandom && pureRandom.avg_total_hits > 0
          ? (difference / pureRandom.avg_total_hits) * 100
          : null;

      const modelHits = checkedRows
        .filter((row) => row.model_key === modelKey)
        .map((row) => row.total_hits);

      const pureRandomHits = checkedRows
        .filter((row) => row.model_key === 'pure_random')
        .map((row) => row.total_hits);

      const bootstrapResult = calculateBootstrapConfidence({
        modelHits,
        pureRandomHits,
      });

      const modelDisplayName = getModelDisplayName(modelKey);

      const modelBootstrapResult = bootstrapResult.interpretation
        ? {
            ...bootstrapResult,
            interpretation: {
              ...bootstrapResult.interpretation,
              title:
                bootstrapResult.interpretation.level === 'strong'
                  ? `Bootstrap analysis indicates strong evidence that ${modelDisplayName} outperforms Pure Random.`
                  : `Current bootstrap analysis does not provide strong evidence that ${modelDisplayName} outperforms Pure Random.`,
            },
          }
        : bootstrapResult;

      const evidence = calculateModelEvidenceScore({
        modelSampleSize: model.checked_predictions,
        percentageDifference: percentageDifference ?? 0,
        bootstrapResult: modelBootstrapResult,
      });

      res.json({
        ok: true,
        lottery,
        performance: {
          rank: modelIndex + 1,
          models_analysed: rankedModels.length,
          avg_total_hits: model.avg_total_hits,
          checked_predictions: model.checked_predictions,
          pure_random_avg_hits: pureRandom?.avg_total_hits ?? null,
          difference,
          percentage_difference: percentageDifference,
          beats_pure_random: difference === null ? null : difference > 0,
          evidence,
        },
      });
    } catch (err) {
      console.error(
        'GET /performance/model-registry/:modelKey/performance failed:',
        err,
      );

      res.status(500).json({
        ok: false,
        error: 'model_registry_performance_failed',
      });
    }
  },
);

export default router;
