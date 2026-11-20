import { countMatches } from './countMatches.js';

export function compareSavedNumbers(savedSet, drawsNewestFirst) {
  const specialChoices =
    savedSet.lottery === 'uk_lotto'
      ? savedSet.main_numbers
      : savedSet.special_numbers;

  let latest = null;
  let best = null;

  for (const draw of drawsNewestFirst) {
    const result = {
      draw_date: draw.draw_date,
      draw_sequence: draw.draw_sequence ?? 1,
      main_numbers: draw.main,
      special_numbers: draw.stars,
      matched_main: countMatches(savedSet.main_numbers, draw.main),
      matched_special: countMatches(specialChoices, draw.stars),
    };

    if (latest === null) latest = result;

    if (
      best === null ||
      result.matched_main > best.matched_main ||
      (result.matched_main === best.matched_main &&
        result.matched_special > best.matched_special)
    ) {
      best = result;
    }
  }

  return { draws_compared: drawsNewestFirst.length, latest, best };
}

export async function loadSavedNumberComparison(pool, savedSet) {
  const drawQueries = {
    euromillions: `
      SELECT draw_date::text AS draw_date, 1 AS draw_sequence,
             ARRAY[n1, n2, n3, n4, n5] AS main,
             ARRAY[s1, s2] AS stars
      FROM euromillions_draws
      WHERE draw_date <= CURRENT_DATE
      ORDER BY draw_date DESC
    `,
    uk_lotto: `
      SELECT draw_date::text AS draw_date, draw_sequence,
             ARRAY[n1, n2, n3, n4, n5, n6] AS main,
             ARRAY[bonus_ball] AS stars
      FROM uk_lotto_draws
      WHERE draw_date <= CURRENT_DATE
      ORDER BY draw_date DESC, draw_sequence DESC
    `,
    set_for_life: `
      SELECT draw_date::text AS draw_date, 1 AS draw_sequence,
             ARRAY[n1, n2, n3, n4, n5] AS main,
             ARRAY[life_ball] AS stars
      FROM set_for_life_draws
      WHERE draw_date <= CURRENT_DATE
      ORDER BY draw_date DESC
    `,
  };

  if (!Object.hasOwn(drawQueries, savedSet.lottery)) {
    throw new Error('Unsupported lottery for saved number comparison');
  }

  const { rows } = await pool.query(drawQueries[savedSet.lottery]);
  return compareSavedNumbers(savedSet, rows);
}
