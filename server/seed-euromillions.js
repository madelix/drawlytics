// server/seed-euromillions.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { db, schema } from './db.js';

const { euromillions_draws } = schema; // <-- table from schema.js

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const filePath = path.join(__dirname, 'data', 'euromillions.csv');

  if (!fs.existsSync(filePath)) {
    console.error('CSV not found at:', filePath);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) {
    console.error('CSV file is empty');
    process.exit(1);
  }

  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Parsed ${rows.length} rows from CSV`);

  // ⚠ Optional: clear existing rows so we don't insert duplicates
  await db.delete(euromillions_draws);
  console.log('Cleared existing rows from euromillions_draws');

  const batch = rows.map((row) => ({
    // Adjust field names if your CSV headers are slightly different
    draw_date: row.date, // stored as text in DB (fine for now)
    n1: Number(row.n1),
    n2: Number(row.n2),
    n3: Number(row.n3),
    n4: Number(row.n4),
    n5: Number(row.n5),
    s1: Number(row.s1),
    s2: Number(row.s2),
  }));

  await db.insert(euromillions_draws).values(batch);
  console.log('Inserted rows into euromillions_draws ✅');
}

main()
  .then(() => {
    console.log('Seeding finished');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
