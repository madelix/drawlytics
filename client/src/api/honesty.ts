import { apiGetJson } from './apiClient';

export type HonestySummary = {
  headline: string;
  current_leader: string | null;
  evidence_level: string;
  checked_predictions: number;
  models_analysed: number;
  leader_avg_total_hits: number | null;
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
