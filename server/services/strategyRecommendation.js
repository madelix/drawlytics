export function buildStrategyRecommendation(models) {
  const scoredModels = models
    .map((model) => {
      const avgMain = Number(model.avg_main ?? 0);
      const avgStars = Number(model.avg_stars ?? 0);
      const avgTotal = avgMain + avgStars;

      const recentAvgTotal = Number(model.recent_avg_total_hits ?? avgTotal);

      const checked = Number(model.checked_predictions ?? 0);
      const highHitCount = Number(model.high_hit_predictions ?? 0);
      const fourPlusCount = Number(model.four_plus_hits ?? 0);
      const fivePlusCount = Number(model.five_plus_hits ?? 0);

      const highHitRate = checked > 0 ? highHitCount / checked : 0;
      const fourPlusRate = checked > 0 ? fourPlusCount / checked : 0;
      const fivePlusRate = checked > 0 ? fivePlusCount / checked : 0;

      const sampleFactor = Math.min(1, checked / 20);

      const consistencyScore =
        (avgTotal * 0.6 + highHitRate * 0.4) * sampleFactor;

      const baselineWins = Number(model.baseline_wins ?? 0);
      const baselineCompared = Number(model.baseline_compared_draws ?? 0);

      const baselineWinRate =
        baselineCompared > 0 ? baselineWins / baselineCompared : 0;

      const baselineSampleFactor = Math.min(1, baselineCompared / 20);

      const baselineWeightedScore = baselineWinRate * baselineSampleFactor;

      const delta = recentAvgTotal - avgTotal;

      const strategyScore =
        consistencyScore * 0.4 +
        baselineWeightedScore * 0.4 +
        Math.max(0, delta) * 0.2;

      return {
        model_key: model.model_key,
        strategy_score: strategyScore,
      };
    })
    .filter(
      (model) =>
        model.model_key !== 'pure_random' && model.model_key !== 'strategy_mix',
    )
    .sort((a, b) => b.strategy_score - a.strategy_score)
    .slice(0, 3);

  const totalScore = scoredModels.reduce(
    (sum, model) => sum + model.strategy_score,
    0,
  );

  return scoredModels.map((model) => ({
    model_key: model.model_key,
    weight: totalScore > 0 ? model.strategy_score / totalScore : 0,
  }));
}
