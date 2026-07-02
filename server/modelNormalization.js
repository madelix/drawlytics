// server/modelNormalization.js

export function normalizeModelKey(rawModelName, source = null) {
  if (source === 'strategy_mix') return 'strategy_mix';

  const raw = String(rawModelName ?? '')
    .trim()
    .toLowerCase();

  if (!raw) return 'unknown';

  if (raw.startsWith('make_magic:')) {
    return raw.replace('make_magic:', '').replace(/:/g, '_').trim();
  }

  if (raw.startsWith('ai:')) {
    return raw.replace('ai:', 'ai_').replace(/:/g, '_').trim();
  }

  if (raw.includes('cold-focused generator')) return 'cold_focused';
  if (raw.includes('hot-focused generator')) return 'hot_focused';
  if (raw.includes('balanced hot/cold generator')) return 'balanced_hot_cold';
  if (raw.includes('pure random generator')) return 'pure_random';
  if (raw.includes('overdue-focused generator')) return 'overdue';

  return raw
    .replace(/\s+generator$/i, '')
    .replace(/-focused/g, '')
    .replace(/:/g, '_')
    .replace(/\s+/g, '_')
    .trim();
}

export function getModelDisplayName(modelKey) {
  const key = String(modelKey ?? '').trim();

  const names = {
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
    ai_markov_chain: 'AI Markov Chain',
    ai_meta_learning: 'AI Meta Learning',
    ai_lstm: 'AI LSTM',
    ai_bayesian: 'AI Bayesian',
  };

  return (
    names[key] ??
    key
      .replace(/^make_magic_/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}
