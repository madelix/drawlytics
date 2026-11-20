export function countMatches(chosenNumbers, drawnNumbers) {
  const drawn = new Set(drawnNumbers);
  let matches = 0;

  for (const number of chosenNumbers) {
    if (drawn.has(number)) matches++;
  }

  return matches;
}
