// server/modelNormalization.js

import { getModelDisplayName as getRegistryModelDisplayName } from './modelMetadata.js';

export function normalizeModelKey(rawModelName, source = null) {
  if (source === 'strategy_mix' || source === 'benchmark_strategy_mix') {
    return 'strategy_mix';
  }

  const raw = String(rawModelName ?? '')
    .trim()
    .toLowerCase();

  if (!raw) return 'unknown';

  /*
   * Genuine trained models have their own stable identities.
   * These must never be normalized into historical heuristic keys.
   */
  if (raw === 'xgboost_v2') {
    return 'xgboost_v2';
  }

  /*
   * Current Make Magic identities.
   */
  if (raw.startsWith('make_magic:')) {
    return raw.replace('make_magic:', '').replace(/:/g, '_').trim();
  }

  /*
   * Historical ai:* identities.
   *
   * These keys are deliberately preserved because historical benchmark
   * evidence already uses them. Their truthful implementation metadata
   * lives in modelMetadata.js.
   */
  if (raw.startsWith('ai:')) {
    return raw.replace('ai:', 'ai_').replace(/:/g, '_').trim();
  }

  /*
   * Older human-readable generator names.
   */
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

/*
 * Preserve the existing public API so current imports throughout
 * Drawlytics continue to work.
 *
 * Display-name ownership now lives in modelMetadata.js.
 */
export function getModelDisplayName(modelKey) {
  return getRegistryModelDisplayName(modelKey);
}
