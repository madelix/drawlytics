// client/src/api/draws.ts
import { apiGetJson } from './apiClient';

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

export type EuromillionsDraw = {
  id: number;
  draw_date: string;
  n1: number;
  n2: number;
  n3: number;
  n4: number;
  n5: number;
  s1: number;
  s2: number;
  created_at: string;
};

export type DrawsListResponse = {
  ok: boolean;
  draws: EuromillionsDraw[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  error?: string;
};

export async function getDraws(
  params: { limit?: number; offset?: number } = {},
): Promise<DrawsListResponse> {
  const { limit = 20, offset = 0 } = params;

  const qs = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return apiGetJson<DrawsListResponse>(`/api/draws/all?${qs.toString()}`);
}
