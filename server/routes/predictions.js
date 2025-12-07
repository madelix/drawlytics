// server/predictions.js
import express from 'express';
import { db } from './db.js';
import * as schema from './drizzle/schema.js';
import { desc, eq } from 'drizzle-orm';

const router = express.Router();

// GET /api/predictions  -> list all predictions (newest first)
router.get('/', async (req, res) => {
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

// POST /api/predictions  -> create a new prediction
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

    if (!lottery || !draw_date || !model_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const inserted = await db
      .insert(schema.predictions)
      .values({
        lottery,
        draw_date,
        model_name,
        main_numbers,
        star_numbers,
        confidence,
        // status, matched_* and result_label can use DB defaults / nulls
      })
      .returning();

    res.status(201).json({ prediction: inserted[0] });
  } catch (err) {
    console.error('Error inserting prediction:', err);
    res.status(500).json({ error: 'Failed to save prediction' });
  }
});

// DELETE /api/predictions/:id  -> delete a prediction by id
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const deleted = await db
      .delete(schema.predictions)
      .where(eq(schema.predictions.id, id))
      .returning({ id: schema.predictions.id });

    if (!deleted.length) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting prediction:', err);
    res.status(500).json({ error: 'Failed to delete prediction' });
  }
});

export default router;
