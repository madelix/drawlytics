// server/services/checkPredictions.js
import { pool } from '../db.js';

function getPredictionLotteryConfig(lotteryRaw) {
  const lottery = String(lotteryRaw ?? 'euromillions')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (lottery === 'uk_lotto') {
    return {
      key: 'uk_lotto',
      mainCount: 6,
      specialCount: 1,
    };
  }

  if (lottery === 'set_for_life') {
    return {
      key: 'set_for_life',
      mainCount: 5,
      specialCount: 1,
    };
  }

  return {
    key: 'euromillions',
    mainCount: 5,
    specialCount: 2,
  };
}

export async function checkPredictions({
  userId = 1,
  lottery = null,
  limit = 200,
  onlyUnchecked = true,
} = {}) {
  const lotteryFilter = lottery
    ? getPredictionLotteryConfig(lottery).key
    : null;
  const { rows: preds } = await pool.query(
    `
        SELECT
          id,
          lottery,
          draw_date,
          main_numbers,
          star_numbers,
          matched_main,
          matched_stars,
          result_label,
          status
        FROM predictions
  WHERE lower(replace(lottery, ' ', '_')) IN ('euromillions', 'uk_lotto', 'set_for_life')
    AND (
      $3::text IS NULL
      OR lower(replace(lottery, ' ', '_')) = $3::text
    )
    AND (
            $2::boolean = false
            OR matched_main IS NULL
            OR matched_stars IS NULL
            OR result_label IS NULL
            OR result_label = ''
            OR result_label LIKE 'no_draw%'
            OR status IS NULL
            OR status = 'pending'
          )
        ORDER BY created_at DESC
        LIMIT $1
        `,
    [limit, onlyUnchecked, lotteryFilter],
  );

  let predictionsToCheck = preds;

  if (!predictionsToCheck.length) {
    return { ok: true, checked: 0, updated: 0, skipped: 0 };
  }

  const toNums = (arr) =>
    Array.isArray(arr) ? arr.map((n) => Number(n)).filter(Number.isFinite) : [];

  const countMatches = (a, b) => {
    const setB = new Set(b);
    let c = 0;
    for (const x of a) if (setB.has(x)) c++;
    return c;
  };

  const toYYYYMMDD = (d) => {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  };

  const addDays = (yyyyMmDd, plusDays) => {
    const dt = new Date(`${yyyyMmDd}T00:00:00.000Z`);
    dt.setUTCDate(dt.getUTCDate() + plusDays);
    return dt.toISOString().slice(0, 10);
  };

  const dateSet = new Set();
  const predMeta = [];
  for (const p of predictionsToCheck) {
    const day = toYYYYMMDD(p.draw_date);
    if (day) dateSet.add(day);
    predMeta.push({
      id: p.id,
      draw_date: p.draw_date,
      day,
      lottery: p.lottery,
    });
  }
  const days = Array.from(dateSet);

  const expandedDays = new Set(days);
  for (const d of days) {
    expandedDays.add(addDays(d, 1));
    expandedDays.add(addDays(d, 2));
    expandedDays.add(addDays(d, 3));
  }
  const daysQuery = Array.from(expandedDays);

  const drawsByDay = new Map();
  const drawsByLotteryAndDay = new Map();

  const put = (lottery, day, main, stars) => {
    if (!day) return;

    const key = `${lottery}:${day}`;
    drawsByLotteryAndDay.set(key, { main, stars });
  };

  try {
    const euromillionsRows = await pool.query(
      `
    SELECT draw_date, n1,n2,n3,n4,n5, s1,s2
    FROM euromillions_draws
    WHERE draw_date::date = ANY($1::date[])
    `,
      [daysQuery],
    );

    for (const r of euromillionsRows.rows) {
      const day = toYYYYMMDD(r.draw_date);

      const main = [r.n1, r.n2, r.n3, r.n4, r.n5]
        .map(Number)
        .filter(Number.isFinite);

      const stars = [r.s1, r.s2].map(Number).filter(Number.isFinite);

      put('euromillions', day, main, stars);
    }

    const ukLottoRows = await pool.query(
      `
    SELECT draw_date, n1,n2,n3,n4,n5,n6, bonus_ball
    FROM uk_lotto_draws
    WHERE draw_date::date = ANY($1::date[])
    `,
      [daysQuery],
    );

    for (const r of ukLottoRows.rows) {
      const day = toYYYYMMDD(r.draw_date);

      const main = [r.n1, r.n2, r.n3, r.n4, r.n5, r.n6]
        .map(Number)
        .filter(Number.isFinite);

      const stars = [r.bonus_ball].map(Number).filter(Number.isFinite);

      put('uk_lotto', day, main, stars);
    }

    const setForLifeRows = await pool.query(
      `
    SELECT draw_date, n1,n2,n3,n4,n5, life_ball
    FROM set_for_life_draws
    WHERE draw_date::date = ANY($1::date[])
    `,
      [daysQuery],
    );

    for (const r of setForLifeRows.rows) {
      const day = toYYYYMMDD(r.draw_date);

      const main = [r.n1, r.n2, r.n3, r.n4, r.n5]
        .map(Number)
        .filter(Number.isFinite);

      const stars = [r.life_ball].map(Number).filter(Number.isFinite);

      put('set_for_life', day, main, stars);
    }
  } catch (e) {
    console.error('Draw fetch failed (n1..s2).', e);
    return { ok: false, error: 'draw_fetch_failed' };
  }

  let checked = 0;
  let updated = 0;
  let skipped = 0;

  const shifted = [];
  const findDrawDay = (lottery, day) => {
    if (drawsByLotteryAndDay.has(`${lottery}:${day}`)) return day;

    for (let i = 1; i <= 3; i++) {
      const d2 = addDays(day, i);
      if (drawsByLotteryAndDay.has(`${lottery}:${d2}`)) return d2;
    }

    return null;
  };

  for (const p of predictionsToCheck) {
    checked++;

    const pMain = toNums(p.main_numbers);
    const pStars = toNums(p.star_numbers);

    const predictionConfig = getPredictionLotteryConfig(p.lottery);

    if (
      pMain.length !== predictionConfig.mainCount ||
      pStars.length !== predictionConfig.specialCount
    ) {
      skipped++;
      continue;
    }

    const day = toYYYYMMDD(p.draw_date);
    if (!day) {
      await pool.query(
        `
            UPDATE predictions
            SET matched_main = NULL,
                matched_stars = NULL,
                result_label = 'invalid_prediction_draw_date',
                status = 'checked'
            WHERE id = $1
            `,
        [p.id],
      );
      updated++;
      continue;
    }

    const predictionLottery = getPredictionLotteryConfig(p.lottery).key;
    const drawDay = findDrawDay(predictionLottery, day);
    if (!drawDay) {
      await pool.query(
        `
            UPDATE predictions
  SET matched_main = NULL,
      matched_stars = NULL,
      result_label = 'no_draw_for_date',
      status = 'pending'
  WHERE id = $1
            `,
        [p.id],
      );
      updated++;
      continue;
    }

    if (drawDay !== day) shifted.push([day, drawDay]);

    const draw = drawsByLotteryAndDay.get(`${predictionLottery}:${drawDay}`);
    const mMain = countMatches(pMain, draw.main);
    const mStars = countMatches(pStars, draw.stars);
    const label =
      drawDay !== day
        ? `${mMain}+${mStars} (draw:${drawDay})`
        : `${mMain}+${mStars}`;

    await pool.query(
      `
          UPDATE predictions
          SET matched_main = $2,
              matched_stars = $3,
              result_label = $4,
              status = 'checked'
          WHERE id = $1
          `,
      [p.id, mMain, mStars, label],
    );

    updated++;
  }
  return {
    ok: true,
    checked,
    updated,
    skipped,
  };
}
