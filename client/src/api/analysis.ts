// client/src/api/analysis.ts
import { apiUrl } from './apiClient';

/* ---------- Shared types ---------- */

export type NumberCount = {
  number: number;
  count: number;
};

/* ---------- Frequency: latest N draws ---------- */

export type FrequencyLatestNResponse = {
  ok: boolean;
  main: NumberCount[];
  stars: NumberCount[];
  requestedN: number;
  totalDrawsConsidered: number;
  error?: string;
};

export async function getFrequencyLatestN(
  n: number,
): Promise<FrequencyLatestNResponse> {
  const res = await fetch(apiUrl(`/api/frequency/latest-n?n=${n}`));

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to fetch frequency latest-n: ${res.status} ${text || res.statusText}`,
    );
  }

  return (await res.json()) as FrequencyLatestNResponse;
}

/* ---------- Hot / Cold numbers ---------- */

export type HotColdItem = {
  number: number;
  count: number;
};

export type HotColdResponse = {
  ok: boolean;
  requestedN: number;
  totalDrawsConsidered: number;
  top: number;
  hot: {
    main: HotColdItem[];
    stars: HotColdItem[];
  };
  cold: {
    main: HotColdItem[];
    stars: HotColdItem[];
  };
  error?: string;
};

export async function getHotCold(
  n: number,
  top: number,
): Promise<HotColdResponse> {
  const res = await fetch(apiUrl(`/api/hot-cold?n=${n}&top=${top}`));

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to fetch hot/cold: ${res.status} ${text || res.statusText}`,
    );
  }

  return (await res.json()) as HotColdResponse;
}

/* ---------- Gaps / Overdue numbers ---------- */

export type GapItem = {
  number: number;
  gap: number; // draws since last seen (0 = hit in latest draw)
  lastSeen: string | null;
};

export type GapsResponse = {
  ok: boolean;
  main: GapItem[];
  stars: GapItem[];
  totalDrawsConsidered: number;
  error?: string;
};

export async function getGaps(): Promise<GapsResponse> {
  const res = await fetch(apiUrl('/api/gaps'));

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to fetch gaps: ${res.status} ${text || res.statusText}`,
    );
  }

  return (await res.json()) as GapsResponse;
}
