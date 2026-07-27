// client/src/api/draws.ts
import { apiGetJson } from './apiClient';
import type { LotteryKey } from '../config/lotteries';

export type LatestDrawResponse = {
  ok: boolean;
  draw?: {
    id: number;
    draw_date: string;
    numbers: number[];
    stars: number[];
    raw: Record<string, unknown>;
  } | null;
  error?: string;
};

export async function getLatestDraw(): Promise<LatestDrawResponse> {
  return apiGetJson<LatestDrawResponse>('/api/draws/latest');
}

export type LotteryDraw = {
  id: number;
  draw_date: string;
  draw_sequence?: number;
  n1: number;
  n2: number;
  n3: number;
  n4: number;
  n5: number;
  n6?: number | null;
  s1?: number | null;
  s2?: number | null;
  bonus_ball?: number | null;
  life_ball?: number | null;
  created_at: string;
};

export type DrawsListResponse = {
  ok: boolean;
  draws: LotteryDraw[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  error?: string;
};

export async function getDraws(
  params: {
    limit?: number;
    offset?: number;
    lottery?: LotteryKey;
  } = {},
): Promise<DrawsListResponse> {
  const { limit = 20, offset = 0, lottery = 'euromillions' } = params;

  const qs = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    lottery,
  });
  console.log('All draws query:', qs.toString());
  return apiGetJson<DrawsListResponse>(`/api/draws/all?${qs.toString()}`);
}
