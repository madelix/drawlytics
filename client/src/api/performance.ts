// client/src/api/performance.ts
import { apiGetJson } from './apiClient';

export type ModelPerformanceRow = {
  model_name: string;

  total_predictions: number;
  checked_predictions: number;

  // returned from Postgres as numeric -> often string in node-postgres
  checked_rate_pct: string;

  avg_main: string;
  avg_stars: string;

  jackpots: number;
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
