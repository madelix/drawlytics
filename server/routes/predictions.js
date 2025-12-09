// server/routes/predictions.js
import express from 'express';
import { db } from '../db.js';
import * as schema from '../drizzle/schema.js';
import { desc, eq } from 'drizzle-orm';

// Canonical internal strategy keys -> human labels
const STRATEGY_LABELS = {
  balanced_hot_cold: 'Balanced hot/cold generator',
  pure_random: 'Pure random generator',
  hot_focused: 'Hot-focused generator',
  cold_focused: 'Cold-focused generator',
  overdue: 'Overdue-focused generator',
};

const { predictions } = schema;

const router = express.Router();

/**
 * Normalise any incoming strategy value to one of our canonical keys.
 * This lets us accept both old and new values, e.g. "hot" or "hot_focused".
 */
function normaliseStrategy(raw) {
  switch (raw) {
    case 'balanced':
    case 'default':
    case 'balanced_hot_cold':
    case undefined:
    case null:
      return 'balanced_hot_cold';

    case 'random':
    case 'pure_random':
      return 'pure_random';

    case 'hot':
    case 'hot_focused':
      return 'hot_focused';

    case 'cold':
    case 'cold_focused':
      return 'cold_focused';

    case 'overdue':
    case 'overdue_focused':
      return 'overdue';

    default:
      return 'balanced_hot_cold';
  }
}

/**
 * Helper: get the next EuroMillions draw date (Tue/Fri)
 * as a YYYY-MM-DD string.
 */
function getNextEuroMillionsDrawDate(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 2 = Tue, 5 = Fri

  let daysToAdd;
  if (day <= 2) {
    // Sun/Mon/Tue → go to this week's Tuesday
    daysToAdd = 2 - day;
  } else if (day <= 5) {
    // Wed/Thu/Fri → go to this week's Friday
    daysToAdd = 5 - day;
  } else {
    // Saturday → next Tuesday (+3 days)
    daysToAdd = 3;
  }

  d.setDate(d.getDate() + daysToAdd);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
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
  // EuroMillions: 5 main numbers 1..50
  return generateUniqueNumbers(50, 5);
}

function generateStarNumbers() {
  // EuroMillions: 2 stars 1..12
  return generateUniqueNumbers(12, 2);
}

// ----------------- ROUTES -----------------

// GET /api/predictions  – list all predictions
router.get('/predictions', async (req, res) => {
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

    // Normalise strategy to a canonical key and label
    const normalised = normaliseStrategy(strategy);
    const model_name = STRATEGY_LABELS[normalised] || 'Generator';

    // Clamp lines between 1 and 10
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
