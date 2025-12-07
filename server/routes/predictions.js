// server/routes/predictions.js
import { Router } from 'express';
import { desc } from 'drizzle-orm';

import { db } from '../db.js';
import * as schema from '../drizzle/schema.js';

const router = Router();
const { predictions } = schema;

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

    res.json({ ok: true, predictions: rows });
  } catch (err) {
    console.error('GET /api/predictions error:', err);
    res.status(500).json({ ok: false, error: 'predictions_list_failed' });
  }
});

/**
 * POST /api/predictions
 * Create a new prediction
 */
router.post('/predictions', async (req, res) => {
  try {
    const {
      lottery,
      draw_date,
      model_name,
      main_numbers,
      star_numbers,
      confidence,
    } = req.body || {};

    // Basic validation
    if (!lottery || !draw_date || !model_name) {
      return res.status(400).json({
        ok: false,
        error: 'missing_required_fields',
      });
    }

    if (
      !Array.isArray(main_numbers) ||
      main_numbers.length !== 5 ||
      !Array.isArray(star_numbers) ||
      star_numbers.length !== 2
    ) {
      return res.status(400).json({
        ok: false,
        error: 'invalid_numbers',
      });
    }

    const [inserted] = await db
      .insert(predictions)
      .values({
        lottery,
        draw_date, // YYYY-MM-DD
        model_name,
        main_numbers, // int[]
        star_numbers, // int[]
        confidence, // numeric(5,2) – will come as string/number
        status: 'pending', // default status for new predictions
      })
      .returning();

    res.status(201).json({ ok: true, prediction: inserted });
  } catch (err) {
    console.error('POST /api/predictions error:', err);
    res.status(500).json({ ok: false, error: 'predictions_create_failed' });
  }
});

export default router;
