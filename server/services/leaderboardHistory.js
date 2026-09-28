// server/services/leaderboardHistory.js

import { getBenchmarkDrawModelScores } from './benchmarkEvidenceData.js';

export async function buildLeaderboardHistory(
  lottery,
  allowedModelKeys = null,
) {
  const allDrawModelScores = await getBenchmarkDrawModelScores(lottery);

  const drawModelScores =
    allowedModelKeys instanceof Set
      ? allDrawModelScores.filter((row) => allowedModelKeys.has(row.model_key))
      : allDrawModelScores;

  const scoresByDraw = new Map();

  for (const row of drawModelScores) {
    const drawKey = `${row.draw_date}:${row.draw_sequence ?? 1}`;

    const drawScores = scoresByDraw.get(drawKey) ?? [];

    drawScores.push(row);

    scoresByDraw.set(drawKey, drawScores);
  }

  const cumulativeStats = new Map();
  const history = [];

  for (const [drawKey, drawScores] of scoresByDraw.entries()) {
    for (const score of drawScores) {
      const current = cumulativeStats.get(score.model_key) ?? {
        totalDrawScore: 0,
        evaluatedDraws: 0,
      };

      current.totalDrawScore += Number(score.avg_total_hits ?? 0);

      current.evaluatedDraws += 1;

      cumulativeStats.set(score.model_key, current);
    }

    const rankedModels = [...cumulativeStats.entries()]
      .map(([modelKey, stats]) => ({
        model_key: modelKey,

        avg_total_hits:
          stats.evaluatedDraws > 0
            ? stats.totalDrawScore / stats.evaluatedDraws
            : 0,

        checked_predictions: stats.evaluatedDraws,
      }))
      .sort(
        (a, b) =>
          b.avg_total_hits - a.avg_total_hits ||
          b.checked_predictions - a.checked_predictions ||
          a.model_key.localeCompare(b.model_key),
      );

    const leader = rankedModels[0];

    if (!leader) {
      continue;
    }

    const [drawDate, drawSequenceRaw] = drawKey.split(':');

    const drawSequence = Number(drawSequenceRaw || 1);

    history.push({
      draw_date: drawDate,
      draw_sequence: drawSequence,

      leader_model_key: leader.model_key,

      leader_avg_total_hits: leader.avg_total_hits,

      /*
       * Kept for API compatibility.
       * This now represents evaluated draws,
       * not raw prediction lines.
       */
      leader_checked_predictions: leader.checked_predictions,
    });
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
