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
