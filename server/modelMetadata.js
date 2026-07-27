// server/modelMetadata.js

export const MODEL_DISPLAY_NAMES = {
  strategy_mix: 'Strategy Mix',
  cold_focused: 'Cold Focused',
  hot_focused: 'Hot Focused',
  balanced_hot_cold: 'Balanced Hot/Cold',
  pure_random: 'Pure Random',
  overdue: 'Overdue',

  ai_ensemble: 'AI Ensemble',
  ai_statistical_analysis: 'AI Statistical Analysis',
  ai_random_forest: 'AI Random Forest',
  ai_decision_tree: 'AI Decision Tree',
  ai_gradient_boosting: 'AI Gradient Boosting',
  ai_xgboost: 'AI XGBoost',
  ai_q_learning: 'AI Q-Learning',
  ai_advanced_analysis: 'AI Advanced Analysis',
  ai_neural_network: 'AI Neural Network',
  ai_lstm: 'AI LSTM',
  ai_bayesian: 'AI Bayesian',
  ai_markov_chain: 'AI Markov Chain',
  ai_meta_learning: 'AI Meta Learning',
};

export const MODEL_KEYS = Object.keys(MODEL_DISPLAY_NAMES);

export function getModelDisplayName(modelKey) {
  return (
    MODEL_DISPLAY_NAMES[modelKey] ??
    String(modelKey || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim()
  );
}
