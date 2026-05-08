// server/import-set-for-life.js
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { pool } from './db.js';

const MONTHS = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

function parseSetForLifeDate(value) {
  const [day, monthRaw, yearRaw] = String(value ?? '')
    .trim()
    .split('-');

  const month = MONTHS[String(monthRaw ?? '').toLowerCase()];
  const yearNumber = Number(yearRaw);

  if (!day || !month || !Number.isInteger(yearNumber)) {
    throw new Error(`Invalid date: ${value}`);
  }

  const fullYear = yearNumber < 50 ? 2000 + yearNumber : 1900 + yearNumber;

  return `${fullYear}-${month}-${String(day).padStart(2, '0')}`;
}

function toInt(value, label) {
  const n = Number(String(value ?? '').trim());

  if (!Number.isInteger(n)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return n;
}

const csvPath = path.resolve('data/set-for-life-historical.csv');
const csv = fs.readFileSync(csvPath, 'utf8');

const rows = parse(csv, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

console.log(`Loaded ${rows.length} Set For Life rows from CSV...`);

let inserted = 0;
let updated = 0;

try {
  for (const row of rows) {
    if ((inserted + updated) % 250 === 0) {
      console.log(`Processed ${inserted + updated}/${rows.length} rows...`);
    }

    const drawDate = parseSetForLifeDate(row.date);

    const values = {
      draw_date: drawDate,
      n1: toInt(row['Ball 1'], 'Ball 1'),
      n2: toInt(row['Ball 2'], 'Ball 2'),
      n3: toInt(row['Ball 3'], 'Ball 3'),
      n4: toInt(row['Ball 4'], 'Ball 4'),
      n5: toInt(row['Ball 5'], 'Ball 5'),
      life_ball: toInt(row['Life Ball'], 'Life Ball'),
    };

    const result = await pool.query(
      `
      INSERT INTO set_for_life_draws (
        draw_date,
        n1, n2, n3, n4, n5,
        life_ball
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (draw_date)
      DO UPDATE SET
        n1 = EXCLUDED.n1,
        n2 = EXCLUDED.n2,
        n3 = EXCLUDED.n3,
        n4 = EXCLUDED.n4,
        n5 = EXCLUDED.n5,
        life_ball = EXCLUDED.life_ball
      RETURNING (xmax = 0) AS inserted;
      `,
      [
        values.draw_date,
        values.n1,
        values.n2,
        values.n3,
        values.n4,
        values.n5,
        values.life_ball,
      ],
    );

    if (result.rows[0]?.inserted) inserted += 1;
    else updated += 1;
  }

  console.log('Set For Life import complete.');
  console.log(`Rows processed: ${rows.length}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
} catch (err) {
  console.error('Set For Life import failed:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
