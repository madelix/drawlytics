// server/import-uk-lotto.js
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { pool } from './db.js';

function parseUkDate(value) {
  const [day, month, year] = String(value ?? '')
    .trim()
    .split('/');

  if (!day || !month || !year) {
    throw new Error(`Invalid date: ${value}`);
  }

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function toInt(value, label) {
  const n = Number(String(value ?? '').trim());

  if (!Number.isInteger(n)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return n;
}

const csvPath = path.resolve('data/uk-lotto-historical.csv');

const csv = fs.readFileSync(csvPath, 'utf8');

const rows = parse(csv, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});
console.log(`Loaded ${rows.length} UK Lotto rows from CSV...`);

let inserted = 0;
let updated = 0;

try {
  for (const row of rows) {
    if ((inserted + updated) % 250 === 0) {
      console.log(`Processed ${inserted + updated}/${rows.length} rows...`);
    }
    const drawDate = parseUkDate(row.date);

    const values = {
      draw_date: drawDate,
      n1: toInt(row['Ball 1'], 'Ball 1'),
      n2: toInt(row['Ball 2'], 'Ball 2'),
      n3: toInt(row['Ball 3'], 'Ball 3'),
      n4: toInt(row['Ball 4'], 'Ball 4'),
      n5: toInt(row['Ball 5'], 'Ball 5'),
      n6: toInt(row['Ball 6'], 'Ball 6'),
      bonus_ball: toInt(row['Bonus Ball'], 'Bonus Ball'),
    };

    const result = await pool.query(
      `
      INSERT INTO uk_lotto_draws (
        draw_date,
        n1, n2, n3, n4, n5, n6,
        bonus_ball
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (draw_date)
      DO UPDATE SET
        n1 = EXCLUDED.n1,
        n2 = EXCLUDED.n2,
        n3 = EXCLUDED.n3,
        n4 = EXCLUDED.n4,
        n5 = EXCLUDED.n5,
        n6 = EXCLUDED.n6,
        bonus_ball = EXCLUDED.bonus_ball
      RETURNING (xmax = 0) AS inserted;
      `,
      [
        values.draw_date,
        values.n1,
        values.n2,
        values.n3,
        values.n4,
        values.n5,
        values.n6,
        values.bonus_ball,
      ],
    );

    if (result.rows[0]?.inserted) inserted += 1;
    else updated += 1;
  }

  console.log(`UK Lotto import complete.`);
  console.log(`Rows processed: ${rows.length}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
} catch (err) {
  console.error('UK Lotto import failed:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
