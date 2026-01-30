// server/routes/playedPredictions.js
import express from 'express';
import { db } from '../db.js';
import * as schema from '../drizzle/schema.js';
import { and, eq, inArray, desc } from 'drizzle-orm';

const router = express.Router();

const { predictions, played_predictions } = schema;

function isPgUniqueViolation(err) {
  return err && typeof err === 'object' && err.code === '23505';
}

function isPgForeignKeyViolation(err) {
  return err && typeof err === 'object' && err.code === '23503';
}

/**
 * POST /api/played-predictions
 * Body: { prediction_id: number, notes?: string }
 *
 * Marks ONE prediction line as "played".
 */
router.post('/played-predictions', async (req, res) => {
  try {
    const prediction_id = Number(req.body?.prediction_id);
    const notes =
      req.body?.notes != null && String(req.body.notes).trim() !== ''
        ? String(req.body.notes)
        : null;

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
        matched_main: predictions.matched_main,
        matched_stars: predictions.matched_stars,
        result_label: predictions.result_label,
        created_at: predictions.created_at,
      })
      .from(predictions)
      .where(eq(predictions.id, prediction_id))
      .limit(1);

    if (!p) {
      return res.status(404).json({ ok: false, error: 'Prediction not found' });
    }

    // ✅ FORCE model_name (local DB has NOT NULL on played_predictions.model_name)
    const modelName =
      typeof p.model_name === 'string' && p.model_name.trim() !== ''
        ? p.model_name
        : `unknown_model:${prediction_id}`;

    // 2) Fast path: already played?
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
    const [inserted] = await db
      .insert(played_predictions)
      .values({
        lottery: p.lottery,
        draw_date: p.draw_date,
        prediction_id: p.id,
        model_name: modelName, // ✅ never undefined / empty
        notes,
      })
      .returning({
        id: played_predictions.id,
        played_at: played_predictions.played_at,
        notes: played_predictions.notes,
        prediction_id: played_predictions.prediction_id,
        lottery: played_predictions.lottery,
        draw_date: played_predictions.draw_date,
        model_name: played_predictions.model_name,
      });

    return res.json({
      ok: true,
      played: {
        ...inserted,
        main_numbers: p.main_numbers,
        star_numbers: p.star_numbers,
        confidence: p.confidence,
        status: p.status,
        matched_main: p.matched_main,
        matched_stars: p.matched_stars,
        result_label: p.result_label,
        created_at: p.created_at,
      },
    });
  } catch (err) {
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
      detail: err?.detail || (err instanceof Error ? err.message : String(err)),
    });
  }
});

/**
 * DELETE /api/played-predictions/:predictionId
 * Unmarks a prediction as played by removing its played_predictions row.
 */
router.delete('/played-predictions/:predictionId', async (req, res) => {
  try {
    const predictionId = Number(req.params.predictionId);

    if (!Number.isInteger(predictionId) || predictionId <= 0) {
      return res
        .status(400)
        .json({ ok: false, error: 'invalid_prediction_id' });
    }

    const deleted = await db
      .delete(played_predictions)
      .where(eq(played_predictions.prediction_id, predictionId))
      .returning({ id: played_predictions.id });

    if (!deleted.length) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }

    return res.json({ ok: true, deleted: deleted.length });
  } catch (err) {
    console.error('played-predictions DELETE error:', err);
    return res.status(500).json({
      ok: false,
      error: 'server_error',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * GET /api/played-predictions?lottery=euromillions&draw_date=2025-12-30
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
        played_model_name: played_predictions.model_name,

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
