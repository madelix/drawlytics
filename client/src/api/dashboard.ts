import { apiGetJson } from './apiClient';
import type { LotteryKey } from '../config/lotteries';

export type LatestPlayedResult = {
  lottery: LotteryKey;
  draw_date: string;
  draw_sequence: number;
  checked_lines: number;
  matched_main: number;
  matched_special: number;
};

export async function getLatestPlayedResults(): Promise<LatestPlayedResult[]> {
  const response = await apiGetJson<{
    ok: boolean;
    results: LatestPlayedResult[];
  }>('/api/predictions/latest-result');

  return response.results;
}

type PlayedLinesPage = {
  ok: boolean;
  predictions: import('../pages/MyPredictionsPage').PredictionRow[];
  played_model_counts: {
    model_name: string;
    source: string | null;
    played_count: number;
  }[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
};

export function getPlayedLinesPage(offset = 0): Promise<PlayedLinesPage> {
  const search = new URLSearchParams({
    played: 'true',
    offset: String(offset),
  });

  return apiGetJson<PlayedLinesPage>(`/api/predictions?${search}`);
}

export type PersonalModelPerformanceRow = {
  model_key: string;
  checked_lines: number;
  shared_draws: number;
  compared_line_results: number;
  personal_average: number | null;
  benchmark_average: number | null;
  difference: number | null;
};

export async function getPersonalModelPerformance(
  lottery: LotteryKey,
): Promise<PersonalModelPerformanceRow[]> {
  const search = new URLSearchParams({ lottery });

  const response = await apiGetJson<{
    ok: boolean;
    lottery: LotteryKey;
    models: PersonalModelPerformanceRow[];
  }>(`/api/predictions/personal-performance?${search}`);

  return response.models;
}
