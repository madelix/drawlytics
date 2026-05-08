// server/utils/lotteryNumbers.js

import { getLotteryConfig } from '../config/lotteries.js';

export function getMainGroup(lotteryKey) {
  return getLotteryConfig(lotteryKey).numberGroups.find(
    (group) => group.key === 'main',
  );
}

export function getSecondaryGroup(lotteryKey) {
  return getLotteryConfig(lotteryKey).numberGroups.find(
    (group) => group.key !== 'main',
  );
}

export function getNumberGroups(lotteryKey) {
  return getLotteryConfig(lotteryKey).numberGroups;
}
