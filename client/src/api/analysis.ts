// client/src/api/analysis.ts

// Use (import.meta as any) to avoid TS typing issues with env
const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:3000';

// Basic number → count shape
export type NumberCount = {
  number: number;
  count: number;
};

// /api/frequency/latest-n response
export type FrequencyLatestNResponse = {
  ok: boolean;
  main: NumberCount[];
  stars: NumberCount[];
  requestedN: number;
  totalDrawsConsidered: number;
};

// /api/hot-cold response shapes
export type HotColdGroup = {
  main: NumberCount[];
  stars: NumberCount[];
};

export type HotColdResponse = {
  ok: boolean;
  requestedN: number;
  totalDrawsConsidered: number;
  top: number;
  hot: HotColdGroup;
  cold: HotColdGroup;
};

export async function getFrequencyLatestN(
  n: number,
): Promise<FrequencyLatestNResponse> {
  const url = `${API_BASE}/api/frequency/latest-n?n=${encodeURIComponent(
    String(n),
  )}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch latest-n frequency (status ${res.status})`,
    );
  }
  return res.json();
}

export async function getHotCold(
  n: number,
  top: number,
): Promise<HotColdResponse> {
  const url = `${API_BASE}/api/hot-cold?n=${encodeURIComponent(
    String(n),
  )}&top=${encodeURIComponent(String(top))}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch hot/cold numbers (status ${res.status})`);
  }
  return res.json();
}
