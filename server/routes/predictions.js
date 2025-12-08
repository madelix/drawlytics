// server/routes/predictions.js
import express from 'express';
import { db } from '../db.js';
import * as schema from '../drizzle/schema.js';
import { desc, eq } from 'drizzle-orm';

const { predictions } = schema;

const router = express.Router();

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
    // Saturday → next Tuesday ( +3 days )
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

function strategyToLabel(strategy) {
  switch (strategy) {
    case 'hot':
      return 'Hot-focused generator';
    case 'cold':
      return 'Cold-focused generator';
    case 'overdue':
      return 'Overdue-focused generator';
    case 'random':
      return 'Random generator';
    case 'balanced_hot_cold':
    default:
      return 'Balanced hot/cold generator';
  }
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

// POST /api/predictions  – generic create (used if you ever call it manually)
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

// NEW: POST /api/predictions/generate – generate + save one or more lines
router.post('/predictions/generate', async (req, res) => {
  try {
    const {
      lottery = 'Euromillions',
      strategy = 'balanced_hot_cold',
      lines = 1,
    } = req.body || {};

    // Clamp lines between 1 and 10
    const lineCount = Math.min(Math.max(Number(lines) || 1, 1), 10);

    const drawDate = getNextEuroMillionsDrawDate();
    const model_name = strategyToLabel(strategy);

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
