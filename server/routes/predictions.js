// server/routes/predictions.js
import express from 'express';
import { getAuth } from '@clerk/express';
import { pool } from '../db.js';
import { checkPredictions } from '../services/checkPredictions.js';

const router = express.Router();

async function getCurrentDrawlyticsUser(req) {
  const auth = getAuth(req);

  if (!auth.userId) {
    return null;
  }

  const { rows } = await pool.query(
    `
    SELECT id, clerk_user_id, email
    FROM users
    WHERE clerk_user_id = $1
    LIMIT 1
    `,
    [auth.userId],
  );

  return rows[0] ?? null;
}

function getPredictionLotteryConfig(lotteryRaw) {
  const lottery = String(lotteryRaw ?? 'euromillions')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (lottery === 'uk_lotto') {
    return {
      key: 'uk_lotto',
      label: 'UK Lotto',
      table: 'uk_lotto_draws',
      mainKeys: ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'],
      specialKeys: ['bonus_ball'],
      mainMin: 1,
      mainMax: 59,
      mainCount: 6,
      specialMin: 1,
      specialMax: 59,
      specialCount: 1,
    };
  }

  if (lottery === 'set_for_life') {
    return {
      key: 'set_for_life',
      label: 'Set For Life',
      table: 'set_for_life_draws',
      mainKeys: ['n1', 'n2', 'n3', 'n4', 'n5'],
      specialKeys: ['life_ball'],
      mainMin: 1,
      mainMax: 47,
      mainCount: 5,
      specialMin: 1,
      specialMax: 10,
      specialCount: 1,
    };
  }

  return {
    key: 'euromillions',
    label: 'EuroMillions',
    table: 'euromillions_draws',
    mainKeys: ['n1', 'n2', 'n3', 'n4', 'n5'],
    specialKeys: ['s1', 's2'],
    mainMin: 1,
    mainMax: 50,
    mainCount: 5,
    specialMin: 1,
    specialMax: 12,
    specialCount: 2,
  };
}

/**
 * Resolve EuroMillions draw date:
 * - If client provides draw_date: validate and use it (date-only UTC midnight)
 * - If not provided:
 *    1) try euromillions_draws for a future draw_date (only works if table has future rows)
 *    2) fallback: compute next Tue/Fri
 *       - if today is Tue/Fri AND it's <= 19:20 Europe/London, use TODAY
 *       - otherwise use the next Tue/Fri
 */
async function resolveLotteryDrawDate(drawDateRaw, lotteryConfig) {
  // 1) Client provided draw date -> validate and use it
  if (drawDateRaw) {
    const parsed = new Date(String(drawDateRaw));
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: 'invalid_draw_date' };
    }

    // Normalize to date-only (UTC midnight) to avoid timezone drift
    const yyyyMmDd = parsed.toISOString().slice(0, 10);
    const dt = new Date(`${yyyyMmDd}T00:00:00.000Z`);
    return { ok: true, draw_date: dt };
  }

  // 2) Try next draw from draws table (only works if table includes future dates)
  try {
    const next = await pool.query(
      `
      SELECT draw_date
FROM ${lotteryConfig.table}
WHERE draw_date >= CURRENT_DATE
ORDER BY draw_date ASC
LIMIT 1
      `,
    );

    if (next.rows?.length) {
      return { ok: true, draw_date: next.rows[0].draw_date };
    }
  } catch (e) {
    // If the table doesn't exist or query fails, we still have the fallback below.
    console.error('resolveEuroMillionsDrawDate: draw table lookup failed:', e);
  }

  // 3) Fallback: compute next Tuesday/Friday (EuroMillions draws)
  // Use UTC for date math, but apply cutoff time using Europe/London.
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const day = todayUtc.getUTCDay(); // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  const drawDays =
    lotteryConfig.key === 'uk_lotto'
      ? [3, 6] // Wed + Sat
      : lotteryConfig.key === 'set_for_life'
        ? [1, 4] // Mon + Thu
        : [2, 5]; // Tue + Fri

  const isDrawDay = drawDays.includes(day);

  // Cutoff: 19:20 Europe/London on draw days
  const cutoffHour = 19;
  const cutoffMinute = 20;

  const londonParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);

  const hStr = londonParts.find((p) => p.type === 'hour')?.value ?? '00';
  const mStr = londonParts.find((p) => p.type === 'minute')?.value ?? '00';
  const londonHour = Number(hStr);
  const londonMinute = Number(mStr);

  const beforeCutoff =
    londonHour < cutoffHour ||
    (londonHour === cutoffHour && londonMinute <= cutoffMinute);

  // If today is a draw day and it's before cutoff, use TODAY (date-only)
  if (isDrawDay && beforeCutoff) {
    return { ok: true, draw_date: todayUtc };
  }

  // Otherwise, compute the next draw day after today
  const daysUntil = (target) => {
    const diff = (target - day + 7) % 7;
    return diff === 0 ? 7 : diff;
  };

  const add = Math.min(...drawDays.map(daysUntil));

  const nextDraw = new Date(todayUtc);
  nextDraw.setUTCDate(nextDraw.getUTCDate() + add);

  return { ok: true, draw_date: nextDraw };
}

/**
 * GET /api/predictions
 */
