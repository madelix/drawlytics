// client/src/api/playedPredictions.ts
import { apiUrl } from './apiClient';

type ApiOk<T> = { ok: true } & T;
type ApiErr = {
  ok: false;
  error?: string;
  message?: string;
  details?: unknown;
};

async function requestJson<T>(
  path: string,
  options: RequestInit,
): Promise<ApiOk<T>> {
  const res = await fetch(apiUrl(path), {
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  });

  // Try to parse JSON; if not JSON, fall back to text
  const contentType = res.headers.get('content-type') ?? '';
  const payload: unknown = contentType.includes('application/json')
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const msg =
      typeof payload === 'string'
        ? payload
        : (payload as ApiErr | null)?.message ||
          (payload as ApiErr | null)?.error ||
          `Request failed (${res.status})`;

    throw new Error(msg);
  }

  return payload as ApiOk<T>;
}

/**
 * POST /api/played-predictions
 * Body: { prediction_id, notes? }
 */
export async function markPlayed(predictionId: number, notes?: string | null) {
  return requestJson<{ prediction?: unknown; degraded?: string | null }>(
    '/api/played-predictions',
    {
      method: 'POST',
      body: JSON.stringify({
        prediction_id: predictionId,
        notes: notes ?? null,
      }),
    },
  );
}

/**
 * DELETE /api/played-predictions/:predictionId
 */
export async function unmarkPlayed(predictionId: number) {
  return requestJson<{ prediction?: unknown }>(
    `/api/played-predictions/${predictionId}`,
    {
      method: 'DELETE',
    },
  );
}
