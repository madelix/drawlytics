// server/config/lotteries.js

export const LOTTERIES = {
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

export function getLotteryConfig(key) {
  return LOTTERIES[key] ?? LOTTERIES.euromillions;
}
