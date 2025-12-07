// server/routes/predictions.js
import express from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db.js';
import * as schema from '../drizzle/schema.js';

const router = express.Router();
const { predictions } = schema;

/**
 * GET /api/predictions
 * List all predictions (newest first)
 */
router.get('/predictions', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(predictions)
      .orderBy(desc(predictions.created_at));

    res.json({ ok: true, predictions: rows });
  } catch (err) {
    console.error('List predictions error:', err);
    res.status(500).json({ ok: false, error: 'list_failed' });
  }
});

/**
 * POST /api/predictions
 * Create a new prediction.
 * Expects body like:
 * {
 *   lottery: string,
 *   draw_date: string (YYYY-MM-DD),
 *   model_name: string,
 *   main_numbers: number[],
 *   star_numbers: number[],
 *   confidence: string | number,
 *   status?: string
 * }
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
      status,
    } = req.body ?? {};

    if (
      !lottery ||
      !draw_date ||
      !model_name ||
      !Array.isArray(main_numbers) ||
      !Array.isArray(star_numbers)
    ) {
      return res.status(400).json({ ok: false, error: 'invalid_body' });
    }

    const [inserted] = await db
      .insert(predictions)
      .values({
        lottery,
        draw_date,
        model_name,
        main_numbers,
        star_numbers,
        // numeric(5,2) comes back as string, so store as string too
        confidence: String(confidence ?? '0.00'),
        status: status ?? 'pending',
      })
      .returning();

    res.json({ ok: true, prediction: inserted });
  } catch (err) {
    console.error('Create prediction error:', err);
    res.status(500).json({ ok: false, error: 'create_failed' });
  }
});

/**
 * DELETE /api/predictions/:id
 * Delete a prediction by ID
 */
router.delete('/predictions/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, error: 'invalid_id' });
    }

    await db.delete(predictions).where(eq(predictions.id, id));
    res.json({ ok: true, deletedId: id });
  } catch (err) {
    console.error('Delete prediction error:', err);
    res.status(500).json({ ok: false, error: 'delete_failed' });
  }
});

export default router;
