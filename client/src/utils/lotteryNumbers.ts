import { getLotteryConfig } from '../config/lotteries';

export function getMainGroup(lotteryKey: string) {
  return getLotteryConfig(lotteryKey).numberGroups.find(
    (group) => group.key === 'main',
  );
}

export function getSecondaryGroup(lotteryKey: string) {
  return getLotteryConfig(lotteryKey).numberGroups.find(
    (group) => group.key !== 'main',
  );
}

export function getNumberGroups(lotteryKey: string) {
  return getLotteryConfig(lotteryKey).numberGroups;
}
