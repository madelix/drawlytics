// server/routes/savePrediction.js
import { Router } from 'express';
import { db } from '../db.js';
import { predictions } from '../drizzle/schema.js';

const router = Router();

/**
 * POST /api/predictions
 * Body:
 * {
 *   lottery: "euromillions",
 *   draw_date: "2025-12-05",
 *   model_name: "Ensemble",
 *   main_numbers: [3, 9, 13, 26, 27],
 *   star_numbers: [7, 11],
 *   confidence: 7.29
 * }
 */
router.post('/', async (req, res) => {
  try {
    const {
      lottery,
      draw_date,
      model_name,
      main_numbers,
      star_numbers,
      confidence,
    } = req.body;

    // Basic validation
    if (
      !lottery ||
      !draw_date ||
      !model_name ||
      !Array.isArray(main_numbers) ||
      !Array.isArray(star_numbers)
    ) {
      return res.status(400).json({ error: 'Missing or invalid fields' });
    }

    const inserted = await db
      .insert(predictions)
      .values({
        lottery,
        draw_date,
        model_name,
        main_numbers,
        star_numbers,
        confidence,
        status: 'pending', // default state
      })
      .returning({ id: predictions.id });

    return res.json({
      success: true,
      id: inserted[0].id,
    });
  } catch (err) {
    console.error('❌ Error saving prediction:', err);
    return res.status(500).json({ error: 'Server error saving prediction' });
  }
});

export default router;
