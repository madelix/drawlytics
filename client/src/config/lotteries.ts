export type LotteryKey = 'euromillions' | 'uk_lotto' | 'set_for_life';

export type NumberGroup = {
  key: 'main' | 'stars' | 'bonus' | 'life';
  label: string;
  shortLabel: string;
  count: number;
  min: number;
  max: number;
};

export type LotteryConfig = {
  key: LotteryKey;
  label: string;
  mainNumbers: number;
  specialNumbers: number;
  specialLabel: string;
  hotChipClass: string;

  numberGroups: NumberGroup[];
};

export const LOTTERIES: LotteryConfig[] = [
  {
    key: 'euromillions',
    label: 'EuroMillions',
    mainNumbers: 5,
    specialNumbers: 2,
    specialLabel: 'Stars',
    hotChipClass: 'dl-chip-hot-euromillions',
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
        label: 'Lucky Stars',
        shortLabel: 'Stars',
        count: 2,
        min: 1,
        max: 12,
      },
    ],
  },
  {
    key: 'uk_lotto',
    label: 'UK Lotto',
    mainNumbers: 6,
    specialNumbers: 1,
    specialLabel: 'Bonus Ball',
    hotChipClass: 'dl-chip-hot-uk-lotto',
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
      },
    ],
  },
  {
    key: 'set_for_life',
    label: 'Set For Life',
    mainNumbers: 5,
    specialNumbers: 1,
    specialLabel: 'Life Ball',
    hotChipClass: 'dl-chip-hot-set-for-life',
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
];

export function getLotteryConfig(key: string): LotteryConfig {
  const found = LOTTERIES.find((l) => l.key === key);

  if (!found) {
    return LOTTERIES[0];
  }

  return found;
}
