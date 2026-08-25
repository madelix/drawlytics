export type ModelPersonality =
  | 'stable'
  | 'aggressive'
  | 'balanced'
  | 'experimental';

type ModelPersonalityInput = {
  modelKey: string;
  checked: number;
  consistencyScore: number;
  upsideScore: number;
  avgTotal: number;
};

export function getModelPersonality({
  modelKey,
  checked,
  consistencyScore,
  upsideScore,
  avgTotal,
}: ModelPersonalityInput): ModelPersonality {
  if (modelKey === 'strategy_mix') {
    return 'balanced';
  }

  if (checked < 10) {
    return 'experimental';
  }

  if (consistencyScore >= 0.5) {
    return 'stable';
  }

  if (upsideScore >= 0.25 && consistencyScore < 0.3) {
    return 'aggressive';
  }

  if (avgTotal >= 0.9 && upsideScore >= 0.1) {
    return 'balanced';
  }

  return 'stable';
}
