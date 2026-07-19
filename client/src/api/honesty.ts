import { apiGetJson } from './apiClient';

export type HonestySummary = {
  headline: string;
  current_leader: string | null;
  evidence_level: string;
  checked_predictions: number;
  models_analysed: number;
  leader_avg_total_hits: number | null;

  findings: {
    id: string;
    type: 'info' | 'positive' | 'warning';
    category: string;
    priority: number;
    title: string;
  }[];
};

export type HonestySummaryResponse = {
  ok: boolean;
  lottery: string;
  summary: HonestySummary;
};

export async function getHonestySummary(params: {
  lottery: string;
}): Promise<HonestySummaryResponse> {
  const search = new URLSearchParams({
    lottery: params.lottery,
  });

  return apiGetJson<HonestySummaryResponse>(
    `/api/performance/honesty-summary?${search.toString()}`,
  );
}

export type RandomComparison = {
  strongest_model_key: string;
  strongest_model_name: string;
  strongest_model_avg_hits: number;
  pure_random_avg_hits: number;
  difference: number;
  percentage_difference: number | null;
};

export type RandomComparisonResponse = {
  ok: boolean;
  lottery: string;
  comparison: RandomComparison | null;
};

export async function getRandomComparison(params: {
  lottery: string;
}): Promise<RandomComparisonResponse> {
  const search = new URLSearchParams({
    lottery: params.lottery,
  });

  return apiGetJson<RandomComparisonResponse>(
    `/api/performance/random-comparison?${search.toString()}`,
  );
}
