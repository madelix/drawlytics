// server/routes/predictions.js
import express from 'express';
import { db } from '../db.js';
import * as schema from '../drizzle/schema.js';
import { desc, eq, and } from 'drizzle-orm';

// Canonical internal strategy keys -> human labels
const STRATEGY_LABELS = {
  balanced_hot_cold: 'Balanced hot/cold generator',
  pure_random: 'Pure random generator',
  hot_focused: 'Hot-focused generator',
  cold_focused: 'Cold-focused generator',
  overdue: 'Overdue-focused generator',
};

const { predictions, euromillions_draws } = schema;

const router = express.Router();

/**
 * Normalise any incoming strategy value to one of our canonical keys.
 */
function normaliseStrategy(raw) {
  if (!raw) return 'balanced_hot_cold';

  const cleaned = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s\-\/]+/g, '_');

  switch (cleaned) {
    case 'balanced_hot_cold':
    case 'balanced':
    case 'default':
      return 'balanced_hot_cold';

    case 'pure_random':
    case 'random':
      return 'pure_random';

    case 'hot_focused':
    case 'hot':
      return 'hot_focused';

    case 'cold_focused':
    case 'cold':
      return 'cold_focused';

    case 'overdue':
    case 'overdue_focused':
      return 'overdue';

    default:
      return 'balanced_hot_cold';
  }
}

/**
 * Decide which EuroMillions draw this prediction should belong to.
 *
 * Rules (Europe/London time):
 * - Draw days: Tuesday (2), Friday (5)
 * - Until 20:44 → prediction belongs to *today's* draw
 * - From 20:45 onwards → prediction belongs to the *next* draw
 *
 * Returns YYYY-MM-DD.
 */
function getNextEuroMillionsDrawDate(from = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = fmt.formatToParts(from);
  const getPart = (type) => Number(parts.find((p) => p.type === type)?.value);

  const year = getPart('year');
  const month = getPart('month'); // 1–12
  const dayOfMonth = getPart('day');
  const hour = getPart('hour');
  const minute = getPart('minute');

  const londonNow = new Date(
    Date.UTC(year, month - 1, dayOfMonth, hour, minute),
  );

  const day = londonNow.getUTCDay(); // 0=Sun ... 2=Tue ... 5=Fri
  const minutes = hour * 60 + minute;
  const cutoffMinutes = 20 * 60 + 45; // 20:45

  let daysToAdd = 0;

  if (day === 2 || day === 5) {
    if (minutes >= cutoffMinutes) {
      daysToAdd = day === 2 ? 3 : 4; // Tue→Fri (+3), Fri→Tue (+4)
    } else {
      daysToAdd = 0; // still today's draw
    }
  } else if (day === 3 || day === 4) {
    daysToAdd = 5 - day; // Wed/Thu → Friday
  } else if (day === 6) {
    daysToAdd = 3; // Saturday → Tuesday
  } else if (day === 0 || day === 1) {
    daysToAdd = 2 - day; // Sunday/Monday → Tuesday
  } else {
    daysToAdd = (2 - day + 7) % 7;
  }

  const drawDate = new Date(
    Date.UTC(year, month - 1, dayOfMonth + daysToAdd, 0, 0, 0, 0),
  );

  const iso = drawDate.toISOString().slice(0, 10);

  console.log('[draw-date]', {
    nowIso: from.toISOString(),
    london: { year, month, dayOfMonth, hour, minute, day, minutes },
    daysToAdd,
    drawDate: iso,
  });

  return iso;
}

// --- simple helpers to generate numbers ---
function generateUniqueNumbers(max, count) {
  const nums = new Set();
  while (nums.size < count) {
    const n = Math.floor(Math.random() * max) + 1; // 1..max
    nums.add(n);
  }
  return Array.from(nums).sort((a, b) => a - b);
}

function generateMainNumbers() {
  return generateUniqueNumbers(50, 5);
}

function generateStarNumbers() {
  return generateUniqueNumbers(12, 2);
}

function countIntersection(a = [], b = []) {
  const setB = new Set(b.filter((x) => x != null));
  let hits = 0;
  for (const x of a || []) {
    if (setB.has(x)) hits++;
  }
  return hits;
}

// ----------------- ROUTES -----------------

