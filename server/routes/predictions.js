// server/routes/predictions.js
import express from 'express';
import { db } from '../db.js';
import * as schema from '../drizzle/schema.js';
import { desc, eq } from 'drizzle-orm';

const router = express.Router();

/**
 * GET /api/predictions
 * Return all predictions, newest first.
 */
router.get('/predictions', async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(schema.predictions)
      .orderBy(desc(schema.predictions.created_at));

    res.json({ predictions: rows });
  } catch (err) {
    console.error('Error fetching predictions:', err);
    res.status(500).json({ error: 'Failed to fetch predictions' });
  }
});

/**
 * POST /api/predictions
 * Create a new prediction.
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
    } = req.body;

    if (
      !lottery ||
      !draw_date ||
      !model_name ||
      !Array.isArray(main_numbers) ||
      !Array.isArray(star_numbers)
    ) {
      return res.status(400).json({ error: 'Missing or invalid fields' });
    }

    const [inserted] = await db
      .insert(schema.predictions)
      .values({
        lottery,
        draw_date,
        model_name,
        main_numbers,
        star_numbers,
        confidence: confidence ?? '0.00',
        status: 'pending',
      })
      .returning();

    res.status(201).json({ prediction: inserted });
  } catch (err) {
    console.error('Error saving prediction:', err);
    res.status(500).json({ error: 'Failed to save prediction' });
  }
});

/**
 * DELETE /api/predictions/:id
 * Delete a prediction by id.
 */
router.delete('/predictions/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid prediction id' });
    }

    const deleted = await db
      .delete(schema.predictions)
      .where(eq(schema.predictions.id, id))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    // Success, nothing else to send
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting prediction:', err);
    res.status(500).json({ error: 'Failed to delete prediction' });
  }
});

export default router;
