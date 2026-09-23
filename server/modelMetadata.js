// server/modelMetadata.js

/*
 * Canonical Drawlytics model registry.
 *
 * IMPORTANT:
 * The registry key is the stable canonical identity used by Drawlytics.
 * Historical keys must not be renamed merely to improve display wording,
 * because doing so could fragment historical benchmark evidence.
 *
 * `displayName` describes the implementation truthfully.
 * `legacyName` preserves the older user-facing identity where relevant.
 */

export const MODEL_REGISTRY = {
  strategy_mix: {
    displayName: 'Strategy Mix',
    category: 'meta_portfolio',
    implementation: 'performance_weighted_portfolio',
    trained: false,
    legacy: false,
  },

  balanced_hot_cold: {
    displayName: 'Balanced Hot/Cold',
    category: 'strategy',
    implementation: 'frequency_balanced_sampling',
    trained: false,
    legacy: false,
  },

  hot_focused: {
    displayName: 'Hot Focused',
    category: 'strategy',
    implementation: 'frequency_weighted_sampling',
    trained: false,
    legacy: false,
  },

  cold_focused: {
    displayName: 'Cold Focused',
    category: 'strategy',
    implementation: 'inverse_frequency_sampling',
    trained: false,
    legacy: false,
  },

  overdue: {
    displayName: 'Overdue',
    category: 'strategy',
    implementation: 'draw_gap_weighted_sampling',
    trained: false,
    legacy: false,
  },

  pure_random: {
    displayName: 'Pure Random',
    category: 'control',
    implementation: 'uniform_random_sampling',
    trained: false,
    legacy: false,
  },

  ai_statistical_analysis: {
    displayName: 'Statistical Recency Heuristic',
    legacyName: 'AI Statistical Analysis',
    category: 'strategy',
    implementation: 'frequency_recency_heuristic',
    trained: false,
    legacy: true,
  },

  ai_bayesian: {
    displayName: 'Bayesian Frequency Heuristic',
    legacyName: 'AI Bayesian',
    category: 'strategy',
    implementation: 'smoothed_frequency_heuristic',
    trained: false,
    legacy: true,
  },

  ai_markov_chain: {
    displayName: 'Markov Transition Heuristic',
    legacyName: 'AI Markov Chain',
    category: 'strategy',
    implementation: 'transition_distance_heuristic',
    trained: false,
    legacy: true,
  },

  ai_random_forest: {
    displayName: 'Recency Frequency Heuristic',
    legacyName: 'AI Random Forest',
    category: 'strategy',
    implementation: 'recency_frequency_heuristic',
    trained: false,
    legacy: true,
  },

  ai_gradient_boosting: {
    displayName: 'Trend Boost Heuristic',
    legacyName: 'AI Gradient Boosting',
    category: 'strategy',
    implementation: 'recency_trend_heuristic',
    trained: false,
    legacy: true,
  },

  ai_decision_tree: {
    displayName: 'Decision Zone Heuristic',
    legacyName: 'AI Decision Tree',
    category: 'strategy',
    implementation: 'range_bonus_recency_heuristic',
    trained: false,
    legacy: true,
  },

  ai_q_learning: {
    displayName: 'Reward Zone Heuristic',
    legacyName: 'AI Q-Learning',
    category: 'strategy',
    implementation: 'reward_zone_recency_heuristic',
    trained: false,
    legacy: true,
  },

  ai_neural_network: {
    displayName: 'Neural Pattern Heuristic',
    legacyName: 'AI Neural Network',
    category: 'strategy',
    implementation: 'recency_position_signal_heuristic',
    trained: false,
    legacy: true,
  },

  ai_lstm: {
    displayName: 'Sequence Memory Heuristic',
    legacyName: 'AI LSTM',
    category: 'strategy',
    implementation: 'recency_memory_heuristic',
    trained: false,
    legacy: true,
  },

  ai_ensemble: {
    displayName: 'Heuristic Ensemble',
    legacyName: 'AI Ensemble',
    category: 'meta_portfolio',
    implementation: 'multi_heuristic_weight_merge',
    trained: false,
    legacy: true,
  },

  ai_meta_learning: {
    displayName: 'Adaptive Heuristic Blend',
    legacyName: 'AI Meta Learning',
    category: 'meta_portfolio',
    implementation: 'fixed_heuristic_blend_with_exploration',
    trained: false,
    legacy: true,
  },

  ai_xgboost: {
    displayName: 'Legacy XGBoost (Heuristic)',
    legacyName: 'AI XGBoost',
    category: 'strategy',
    implementation: 'legacy_recency_frequency_heuristic',
    trained: false,
    legacy: true,
    retired: true,
  },

  xgboost_v2: {
    displayName: 'XGBoost v2',
    category: 'trained_model',
    implementation: 'xgboost_classifier',
    trained: true,
    legacy: false,
    prospective: true,
  },

  ai_advanced_analysis: {
    displayName: 'Legacy Advanced Analysis',
    legacyName: 'AI Advanced Analysis',
    category: 'strategy',
    implementation: 'legacy_unknown',
    trained: false,
    legacy: true,
  },
};

export const MODEL_DISPLAY_NAMES = Object.fromEntries(
  Object.entries(MODEL_REGISTRY).map(([key, metadata]) => [
    key,
    metadata.displayName,
  ]),
);

export const MODEL_KEYS = Object.keys(MODEL_REGISTRY);

export function getModelMetadata(modelKey) {
  return MODEL_REGISTRY[modelKey] ?? null;
}

export function getModelDisplayName(modelKey) {
  return (
    MODEL_REGISTRY[modelKey]?.displayName ??
    String(modelKey || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim()
  );
}
