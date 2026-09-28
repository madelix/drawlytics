// server/services/benchmarkEvidenceData.js

import { pool } from '../db.js';
import { normalizeModelKey } from '../modelNormalization.js';

/*
 * Return canonical benchmark evidence at the model-per-draw level.
 *
 * This is the fair comparison unit used by global Drawlytics evidence:
 *
 * - personal predictions are excluded;
 * - only checked predictions are included;
 * - Strategy Mix is identified by source;
 * - multiple lines from the same model on the same draw are averaged;
 * - every model therefore contributes at most one score per draw.
 */
export async function getBenchmarkDrawModelScores(
  lottery,
  beforeDrawDate = null,
) {
  const { rows } = await pool.query(
    `
    SELECT
      p.model_name,
      p.source,
      pdr.draw_date,
      pdr.draw_sequence,
      pdr.matched_main,
      pdr.matched_special AS matched_special
    FROM predictions p
    INNER JOIN prediction_draw_results pdr
      ON pdr.prediction_id = p.id
    WHERE LOWER(p.lottery) = LOWER($1)
      AND p.benchmark_eligible = true
      AND LOWER(TRIM(p.status)) = 'checked'
      AND (
        $2::date IS NULL
        OR pdr.draw_date < $2::date
      )
    ORDER BY
      pdr.draw_date ASC,
      pdr.draw_sequence ASC,
      p.id ASC
    `,
    [lottery, beforeDrawDate],
  );

  const draws = new Map();

  for (const row of rows) {
    const drawDate = new Date(row.draw_date).toISOString().slice(0, 10);

    const drawSequence = Number(row.draw_sequence ?? 1);

    const drawKey = `${drawDate}:${drawSequence}`;

    const modelKey = normalizeModelKey(row.model_name, row.source);

    const drawModels = draws.get(drawKey) ?? new Map();

    const current = drawModels.get(modelKey) ?? {
      mainHits: 0,
      specialHits: 0,
      totalHits: 0,
      predictionCount: 0,
    };

    const mainHits = Number(row.matched_main ?? 0);

    const specialHits = Number(row.matched_special ?? 0);

    current.mainHits += mainHits;
    current.specialHits += specialHits;
    current.totalHits += mainHits + specialHits;

    current.predictionCount += 1;

    drawModels.set(modelKey, current);

    draws.set(drawKey, drawModels);
  }

  const scores = [];

  for (const [drawKey, drawModels] of draws.entries()) {
    const [drawDate, drawSequenceRaw] = drawKey.split(':');

    const drawSequence = Number(drawSequenceRaw || 1);

    for (const [modelKey, stats] of drawModels.entries()) {
      const denominator = Math.max(stats.predictionCount, 1);

      scores.push({
        draw_date: drawDate,
        draw_sequence: drawSequence,
        model_key: modelKey,

        avg_main_hits: stats.mainHits / denominator,

        avg_special_hits: stats.specialHits / denominator,

        avg_total_hits: stats.totalHits / denominator,

        prediction_count: stats.predictionCount,
      });
    }
  }

  return scores;
}

/*
 * Aggregate draw-level evidence into one summary per model.
 *
 * `evaluated_draws` is deliberately distinct from raw prediction count.
 * A Strategy Mix with several lines on one draw still contributes one
 * evaluated draw.
 */
export function summarizeBenchmarkModelScores(drawModelScores) {
  const totals = new Map();

  for (const row of drawModelScores) {
    const current = totals.get(row.model_key) ?? {
      totalMainHits: 0,
      totalSpecialHits: 0,
      totalHits: 0,
      evaluatedDraws: 0,
    };

    current.totalMainHits += Number(row.avg_main_hits ?? 0);

    current.totalSpecialHits += Number(row.avg_special_hits ?? 0);

    current.totalHits += Number(row.avg_total_hits ?? 0);

    current.evaluatedDraws += 1;

    totals.set(row.model_key, current);
  }

  return [...totals.entries()].map(([modelKey, stats]) => ({
    model_key: modelKey,

    evaluated_draws: stats.evaluatedDraws,

    avg_main_hits:
      stats.evaluatedDraws > 0 ? stats.totalMainHits / stats.evaluatedDraws : 0,

    avg_special_hits:
      stats.evaluatedDraws > 0
        ? stats.totalSpecialHits / stats.evaluatedDraws
        : 0,

    avg_total_hits:
      stats.evaluatedDraws > 0 ? stats.totalHits / stats.evaluatedDraws : 0,
  }));
}
