import fs from 'node:fs/promises';
import path from 'node:path';

import { pool } from '../db.js';
import { getPredictionLotteryConfig } from '../services/predictionGenerator.js';

function getArgument(name, fallback = null) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] ?? fallback;
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

async function run() {
  const lotteryRaw = getArgument('--lottery', 'euromillions');

  const drawDateRaw = getArgument('--draw-date');

  const outputRaw = getArgument('--output', 'ml/data/history.json');

  const drawDate = normalizeDate(drawDateRaw);

  if (!drawDate) {
    throw new Error('A valid --draw-date YYYY-MM-DD is required.');
  }

  const lotteryConfig = getPredictionLotteryConfig(lotteryRaw);

  const { rows } = await pool.query(
    `
    SELECT *
    FROM ${lotteryConfig.table}
    WHERE draw_date < $1::date
    ORDER BY draw_date ASC
    `,
    [drawDate],
  );

  const outputPath = path.resolve(outputRaw);

  await fs.mkdir(path.dirname(outputPath), {
    recursive: true,
  });

  await fs.writeFile(outputPath, JSON.stringify(rows, null, 2), 'utf8');

  console.log(
    JSON.stringify(
      {
        ok: true,
        lottery: lotteryConfig.key,
        target_draw_date: drawDate,
        historical_draws: rows.length,
        first_draw: rows[0]?.draw_date ?? null,
        last_draw: rows.at(-1)?.draw_date ?? null,
        output: outputPath,
      },
      null,
      2,
    ),
  );
}

try {
  await run();
} catch (error) {
  console.error('[export-ml-history] failed:', error);

  process.exitCode = 1;
} finally {
  await pool.end();
}
