// server/routes/predictions.js
import express from 'express';
import { db } from '../db.js';
import * as schema from '../drizzle/schema.js';
import { desc } from 'drizzle-orm';

const router = express.Router();
const { predictions } = schema;

/**
 * Helper: get the next EuroMillions draw date (Tue or Fri).
 * - If today is Tue/Fri, we use today.
 * - Otherwise, we move forward until we hit the next Tue or Fri.
 * Returns YYYY-MM-DD string.
 */
function getNextEuroMillionsDrawDate() {
  const today = new Date();
  const candidate = new Date(today);
  candidate.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const day = candidate.getDay(); // 0=Sun ... 2=Tue ... 5=Fri
    if (day === 2 || day === 5) {
      return candidate.toISOString().slice(0, 10);
    }
    candidate.setDate(candidate.getDate() + 1);
  }

  // Fallback (should never hit)
  return today.toISOString().slice(0, 10);
}

/**
 * GET /api/predictions
 * List all saved predictions (newest first)
 */
router.get('/predictions', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(predictions)
      .orderBy(desc(predictions.created_at));

    res.json({
      ok: true,
      predictions: rows,
    });
  } catch (err) {
    console.error('Error fetching predictions:', err);
    res.status(500).json({ ok: false, error: 'predictions_fetch_failed' });
  }
});

/**
 * POST /api/predictions/example
 * Dev helper: save one example EuroMillions prediction
 */
router.post('/predictions/example', async (_req, res) => {
  try {
    const drawDate = getNextEuroMillionsDrawDate();

    const [row] = await db
      .insert(predictions)
      .values({
        lottery: 'EuroMillions',
        draw_date: drawDate, // ✅ use next Tue/Fri, not "today"
        model_name: 'Example hot/cold blend',
        main_numbers: [7, 19, 23, 42, 44],
        star_numbers: [3, 9],
        confidence: '12.34', // numeric(5,2) stored as string
        status: 'pending',
        result_label: null,
        matched_main: null,
        matched_stars: null,
      })
      .returning();

    res.json({
      ok: true,
      prediction: row,
    });
  } catch (err) {
    console.error('Error inserting example prediction:', err);
    res.status(500).json({ ok: false, error: 'prediction_insert_failed' });
  }
});

export default router;
