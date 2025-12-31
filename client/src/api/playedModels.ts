// client/src/api/playedModels.ts
import { apiGetJson } from './apiClient';

export type PlayedModelRow = {
  id: number;
  lottery: string;
  draw_date: string;
  model_name: string;
  played_at: string;
  notes: string | null;
};

export type PlayedLatestResponse = {
  ok: boolean;
  lottery: string;
  draw_date: string;
  played: PlayedModelRow | null;
  error?: string;
};

export type SavePlayedResponse = {
  ok: boolean;
  played?: PlayedModelRow;
  error?: string;
};

export async function getPlayedModelLatest(lottery = 'euromillions') {
  return apiGetJson<PlayedLatestResponse>(
    `/api/played-models/latest?lottery=${encodeURIComponent(lottery)}`,
  );
}

export async function savePlayedModel(params: {
  lottery?: string;
  model_name: string;
  notes?: string;
}) {
  const res = await fetch(`/api/played-models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(params),
  });

  const json = (await res
    .json()
    .catch(() => null)) as SavePlayedResponse | null;

  if (!res.ok) {
    throw new Error(json?.error || `Save failed (${res.status})`);
  }

  return json as SavePlayedResponse;
}
