import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from './db.js';
import { uk_lotto_draws } from './drizzle/schema.js';
import fs from 'node:fs/promises';
import { parse } from 'csv-parse/sync';

const START_DATE = '2026-06-10';
const END_DATE = '2026-07-22';
const CSV_PATH = './lotto-draw-history.csv';

console.log('UK Lotto second-draw backfill');
console.log(`Range: ${START_DATE} → ${END_DATE}`);

function csvDateToIso(value) {
  const months = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12',
  };

  const [day, month, year] = String(value).split('-');

  return `${year}-${months[month]}-${day.padStart(2, '0')}`;
}

async function main() {
  const csv = await fs.readFile(CSV_PATH, 'utf8');

  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log('CSV rows:', rows.length);

  const targetRows = rows.filter((row) => {
    if (row.Round !== '2') return false;

    const drawDate = new Date(row.DrawDate);
    const startDate = new Date(START_DATE);
    const endDate = new Date(END_DATE);

    return drawDate >= startDate && drawDate <= endDate;
  });

  console.log('Target Round 2 rows:', targetRows.length);

  const backfillRows = targetRows.map((row) => ({
    draw_date: csvDateToIso(row.DrawDate),
    draw_sequence: 2,
    n1: Number(row['Ball 1']),
    n2: Number(row['Ball 2']),
    n3: Number(row['Ball 3']),
    n4: Number(row['Ball 4']),
    n5: Number(row['Ball 5']),
    n6: Number(row['Ball 6']),
    bonus_ball: Number(row['Bonus Ball']),
  }));

  const missingRows = [];

  for (const row of backfillRows) {
    const existing = await db
      .select()
      .from(uk_lotto_draws)
      .where(
        and(
          eq(uk_lotto_draws.draw_date, row.draw_date),
          eq(uk_lotto_draws.draw_sequence, 2),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      missingRows.push(row);
    }
  }

  console.log(
    `Missing in database: ${missingRows.length} of ${backfillRows.length}`,
  );

  console.log(
    'Missing dates:',
    missingRows.map((row) => row.draw_date),
  );

  if (missingRows.length > 0) {
    await db.insert(uk_lotto_draws).values(missingRows);

    console.log(`Inserted ${missingRows.length} missing Round 2 draws.`);
  } else {
    console.log('No missing Round 2 draws to insert.');
  }
}

main().catch((error) => {
  console.error('UK Lotto backfill failed:', error);
  process.exitCode = 1;
});
