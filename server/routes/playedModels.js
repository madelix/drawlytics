// server/routes/playedModels.js
import express from 'express';
import { db } from '../db.js';
import * as schema from '../drizzle/schema.js';
import { desc, eq } from 'drizzle-orm';

const router = express.Router();
const { played_models } = schema;

/**
 * Decide which EuroMillions draw this "played model" belongs to.
 * (Same logic as predictions.js)
 *
 * Europe/London:
 * - Draw days: Tue, Fri
 * - Until 20:44 → today
 * - From 20:45 → next draw
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
  const month = getPart('month');
  const dayOfMonth = getPart('day');
  const hour = getPart('hour');
  const minute = getPart('minute');

  const londonNow = new Date(
    Date.UTC(year, month - 1, dayOfMonth, hour, minute),
  );
  const day = londonNow.getUTCDay(); // 0 Sun ... 2 Tue ... 5 Fri
  const minutes = hour * 60 + minute;
  const cutoffMinutes = 20 * 60 + 45; // 20:45

  let daysToAdd = 0;

  if (day === 2 || day === 5) {
    daysToAdd = minutes >= cutoffMinutes ? (day === 2 ? 3 : 4) : 0;
  } else if (day === 3 || day === 4) {
    daysToAdd = 5 - day;
  } else if (day === 6) {
    daysToAdd = 3;
  } else if (day === 0 || day === 1) {
    daysToAdd = 2 - day;
  } else {
    daysToAdd = (2 - day + 7) % 7;
  }

  const drawDate = new Date(
    Date.UTC(year, month - 1, dayOfMonth + daysToAdd, 0, 0, 0, 0),
  );
  return drawDate.toISOString().slice(0, 10);
}

/**
 * GET /api/played-models/latest?lottery=euromillions
 * Returns the played model for the NEXT draw date (computed) if it exists
 */
router.get('/played-models/latest', async (req, res) => {
  try {
    const lottery = String(req.query.lottery || 'euromillions');
    const draw_date = getNextEuroMillionsDrawDate();

    const [row] = await db
      .select()
      .from(played_models)
      .where(eq(played_models.lottery, lottery))
      .where(eq(played_models.draw_date, draw_date))
      .limit(1);

    res.json({ ok: true, lottery, draw_date, played: row ?? null });
  } catch (err) {
    console.error('played-models latest error:', err);
    res.status(500).json({ ok: false, error: 'played_models_latest_failed' });
  }
});

/**
 * POST /api/played-models
 * Body: { lottery?: string, model_name: string, notes?: string }
 * draw_date is computed (next draw). Unique index enforces 1 per draw.
 */
router.post('/played-models', async (req, res) => {
  try {
    const lottery = String(req.body?.lottery || 'euromillions');
    const model_name = String(req.body?.model_name || '').trim();
    const notes = req.body?.notes != null ? String(req.body.notes) : null;

    if (!model_name) {
      return res.status(400).json({ ok: false, error: 'model_name_required' });
    }

    const draw_date = getNextEuroMillionsDrawDate();

    // If you want "replace" behaviour: delete existing then insert
    // (keeps it simple and avoids dealing with UPSERT differences)
    await db
      .delete(played_models)
      .where(eq(played_models.lottery, lottery))
      .where(eq(played_models.draw_date, draw_date));

    const [inserted] = await db
      .insert(played_models)
      .values({ lottery, draw_date, model_name, notes })
      .returning();

    res.status(201).json({ ok: true, played: inserted });
  } catch (err) {
    console.error('played-models save error:', err);
    res.status(500).json({ ok: false, error: 'played_models_save_failed' });
  }
});

export default router;
