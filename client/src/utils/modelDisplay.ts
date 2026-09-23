export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  strategy_mix: 'Strategy Mix',

  balanced_hot_cold: 'Balanced Hot/Cold',
  hot_focused: 'Hot Focused',
  cold_focused: 'Cold Focused',
  overdue: 'Overdue',

  pure_random: 'Pure Random',

  ai_statistical_analysis: 'Statistical Recency Heuristic',
  ai_bayesian: 'Bayesian Frequency Heuristic',
  ai_markov_chain: 'Markov Transition Heuristic',
  ai_random_forest: 'Recency Frequency Heuristic',
  ai_gradient_boosting: 'Trend Boost Heuristic',
  ai_decision_tree: 'Decision Zone Heuristic',
  ai_q_learning: 'Reward Zone Heuristic',
  ai_neural_network: 'Neural Pattern Heuristic',
  ai_lstm: 'Sequence Memory Heuristic',

  ai_ensemble: 'Heuristic Ensemble',
  ai_meta_learning: 'Adaptive Heuristic Blend',

  ai_xgboost: 'Legacy XGBoost (Heuristic)',
  xgboost_v2: 'XGBoost v2',

  ai_advanced_analysis: 'Legacy Advanced Analysis',
};

export function normalizeModelKey(
  rawModelName: string,
  source?: string | null,
) {
  if (source === 'strategy_mix' || source === 'benchmark_strategy_mix') {
    return 'strategy_mix';
  }

  const raw = String(rawModelName ?? '')
    .trim()
    .toLowerCase();

  if (!raw) return 'unknown';

  /*
   * Genuine trained models keep their own stable identities.
   * XGBoost v2 must never be normalized into the historical
   * heuristic XGBoost key.
   */
  if (raw === 'xgboost_v2') {
    return 'xgboost_v2';
  }

  if (raw.startsWith('make_magic:')) {
    return raw.replace('make_magic:', '').replace(/:/g, '_').trim();
  }

  /*
   * Historical ai:* identities remain stable so existing
   * prediction history continues to normalize correctly.
   */
  if (raw.startsWith('ai:')) {
    return raw.replace('ai:', 'ai_').replace(/:/g, '_').trim();
  }

  if (raw.includes('cold-focused generator')) {
    return 'cold_focused';
  }

  if (raw.includes('hot-focused generator')) {
    return 'hot_focused';
  }

  if (raw.includes('balanced hot/cold generator')) {
    return 'balanced_hot_cold';
  }

  if (raw.includes('pure random generator')) {
    return 'pure_random';
  }

  if (raw.includes('overdue-focused generator')) {
    return 'overdue';
  }

  return raw
    .replace(/\s+generator$/i, '')
    .replace(/-focused/g, '')
    .replace(/:/g, '_')
    .replace(/\s+/g, '_')
    .trim();
}

export function getModelDisplayName(
  rawModelName: string,
  source?: string | null,
) {
  const key = normalizeModelKey(rawModelName, source);

  return (
    MODEL_DISPLAY_NAMES[key] ??
    String(rawModelName || '')
      .replace(/^make_magic:/i, '')
      .replace(/^ai:/i, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim()
  );
}

export function getShortModelDisplayName(
  rawModelName: string,
  source?: string | null,
) {
  const displayName = getModelDisplayName(rawModelName, source);

  return displayName
    .replace('Balanced Hot/Cold', 'Balanced')
    .replace('Cold Focused', 'Cold')
    .replace('Hot Focused', 'Hot')
    .replace('Pure Random', 'Random');
}
