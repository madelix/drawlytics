import { pool } from '../db.js';
import { normalizeModelKey } from '../modelNormalization.js';
import { getBenchmarkDrawModelScores } from './benchmarkEvidenceData.js';

export async function getPersonalPlayedResults(userId, lottery) {
  const { rows } = await pool.query(
    `
    SELECT
      p.id AS prediction_id,
      p.model_name,
      p.source,
      r.draw_date,
      r.draw_sequence,
      r.matched_main,
      r.matched_special
    FROM predictions p
    JOIN prediction_draw_results r ON r.prediction_id = p.id
    WHERE p.user_id = $1
      AND LOWER(p.lottery) = LOWER($2)
      AND LOWER(TRIM(p.status)) = 'checked'
      AND EXISTS (
        SELECT 1
        FROM played_predictions played
        WHERE played.prediction_id = p.id
      )
    ORDER BY r.draw_date, r.draw_sequence, p.id
    `,
    [userId, lottery],
  );

  return rows;
}

export function comparePersonalModelScores(
  personalRows,
  benchmarkScores,
  normalizeModelKey,
) {
  const scoresByDraw = new Map(
    benchmarkScores.map((score) => [
      `${score.model_key}:${score.draw_date}:${score.draw_sequence}`,
      score.avg_total_hits,
    ]),
  );

  const models = new Map();

  for (const row of personalRows) {
    const modelKey = normalizeModelKey(row.model_name, row.source);
    const date = new Date(row.draw_date).toISOString().slice(0, 10);
    const drawKey = `${modelKey}:${date}:${row.draw_sequence ?? 1}`;
    const benchmark = scoresByDraw.get(drawKey);

    if (!models.has(modelKey)) {
      models.set(modelKey, {
        checkedLines: new Set(),
        sharedDraws: new Map(),
        personalHits: 0,
        comparedResults: 0,
      });
    }

    const model = models.get(modelKey);
    model.checkedLines.add(row.prediction_id);

    if (benchmark === undefined) continue;

    model.sharedDraws.set(drawKey, benchmark);
    model.personalHits +=
      Number(row.matched_main) + Number(row.matched_special);
    model.comparedResults += 1;
  }

  return Array.from(models, ([model_key, model]) => {
    const sharedDraws = model.sharedDraws.size;
    const personalAverage = sharedDraws
      ? model.personalHits / model.comparedResults
      : null;
    const benchmarkAverage = sharedDraws
      ? Array.from(model.sharedDraws.values()).reduce(
          (sum, hits) => sum + hits,
          0,
        ) / sharedDraws
      : null;

    return {
      model_key,
      checked_lines: model.checkedLines.size,
      shared_draws: sharedDraws,
      compared_line_results: model.comparedResults,
      personal_average: personalAverage,
      benchmark_average: benchmarkAverage,
      difference: sharedDraws ? personalAverage - benchmarkAverage : null,
    };
  });
}

export async function getPersonalModelPerformance(userId, lottery) {
  const personalRows = await getPersonalPlayedResults(userId, lottery);

  if (personalRows.length === 0) return [];

  const benchmarkScores = await getBenchmarkDrawModelScores(lottery);

  return comparePersonalModelScores(
    personalRows,
    benchmarkScores,
    normalizeModelKey,
  );
}
