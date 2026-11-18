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
