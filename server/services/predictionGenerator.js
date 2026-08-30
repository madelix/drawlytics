import { pool } from '../db.js';

export function getPredictionLotteryConfig(lotteryRaw) {
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

export async function resolveLotteryDrawDate(drawDateRaw, lotteryConfig) {
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

export const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const sampleUnique = (min, max, count) => {
  const set = new Set();
  while (set.size < count) set.add(randInt(min, max));
  return Array.from(set).sort((a, b) => a - b);
};

export const weightedSampleUnique = (weights, count, temperature = 1) => {
  const picked = new Set();

  while (picked.size < count) {
    const available = weights.filter((item) => !picked.has(item.n));
    const adjusted = available.map((item) => ({
      ...item,
      weight: Math.pow(item.weight, 1 / temperature),
    }));

    const totalWeight = adjusted.reduce((sum, item) => sum + item.weight, 0);

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

export const buildLinearWeights = (min, max, direction = 'ascending') => {
  const weights = [];

  for (let n = min; n <= max; n++) {
    const base = direction === 'descending' ? max - n + 1 : n - min + 1;

    weights.push({ n, weight: base });
  }

  return weights;
};

export const buildFrequencyWeights = (min, max, rows, keys) => {
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

export const buildRecencyFrequencyWeights = (min, max, rows, keys) => {
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

export const buildBayesianWeights = (min, max, rows, keys) => {
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

export const buildTrendBoostWeights = (min, max, rows, keys) => {
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

export const buildMarkovWeights = (min, max, rows, keys) => {
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

    const nextNums = keys.map((k) => Number(next[k])).filter(Number.isFinite);

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

export const buildStatisticalWeights = (min, max, rows, keys) => {
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

export const buildDecisionTreeWeights = (min, max, rows, keys) => {
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

export const buildQLearningWeights = (min, max, rows, keys) => {
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

export const buildNeuralNetworkWeights = (min, max, rows, keys) => {
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
          1 + recencySignal * 0.3 + Math.sin(normalizedPosition * Math.PI) * 2;

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

export const buildLSTMWeights = (min, max, rows, keys) => {
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

export const mergeWeightSets = (...sets) => {
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

export const buildMetaLearningWeights = (min, max, rows, keys) => {
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

export const getBaseConfidence = (strategyKey) => {
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

export const sampleRangeBalancedMainNumbers = (historyRows) => {
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

export const generateOneLine = (strategy, lotteryConfig, historyRows) => {
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

export async function generatePredictionBatch({
  lotteryRaw,
  strategy,
  lines = 1,
  drawDateRaw = null,
}) {
  const canonicalLottery = getPredictionLotteryConfig(lotteryRaw).key;
  const lotteryConfig = getPredictionLotteryConfig(canonicalLottery);

  const resolved = await resolveLotteryDrawDate(drawDateRaw, lotteryConfig);

  if (!resolved.ok) {
    return resolved;
  }

  const { rows: historyRows } = await pool.query(
    `
    SELECT *
    FROM ${lotteryConfig.table}
    ORDER BY draw_date DESC
    LIMIT 200
    `,
  );

  const predictions = [];

  for (let i = 0; i < lines; i++) {
    predictions.push(generateOneLine(strategy, lotteryConfig, historyRows));
  }

  return {
    ok: true,
    lotteryConfig,
    draw_date: resolved.draw_date,
    predictions,
  };
}
