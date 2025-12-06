// server/routes/predictions.js
import { Router } from 'express';
import { db } from '../db.js';
import * as schema from '../drizzle/schema.js';
import { desc } from 'drizzle-orm';

const router = Router();
const { predictions } = schema;

/**
 * GET /api/predictions
 * Returns all saved predictions, newest first.
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
    console.error('GET /api/predictions error:', err);
    res.status(500).json({ ok: false, error: 'predictions_list_failed' });
  }
});

export default router;
