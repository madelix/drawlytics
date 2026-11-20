import { apiGetJson, apiSendJson } from './apiClient';
import type { LotteryKey } from '../config/lotteries';

export type NewNumberSet = {
  name: string;
  lottery: LotteryKey;
  main_numbers: number[];
  special_numbers: number[];
};

export type SavedNumberSet = NewNumberSet & {
  id: number;
  created_at: string;
};

const path = '/api/my-numbers';

export async function getSavedNumberSets(): Promise<SavedNumberSet[]> {
  const response = await apiGetJson<{ ok: true; sets: SavedNumberSet[] }>(path);
  return response.sets;
}

export async function saveNumberSet(
  input: NewNumberSet,
): Promise<SavedNumberSet> {
  const response = await apiSendJson<{ ok: true; set: SavedNumberSet }>(path, {
    method: 'POST',
    body: input,
  });
  return response.set;
}

export type SavedSetDrawResult = {
  draw_date: string;
  draw_sequence: number;
  main_numbers: number[];
  special_numbers: number[];
  matched_main: number;
  matched_special: number;
};

export type SavedSetComparison = {
  draws_compared: number;
  latest: SavedSetDrawResult | null;
  best: SavedSetDrawResult | null;
};

export async function getSavedSetComparison(
  setId: number,
): Promise<SavedSetComparison> {
  const response = await apiGetJson<{
    ok: true;
    comparison: SavedSetComparison;
  }>(`${path}/${setId}/comparison`);

  return response.comparison;
}
