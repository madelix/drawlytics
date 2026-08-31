import { pool } from '../db.js';
import {
  generatePredictionBatch,
  getPredictionLotteryConfig,
  resolveLotteryDrawDate,
} from './predictionGenerator.js';
import { getModelPerformanceData } from './modelPerformanceData.js';
import { buildStrategyRecommendation } from './strategyRecommendation.js';

const BENCHMARK_SOURCE = 'benchmark_runner';
const SUGGESTED_MIX_SOURCE = 'strategy_mix';

const SUPPORTED_LOTTERIES = new Set([
  'euromillions',
  'uk_lotto',
  'set_for_life',
]);

export const BENCHMARK_STRATEGIES = [
  'balanced_hot_cold',
  'hot_focused',
  'cold_focused',
  'overdue',
  'ai:xgboost',
  'ai:ensemble',
  'ai:random_forest',
  'ai:gradient_boosting',
  'ai:statistical_analysis',
  'ai:decision_tree',
  'ai:q_learning',
  'ai:neural_network',
  'ai:lstm',
  'ai:markov_chain',
  'ai:bayesian',
  'ai:meta_learning',
  'pure_random',
];

function normalizeLotteryKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function getExpectedModelName(strategy) {
  return strategy.startsWith('ai:') ? strategy : `make_magic:${strategy}`;
}

function toGeneratorStrategyKey(modelKey) {
  return modelKey.startsWith('ai_') ? `ai:${modelKey.slice(3)}` : modelKey;
}