router.get('/predictions', async (req, res) => {
  try {
    const currentUser = await getCurrentDrawlyticsUser(req);

    if (!currentUser) {
      return res.status(401).json({
        ok: false,
        error: 'unauthenticated',
      });
    }

    const userId = currentUser.id;
    const limitRaw = Number(req.query.limit ?? 20);
    const offsetRaw = Number(req.query.offset ?? 0);

    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(100, Math.floor(limitRaw)))
      : 20;

    const offset = Number.isFinite(offsetRaw)
      ? Math.max(0, Math.floor(offsetRaw))
      : 0;

    const lotteryRaw = req.query.lottery
      ? String(req.query.lottery).trim()
      : null;

    const lotteryFilter =
      lotteryRaw && lotteryRaw !== 'all'
        ? getPredictionLotteryConfig(lotteryRaw).key
        : null;

    const dateRows = await pool.query(
      `
  SELECT DISTINCT draw_date
  FROM predictions
  WHERE user_id = $4
    AND (
      $3::text IS NULL
      OR lower(replace(lottery, ' ', '_')) = $3::text
    )
  ORDER BY draw_date DESC
  LIMIT $1
  OFFSET $2
  `,
      [limit, offset, lotteryFilter, userId],
    );

    const drawDates = dateRows.rows.map((row) => row.draw_date);

    const { rows } =
      drawDates.length === 0
        ? { rows: [] }
        : await pool.query(
            `
        SELECT
          id,
          lottery,
          draw_date,
          model_name,
          main_numbers,
          star_numbers,
          confidence,
          status,
          created_at,
          matched_main,
          matched_stars,
          result_label,
          source,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'draw_date', pdr.draw_date,
                  'draw_sequence', pdr.draw_sequence,
                  'matched_main', pdr.matched_main,
                  'matched_special', pdr.matched_special
                )
                ORDER BY pdr.draw_date, pdr.draw_sequence
              )
              FROM prediction_draw_results pdr
              WHERE pdr.prediction_id = predictions.id
            ),
            '[]'::json
          ) AS draw_results
        FROM predictions
        WHERE user_id = $3
          AND draw_date = ANY($1::date[])
          AND (
            $2::text IS NULL
            OR lower(replace(lottery, ' ', '_')) = $2::text
          )
        ORDER BY draw_date DESC, created_at DESC
        `,
            [drawDates, lotteryFilter, userId],
          );

    const countResult = await pool.query(
      `
  SELECT COUNT(DISTINCT draw_date)::int AS total
  FROM predictions
  WHERE user_id = $2
    AND (
      $1::text IS NULL
      OR lower(replace(lottery, ' ', '_')) = $1::text
    )
  `,
      [lotteryFilter, userId],
    );

    const total = countResult.rows?.[0]?.total ?? 0;

    return res.json({
      ok: true,
      predictions: rows,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (err) {
    console.error('GET /predictions failed:', err);
    res.status(500).json({ ok: false, error: 'predictions_failed' });
  }
});

/**
 * GET /api/predictions/usage
 * Returns usage for current user (temporary: user_id = 1).
 */
router.get('/predictions/usage', async (req, res) => {
  try {
    const currentUser = await getCurrentDrawlyticsUser(req);

    if (!currentUser) {
      return res.status(401).json({
        ok: false,
        error: 'unauthenticated',
      });
    }

    const userId = currentUser.id;

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS used FROM predictions WHERE user_id = $1`,
      [userId],
    );

    return res.json({
      ok: true,
      used: rows?.[0]?.used ?? 0,
      limit: null,
      limits_disabled: true,
    });
  } catch (err) {
    console.error('GET /predictions/usage failed:', err);
    return res.status(500).json({ ok: false, error: 'usage_failed' });
  }
});

/**
 * POST /api/predictions/generate
 * If draw_date is not provided, save for:
 * - today's draw if Tue/Fri and <= 19:20 UK time
 * - otherwise the next Tue/Fri draw
 */
router.post('/predictions/generate', async (req, res) => {
  try {
    const currentUser = await getCurrentDrawlyticsUser(req);

    if (!currentUser) {
      return res.status(401).json({
        ok: false,
        error: 'unauthenticated',
      });
    }

    const userId = currentUser.id;
    const lotteryRaw = String(req.body?.lottery ?? '').trim();
    const strategy = String(req.body?.strategy ?? 'pure_random').trim();
    const source = String(req.body?.source ?? 'manual').trim();
    const linesRaw = Number(req.body?.lines ?? 1);
    const drawDateRaw = req.body?.draw_date ? String(req.body.draw_date) : null;

    const lottery = lotteryRaw.toLowerCase();

    const supportedLotteries = [
      'euromillions',
      'euro millions',
      'euro-millions',
      'uk_lotto',
      'uk lotto',
      'uk-lotto',
      'set_for_life',
      'set for life',
      'set-for-life',
    ];

    if (!supportedLotteries.includes(lottery)) {
      return res.status(400).json({
        ok: false,
        error: 'unsupported_lottery',
      });
    }

    const canonicalLottery = getPredictionLotteryConfig(lotteryRaw).key;

    const lotteryConfig = getPredictionLotteryConfig(canonicalLottery);

    const lines = Number.isFinite(linesRaw) ? Math.floor(linesRaw) : 1;
    if (lines < 1 || lines > 5) {
      return res.status(400).json({ ok: false, error: 'invalid_lines' });
    }

    const resolved = await resolveLotteryDrawDate(drawDateRaw, lotteryConfig);
    if (!resolved.ok) {
      return res.status(400).json({ ok: false, error: resolved.error });
    }
    const draw_date = resolved.draw_date;
    const { rows: historyRows } = await pool.query(
      `
  SELECT *
  FROM ${lotteryConfig.table}
  ORDER BY draw_date DESC
  LIMIT 200
  `,
    );

    const randInt = (min, max) =>
      Math.floor(Math.random() * (max - min + 1)) + min;

    const sampleUnique = (min, max, count) => {
      const set = new Set();
      while (set.size < count) set.add(randInt(min, max));
      return Array.from(set).sort((a, b) => a - b);
    };

    const weightedSampleUnique = (weights, count, temperature = 1) => {
      const picked = new Set();

      while (picked.size < count) {
        const available = weights.filter((item) => !picked.has(item.n));
        const adjusted = available.map((item) => ({
          ...item,
          weight: Math.pow(item.weight, 1 / temperature),
        }));

        const totalWeight = adjusted.reduce(
          (sum, item) => sum + item.weight,
          0,
        );

        let roll = Math.random() * totalWeight;

        for (const item of adjusted) {
          roll -= item.weight;
          if (roll <= 0) {
            picked.add(item.n);
            break;
          }
        }
      }

      return Array.from(picked).sort((a, b) => a - b);
    };

    const buildLinearWeights = (min, max, direction = 'ascending') => {
      const weights = [];

      for (let n = min; n <= max; n++) {
        const base = direction === 'descending' ? max - n + 1 : n - min + 1;

        weights.push({ n, weight: base });
      }

      return weights;
    };

    const buildFrequencyWeights = (min, max, rows, keys) => {
      const counts = new Map();

      for (let n = min; n <= max; n++) {
        counts.set(n, 1); // small baseline so every number remains possible
      }

      for (const row of rows) {
        for (const key of keys) {
          const n = Number(row[key]);
          if (Number.isFinite(n)) {
            counts.set(n, (counts.get(n) ?? 1) + 1);
          }
        }
      }

      return Array.from(counts.entries()).map(([n, weight]) => ({
        n,
        weight,
      }));
    };

    const buildRecencyFrequencyWeights = (min, max, rows, keys) => {
      const counts = new Map();

      for (let n = min; n <= max; n++) {
        counts.set(n, 1);
      }

      rows.forEach((row, index) => {
        const recencyBoost = Math.max(1, rows.length - index);

        for (const key of keys) {
          const n = Number(row[key]);
          if (Number.isFinite(n)) {
            counts.set(n, (counts.get(n) ?? 1) + recencyBoost);
          }
        }
      });

      return Array.from(counts.entries()).map(([n, weight]) => ({
        n,
        weight,
      }));
    };

    const sampleRangeBalancedMainNumbers = () => {
      const low = weightedSampleUnique(
        buildRecencyFrequencyWeights(1, 16, historyRows, [
          'n1',
          'n2',
          'n3',
          'n4',
          'n5',
        ]),
        2,
        2.2,
      );

      const mid = weightedSampleUnique(
        buildRecencyFrequencyWeights(17, 33, historyRows, [
          'n1',
          'n2',
          'n3',
          'n4',
          'n5',
        ]),
        2,
        2.2,
      );

      const high = weightedSampleUnique(
        buildRecencyFrequencyWeights(34, 50, historyRows, [
          'n1',
          'n2',
          'n3',
          'n4',
          'n5',
        ]),
        1,
        2.2,
      );

      return [...low, ...mid, ...high].sort((a, b) => a - b);
    };

    const buildBayesianWeights = (min, max, rows, keys) => {
      const counts = new Map();

      for (let n = min; n <= max; n++) {
        counts.set(n, 1);
      }

      for (const row of rows) {
        for (const key of keys) {
          const n = Number(row[key]);

          if (Number.isFinite(n)) {
            counts.set(n, counts.get(n) + 1);
          }
        }
      }

      const total = Array.from(counts.values()).reduce((sum, v) => sum + v, 0);

      return Array.from(counts.entries()).map(([n, count]) => ({
        n,
        weight: count / total,
      }));
    };

    const buildTrendBoostWeights = (min, max, rows, keys) => {
      const counts = new Map();

      for (let n = min; n <= max; n++) {
        counts.set(n, 1);
      }

      rows.forEach((row, index) => {
        const recentWeight = Math.max(1, (rows.length - index) * 2);

        for (const key of keys) {
          const n = Number(row[key]);

          if (Number.isFinite(n)) {
            counts.set(n, (counts.get(n) ?? 1) + recentWeight);
          }
        }
      });

      return Array.from(counts.entries()).map(([n, weight]) => ({
        n,
        weight,
      }));
    };

    const buildMarkovWeights = (min, max, rows, keys) => {
      const transitions = new Map();

      for (let n = min; n <= max; n++) {
        transitions.set(n, 1);
      }

      for (let i = 0; i < rows.length - 1; i++) {
        const current = rows[i];
        const next = rows[i + 1];

        const currentNums = keys
          .map((k) => Number(current[k]))
          .filter(Number.isFinite);

        const nextNums = keys
          .map((k) => Number(next[k]))
          .filter(Number.isFinite);

        for (const c of currentNums) {
          for (const n of nextNums) {
            const distance = Math.abs(c - n);

            if (distance <= 5) {
              transitions.set(n, (transitions.get(n) ?? 1) + (6 - distance));
            }
          }
        }
      }

      return Array.from(transitions.entries()).map(([n, weight]) => ({
        n,
        weight,
      }));
    };

    const buildStatisticalWeights = (min, max, rows, keys) => {
      const counts = new Map();

      for (let n = min; n <= max; n++) {
        counts.set(n, 1);
      }

      rows.forEach((row, index) => {
        const recencyWeight = Math.max(1, rows.length - index);

        for (const key of keys) {
          const n = Number(row[key]);

          if (Number.isFinite(n)) {
            counts.set(n, (counts.get(n) ?? 1) + 1 + recencyWeight * 0.35);
          }
        }
      });

      return Array.from(counts.entries()).map(([n, weight]) => ({
        n,
        weight,
      }));
    };

    const buildDecisionTreeWeights = (min, max, rows, keys) => {
      const counts = new Map();

      for (let n = min; n <= max; n++) {
        counts.set(n, 1);
      }

      rows.forEach((row, index) => {
        const depthWeight = Math.max(1, rows.length - index);

        for (const key of keys) {
          const n = Number(row[key]);

          if (Number.isFinite(n)) {
            let bonus = 1;

            // Simulated split preference
            if (n <= 10 || n >= 40) {
              bonus += 1.5;
            }

            // Middle range slightly favoured
            if (n >= 20 && n <= 35) {
              bonus += 2;
            }

            counts.set(n, (counts.get(n) ?? 1) + bonus + depthWeight * 0.25);
          }
        }
      });

      return Array.from(counts.entries()).map(([n, weight]) => ({
        n,
        weight,
      }));
    };

    const buildQLearningWeights = (min, max, rows, keys) => {
      const rewards = new Map();

      for (let n = min; n <= max; n++) {
        rewards.set(n, 1);
      }

      rows.forEach((row, index) => {
        const recencyReward = Math.max(1, rows.length - index);

        for (const key of keys) {
          const n = Number(row[key]);

          if (Number.isFinite(n)) {
            let reward = 1 + recencyReward * 0.4;

            // Reward numbers that sit in active decision zones
            if ((n >= 7 && n <= 18) || (n >= 31 && n <= 44)) {
              reward += 2;
            }

            // Small exploration reward for edge numbers
            if (n <= 5 || n >= max - 4) {
              reward += 1.25;
            }

            rewards.set(n, (rewards.get(n) ?? 1) + reward);
          }
        }
      });

      return Array.from(rewards.entries()).map(([n, weight]) => ({
        n,
        weight,
      }));
    };

    const buildNeuralNetworkWeights = (min, max, rows, keys) => {
      const signals = new Map();

      for (let n = min; n <= max; n++) {
        signals.set(n, 1);
      }

      rows.forEach((row, index) => {
        const recencySignal = Math.max(1, rows.length - index);

        for (const key of keys) {
          const n = Number(row[key]);

          if (Number.isFinite(n)) {
            const normalizedPosition = (n - min) / (max - min || 1);

            let activation =
              1 +
              recencySignal * 0.3 +
              Math.sin(normalizedPosition * Math.PI) * 2;

            // Soft hidden-layer style boost for central-ish patterns
            if (normalizedPosition > 0.25 && normalizedPosition < 0.75) {
              activation += 1.5;
            }

            signals.set(n, (signals.get(n) ?? 1) + activation);
          }
        }
      });

      return Array.from(signals.entries()).map(([n, weight]) => ({
        n,
        weight,
      }));
    };

    const buildLSTMWeights = (min, max, rows, keys) => {
      const memory = new Map();

      for (let n = min; n <= max; n++) {
        memory.set(n, 1);
      }

      rows.forEach((row, index) => {
        const memoryStrength = Math.max(1, rows.length - index);

        for (const key of keys) {
          const n = Number(row[key]);

          if (Number.isFinite(n)) {
            let retention = 1 + memoryStrength * 0.45;

            // Long-memory continuation preference
            if (index < rows.length * 0.35) {
              retention += 2;
            }

            // Sequential smoothing
            if (n >= min + 5 && n <= max - 5) {
              retention += 1.25;
            }

            memory.set(n, (memory.get(n) ?? 1) + retention);
          }
        }
      });

      return Array.from(memory.entries()).map(([n, weight]) => ({
        n,
        weight,
      }));
    };

    const mergeWeightSets = (...sets) => {
      const merged = new Map();

      for (const set of sets) {
        for (const item of set) {
          merged.set(item.n, (merged.get(item.n) ?? 0) + item.weight);
        }
      }

      return Array.from(merged.entries()).map(([n, weight]) => ({
        n,
        weight,
      }));
    };

    const buildMetaLearningWeights = (min, max, rows, keys) => {
      const meta = new Map();

      for (let n = min; n <= max; n++) {
        meta.set(n, 1);
      }

      const recency = buildRecencyFrequencyWeights(min, max, rows, keys);
      const bayesian = buildBayesianWeights(min, max, rows, keys);
      const statistical = buildStatisticalWeights(min, max, rows, keys);
      const trend = buildTrendBoostWeights(min, max, rows, keys);

      for (let i = 0; i < recency.length; i++) {
        const n = recency[i].n;

        const combined =
          recency[i].weight * 0.3 +
          bayesian[i].weight * 0.2 +
          statistical[i].weight * 0.25 +
          trend[i].weight * 0.25;

        // Adaptive exploration
        const explorationBoost = Math.random() * 2;

        meta.set(n, combined + explorationBoost);
      }

      return Array.from(meta.entries()).map(([n, weight]) => ({
        n,
        weight,
      }));
    };

    const getBaseConfidence = (strategyKey) => {
      const confidenceMap = {
        'ai:xgboost': 72,
        'ai:random_forest': 68,
        'ai:bayesian': 74,
        'ai:gradient_boosting': 66,
        'ai:markov_chain': 63,
        'ai:statistical_analysis': 70,
        'ai:decision_tree': 67,
        'ai:q_learning': 61,
        'ai:neural_network': 69,
        'ai:lstm': 65,
        'ai:ensemble': 76,
        'ai:meta_learning': 73,
        balanced_hot_cold: 58,
        hot_focused: 56,
        cold_focused: 54,
        overdue: 55,
        pure_random: 35,
      };

      return confidenceMap[strategyKey] ?? 50;
    };

    const generateOneLine = () => {
      if (strategy === 'ai:xgboost') {
        return {
          main: weightedSampleUnique(
            buildRecencyFrequencyWeights(
              lotteryConfig.mainMin,
              lotteryConfig.mainMax,
              historyRows,
              lotteryConfig.mainKeys,
            ),
            lotteryConfig.mainCount,
            1.8,
          ),
          stars: weightedSampleUnique(
            buildRecencyFrequencyWeights(
              lotteryConfig.specialMin,
              lotteryConfig.specialMax,
              historyRows,
              lotteryConfig.specialKeys,
            ),
            lotteryConfig.specialCount,
            1.6,
          ),
        };
      }

      if (strategy === 'ai:random_forest') {
        return {
          main: weightedSampleUnique(
            buildRecencyFrequencyWeights(
              lotteryConfig.mainMin,
              lotteryConfig.mainMax,
              historyRows,
              lotteryConfig.mainKeys,
            ),
            lotteryConfig.mainCount,
            2.2,
          ),
          stars: weightedSampleUnique(
            buildRecencyFrequencyWeights(
              lotteryConfig.specialMin,
              lotteryConfig.specialMax,
              historyRows,
              lotteryConfig.specialKeys,
            ),
            lotteryConfig.specialCount,
            2.4,
          ),
        };
      }

      if (strategy === 'ai:bayesian') {
        return {
          main: weightedSampleUnique(
            buildBayesianWeights(
              lotteryConfig.mainMin,
              lotteryConfig.mainMax,
              historyRows,
              lotteryConfig.mainKeys,
            ),
            lotteryConfig.mainCount,
            2.8,
          ),
          stars: weightedSampleUnique(
            buildBayesianWeights(
              lotteryConfig.specialMin,
              lotteryConfig.specialMax,
              historyRows,
              lotteryConfig.specialKeys,
            ),
            lotteryConfig.specialCount,
            2.4,
          ),
        };
      }

      if (strategy === 'ai:gradient_boosting') {
        return {
          main: weightedSampleUnique(
            buildTrendBoostWeights(
              lotteryConfig.mainMin,
              lotteryConfig.mainMax,
              historyRows,
              lotteryConfig.mainKeys,
            ),
            lotteryConfig.mainCount,
            1.2,
          ),
          stars: weightedSampleUnique(
            buildTrendBoostWeights(
              lotteryConfig.specialMin,
              lotteryConfig.specialMax,
              historyRows,
              lotteryConfig.specialKeys,
            ),
            lotteryConfig.specialCount,
            1.1,
          ),
        };
      }

      if (strategy === 'ai:markov_chain') {
        return {
          main: weightedSampleUnique(
            buildMarkovWeights(
              lotteryConfig.mainMin,
              lotteryConfig.mainMax,
              historyRows,
              lotteryConfig.mainKeys,
            ),
            lotteryConfig.mainCount,
            2.0,
          ),
          stars: weightedSampleUnique(
            buildMarkovWeights(
              lotteryConfig.specialMin,
              lotteryConfig.specialMax,
              historyRows,
              lotteryConfig.specialKeys,
            ),
            lotteryConfig.specialCount,
            1.8,
          ),
        };
      }

      if (strategy === 'ai:statistical_analysis') {
        return {
          main: weightedSampleUnique(
            buildStatisticalWeights(
              lotteryConfig.mainMin,
              lotteryConfig.mainMax,
              historyRows,
              lotteryConfig.mainKeys,
            ),
            lotteryConfig.mainCount,
            2.1,
          ),
          stars: weightedSampleUnique(
            buildStatisticalWeights(
              lotteryConfig.specialMin,
              lotteryConfig.specialMax,
              historyRows,
              lotteryConfig.specialKeys,
            ),
            lotteryConfig.specialCount,
            2.0,
          ),
        };
      }

      if (strategy === 'ai:decision_tree') {
        return {
          main: weightedSampleUnique(
            buildDecisionTreeWeights(
              lotteryConfig.mainMin,
              lotteryConfig.mainMax,
              historyRows,
              lotteryConfig.mainKeys,
            ),
            lotteryConfig.mainCount,
            1.9,
          ),
          stars: weightedSampleUnique(
            buildDecisionTreeWeights(
              lotteryConfig.specialMin,
              lotteryConfig.specialMax,
              historyRows,
              lotteryConfig.specialKeys,
            ),
            lotteryConfig.specialCount,
            2.0,
          ),
        };
      }

      if (strategy === 'ai:q_learning') {
        return {
          main: weightedSampleUnique(
            buildQLearningWeights(
              lotteryConfig.mainMin,
              lotteryConfig.mainMax,
              historyRows,
              lotteryConfig.mainKeys,
            ),
            lotteryConfig.mainCount,
            2.3,
          ),
          stars: weightedSampleUnique(
            buildQLearningWeights(
              lotteryConfig.specialMin,
              lotteryConfig.specialMax,
              historyRows,
              lotteryConfig.specialKeys,
            ),
            lotteryConfig.specialCount,
            2.2,
          ),
        };
      }

      if (strategy === 'ai:neural_network') {
        return {
          main: weightedSampleUnique(
            buildNeuralNetworkWeights(
              lotteryConfig.mainMin,
              lotteryConfig.mainMax,
              historyRows,
              lotteryConfig.mainKeys,
            ),
            lotteryConfig.mainCount,
            2.0,
          ),
          stars: weightedSampleUnique(
            buildNeuralNetworkWeights(
              lotteryConfig.specialMin,
              lotteryConfig.specialMax,
              historyRows,
              lotteryConfig.specialKeys,
            ),
            lotteryConfig.specialCount,
            1.9,
          ),
        };
      }

      if (strategy === 'ai:lstm') {
        return {
          main: weightedSampleUnique(
            buildLSTMWeights(
              lotteryConfig.mainMin,
              lotteryConfig.mainMax,
              historyRows,
              lotteryConfig.mainKeys,
            ),
            lotteryConfig.mainCount,
            1.7,
          ),
          stars: weightedSampleUnique(
            buildLSTMWeights(
              lotteryConfig.specialMin,
              lotteryConfig.specialMax,
              historyRows,
              lotteryConfig.specialKeys,
            ),
            lotteryConfig.specialCount,
            1.6,
          ),
        };
      }
      if (strategy === 'ai:ensemble') {
        return {
          main: weightedSampleUnique(
            mergeWeightSets(
              buildRecencyFrequencyWeights(
                lotteryConfig.mainMin,
                lotteryConfig.mainMax,
                historyRows,
                lotteryConfig.mainKeys,
              ),
              buildBayesianWeights(
                lotteryConfig.mainMin,
                lotteryConfig.mainMax,
                historyRows,
                lotteryConfig.mainKeys,
              ),
              buildStatisticalWeights(
                lotteryConfig.mainMin,
                lotteryConfig.mainMax,
                historyRows,
                lotteryConfig.mainKeys,
              ),
            ),
            lotteryConfig.mainCount,
            2.0,
          ),
          stars: weightedSampleUnique(
            mergeWeightSets(
              buildRecencyFrequencyWeights(
                lotteryConfig.specialMin,
                lotteryConfig.specialMax,
                historyRows,
                lotteryConfig.specialKeys,
              ),
              buildBayesianWeights(
                lotteryConfig.specialMin,
                lotteryConfig.specialMax,
                historyRows,
                lotteryConfig.specialKeys,
              ),
              buildStatisticalWeights(
                lotteryConfig.specialMin,
                lotteryConfig.specialMax,
                historyRows,
                lotteryConfig.specialKeys,
              ),
            ),
            lotteryConfig.specialCount,
            1.9,
          ),
        };
      }

      if (strategy === 'ai:meta_learning') {
        return {
          main: weightedSampleUnique(
            buildMetaLearningWeights(
              lotteryConfig.mainMin,
              lotteryConfig.mainMax,
              historyRows,
              lotteryConfig.mainKeys,
            ),
            lotteryConfig.mainCount,
            2.4,
          ),
          stars: weightedSampleUnique(
            buildMetaLearningWeights(
              lotteryConfig.specialMin,
              lotteryConfig.specialMax,
              historyRows,
              lotteryConfig.specialKeys,
            ),
            lotteryConfig.specialCount,
            2.2,
          ),
        };
      }

      return {
        main: sampleUnique(
          lotteryConfig.mainMin,
          lotteryConfig.mainMax,
          lotteryConfig.mainCount,
        ),
        stars: sampleUnique(
          lotteryConfig.specialMin,
          lotteryConfig.specialMax,
          lotteryConfig.specialCount,
        ),
      };
    };

    const saved = [];

    for (let i = 0; i < lines; i++) {
      const line = generateOneLine();
      const confidence =
        getBaseConfidence(strategy) + Math.floor(Math.random() * 8) - 4;
      const model_name = strategy.startsWith('ai:')
        ? strategy
        : `make_magic:${strategy}`;

      const { rows } = await pool.query(
        `
        INSERT INTO predictions (
  lottery,
  draw_date,
  model_name,
  main_numbers,
  star_numbers,
  confidence,
  created_at,
  matched_main,
  matched_stars,
  result_label,
  status,
user_id,
source,
benchmark_eligible
)
VALUES (
  $1,
  $2,
  $3,
  $4::smallint[],
  $5::smallint[],
  $6,
  NOW(),
  NULL,
  NULL,
  NULL,
  'pending',
  $7,
  $8,
  false
)
        RETURNING
  id,
  lottery,
  draw_date,
  model_name,
  main_numbers,
  star_numbers,
  confidence,
  status,
  created_at,
  matched_main,
  matched_stars,
  result_label,
  source
        `,
        [
          lotteryConfig.key,
          draw_date,
          model_name,
          line.main,
          line.stars,
          confidence,
          userId,
          source,
        ],
      );

      saved.push(rows[0]);
    }

    return res.json({
      ok: true,
      created: saved.length,
      draw_date_used: draw_date,
      predictions: saved,
    });
  } catch (err) {
    console.error('POST /predictions/generate failed:', err);
    res.status(500).json({
      ok: false,
      error: 'generate_failed',
      message: err?.message,
    });
  }
});

/**
 * GET /api/predictions/debug-draws?date=YYYY-MM-DD
 */
router.get('/predictions/debug-draws', async (req, res) => {
  try {
    const date = req.query.date ? String(req.query.date) : null;

    const c = await pool.query(
      `SELECT COUNT(*)::int AS draws_count, MAX(draw_date) AS latest_draw FROM euromillions_draws`,
    );

    let rowForDate = null;
    let nearest = null;

    if (date) {
      const r = await pool.query(
        `
        SELECT draw_date, n1,n2,n3,n4,n5, s1,s2
        FROM euromillions_draws
        WHERE draw_date = $1::date
        LIMIT 1
        `,
        [date],
      );
      rowForDate = r.rows?.[0] ?? null;

      const prev = await pool.query(
        `
        SELECT draw_date
        FROM euromillions_draws
        WHERE draw_date < $1::date
        ORDER BY draw_date DESC
        LIMIT 1
        `,
        [date],
      );
      const next = await pool.query(
        `
        SELECT draw_date
        FROM euromillions_draws
        WHERE draw_date > $1::date
        ORDER BY draw_date ASC
        LIMIT 1
        `,
        [date],
      );

      nearest = {
        prev: prev.rows?.[0]?.draw_date ?? null,
        next: next.rows?.[0]?.draw_date ?? null,
      };
    }

    return res.json({
      ok: true,
      draws_count: c.rows?.[0]?.draws_count ?? null,
      latest_draw: c.rows?.[0]?.latest_draw ?? null,
      requested_date: date,
      row_for_date: rowForDate,
      nearest,
    });
  } catch (err) {
    console.error('debug-draws error:', err);
    return res.status(500).json({ ok: false, error: 'debug_failed' });
  }
});

/**
 * POST /api/predictions/check
 * (unchanged)
 */
router.post('/predictions/check', async (req, res) => {
  try {
    const currentUser = await getCurrentDrawlyticsUser(req);

    if (!currentUser) {
      return res.status(401).json({
        ok: false,
        error: 'unauthenticated',
      });
    }

    const result = await checkPredictions({
      userId: currentUser.id,
      lottery: req.body?.lottery ?? null,
      limit: req.body?.limit ?? 200,
      onlyUnchecked: req.body?.onlyUnchecked !== false,
    });

    return res.json(result);

    const debug = String(req.query.debug ?? '') === '1';

    const limitRaw = Number(req.body?.limit ?? 200);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(500, Math.floor(limitRaw)))
      : 200;

    const onlyUnchecked = req.body?.onlyUnchecked !== false;

    const lotteryRaw = req.body?.lottery ? String(req.body.lottery) : null;
    const lotteryFilter = lotteryRaw
      ? getPredictionLotteryConfig(lotteryRaw).key
      : null;

    const { rows: preds } = await pool.query(
      `
      SELECT
        id,
        lottery,
        draw_date,
        main_numbers,
        star_numbers,
        matched_main,
        matched_stars,
        result_label,
        status
      FROM predictions
WHERE lower(replace(lottery, ' ', '_')) IN ('euromillions', 'uk_lotto', 'set_for_life')
  AND (
    $3::text IS NULL
    OR lower(replace(lottery, ' ', '_')) = $3::text
  )
  AND (
          $2::boolean = false
          OR matched_main IS NULL
          OR matched_stars IS NULL
          OR result_label IS NULL
          OR result_label = ''
          OR result_label LIKE 'no_draw%'
          OR status IS NULL
          OR status = 'pending'
        )
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit, onlyUnchecked, lotteryFilter],
    );

    let predictionsToCheck = preds;

    if (!predictionsToCheck.length) {
      return res.json({ ok: true, checked: 0, updated: 0, skipped: 0 });
    }

    const toNums = (arr) =>
      Array.isArray(arr)
        ? arr.map((n) => Number(n)).filter(Number.isFinite)
        : [];

    const countMatches = (a, b) => {
      const setB = new Set(b);
      let c = 0;
      for (const x of a) if (setB.has(x)) c++;
      return c;
    };

    const toYYYYMMDD = (d) => {
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return null;
      return dt.toISOString().slice(0, 10);
    };

    const addDays = (yyyyMmDd, plusDays) => {
      const dt = new Date(`${yyyyMmDd}T00:00:00.000Z`);
      dt.setUTCDate(dt.getUTCDate() + plusDays);
      return dt.toISOString().slice(0, 10);
    };

    const dateSet = new Set();
    const predMeta = [];
    for (const p of predictionsToCheck) {
      const day = toYYYYMMDD(p.draw_date);
      if (day) dateSet.add(day);
      predMeta.push({
        id: p.id,
        draw_date: p.draw_date,
        day,
        lottery: p.lottery,
      });
    }
    const days = Array.from(dateSet);

    const expandedDays = new Set(days);
    for (const d of days) {
      expandedDays.add(addDays(d, 1));
      expandedDays.add(addDays(d, 2));
      expandedDays.add(addDays(d, 3));
    }
    const daysQuery = Array.from(expandedDays);

    const drawsByDay = new Map();
    const drawsByLotteryAndDay = new Map();

    const put = (lottery, day, main, stars) => {
      if (!day) return;

      const key = `${lottery}:${day}`;
      drawsByLotteryAndDay.set(key, { main, stars });
    };

    try {
      const euromillionsRows = await pool.query(
        `
  SELECT draw_date, n1,n2,n3,n4,n5, s1,s2
  FROM euromillions_draws
  WHERE draw_date::date = ANY($1::date[])
  `,
        [daysQuery],
      );

      for (const r of euromillionsRows.rows) {
        const day = toYYYYMMDD(r.draw_date);

        const main = [r.n1, r.n2, r.n3, r.n4, r.n5]
          .map(Number)
          .filter(Number.isFinite);

        const stars = [r.s1, r.s2].map(Number).filter(Number.isFinite);

        put('euromillions', day, main, stars);
      }

      const ukLottoRows = await pool.query(
        `
  SELECT draw_date, n1,n2,n3,n4,n5,n6, bonus_ball
  FROM uk_lotto_draws
  WHERE draw_date::date = ANY($1::date[])
  `,
        [daysQuery],
      );

      for (const r of ukLottoRows.rows) {
        const day = toYYYYMMDD(r.draw_date);

        const main = [r.n1, r.n2, r.n3, r.n4, r.n5, r.n6]
          .map(Number)
          .filter(Number.isFinite);

        const stars = [r.bonus_ball].map(Number).filter(Number.isFinite);

        put('uk_lotto', day, main, stars);
      }

      const setForLifeRows = await pool.query(
        `
  SELECT draw_date, n1,n2,n3,n4,n5, life_ball
  FROM set_for_life_draws
  WHERE draw_date::date = ANY($1::date[])
  `,
        [daysQuery],
      );

      for (const r of setForLifeRows.rows) {
        const day = toYYYYMMDD(r.draw_date);

        const main = [r.n1, r.n2, r.n3, r.n4, r.n5]
          .map(Number)
          .filter(Number.isFinite);

        const stars = [r.life_ball].map(Number).filter(Number.isFinite);

        put('set_for_life', day, main, stars);
      }
    } catch (e) {
      console.error('Draw fetch failed (n1..s2).', e);
      return res.status(500).json({ ok: false, error: 'draw_fetch_failed' });
    }

    let checked = 0;
    let updated = 0;
    let skipped = 0;

    const shifted = [];
    const findDrawDay = (lottery, day) => {
      if (drawsByLotteryAndDay.has(`${lottery}:${day}`)) return day;

      for (let i = 1; i <= 3; i++) {
        const d2 = addDays(day, i);
        if (drawsByLotteryAndDay.has(`${lottery}:${d2}`)) return d2;
      }

      return null;
    };

    for (const p of predictionsToCheck) {
      checked++;

      const pMain = toNums(p.main_numbers);
      const pStars = toNums(p.star_numbers);

      const predictionConfig = getPredictionLotteryConfig(p.lottery);

      if (
        pMain.length !== predictionConfig.mainCount ||
        pStars.length !== predictionConfig.specialCount
      ) {
        skipped++;
        continue;
      }

      const day = toYYYYMMDD(p.draw_date);
      if (!day) {
        await pool.query(
          `
          UPDATE predictions
          SET matched_main = NULL,
              matched_stars = NULL,
              result_label = 'invalid_prediction_draw_date',
              status = 'checked'
          WHERE id = $1
          `,
          [p.id],
        );
        updated++;
        continue;
      }

      const predictionLottery = getPredictionLotteryConfig(p.lottery).key;
      const drawDay = findDrawDay(predictionLottery, day);
      if (!drawDay) {
        await pool.query(
          `
          UPDATE predictions
SET matched_main = NULL,
    matched_stars = NULL,
    result_label = 'no_draw_for_date',
    status = 'pending'
WHERE id = $1
          `,
          [p.id],
        );
        updated++;
        continue;
      }

      if (drawDay !== day) shifted.push([day, drawDay]);

      const draw = drawsByLotteryAndDay.get(`${predictionLottery}:${drawDay}`);
      const mMain = countMatches(pMain, draw.main);
      const mStars = countMatches(pStars, draw.stars);
      const label =
        drawDay !== day
          ? `${mMain}+${mStars} (draw:${drawDay})`
          : `${mMain}+${mStars}`;

      await pool.query(
        `
        UPDATE predictions
        SET matched_main = $2,
            matched_stars = $3,
            result_label = $4,
            status = 'checked'
        WHERE id = $1
        `,
        [p.id, mMain, mStars, label],
      );

      updated++;
    }

    const payload = { ok: true, checked, updated, skipped };

    if (debug) {
      return res.json({
        ...payload,
        debug: {
          shiftedCount: shifted.length,
          samplePredictions: predMeta.slice(0, 10),
          sampleShifted: shifted.slice(0, 10),
        },
      });
    }

    return res.json(payload);
  } catch (err) {
    console.error('POST /predictions/check failed:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'check_failed', message: err?.message });
  }
});

/**
 * DELETE /api/predictions/:id
 */
router.delete('/predictions/:id', async (req, res) => {
  try {
    const currentUser = await getCurrentDrawlyticsUser(req);

    if (!currentUser) {
      return res.status(401).json({
        ok: false,
        error: 'unauthenticated',
      });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'invalid_id',
      });
    }

    const result = await pool.query(
      `
      DELETE FROM predictions
      WHERE id = $1
        AND user_id = $2
      RETURNING id
      `,
      [id, currentUser.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        error: 'prediction_not_found',
      });
    }

    return res.status(204).send();
  } catch (err) {
    console.error('DELETE /predictions/:id failed:', err);

    return res.status(500).json({
      ok: false,
      error: 'delete_failed',
    });
  }
});

export default router;
