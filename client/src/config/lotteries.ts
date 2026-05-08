export type LotteryNumberGroup = {
  key: 'main' | 'stars' | 'bonus' | 'life';
  label: string;
  shortLabel: string;
  count: number;
  min: number;
  max: number;

  // Optional relationship metadata
  samePoolAs?: 'main';
  excludeFrom?: 'main';
};

export type LotteryConfig = {
  key: 'euromillions' | 'uk_lotto' | 'set_for_life';
  displayName: string;
  numberGroups: LotteryNumberGroup[];
};

export const LOTTERIES: Record<LotteryConfig['key'], LotteryConfig> = {
  euromillions: {
    key: 'euromillions',
    displayName: 'EuroMillions',
    numberGroups: [
      {
        key: 'main',
        label: 'Main numbers',
        shortLabel: 'Main',
        count: 5,
        min: 1,
        max: 50,
      },
      {
        key: 'stars',
        label: 'Stars',
        shortLabel: 'Stars',
        count: 2,
        min: 1,
        max: 12,
      },
    ],
  },

  uk_lotto: {
    key: 'uk_lotto',
    displayName: 'UK Lotto',
    numberGroups: [
      {
        key: 'main',
        label: 'Main numbers',
        shortLabel: 'Main',
        count: 6,
        min: 1,
        max: 59,
      },
      {
        key: 'bonus',
        label: 'Bonus Ball',
        shortLabel: 'Bonus',
        count: 1,
        min: 1,
        max: 59,
        samePoolAs: 'main',
        excludeFrom: 'main',
      },
    ],
  },

  set_for_life: {
    key: 'set_for_life',
    displayName: 'Set For Life',
    numberGroups: [
      {
        key: 'main',
        label: 'Main numbers',
        shortLabel: 'Main',
        count: 5,
        min: 1,
        max: 47,
      },
      {
        key: 'life',
        label: 'Life Ball',
        shortLabel: 'Life',
        count: 1,
        min: 1,
        max: 10,
      },
    ],
  },
};

export function getLotteryConfig(key: string): LotteryConfig {
  return LOTTERIES[key as LotteryConfig['key']] ?? LOTTERIES.euromillions;
}
