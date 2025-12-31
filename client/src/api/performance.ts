// client/src/api/performance.ts
import { apiGetJson } from './apiClient';

export type ModelPerformanceRow = {
  model_name: string;
  total: number;
  checked: number;
  hit_rate_any: number; // %
  avg_main_hits: number;
  avg_star_hits: number;
  main_2plus: number;
  main_3plus: number;
  main_4plus: number;
  main_5: number;
  avg_saved_confidence: number; // %
  last_created_at: string | null;
};

export type ModelsPerformanceResponse = {
  ok: boolean;
  lottery: string;
  limit: number;
  models: ModelPerformanceRow[];
};

function clampInt(n: unknown, fallback: number, min: number, max: number) {
  const x = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(x)));
}

export async function getModelPerformance(params?: {
  lottery?: string;
  limit?: number;
}): Promise<ModelsPerformanceResponse> {
  const lottery = params?.lottery ?? 'euromillions';
  const limit = clampInt(params?.limit ?? 500, 500, 1, 5000);

  const qs = new URLSearchParams();
  qs.set('lottery', lottery);
  qs.set('limit', String(limit));

  return apiGetJson<ModelsPerformanceResponse>(
    `/api/performance/models?${qs.toString()}`,
  );
}
