// client/src/api/performance.ts

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

function getApiBaseUrl() {
  const base = import.meta.env.VITE_API_BASE_URL || '';
  return base.replace(/\/+$/, '');
}

export async function getModelPerformance(params?: {
  lottery?: string;
  limit?: number;
}): Promise<ModelsPerformanceResponse> {
  const lottery = params?.lottery ?? 'euromillions';
  const limit = params?.limit ?? 500;

  const base = getApiBaseUrl();
  const url =
    `${base}/api/performance/models` +
    `?lottery=${encodeURIComponent(lottery)}` +
    `&limit=${encodeURIComponent(String(limit))}`;

  console.log('[getModelPerformance] GET', url);

  const res = await fetch(url, { headers: { Accept: 'application/json' } });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Performance fetch failed: ${res.status} ${text}`);
  }

  return res.json();
}
