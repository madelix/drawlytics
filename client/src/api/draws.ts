// client/src/api/draws.ts

// Fix: use `(import.meta as any).env` so TS stops complaining about ImportMeta.env
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '';

export type LatestDrawResponse = {
  ok: boolean;
  draw?: {
    id: number;
    draw_date: string;
    numbers: number[];
    stars: number[];
    raw: Record<string, unknown>;
  };
  error?: string;
};

export async function getLatestDraw(): Promise<LatestDrawResponse> {
  const res = await fetch(`${API_BASE}/api/draws/latest`);

  if (!res.ok) {
    throw new Error(
      `Failed to fetch latest draw: ${res.status} ${res.statusText}`,
    );
  }

  const data = (await res.json()) as LatestDrawResponse;
  return data;
}

// ---------- NEW: list types + getDraws ----------

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
  params: {
    limit?: number;
    offset?: number;
  } = {},
): Promise<DrawsListResponse> {
  const { limit = 20, offset = 0 } = params;

  // Build full API URL using the API base, NOT window.location.origin
  const url = new URL(`${API_BASE}/api/draws/all`);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(`Failed to fetch draws: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as DrawsListResponse;
  return data;
}
