// client/src/api/performance.ts
import { apiGetJson } from './apiClient';

export type ModelPerformanceRow = {
  // ✅ new backend fields
  model_key: string;
  model_display_name: string;

  total_predictions: number;
  checked_predictions: number;

  // returned from Postgres as numeric -> often string in node-postgres
  checked_rate_pct: string;

  avg_main: string;
  avg_stars: string;
  recent_avg_total_hits: string;

  jackpots: number;
  high_hit_predictions: number;
  four_plus_hits: number;
  five_plus_hits: number;
  baseline_wins: number;
  baseline_compared_draws: number;
};

export type ModelsPerformanceResponse = {
  ok: boolean;
  lottery: string;
  models: ModelPerformanceRow[];
};

export async function getModelPerformance(params?: {
  lottery?: string;
}): Promise<ModelsPerformanceResponse> {
  const lottery = params?.lottery ?? 'euromillions';

  const qs = new URLSearchParams();
  qs.set('lottery', lottery);

  return apiGetJson<ModelsPerformanceResponse>(
    `/api/performance/models?${qs.toString()}`,
  );
}

export type ModelHistoryPoint = {
  draw_date: string;
  avg_total_hits: number;
};

export type ModelHistoryResponse = {
  ok: boolean;
  model_key: string;
  baseline_model_key: string;
  history: ModelHistoryPoint[];
  baseline_history: ModelHistoryPoint[];
};

export async function getModelHistory(params: {
  model_key: string;
  lottery?: string;
}): Promise<ModelHistoryResponse> {
  const lottery = params.lottery ?? 'euromillions';

  const qs = new URLSearchParams();
  qs.set('model_key', params.model_key);
  qs.set('lottery', lottery);

  return apiGetJson<ModelHistoryResponse>(
    `/api/performance/model-history?${qs.toString()}`,
  );
}
