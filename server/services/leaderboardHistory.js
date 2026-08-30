import { pool } from '../db.js';
import { normalizeModelKey } from '../modelNormalization.js';

export async function buildLeaderboardHistory(lottery) {
  const { rows } = await pool.query(
    `
  SELECT
    pdr.draw_date,
    pdr.draw_sequence,
    p.model_name,
    pdr.matched_main,
    pdr.matched_special AS matched_stars
  FROM prediction_draw_results pdr
  INNER JOIN predictions p
    ON p.id = pdr.prediction_id
  WHERE LOWER(p.lottery) = LOWER($1)
  AND p.benchmark_eligible = true
  AND LOWER(TRIM(p.status)) = 'checked'
  ORDER BY pdr.draw_date ASC, pdr.draw_sequence ASC;
  `,
    [lottery],
  );

  const predictionsByDraw = new Map();

  for (const row of rows) {
    const drawDate = new Date(row.draw_date).toISOString().slice(0, 10);
    const drawKey = `${drawDate}:${row.draw_sequence ?? 1}`;
    const modelKey = normalizeModelKey(row.model_name);
    const totalHits =
      Number(row.matched_main ?? 0) + Number(row.matched_stars ?? 0);

    const drawPredictions = predictionsByDraw.get(drawKey) ?? [];

    drawPredictions.push({
      model_key: modelKey,
      total_hits: totalHits,
    });

    predictionsByDraw.set(drawKey, drawPredictions);
  }

  const cumulativeStats = new Map();
  const history = [];

  for (const [drawKey, drawPredictions] of predictionsByDraw.entries()) {
    for (const prediction of drawPredictions) {
      const current = cumulativeStats.get(prediction.model_key) ?? {
        totalHits: 0,
        predictionCount: 0,
      };

      current.totalHits += prediction.total_hits;
      current.predictionCount += 1;

      cumulativeStats.set(prediction.model_key, current);
    }

    const rankedModels = [...cumulativeStats.entries()]
      .map(([modelKey, stats]) => ({
        model_key: modelKey,
        avg_total_hits: stats.totalHits / stats.predictionCount,
        checked_predictions: stats.predictionCount,
      }))
      .sort(
        (a, b) =>
          b.avg_total_hits - a.avg_total_hits ||
          b.checked_predictions - a.checked_predictions ||
          a.model_key.localeCompare(b.model_key),
      );

    const leader = rankedModels[0];

    if (leader) {
      const [drawDate, drawSequenceRaw] = drawKey.split(':');
      const drawSequence = Number(drawSequenceRaw || 1);

      history.push({
        draw_date: drawDate,
        draw_sequence: drawSequence,
        leader_model_key: leader.model_key,
        leader_avg_total_hits: leader.avg_total_hits,
        leader_checked_predictions: leader.checked_predictions,
      });
    }
  }

  return history;
}

export function analyseLeaderStability(history) {
  if (!history.length) {
    return {
      current_leader_key: null,
      consecutive_draws: 0,
      leader_changes_last_20: 0,
      evaluated_draws: 0,
    };
  }

  const currentLeaderKey = history[history.length - 1].leader_model_key;

  let consecutiveDraws = 0;

  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].leader_model_key !== currentLeaderKey) {
      break;
    }

    consecutiveDraws += 1;
  }

  const recentHistory = history.slice(-20);
  let leaderChangesLast20 = 0;

  for (let index = 1; index < recentHistory.length; index += 1) {
    if (
      recentHistory[index].leader_model_key !==
      recentHistory[index - 1].leader_model_key
    ) {
      leaderChangesLast20 += 1;
    }
  }

  return {
    current_leader_key: currentLeaderKey,
    consecutive_draws: consecutiveDraws,
    leader_changes_last_20: leaderChangesLast20,
    evaluated_draws: history.length,
  };
}
