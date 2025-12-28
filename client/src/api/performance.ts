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

export async function getModelPerformance(params?: {
  lottery?: string;
  limit?: number;
}): Promise<ModelsPerformanceResponse> {
  const lottery = params?.lottery ?? 'euromillions';
  const limit = params?.limit ?? 500;

  const qs = new URLSearchParams({
    lottery,
    limit: String(limit),
  });

  return apiGetJson<ModelsPerformanceResponse>(
    `/api/performance/models?${qs.toString()}`,
  );
}
