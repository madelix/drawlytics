const MODEL_COLOURS: Record<string, string> = {
  balanced_hot_cold: '#7C3AED',
  hot_focused: '#EF4444',
  cold_focused: '#2563EB',
  overdue: '#F97316',
  strategy_mix: '#6D28D9',
  pure_random: '#22C55E',

  ai_xgboost: '#EC4899',
  ai_ensemble: '#8B5CF6',
  ai_random_forest: '#10B981',
  ai_gradient_boosting: '#EF4444',
  ai_statistical_analysis: '#0EA5E9',
  ai_decision_tree: '#F59E0B',
  ai_q_learning: '#14B8A6',
  ai_neural_network: '#7C3AED',
  ai_lstm: '#2563EB',
  ai_markov_chain: '#84CC16',
  ai_bayesian: '#F59E0B',
  ai_meta_learning: '#A855F7',
  ai_advanced_analysis: '#6366F1',
};

export function normalizeModelPresentationKey(modelKey: string): string {
  return modelKey
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/^ai:/, 'ai_');
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createFallbackModelColour(modelKey: string): string {
  const hash = hashString(modelKey);
  const hue = 220 + (hash % 90);
  const saturation = 62 + (hash % 10);
  const lightness = 46 + (hash % 10);

  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

export function getModelColour(modelKey: string): string {
  const normalizedKey = normalizeModelPresentationKey(modelKey);

  return (
    MODEL_COLOURS[normalizedKey] ?? createFallbackModelColour(normalizedKey)
  );
}