function getDateKey(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function buildSuggestedMixPlan(recommendation) {
  return recommendation.map((item) => ({
    model_key: item.model_key,
    strategy: toGeneratorStrategyKey(item.model_key),
    weight: item.weight,
    lines: Math.max(1, Math.round(item.weight * 5)),
  }));
}

async function insertBenchmarkPrediction(client, generatedBatch, line, source) {
  const { confidence, model_name } = line;

  const { rows } = await client.query(
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
      result_label,
      status,
      user_id,
      source,
      benchmark_eligible
    )
    VALUES (
      $1,
      $2,
      $3,
      $4::smallint[],
      $5::smallint[],
      $6,
      NOW(),
      NULL,
      NULL,
      NULL,
      'pending',
      NULL,
      $7,
      true
    )
    RETURNING *
    `,
    [
      generatedBatch.lotteryConfig.key,
      generatedBatch.draw_date,
      model_name,
      line.main,
      line.stars,
      confidence,
      source,
    ],
  );

  return rows[0];
}

async function benchmarkPredictionExists(
  client,
  { lottery, drawDate, modelName, source },
) {
  const { rows } = await client.query(
    `
    SELECT id
    FROM predictions
    WHERE LOWER(lottery) = LOWER($1)
      AND draw_date = $2::date
      AND model_name = $3
      AND source = $4
      AND benchmark_eligible = true
    LIMIT 1
    `,
    [lottery, drawDate, modelName, source],
  );

  return rows.length > 0;
}

async function suggestedMixExists(client, { lottery, drawDate }) {
  const { rows } = await client.query(
    `
    SELECT id
    FROM predictions
    WHERE LOWER(lottery) = LOWER($1)
      AND draw_date = $2::date
      AND source = $3
      AND benchmark_eligible = true
    LIMIT 1
    `,
    [lottery, drawDate, SUGGESTED_MIX_SOURCE],
  );

  return rows.length > 0;
}

export async function getBenchmarkSuggestedMix({ lottery, drawDate }) {
  const models = await getModelPerformanceData(lottery, drawDate);

  const recommendation = buildStrategyRecommendation(models);

  return {
    lottery,
    draw_date: drawDate,
    recommendation,
    plan: buildSuggestedMixPlan(recommendation),
  };
}

export async function generateBenchmarkBatch({
  lottery,
  strategy,
  lines = 1,
  drawDate = null,
}) {
  const generatedBatch = await generatePredictionBatch({
    lotteryRaw: lottery,
    strategy,
    lines,
    drawDateRaw: drawDate,
  });

  if (!generatedBatch.ok) {
    return generatedBatch;
  }

  const saved = [];

  for (const line of generatedBatch.predictions) {
    const savedPrediction = await insertBenchmarkPrediction(
      pool,
      generatedBatch,
      line,
      BENCHMARK_SOURCE,
    );

    saved.push(savedPrediction);
  }

  return {
    ok: true,
    lottery: generatedBatch.lotteryConfig.key,
    draw_date: generatedBatch.draw_date,
    predictions: saved,
  };
}

export async function runBenchmarkForDraw({
  lottery,
  drawDate = null,
  dryRun = false,
}) {
  const normalizedLottery = normalizeLotteryKey(lottery);

  if (!SUPPORTED_LOTTERIES.has(normalizedLottery)) {
    return {
      ok: false,
      error: 'unsupported_lottery',
      lottery: normalizedLottery,
    };
  }

  const lotteryConfig = getPredictionLotteryConfig(normalizedLottery);

  const resolvedDrawDate = await resolveLotteryDrawDate(
    drawDate,
    lotteryConfig,
  );

  if (!resolvedDrawDate.ok) {
    return resolvedDrawDate;
  }

  const drawDateKey = getDateKey(resolvedDrawDate.draw_date);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
      SELECT pg_advisory_xact_lock(
        hashtext($1)::bigint
      )
      `,
      [`drawlytics-benchmark:${normalizedLottery}:${drawDateKey}`],
    );

    const generated = [];
    const skipped = [];

    /*
     * Generate one controlled benchmark prediction
     * from every supported base model.
     */
    for (const strategy of BENCHMARK_STRATEGIES) {
      const expectedModelName = getExpectedModelName(strategy);

      const alreadyExists = await benchmarkPredictionExists(client, {
        lottery: normalizedLottery,
        drawDate: drawDateKey,
        modelName: expectedModelName,
        source: BENCHMARK_SOURCE,
      });

      if (alreadyExists) {
        skipped.push({
          type: 'base_model',
          strategy,
          reason: 'already_exists',
        });

        continue;
      }

      const batch = await generatePredictionBatch({
        lotteryRaw: normalizedLottery,
        strategy,
        lines: 1,
        drawDateRaw: drawDateKey,
      });

      if (!batch.ok) {
        throw new Error(
          `Benchmark generation failed for ${strategy}: ${
            batch.error ?? 'unknown_error'
          }`,
        );
      }

      const line = batch.predictions[0];

      if (dryRun) {
        generated.push({
          type: 'base_model',
          strategy,
          prediction: {
            lottery: batch.lotteryConfig.key,
            draw_date: drawDateKey,
            model_name: line.model_name,
            main_numbers: line.main,
            star_numbers: line.stars,
            confidence: line.confidence,
            user_id: null,
            source: BENCHMARK_SOURCE,
            benchmark_eligible: true,
          },
        });

        continue;
      }

      const savedPrediction = await insertBenchmarkPrediction(
        client,
        batch,
        line,
        BENCHMARK_SOURCE,
      );

      generated.push({
        type: 'base_model',
        strategy,
        prediction: savedPrediction,
      });
    }

    /*
     * Generate the performance-based Strategy Mix.
     * Performance data is restricted to draws before
     * the target draw date.
     */
    const mixAlreadyExists = await suggestedMixExists(client, {
      lottery: normalizedLottery,
      drawDate: drawDateKey,
    });

    let suggestedMix = null;

    if (mixAlreadyExists) {
      skipped.push({
        type: 'strategy_mix',
        strategy: 'strategy_mix',
        reason: 'already_exists',
      });
    } else {
      const mix = await getBenchmarkSuggestedMix({
        lottery: normalizedLottery,
        drawDate: drawDateKey,
      });

      suggestedMix = mix;

      for (const item of mix.plan) {
        const batch = await generatePredictionBatch({
          lotteryRaw: normalizedLottery,
          strategy: item.strategy,
          lines: item.lines,
          drawDateRaw: drawDateKey,
        });

        if (!batch.ok) {
          throw new Error(
            `Suggested mix generation failed for ${
              item.strategy
            }: ${batch.error ?? 'unknown_error'}`,
          );
        }

        for (const line of batch.predictions) {
          if (dryRun) {
            generated.push({
              type: 'strategy_mix',
              strategy: item.strategy,
              weight: item.weight,
              prediction: {
                lottery: batch.lotteryConfig.key,
                draw_date: drawDateKey,
                model_name: line.model_name,
                main_numbers: line.main,
                star_numbers: line.stars,
                confidence: line.confidence,
                user_id: null,
                source: SUGGESTED_MIX_SOURCE,
                benchmark_eligible: true,
              },
            });

            continue;
          }

          const savedPrediction = await insertBenchmarkPrediction(
            client,
            batch,
            line,
            SUGGESTED_MIX_SOURCE,
          );

          generated.push({
            type: 'strategy_mix',
            strategy: item.strategy,
            weight: item.weight,
            prediction: savedPrediction,
          });
        }
      }
    }

    if (dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }

    return {
      ok: true,
      dry_run: dryRun,
      lottery: normalizedLottery,
      draw_date: drawDateKey,
      base_models: BENCHMARK_STRATEGIES.length,
      generated_count: generated.length,
      skipped_count: skipped.length,
      suggested_mix: suggestedMix,
      generated,
      skipped,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
