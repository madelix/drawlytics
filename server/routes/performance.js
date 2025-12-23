// server/routes/performance.js
import express from 'express';
import { and, desc, sql } from 'drizzle-orm';

import { db } from '../db.js';
import * as schema from '../drizzle/schema.js';

const router = express.Router();
const { predictions } = schema;

/**
 * GET /api/performance/models?lottery=euromillions&limit=500
 */
router.get('/performance/models', async (req, res) => {
  try {
    const lotteryRaw = String(req.query.lottery ?? '').trim();
    const lottery = (lotteryRaw || 'euromillions').toLowerCase();

    let limit = parseInt(String(req.query.limit ?? '500'), 10);
    if (Number.isNaN(limit) || limit <= 0) limit = 500;
    if (limit > 5000) limit = 5000;

    const rows = await db
      .select()
      .from(predictions)
      .where(and(sql`lower(${predictions.lottery}) = ${lottery}`))
      .orderBy(desc(predictions.created_at))
      .limit(limit);

    const byModel = new Map();

    for (const p of rows) {
      const name = p.model_name ?? 'Unknown';

      if (!byModel.has(name)) {
        byModel.set(name, {
          model_name: name,
          total: 0,
          checked: 0,
          any_hit: 0,
          main_hit_sum: 0,
          star_hit_sum: 0,
          main_2plus: 0,
          main_3plus: 0,
          main_4plus: 0,
          main_5: 0,
          last_created_at: null,
          avg_saved_confidence_sum: 0,
          avg_saved_confidence_count: 0,
        });
      }

      const s = byModel.get(name);
      s.total += 1;

      if (!s.last_created_at) s.last_created_at = p.created_at;

      const conf = Number(p.confidence);
      if (!Number.isNaN(conf)) {
        s.avg_saved_confidence_sum += conf;
        s.avg_saved_confidence_count += 1;
      }

      const mm = p.matched_main;
      const ms = p.matched_stars;

      if (mm != null || ms != null) {
        s.checked += 1;

        const mainHits = mm ?? 0;
        const starHits = ms ?? 0;

        s.main_hit_sum += mainHits;
        s.star_hit_sum += starHits;

        if (mainHits + starHits > 0) s.any_hit += 1;

        if (mainHits >= 2) s.main_2plus += 1;
        if (mainHits >= 3) s.main_3plus += 1;
        if (mainHits >= 4) s.main_4plus += 1;
        if (mainHits === 5) s.main_5 += 1;
      }
    }

    const models = Array.from(byModel.values()).map((s) => {
      const avgMain = s.checked ? s.main_hit_sum / s.checked : 0;
      const avgStars = s.checked ? s.star_hit_sum / s.checked : 0;
      const hitRate = s.checked ? s.any_hit / s.checked : 0;

      const avgStoredConfidence = s.avg_saved_confidence_count
        ? s.avg_saved_confidence_sum / s.avg_saved_confidence_count
        : 0;

      return {
        model_name: s.model_name,
        total: s.total,
        checked: s.checked,
        hit_rate_any: Number((hitRate * 100).toFixed(1)),
        avg_main_hits: Number(avgMain.toFixed(2)),
        avg_star_hits: Number(avgStars.toFixed(2)),
        main_2plus: s.main_2plus,
        main_3plus: s.main_3plus,
        main_4plus: s.main_4plus,
        main_5: s.main_5,
        avg_saved_confidence: Number(avgStoredConfidence.toFixed(2)),
        last_created_at: s.last_created_at,
      };
    });

    models.sort((a, b) => {
      if (b.hit_rate_any !== a.hit_rate_any)
        return b.hit_rate_any - a.hit_rate_any;
      if (b.avg_main_hits !== a.avg_main_hits)
        return b.avg_main_hits - a.avg_main_hits;
      return b.checked - a.checked;
    });

    res.json({ ok: true, lottery, limit, models });
  } catch (err) {
    console.error('Performance/models error:', err);
    res.status(500).json({ ok: false, error: 'performance_models_failed' });
  }
});

export default router;