// GET /api/predictions  – list all predictions
router.get('/predictions', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(predictions)
      .orderBy(desc(predictions.created_at));

    res.json({ predictions: rows });
  } catch (err) {
    console.error('Error fetching predictions:', err);
    res.status(500).json({ error: 'Failed to load predictions' });
  }
});

// POST /api/predictions  – generic create (manual use)
router.post('/predictions', async (req, res) => {
  try {
    const {
      lottery,
      draw_date,
      model_name,
      main_numbers,
      star_numbers,
      confidence,
      status = 'pending',
    } = req.body || {};

    if (
      !lottery ||
      !draw_date ||
      !model_name ||
      !Array.isArray(main_numbers) ||
      !Array.isArray(star_numbers)
    ) {
      return res.status(400).json({ error: 'Missing or invalid fields' });
    }

    const [row] = await db
      .insert(predictions)
      .values({
        lottery,
        draw_date,
        model_name,
        main_numbers,
        star_numbers,
        confidence: confidence ?? '0.00',
        status,
      })
      .returning();

    res.status(201).json({ prediction: row });
  } catch (err) {
    console.error('Error creating prediction:', err);
    res.status(500).json({ error: 'Failed to create prediction' });
  }
});

// POST /api/predictions/generate – generate + save one or more lines
router.post('/predictions/generate', async (req, res) => {
  try {
    const {
      lottery = 'Euromillions',
      strategy = 'balanced_hot_cold',
      lines = 1,
    } = req.body || {};

    const normalised = normaliseStrategy(strategy);
    const model_name = STRATEGY_LABELS[normalised] || 'Generator';

    const lineCount = Math.min(Math.max(Number(lines) || 1, 1), 10);

    const drawDate = getNextEuroMillionsDrawDate();
    const created = [];

    for (let i = 0; i < lineCount; i++) {
      const main_numbers = generateMainNumbers();
      const star_numbers = generateStarNumbers();

      const [row] = await db
        .insert(predictions)
        .values({
          lottery,
          draw_date: drawDate,
          model_name,
          main_numbers,
          star_numbers,
          confidence: '0.00',
          status: 'pending',
        })
        .returning();

      created.push(row);
    }

    res.status(201).json({ predictions: created });
  } catch (err) {
    console.error('Error generating prediction(s):', err);
    res.status(500).json({ error: 'Failed to generate predictions' });
  }
});

// POST /api/predictions/check – check pending predictions against results
router.post('/predictions/check', async (_req, res) => {
  try {
    // 1) Find pending predictions
    const pending = await db
      .select()
      .from(predictions)
      .where(eq(predictions.status, 'pending'))
      .orderBy(desc(predictions.created_at))
      .limit(500);

    if (pending.length === 0) {
      return res.json({ ok: true, checked: 0, updated: 0, skipped: 0 });
    }

    let updated = 0;
    let skipped = 0;

    // 2) For each pending prediction, find matching draw and compute hits
    for (const p of pending) {
      const [draw] = await db
        .select()
        .from(euromillions_draws)
        .where(eq(euromillions_draws.draw_date, p.draw_date))
        .limit(1);

      if (!draw) {
        // draw not in DB yet (results not seeded) → skip, keep it pending
        skipped++;
        continue;
      }

      const drawMains = [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5].filter(
        (x) => x != null,
      );
      const drawStars = [draw.s1, draw.s2].filter((x) => x != null);

      // IMPORTANT: mains only vs mains, stars only vs stars
      const matchedMain = countIntersection(p.main_numbers, drawMains);
      const matchedStars = countIntersection(p.star_numbers, drawStars);

      const resultLabel = `${matchedMain}+${matchedStars}`;

      await db
        .update(predictions)
        .set({
          matched_main: matchedMain,
          matched_stars: matchedStars,
          result_label: resultLabel,
          status: 'checked',
        })
        .where(eq(predictions.id, p.id));

      updated++;
    }

    res.json({ ok: true, checked: pending.length, updated, skipped });
  } catch (err) {
    console.error('Error checking predictions:', err);
    res.status(500).json({ ok: false, error: 'predictions_check_failed' });
  }
});

// DELETE /api/predictions/:id – delete a prediction
router.delete('/predictions/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const [deleted] = await db
      .delete(predictions)
      .where(eq(predictions.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting prediction:', err);
    res.status(500).json({ error: 'Failed to delete prediction' });
  }
});

export default router;
