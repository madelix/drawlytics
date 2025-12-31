// server/routes/playedPredictions.js
import express from 'express';
import { db } from '../db.js';
import * as schema from '../drizzle/schema.js';
import { and, eq, inArray, desc } from 'drizzle-orm';

const router = express.Router();

// Expect these to exist in drizzle/schema.js
const { predictions, played_predictions } = schema;

function isPgUniqueViolation(err) {
  // Postgres unique violation code
  return err && typeof err === 'object' && err.code === '23505';
}

function isPgForeignKeyViolation(err) {
  // Postgres FK violation code
  return err && typeof err === 'object' && err.code === '23503';
}

/**
 * POST /api/played-predictions
 * Body: { prediction_id: number, notes?: string }
 *
 * Marks ONE prediction line as "played".
 * This is the right abstraction if a model generates multiple lines and you play some/all of them.
 */
router.post('/played-predictions', async (req, res) => {
  try {
    const prediction_id = Number(req.body?.prediction_id);
    const notes = req.body?.notes ?? null;

    if (!Number.isInteger(prediction_id) || prediction_id <= 0) {
      return res
        .status(400)
        .json({ ok: false, error: 'Invalid prediction_id' });
    }

    // 1) Ensure prediction exists (and read its draw context)
    const [p] = await db
      .select({
        id: predictions.id,
        lottery: predictions.lottery,
        draw_date: predictions.draw_date,
        model_name: predictions.model_name,
        main_numbers: predictions.main_numbers,
        star_numbers: predictions.star_numbers,
        confidence: predictions.confidence,
        status: predictions.status,
      })
      .from(predictions)
      .where(eq(predictions.id, prediction_id))
      .limit(1);

    if (!p) {
      return res.status(404).json({ ok: false, error: 'Prediction not found' });
    }

    // 2) Check if already marked as played (fast path; avoids unique violation noise)
    const [already] = await db
      .select({ id: played_predictions.id })
      .from(played_predictions)
      .where(eq(played_predictions.prediction_id, prediction_id))
      .limit(1);

    if (already) {
      return res.status(409).json({
        ok: false,
        error: 'This prediction line is already marked as played.',
      });
    }

    // 3) Insert played record
    // NOTE: played_predictions does NOT store model_name; we join to predictions when reading.
    const insertedRows = await db
      .insert(played_predictions)
      .values({
        lottery: p.lottery,
        draw_date: p.draw_date,
        prediction_id: p.id,
        notes,
      })
      .returning({
        id: played_predictions.id,
        played_at: played_predictions.played_at,
        notes: played_predictions.notes,
        prediction_id: played_predictions.prediction_id,
        lottery: played_predictions.lottery,
        draw_date: played_predictions.draw_date,
      });

    const inserted = insertedRows?.[0];

    return res.json({
      ok: true,
      played: {
        ...(inserted || {}),
        model_name: p.model_name,
        main_numbers: p.main_numbers,
        star_numbers: p.star_numbers,
        confidence: p.confidence,
        status: p.status,
      },
    });
  } catch (err) {
    // Handle DB constraint errors in a user-friendly way
    if (isPgUniqueViolation(err)) {
      return res.status(409).json({
        ok: false,
        error: 'This prediction line is already marked as played.',
        detail: err.detail || null,
      });
    }

    if (isPgForeignKeyViolation(err)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid prediction_id (FK violation).',
        detail: err.detail || null,
      });
    }

    console.error('played-predictions POST error:', err);
    return res.status(500).json({
      ok: false,
      error: 'server_error',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * GET /api/played-predictions?lottery=euromillions&draw_date=2025-12-30
 * Lists played lines, joined with the prediction details.
 */
router.get('/played-predictions', async (req, res) => {
  try {
    const lottery = req.query.lottery ? String(req.query.lottery) : null;
    const draw_date = req.query.draw_date ? String(req.query.draw_date) : null;

    const whereParts = [];
    if (lottery) whereParts.push(eq(played_predictions.lottery, lottery));
    if (draw_date) whereParts.push(eq(played_predictions.draw_date, draw_date));

    const rows = await db
      .select({
        id: played_predictions.id,
        prediction_id: played_predictions.prediction_id,
        lottery: played_predictions.lottery,
        draw_date: played_predictions.draw_date,
        played_at: played_predictions.played_at,
        notes: played_predictions.notes,

        model_name: predictions.model_name,
        main_numbers: predictions.main_numbers,
        star_numbers: predictions.star_numbers,
        confidence: predictions.confidence,
        status: predictions.status,
        matched_main: predictions.matched_main,
        matched_stars: predictions.matched_stars,
        result_label: predictions.result_label,
        created_at: predictions.created_at,
      })
      .from(played_predictions)
      .innerJoin(
        predictions,
        eq(predictions.id, played_predictions.prediction_id),
      )
      .where(whereParts.length ? and(...whereParts) : undefined)
      .orderBy(desc(played_predictions.played_at))
      .limit(500);

    return res.json({ ok: true, played: rows });
  } catch (err) {
    console.error('played-predictions GET error:', err);
    return res.status(500).json({
      ok: false,
      error: 'server_error',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * GET /api/played-predictions/status?ids=1,2,3
 * Returns { playedIds: number[] } for quick UI highlighting.
 */
router.get('/played-predictions/status', async (req, res) => {
  try {
    const raw = String(req.query.ids ?? '').trim();
    if (!raw) return res.json({ ok: true, playedIds: [] });

    const ids = raw
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);

    if (ids.length === 0) return res.json({ ok: true, playedIds: [] });

    const rows = await db
      .select({ prediction_id: played_predictions.prediction_id })
      .from(played_predictions)
      .where(inArray(played_predictions.prediction_id, ids));

    return res.json({ ok: true, playedIds: rows.map((r) => r.prediction_id) });
  } catch (err) {
    console.error('played-predictions status error:', err);
    return res.status(500).json({
      ok: false,
      error: 'server_error',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
