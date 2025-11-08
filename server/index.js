import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_, res) => res.send('Drawlytics API is running'));
app.get('/api/health', (_, res) => res.json({ ok: true }));

// --- Load CSV (simple parser) ---
function parseCSV(text) {
  const [header, ...rows] = text.trim().split(/\r?\n/);
  const keys = header.split(',');
  return rows.map((line) => {
    const vals = line.split(',');
    const obj = {};
    keys.forEach((k, i) => (obj[k] = vals[i]));
    obj.date = new Date(obj.date);
    ['n1', 'n2', 'n3', 'n4', 'n5', 's1', 's2'].forEach(
      (k) => (obj[k] = Number(obj[k])),
    );
    return obj;
  });
}

const dataPath = path.join(__dirname, 'data', 'euromillions.csv');
let DRAWS = [];
try {
  const csv = fs.readFileSync(dataPath, 'utf8');
  DRAWS = parseCSV(csv);
} catch (e) {
  console.error('No CSV found or parse error:', e.message);
  DRAWS = [];
}

// --- Helpers: compute frequencies ---
function frequencies(draws, maxMain = 50, maxStars = 12) {
  const main = Array.from({ length: maxMain }, (_, i) => ({
    number: i + 1,
    count: 0,
  }));
  const stars = Array.from({ length: maxStars }, (_, i) => ({
    number: i + 1,
    count: 0,
  }));
  for (const d of draws) {
    [d.n1, d.n2, d.n3, d.n4, d.n5].forEach((n) => main[n - 1].count++);
    [d.s1, d.s2].forEach((s) => stars[s - 1].count++);
  }
  main.sort((a, b) => b.count - a.count || a.number - b.number);
  stars.sort((a, b) => b.count - a.count || a.number - b.number);
  return { main, stars, totalDraws: draws.length };
}

// --- API: frequency (optional since=YYYY-MM-DD) ---
app.get('/api/frequency', (req, res) => {
  const { since } = req.query;
  const subset = since ? DRAWS.filter((d) => d.date >= new Date(since)) : DRAWS;
  res.json(frequencies(subset));
});

// --- API: last draw ---
app.get('/api/last-draw', (_, res) => {
  if (!DRAWS.length) return res.status(404).json({ error: 'no data' });
  const last = [...DRAWS].sort((a, b) => b.date - a.date)[0];
  res.json(last);
});

app.listen(3000, () => console.log('API http://localhost:3000'));
