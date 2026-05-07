// client/src/pages/ModelPerformancePage.tsx
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import {
  getModelHistory,
  getModelPerformance,
  type ModelHistoryPoint,
  type ModelPerformanceRow,
} from '../api/performance';

function toNum(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatPctFromString(s: string) {
  const n = Number(s);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

function formatNum(n: number, decimals = 2) {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(decimals);
}

function scoreLabel(
  score: number,
  type: 'consistency' | 'confidence' | 'upside',
) {
  if (type === 'upside') {
    if (score >= 0.35) return 'strong upside';
    if (score >= 0.15) return 'moderate upside';
    return 'limited upside';
  }

  if (score >= 0.66) return `strong ${type}`;
  if (score >= 0.33) return `solid ${type}`;
  return `low ${type}`;
}

function strategyLabel(strategy: 'safe' | 'balanced' | 'aggressive') {
  if (strategy === 'safe') return 'Safe';
  if (strategy === 'aggressive') return 'Aggressive';
  return 'Balanced';
}

function reliabilityLabel(checked: number) {
  if (checked >= 50) return 'Proven sample';
  if (checked >= 20) return 'Reliable sample';
  if (checked >= 10) return 'Building evidence';
  return 'Low sample';
}

const MODEL_COLOR_MAP: Record<string, string> = {
  balanced_hot_cold: '#7C3AED', // purple
  hot_focused: '#EF4444', // red
  cold_focused: '#2563EB', // blue
  overdue: '#F97316', // orange
  strategy_mix: '#6d28d9', // strategy mix lavender/purple
  pure_random: '#22C55E', // green
  ai_ensemble: '#8B5CF6',
  ai_statistical_analysis: '#0EA5E9',
  ai_random_forest: '#10B981',
  ai_decision_tree: '#F59E0B',
  ai_gradient_boosting: '#EF4444',
  ai_xgboost: '#EC4899',
  ai_q_learning: '#14B8A6',
  ai_advanced_analysis: '#6366F1',
  ai_markov_chain: '#84CC16',
  ai_meta_learning: '#A855F7',
};

// Stable “hash -> hue” so each model always gets the same colour
function hashString(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function modelColor(stableKey: string) {
  const h = hashString(stableKey);
  const hue = 220 + (h % 90); // 220..309
  const sat = 62 + (h % 10); // 62..71
  const light = 46 + (h % 10); // 46..55
  return `hsl(${hue} ${sat}% ${light}%)`;
}

type ChartRow = {
  model_key: string;
  model_display_name: string;

  checked: number;
  total: number;
  checked_rate_pct: string;
  strategy_mix_predictions: number;

  avg_main_n: number;
  avg_stars_n: number;
  avg_total_hits: number;
  recent_avg_total_hits_n: number;

  confidence: number;
  reliability: string;
  jackpots: number;
  high_hit_predictions: number;
  four_plus_hits: number;
  five_plus_hits: number;

  high_hit_rate: number;
  four_plus_rate: number;
  five_plus_rate: number;
  upside_score: number;
  trend: 'up' | 'down' | 'flat';
  trend_delta: number;
  consistency_score: number;
  recommendation_score: number;
  baseline_win_rate_global: number;
  baseline_wins: number;
  baseline_compared: number;
  baseline_weighted_score: number;
  strategy_score: number;
  strategy_insight: string;
  strategy_reasons: string[];
  insight: string;
  personality: 'stable' | 'aggressive' | 'balanced' | 'experimental';

  color: string;
};

type NivoBarRow = {
  model: string; // label shown on Y axis
  avg_total_hits: number;
};

function Card({
  title,
  value,
  sub,
  right,
}: {
  title: string;
  value: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #eef2f7',
        borderRadius: 16,
        padding: 'clamp(12px, 3vw, 14px)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
        minWidth: 0,
        flex: '1 1 240px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 6,
        }}
      >
        <div style={{ fontSize: 12, color: '#6b7280' }}>{title}</div>
        {right}
      </div>

      <div style={{ fontWeight: 900, fontSize: 18, color: '#111827' }}>
        {value}
      </div>

      {sub && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function TopPick({
  label,
  model,
  metric,
}: {
  label: string;
  model: ChartRow | null;
  metric: ReactNode;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #eef2f7',
        borderRadius: 14,
        padding: '10px 12px',
        minWidth: 180,
        flex: '1 1 180px',
      }}
    >
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontWeight: 900, color: '#111827' }}>
        {model ? model.model_display_name : '—'}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>
        {metric}
      </div>
    </div>
  );
}

export default function ModelPerformancePage() {
  const [lottery, setLottery] = useState('euromillions');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<ModelPerformanceRow[]>([]);
  const [history, setHistory] = useState<ModelHistoryPoint[]>([]);
  const [baselineHistory, setBaselineHistory] = useState<ModelHistoryPoint[]>(
    [],
  );
  const [comparisonModelKeys, setComparisonModelKeys] = useState<string[]>([]);
  const [comparisonHistories, setComparisonHistories] = useState<
    Record<string, ModelHistoryPoint[]>
  >({});
  const [historyHover, setHistoryHover] = useState<{
    drawIndex: number;
    x: number;
    y: number;
  } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [minChecked, setMinChecked] = useState(0);
  const [rankingMode, setRankingMode] = useState<
    'average' | 'upside' | 'consistency' | 'baseline'
  >('average');
  const [strategyMode, setStrategyMode] = useState<
    'safe' | 'balanced' | 'aggressive'
  >('balanced');
  const [isMobile, setIsMobile] = useState(false);

  const [rankDeltaByKey, setRankDeltaByKey] = useState<
    Record<string, number | null>
  >({});

  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(null);

  const [trendByKey, setTrendByKey] = useState<
    Record<string, 'up' | 'down' | 'flat' | 'new'>
  >({});

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const data = await getModelPerformance({ lottery });
      setRows(data.models || []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load model performance');
    } finally {
      setLoading(false);
    }
  }
  async function loadHistory(modelKey: string) {
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const data = await getModelHistory({
        model_key: modelKey,
        lottery,
      });

      setHistory(data.history || []);
      setBaselineHistory(data.baseline_history || []);
      setComparisonHistories((prev) => ({
        ...prev,
        [modelKey]: data.history || [],
      }));
    } catch (e: any) {
      setHistory([]);
      setHistoryError(e?.message ?? 'Failed to load model history');
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 700px)');

    const updateIsMobile = () => {
      setIsMobile(mediaQuery.matches);
    };

    updateIsMobile();
    mediaQuery.addEventListener('change', updateIsMobile);

    return () => {
      mediaQuery.removeEventListener('change', updateIsMobile);
    };
  }, []);

  const summary = useMemo(() => {
    const checked = rows.reduce(
      (acc, r) => acc + (r.checked_predictions || 0),
      0,
    );
    const total = rows.reduce((acc, r) => acc + (r.total_predictions || 0), 0);
    return { total, checked };
  }, [rows]);

  const chartRows = useMemo<ChartRow[]>(() => {
    return (rows || [])
      .map((r) => {
        const avgMain = toNum(r.avg_main, 0);
        const avgStars = toNum(r.avg_stars, 0);
        const avgTotal = avgMain + avgStars;
        const recentAvgTotal = toNum(
          (r as any).recent_avg_total_hits,
          avgTotal,
        );
        const checked = r.checked_predictions ?? 0;
        const highHitCount = r.high_hit_predictions ?? 0;
        const fourPlusCount = r.four_plus_hits ?? 0;
        const fivePlusCount = r.five_plus_hits ?? 0;

        const highHitRate = checked > 0 ? highHitCount / checked : 0;
        const fourPlusRate = checked > 0 ? fourPlusCount / checked : 0;
        const fivePlusRate = checked > 0 ? fivePlusCount / checked : 0;
        const sampleFactor = Math.min(1, checked / 20); // scales 0 → 1

        const consistencyScore =
          (avgTotal * 0.6 + highHitRate * 0.4) * sampleFactor;

        const confidenceScore = consistencyScore * 0.6 + sampleFactor * 0.4;

        const upsideScore =
          highHitRate * 1 + fourPlusRate * 2 + fivePlusRate * 4;

        let trend: 'up' | 'down' | 'flat';

        const baselineWins = r.baseline_wins ?? 0;
        const baselineCompared = r.baseline_compared_draws ?? 0;

        const baselineWinRateGlobal =
          baselineCompared > 0 ? baselineWins / baselineCompared : 0;

        const baselineSampleFactor = Math.min(1, baselineCompared / 20);

        const baselineWeightedScore =
          baselineWinRateGlobal * baselineSampleFactor;

        const recommendationScore =
          avgTotal * 0.35 +
          upsideScore * 0.25 +
          consistencyScore * 0.25 +
          confidenceScore * 0.15;

        const delta = recentAvgTotal - avgTotal;

        let strategyScore: number;

        if (strategyMode === 'safe') {
          strategyScore =
            consistencyScore * 0.5 +
            baselineWeightedScore * 0.4 +
            Math.max(0, delta) * 0.1;
        } else if (strategyMode === 'aggressive') {
          strategyScore =
            consistencyScore * 0.2 +
            baselineWeightedScore * 0.3 +
            Math.max(0, delta) * 0.5 +
            upsideScore * 0.3;
        } else {
          // balanced (default)
          strategyScore =
            consistencyScore * 0.4 +
            baselineWeightedScore * 0.4 +
            Math.max(0, delta) * 0.2;
        }

        let strategyInsight: string;

        if (baselineWeightedScore >= 0.5 && consistencyScore >= 0.5) {
          strategyInsight =
            baselineCompared >= 20
              ? 'Strong and proven, consistently beats random'
              : 'Strong performance, but still building sample';
        } else if (baselineWeightedScore >= 0.5) {
          strategyInsight =
            baselineCompared >= 20
              ? 'Beating random reliably, moderate consistency'
              : 'Beating random, but sample is still limited';
        } else if (consistencyScore >= 0.5) {
          strategyInsight =
            baselineCompared >= 20
              ? 'Realiable and consistent, outperforming random with moderate edge'
              : 'Consistent so far, but not yet proven vs random';
        } else if (delta > 0.05) {
          strategyInsight =
            baselineCompared >= 10
              ? 'Improving recently, showing emerging potential'
              : 'Early signs of improvement, but very limited data';
        } else {
          strategyInsight =
            baselineCompared >= 10
              ? 'Unproven or below baseline performance'
              : 'Too little data to assess reliably';
        }

        const strategyReasons: string[] = [];

        if (consistencyScore >= 0.5) {
          strategyReasons.push('consistent results');
        }

        if (baselineWinRateGlobal >= 0.45 && baselineCompared >= 10) {
          strategyReasons.push('competitive vs random');
        }

        if (delta > 0.05) {
          strategyReasons.push('recently improving');
        }

        if (upsideScore >= 0.15) {
          strategyReasons.push('some upside potential');
        }

        if (strategyReasons.length === 0) {
          strategyReasons.push('best available balance for now');
        }

        if (delta > 0.05) {
          trend = 'up';
        } else if (delta < -0.05) {
          trend = 'down';
        } else {
          trend = 'flat';
        }

        let insight: string;

        if (checked < 10) {
          insight = 'Low sample, results not yet reliable';
        } else if (consistencyScore >= 0.6 && upsideScore >= 0.2) {
          insight = 'Strong and reliable with good upside';
        } else if (consistencyScore >= 0.6) {
          insight = 'Reliable performance, lower volatility';
        } else if (upsideScore >= 0.25) {
          insight = 'High upside but volatile results';
        } else if (trend === 'up') {
          insight = 'Improving recent performance';
        } else if (trend === 'down') {
          insight = 'Recent performance declining';
        } else {
          insight = 'Stable but unremarkable performance';
        }

        let personality: ChartRow['personality'];

        if (r.model_key === 'strategy_mix') {
          personality = 'balanced';
        } else if (checked < 10) {
          personality = 'experimental';
        } else if (consistencyScore >= 0.5) {
          personality = 'stable'; // reliable performer
        } else if (upsideScore >= 0.25 && consistencyScore < 0.3) {
          personality = 'aggressive'; // high risk / high reward
        } else if (avgTotal >= 0.9 && upsideScore >= 0.1) {
          personality = 'balanced'; // good mix
        } else {
          personality = 'stable';
        }

        return {
          model_key: r.model_key,
          model_display_name: r.model_display_name,

          checked: r.checked_predictions,
          total: r.total_predictions,
          checked_rate_pct: r.checked_rate_pct,
          strategy_mix_predictions: r.strategy_mix_predictions ?? 0,

          avg_main_n: avgMain,
          avg_stars_n: avgStars,
          avg_total_hits: avgTotal,
          recent_avg_total_hits_n: recentAvgTotal,
          trend_delta: delta,
          consistency_score: consistencyScore,
          insight,
          recommendation_score: recommendationScore,

          confidence: confidenceScore,
          reliability: reliabilityLabel(checked),
          jackpots: r.jackpots ?? 0,
          high_hit_predictions: r.high_hit_predictions ?? 0,
          four_plus_hits: r.four_plus_hits ?? 0,
          five_plus_hits: r.five_plus_hits ?? 0,

          high_hit_rate: highHitRate,
          four_plus_rate: fourPlusRate,
          five_plus_rate: fivePlusRate,
          upside_score: upsideScore,
          baseline_win_rate_global: baselineWinRateGlobal,
          baseline_wins: baselineWins,
          baseline_compared: baselineCompared,
          baseline_weighted_score: baselineWeightedScore,
          strategy_score: strategyScore,
          strategy_insight: strategyInsight,
          strategy_reasons: strategyReasons,
          trend,
          personality,

          color: MODEL_COLOR_MAP[r.model_key] ?? modelColor(r.model_key),
        };
      })
      .sort((a, b) => b.avg_total_hits - a.avg_total_hits);
  }, [rows]);

  const topAverageModel = useMemo(() => {
    return (
      [...chartRows].sort((a, b) => b.avg_total_hits - a.avg_total_hits)[0] ??
      null
    );
  }, [chartRows]);

  const topUpsideModel = useMemo(() => {
    return (
      [...chartRows].sort((a, b) => b.upside_score - a.upside_score)[0] ?? null
    );
  }, [chartRows]);

  const topConsistencyModel = useMemo(() => {
    return (
      [...chartRows].sort(
        (a, b) => b.consistency_score - a.consistency_score,
      )[0] ?? null
    );
  }, [chartRows]);

  const filtered = useMemo(() => {
    return chartRows
      .filter((r) => r.checked >= minChecked)
      .sort((a, b) =>
        rankingMode === 'average'
          ? b.avg_total_hits - a.avg_total_hits
          : rankingMode === 'upside'
            ? b.upside_score - a.upside_score
            : rankingMode === 'consistency'
              ? b.consistency_score - a.consistency_score
              : b.baseline_weighted_score - a.baseline_weighted_score,
      );
  }, [chartRows, minChecked, rankingMode]);

  useEffect(() => {
    const LS_KEY = 'drawlytics_model_ranks_prev';

    const LS_KEY_PERF = 'drawlytics_model_perf_prev';

    const currentRanks: Record<string, number> = {};
    filtered.forEach((r, i) => {
      currentRanks[r.model_key] = i + 1;
    });

    const currentPerf: Record<string, number> = {};
    filtered.forEach((r) => {
      currentPerf[r.model_key] = r.avg_total_hits;
    });

    let prevRanks: Record<string, number> | null = null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      prevRanks = raw ? (JSON.parse(raw) as Record<string, number>) : null;
    } catch {
      prevRanks = null;
    }

    let prevPerf: Record<string, number> | null = null;
    try {
      const rawPerf = localStorage.getItem(LS_KEY_PERF);
      prevPerf = rawPerf
        ? (JSON.parse(rawPerf) as Record<string, number>)
        : null;
    } catch {
      prevPerf = null;
    }

    const deltas: Record<string, number | null> = {};
    for (const r of filtered) {
      const prev = prevRanks?.[r.model_key];
      const cur = currentRanks[r.model_key];
      deltas[r.model_key] = typeof prev === 'number' ? prev - cur : null;
    }

    const trends: Record<string, 'up' | 'down' | 'flat' | 'new'> = {};

    for (const r of filtered) {
      const prev = prevPerf?.[r.model_key];
      const cur = currentPerf[r.model_key];

      if (typeof prev !== 'number') {
        trends[r.model_key] = 'new';
      } else {
        const diff = cur - prev;

        if (diff > 0.05) trends[r.model_key] = 'up';
        else if (diff < -0.05) trends[r.model_key] = 'down';
        else trends[r.model_key] = 'flat';
      }
    }

    setRankDeltaByKey(deltas);
    setTrendByKey(trends);

    try {
      localStorage.setItem(LS_KEY, JSON.stringify(currentRanks));
      localStorage.setItem(LS_KEY_PERF, JSON.stringify(currentPerf));
    } catch {
      // ignore
    }
  }, [filtered]);

  const hiddenCount = useMemo(() => {
    return Math.max(0, rows.length - filtered.length);
  }, [rows.length, filtered.length]);

  const bestStrategyModel = useMemo(() => {
    return (
      [...chartRows].sort((a, b) => b.strategy_score - a.strategy_score)[0] ??
      null
    );
  }, [chartRows]);

  const strategyPortfolio = useMemo(() => {
    const top = [...chartRows]
      .filter((model) => model.model_key !== 'pure_random')
      .sort((a, b) => b.strategy_score - a.strategy_score)
      .slice(0, 3);

    const totalScore = top.reduce((sum, m) => sum + m.strategy_score, 0);

    return top.map((m) => ({
      ...m,
      weight: totalScore > 0 ? m.strategy_score / totalScore : 0,
    }));
  }, [chartRows]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'drawlytics_suggested_strategy_mix',
        JSON.stringify(
          strategyPortfolio.map((model) => ({
            model_key: model.model_key,
            weight: model.weight,
          })),
        ),
      );
    } catch {
      // ignore localStorage errors
    }
  }, [strategyPortfolio]);

  const selectedModel = useMemo(() => {
    if (!selectedModelKey) return null;
    return filtered.find((r) => r.model_key === selectedModelKey) ?? null;
  }, [filtered, selectedModelKey]);

  useEffect(() => {
    if (!selectedModelKey) {
      setHistory([]);
      setBaselineHistory([]);
      setComparisonModelKeys([]);
      setComparisonHistories({});
      return;
    }

    setComparisonModelKeys([selectedModelKey]);
    loadHistory(selectedModelKey);
  }, [selectedModelKey, lottery]);

  const recommendedModel = useMemo(() => {
    return (
      [...chartRows].sort((a, b) => {
        const getScore = (row: ChartRow) => {
          if (strategyMode === 'safe') {
            return row.consistency_score * 0.6 + row.confidence * 0.4;
          }

          if (strategyMode === 'aggressive') {
            return row.upside_score * 0.7 + row.avg_total_hits * 0.3;
          }

          return row.recommendation_score;
        };

        return getScore(b) - getScore(a);
      })[0] ?? null
    );
  }, [chartRows, strategyMode]);

  const biggestMover = useMemo(() => {
    const movers = filtered.filter((r) => r.trend !== 'flat');
    if (movers.length === 0) return null;

    return [...movers].sort((a, b) => {
      const aDiff = Math.abs(a.recent_avg_total_hits_n - a.avg_total_hits);
      const bDiff = Math.abs(b.recent_avg_total_hits_n - b.avg_total_hits);
      return bDiff - aDiff;
    })[0];
  }, [filtered]);

  const heatingUp = useMemo(() => {
    return [...filtered]
      .filter((r) => r.trend === 'up')
      .sort((a, b) => b.trend_delta - a.trend_delta);
  }, [filtered]);

  const coolingDown = useMemo(() => {
    return filtered.filter((r) => r.trend === 'down');
  }, [filtered]);

  const byLabel = useMemo(() => {
    const m = new Map<string, ChartRow>();

    for (const r of filtered) {
      const rank = filtered.findIndex((x) => x.model_key === r.model_key) + 1;
      const label = isMobile ? `#${rank}` : `#${rank} ${r.model_display_name}`;

      m.set(label, r);
    }

    return m;
  }, [filtered, isMobile]);

  const barData = useMemo<NivoBarRow[]>(() => {
    return [...filtered]
      .map((r, i) => ({
        model: isMobile ? `#${i + 1}` : `#${i + 1} ${r.model_display_name}`,
        avg_total_hits:
          rankingMode === 'average'
            ? r.avg_total_hits
            : rankingMode === 'upside'
              ? r.upside_score
              : rankingMode === 'consistency'
                ? r.consistency_score
                : r.baseline_weighted_score,
      }))
      .reverse();
  }, [filtered, rankingMode, isMobile]);

  const checkedCoveragePct = useMemo(() => {
    if (!summary.total) return null;
    return (100 * summary.checked) / summary.total;
  }, [summary.total, summary.checked]);

  const historyChartData = useMemo(() => {
    if (!selectedModel) return [];

    return [
      {
        id: selectedModel.model_display_name,
        data: history.map((point, index) => ({
          x: index + 1,
          y: toNum(point.avg_total_hits, 0),
        })),
        color: selectedModel.color,
      },
    ];
  }, [history, selectedModel]);

  const baselineWinRate = useMemo(() => {
    if (!history.length || !baselineHistory.length) return null;

    const comparedDraws = Math.min(history.length, baselineHistory.length);

    if (comparedDraws === 0) return null;

    let wins = 0;

    for (let i = 0; i < comparedDraws; i++) {
      const modelHits = toNum(history[i].avg_total_hits, 0);
      const baselineHits = toNum(baselineHistory[i].avg_total_hits, 0);

      if (modelHits > baselineHits) {
        wins += 1;
      }
    }

    return {
      wins,
      comparedDraws,
      percentage: (wins / comparedDraws) * 100,
    };
  }, [history, baselineHistory]);

  const baselineVerdict = useMemo(() => {
    if (!baselineWinRate) return null;

    const pct = baselineWinRate.percentage;

    if (pct >= 60) return { label: 'Outperforming baseline', color: '#166534' };
    if (pct >= 40)
      return { label: 'Competitive with baseline', color: '#b45309' };

    return { label: 'Below baseline', color: '#b91c1c' };
  }, [baselineWinRate]);

  return (
    <div
      style={{
        maxWidth: 980,
        margin: '0 auto',
        padding: '20px 14px 28px',
      }}
    >
      <header style={{ textAlign: 'center', marginBottom: 14 }}>
        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 2.2rem)',
            lineHeight: 1.05,
            margin: 0,
          }}
        >
          Model performance
        </h1>
        <p
          style={{
            margin: '8px auto 0',
            color: '#6b7280',
            maxWidth: 680,
            lineHeight: 1.45,
          }}
        >
          A simple view: higher bars = more matches on average (main + stars).
        </p>
      </header>

      <div
        style={{
          display: 'flex',
          gap: isMobile ? 8 : 10,
          justifyContent: 'center',
          alignItems: isMobile ? 'stretch' : 'flex-start',
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <label
          style={{
            fontSize: 14,
            color: '#6b7280',
            width: isMobile ? '100%' : 'auto',
          }}
        >
          Lottery&nbsp;
          <input
            value={lottery}
            onChange={(e) => setLottery(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: '#fff',
              width: isMobile ? '100%' : undefined,
              marginTop: 4,
            }}
          />
        </label>

        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: '8px 14px',
            borderRadius: 999,
            border: '1px solid #e5e7eb',
            background: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div style={{ textAlign: 'center', color: '#6b7280', marginBottom: 14 }}>
        Models: {filtered.length} (of {rows.length}) · Total predictions:{' '}
        {summary.total} · Checked: {summary.checked}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          margin: '0 auto 14px',
          maxWidth: 980,
        }}
      >
        <Card
          title="Best model right now"
          value={bestStrategyModel ? bestStrategyModel.model_display_name : '—'}
          sub={
            bestStrategyModel ? (
              <>
                <div>{bestStrategyModel.strategy_insight}</div>
              </>
            ) : (
              <>No models available.</>
            )
          }
          right={
            bestStrategyModel ? (
              <span
                aria-hidden
                title="Model colour"
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: bestStrategyModel.color,
                  display: 'inline-block',
                  marginTop: 2,
                }}
              />
            ) : null
          }
        />

        <Card
          title="Suggested mix"
          value={
            strategyPortfolio.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  const mix = strategyPortfolio.map((model) => ({
                    key: model.model_key,
                    weight: model.weight,
                  }));

                  localStorage.setItem(
                    'drawlytics_suggested_strategy_mix',
                    JSON.stringify(mix),
                  );

                  window.location.href = '/make-magic';
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  margin: 0,
                  font: 'inherit',
                  fontWeight: 900,
                  color: '#111827',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                title="Open Strategy Builder"
              >
                {strategyPortfolio
                  .map((model) =>
                    model.model_display_name
                      .replace('Balanced Hot/Cold', 'Balanced')
                      .replace('Cold Focused', 'Cold')
                      .replace('Hot Focused', 'Hot')
                      .replace('Pure Random', 'Random'),
                  )
                  .join(' + ')}
              </button>
            ) : (
              '—'
            )
          }
          sub={
            strategyPortfolio.length > 0 ? (
              <>
                Suggested split:{' '}
                {strategyPortfolio
                  .map((model) => {
                    const shortName = model.model_display_name
                      .replace('Balanced Hot/Cold', 'Balanced')
                      .replace('Cold Focused', 'Cold')
                      .replace('Hot Focused', 'Hot')
                      .replace('Pure Random', 'Random');

                    return `${shortName} ${Math.round(model.weight * 100)}%`;
                  })
                  .join(' · ')}
              </>
            ) : (
              <>No mix available yet.</>
            )
          }
        />

        <Card
          title={`Recommended · ${strategyLabel(strategyMode)}`}
          value={recommendedModel ? recommendedModel.model_display_name : '—'}
          sub={
            recommendedModel ? (
              <>
                <div style={{ marginBottom: 8 }}>
                  {scoreLabel(recommendedModel.confidence, 'confidence')} and{' '}
                  {scoreLabel(
                    recommendedModel.consistency_score,
                    'consistency',
                  )}{' '}
                  make this a reliable choice, with{' '}
                  {scoreLabel(recommendedModel.upside_score, 'upside')}.
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: isMobile ? 4 : 6,
                    flexWrap: 'wrap',
                    marginTop: 2,
                  }}
                >
                  {[
                    { label: 'Safe', value: 'safe' as const },
                    { label: 'Balanced', value: 'balanced' as const },
                    { label: 'Aggressive', value: 'aggressive' as const },
                  ].map((option) => {
                    const active = strategyMode === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setStrategyMode(option.value)}
                        style={{
                          padding: isMobile ? '3px 7px' : '4px 8px',
                          borderRadius: 999,
                          background: active ? '#111827' : '#f8fafc',
                          color: active ? '#fff' : '#374151',
                          border: active
                            ? '1px solid #111827'
                            : '1px solid #e5e7eb',
                          fontSize: isMobile ? 10 : 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>No recommendation available yet.</>
            )
          }
          right={
            recommendedModel ? (
              <span
                aria-hidden
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: recommendedModel.color,
                  display: 'inline-block',
                  marginTop: 2,
                }}
                title="Model colour"
              />
            ) : null
          }
        />
      </div>

      {error && (
        <p style={{ color: '#b91c1c', textAlign: 'center' }}>{error}</p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: 10,
          margin: '0 auto 14px',
          maxWidth: 980,
        }}
      >
        <TopPick
          label="Best average"
          model={topAverageModel}
          metric={
            topAverageModel
              ? `Avg ${formatNum(topAverageModel.avg_total_hits, 2)}`
              : 'No data'
          }
        />

        <TopPick
          label="Highest upside"
          model={topUpsideModel}
          metric={
            topUpsideModel
              ? `Upside ${formatNum(topUpsideModel.upside_score, 2)}`
              : 'No data'
          }
        />

        <TopPick
          label="Most consistent"
          model={topConsistencyModel}
          metric={
            topConsistencyModel
              ? `Consistency ${formatNum(topConsistencyModel.consistency_score, 2)}`
              : 'No data'
          }
        />

        <TopPick
          label="Trending up"
          model={heatingUp[0] ?? null}
          metric={
            heatingUp[0]
              ? `Trend +${formatNum(heatingUp[0].trend_delta, 2)}`
              : 'No active trend'
          }
        />
      </div>

      {/* Chart */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #eef2f7',
          borderRadius: 16,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        <div
          style={{ padding: '12px 14px', borderBottom: '1px solid #eef2f7' }}
        >
          <div style={{ fontWeight: 800 }}>
            {rankingMode === 'average'
              ? 'Average hits per prediction'
              : rankingMode === 'upside'
                ? 'Upside score by model'
                : 'Consistency score by model'}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {rankingMode === 'average'
              ? 'Bars = avg(main + stars). Click a bar to inspect model history.'
              : rankingMode === 'upside'
                ? 'Bars = upside score (high-hit potential).'
                : 'Bars = consistency score (stability + sample size).'}
          </div>
        </div>

        <div
          style={{
            height: isMobile
              ? 'auto'
              : Math.max(260, 48 + filtered.length * 38),
            padding: isMobile ? 14 : 10,
          }}
        >
          {isMobile ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {filtered.map((r, i) => {
                const value =
                  rankingMode === 'average'
                    ? r.avg_total_hits
                    : rankingMode === 'upside'
                      ? r.upside_score
                      : rankingMode === 'consistency'
                        ? r.consistency_score
                        : r.baseline_weighted_score;

                const maxValue = Math.max(
                  ...filtered.map((model) =>
                    rankingMode === 'average'
                      ? model.avg_total_hits
                      : rankingMode === 'upside'
                        ? model.upside_score
                        : rankingMode === 'consistency'
                          ? model.consistency_score
                          : model.baseline_weighted_score,
                  ),
                  1,
                );

                const widthPct = Math.max(4, (value / maxValue) * 100);

                return (
                  <button
                    key={r.model_key}
                    type="button"
                    onClick={() =>
                      setSelectedModelKey((prev) =>
                        prev === r.model_key ? null : r.model_key,
                      )
                    }
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '44px minmax(0, 1fr)',
                      gap: 10,
                      alignItems: 'center',
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        justifySelf: 'start',
                        fontSize: 12,
                        fontWeight: 900,
                        padding: '4px 8px',
                        borderRadius: 999,
                        background: i === 0 ? '#f59e0b' : '#f1f5f9',
                        color: i === 0 ? '#111827' : '#111827',
                      }}
                    >
                      #{i + 1}
                    </span>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: '#111827',
                          marginBottom: 5,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {r.model_display_name}
                      </div>

                      <div
                        style={{
                          height: 26,
                          borderRadius: 999,
                          background: '#f1f5f9',
                          overflow: 'hidden',
                          position: 'relative',
                        }}
                      >
                        <div
                          style={{
                            width: `${widthPct}%`,
                            height: '100%',
                            borderRadius: 999,
                            background: r.color,
                          }}
                        />

                        <span
                          style={{
                            position: 'absolute',
                            right: 10,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: 12,
                            fontWeight: 900,
                            color: '#111827',
                          }}
                        >
                          {formatNum(value, 2)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <ResponsiveBar
              data={barData}
              keys={['avg_total_hits']}
              indexBy="model"
              layout="horizontal"
              margin={{ top: 10, right: 24, bottom: 40, left: 220 }}
              padding={0.3}
              enableGridY={false}
              enableGridX={true}
              enableLabel={true}
              label={(d) => formatNum(toNum(d.value, 0), 2)}
              labelSkipWidth={36}
              labelTextColor={{ from: 'color', modifiers: [['darker', 3]] }}
              colors={(bar) => {
                const label = String(bar.indexValue);
                return byLabel.get(label)?.color ?? '#7c3aed';
              }}
              axisTop={null}
              axisRight={null}
              axisLeft={{
                tickSize: 0,
                tickPadding: 10,
                tickRotation: 0,
              }}
              axisBottom={{
                tickSize: 5,
                tickPadding: 6,
                legend: 'Avg total hits (main + stars)',
                legendPosition: 'middle',
                legendOffset: 32,
              }}
              onClick={(bar) => {
                const label = String(bar.indexValue);
                const model = byLabel.get(label);

                if (!model) return;

                setSelectedModelKey((prev) =>
                  prev === model.model_key ? null : model.model_key,
                );
              }}
              tooltip={() => null}
              theme={{
                axis: {
                  ticks: { text: { fill: '#6b7280', fontSize: 12 } },
                  legend: { text: { fill: '#6b7280', fontSize: 12 } },
                },
                grid: { line: { stroke: '#eef2f7', strokeWidth: 1 } },
                labels: { text: { fontSize: 12, fontWeight: 700 } },
              }}
            />
          )}
        </div>
      </div>

      {selectedModel && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #eef2f7',
            borderRadius: 16,
            padding: 14,
            margin: '0 auto 14px',
            maxWidth: 980,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>
            {selectedModel.model_display_name}
          </div>

          <div style={{ fontSize: 13, color: '#111827', marginBottom: 6 }}>
            {selectedModel.insight}
          </div>

          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
            Avg <strong>{formatNum(selectedModel.avg_total_hits, 2)}</strong> ·
            main {formatNum(selectedModel.avg_main_n, 2)} · stars{' '}
            {formatNum(selectedModel.avg_stars_n, 2)} · 3+ hits{' '}
            <strong>{selectedModel.high_hit_predictions}</strong> · 4+ hits{' '}
            <strong>{selectedModel.four_plus_hits}</strong> · 5+ hits{' '}
            <strong>{selectedModel.five_plus_hits}</strong> · checked{' '}
            <strong>{selectedModel.checked}</strong>/{selectedModel.total}
          </div>
        </div>
      )}

      {selectedModel && history.length > 0 && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #eef2f7',
            borderRadius: 16,
            padding: '14px 14px 28px',
            margin: '0 auto 14px',
            maxWidth: 980,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 10 }}>
            Performance over time
          </div>

          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              marginBottom: 10,
            }}
          >
            {filtered.map((model) => {
              const active = comparisonModelKeys.includes(model.model_key);

              return (
                <button
                  key={model.model_key}
                  type="button"
                  onClick={() => {
                    setComparisonModelKeys((prev) => {
                      if (active) {
                        if (prev.length === 1) return prev;
                        return prev.filter((key) => key !== model.model_key);
                      }

                      loadHistory(model.model_key);
                      return [...prev, model.model_key].slice(-3);
                    });
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 999,
                    border: active ? '1px solid #111827' : '1px solid #e5e7eb',
                    background: active ? '#111827' : '#f8fafc',
                    color: active ? '#fff' : '#374151',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {model.model_display_name}
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>
            {(() => {
              if (history.length < 2) {
                return 'Not enough data to assess trend.';
              }

              const mid = Math.floor(history.length / 2);
              const firstHalf = history.slice(0, mid);
              const secondHalf = history.slice(mid);

              const avg = (arr: typeof history) =>
                arr.reduce((sum, p) => sum + toNum(p.avg_total_hits, 0), 0) /
                arr.length;

              const diff = avg(secondHalf) - avg(firstHalf);

              const trend =
                diff > 0.05
                  ? 'improving'
                  : diff < -0.05
                    ? 'declining'
                    : 'stable';

              const reliability =
                history.length < 10
                  ? 'low reliability'
                  : history.length < 25
                    ? 'moderate reliability'
                    : 'high reliability';

              return (
                <>
                  {history.length} recent draws · <strong>{trend}</strong>{' '}
                  performance ({formatNum(diff, 2)}) ·{' '}
                  <span style={{ opacity: 0.7 }}>{reliability}</span>
                  {baselineWinRate &&
                    selectedModel?.model_key !== 'pure_random' && (
                      <>
                        {' '}
                        · beats baseline in{' '}
                        <strong>
                          {baselineWinRate.wins}/{baselineWinRate.comparedDraws}
                        </strong>{' '}
                        draws ({formatNum(baselineWinRate.percentage, 0)}%)
                      </>
                    )}
                  {baselineVerdict && (
                    <>
                      {' '}
                      ·{' '}
                      <span
                        style={{
                          color: baselineVerdict.color,
                          fontWeight: 700,
                        }}
                      >
                        {baselineVerdict.label}
                      </span>
                    </>
                  )}
                </>
              );
            })()}
          </div>

          <div style={{ height: 235, marginBottom: 22 }}>
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 400 200"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 400;

                const index = Math.round(
                  ((x - 10) / 380) * (history.length - 1),
                );

                if (index < 0 || index >= history.length) return;

                const px = (index / (history.length - 1)) * 380 + 10;
                const point = history[index];

                if (!point) return;

                const hits = toNum(point.avg_total_hits, 0);
                const py = 180 - hits * 30;

                setHistoryHover({
                  drawIndex: index + 1,
                  x: px,
                  y: py,
                });
              }}
              onMouseLeave={() => setHistoryHover(null)}
            >
              {[0, 1, 2, 3, 4, 5].map((v) => {
                const y = 180 - v * 30;

                return (
                  <g key={v}>
                    <line
                      x1={10}
                      y1={y}
                      x2={390}
                      y2={y}
                      stroke="#eef2f7"
                      strokeWidth={1}
                    />
                    <text x={0} y={y + 4} fontSize={10} fill="#9ca3af">
                      {v}
                    </text>
                  </g>
                );
              })}
              <line
                x1={10}
                y1={180}
                x2={390}
                y2={180}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
              {history.map((point, i) => {
                const x = (i / (history.length - 1)) * 380 + 10;
                const hits = toNum(point.avg_total_hits, 0);
                const y = 180 - hits * 30;

                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={4}
                    fill={selectedModel?.color ?? '#804198'}
                    onMouseEnter={() =>
                      setHistoryHover({
                        drawIndex: i + 1,
                        x,
                        y,
                      })
                    }
                    onMouseLeave={() => setHistoryHover(null)}
                    style={{ cursor: 'pointer' }}
                  />
                );
              })}

              {comparisonModelKeys.map((modelKey) => {
                const series =
                  modelKey === selectedModel?.model_key
                    ? history
                    : comparisonHistories[modelKey] || [];

                const color =
                  modelKey === selectedModel?.model_key
                    ? selectedModel?.color
                    : chartRows.find((m) => m.model_key === modelKey)?.color ||
                      '#9ca3af';

                if (!series || series.length < 2) return null;

                return series.map((point, i) => {
                  if (i === 0) return null;

                  const prev = series[i - 1];

                  const x1 = ((i - 1) / (series.length - 1)) * 380 + 10;
                  const y1 = 180 - toNum(prev.avg_total_hits, 0) * 30;

                  const x2 = (i / (series.length - 1)) * 380 + 10;
                  const y2 = 180 - toNum(point.avg_total_hits, 0) * 30;

                  return (
                    <line
                      key={`${modelKey}-${i}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={color}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      opacity={modelKey === selectedModel?.model_key ? 1 : 0.7}
                    />
                  );
                });
              })}

              {selectedModel?.model_key !== 'pure_random' &&
                baselineHistory.length > 0 &&
                baselineHistory.map((point, i) => {
                  if (i === 0) return null;

                  const prev = baselineHistory[i - 1];

                  const x1 =
                    ((i - 1) / (baselineHistory.length - 1)) * 380 + 10;
                  const y1 = 180 - toNum(prev.avg_total_hits, 0) * 30;

                  const x2 = (i / (baselineHistory.length - 1)) * 380 + 10;
                  const y2 = 180 - toNum(point.avg_total_hits, 0) * 30;

                  return (
                    <line
                      key={`baseline-${i}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#9ca3af"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      opacity={0.7}
                    />
                  );
                })}
              {historyHover &&
                (() => {
                  const tooltipWidth = 145;
                  const rowHeight = 14;

                  const rows = comparisonModelKeys
                    .map((modelKey) => {
                      const model = chartRows.find(
                        (m) => m.model_key === modelKey,
                      );
                      const series =
                        modelKey === selectedModel?.model_key
                          ? history
                          : comparisonHistories[modelKey] || [];

                      const point = series[historyHover.drawIndex - 1];

                      if (!model || !point) return null;

                      return {
                        name: model.model_display_name,
                        color: model.color,
                        hits: toNum(point.avg_total_hits, 0),
                      };
                    })
                    .filter(Boolean) as {
                    name: string;
                    color: string;
                    hits: number;
                  }[];

                  const baselinePoint =
                    baselineHistory[historyHover.drawIndex - 1];

                  if (
                    baselinePoint &&
                    selectedModel?.model_key !== 'pure_random'
                  ) {
                    rows.push({
                      name: 'Pure Random',
                      color: '#9ca3af',
                      hits: toNum(baselinePoint.avg_total_hits, 0),
                    });
                  }
                  rows.sort((a, b) => b.hits - a.hits);

                  const tooltipHeight = 24 + rows.length * rowHeight;

                  const tx = Math.max(
                    8,
                    Math.min(
                      historyHover.x - tooltipWidth / 2,
                      400 - tooltipWidth - 8,
                    ),
                  );

                  const ty = Math.max(8, historyHover.y - tooltipHeight - 6);

                  return (
                    <g>
                      <line
                        x1={historyHover.x}
                        y1={0}
                        x2={historyHover.x}
                        y2={180}
                        stroke="#9ca3af"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                        opacity={0.45}
                      />
                      <rect
                        x={tx}
                        y={ty}
                        width={tooltipWidth}
                        height={tooltipHeight}
                        rx={6}
                        fill="#111827"
                        opacity={0.94}
                      />

                      <text
                        x={tx + 8}
                        y={ty + 14}
                        fontSize={10}
                        fill="#fff"
                        fontWeight={800}
                      >
                        Draw {historyHover.drawIndex}
                      </text>

                      {rows.map((row, index) => (
                        <g key={row.name}>
                          <circle
                            cx={tx + 10}
                            cy={ty + 28 + index * rowHeight}
                            r={3}
                            fill={row.color}
                          />
                          <text
                            x={tx + 18}
                            y={ty + 31 + index * rowHeight}
                            fontSize={10}
                            fill={index === 0 ? '#fff' : '#9ca3af'}
                            fontWeight={index === 0 ? 800 : 500}
                          >
                            {row.name}
                          </text>

                          <text
                            x={tx + tooltipWidth - 8}
                            y={ty + 31 + index * rowHeight}
                            fontSize={10}
                            fill={index === 0 ? '#fff' : '#9ca3af'}
                            fontWeight={index === 0 ? 800 : 500}
                            textAnchor="end"
                          >
                            {formatNum(row.hits, 2)}
                          </text>
                        </g>
                      ))}
                    </g>
                  );
                })()}
            </svg>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 16,
                marginTop: 8,
                fontSize: 12,
                color: '#6b7280',
                flexWrap: 'wrap',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 12,
                  marginTop: 8,
                  fontSize: 12,
                  color: '#6b7280',
                  flexWrap: 'wrap',
                  textAlign: 'center',
                }}
              >
                {comparisonModelKeys.map((modelKey) => {
                  const model = chartRows.find((m) => m.model_key === modelKey);
                  if (!model) return null;

                  return (
                    <div
                      key={modelKey}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 2,
                          background: model.color,
                          display: 'inline-block',
                        }}
                      />
                      {model.model_display_name}
                    </div>
                  );
                })}

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 14,
                      height: 2,
                      borderTop: '2px dashed #9ca3af',
                      display: 'inline-block',
                    }}
                  />
                  Pure Random baseline
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          fontSize: 12,
          color: '#6b7280',
          margin: '10px 0 6px',
          textAlign: 'center',
        }}
      >
        Sample reliability:
        <span style={{ color: '#b91c1c', fontWeight: 600 }}> small</span>{' '}
        (&lt;10),
        <span style={{ color: '#b45309', fontWeight: 600 }}> medium</span>{' '}
        (10–24),
        <span style={{ color: '#166534', fontWeight: 600 }}> strong</span> (25+)
      </div>

      <div
        style={{
          fontWeight: 900,
          fontSize: 18,
          margin: '18px 0 8px',
          color: '#111827',
          textAlign: 'center',
        }}
      >
        Model League Table
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          flexWrap: 'wrap',
          margin: '0 0 10px',
        }}
      >
        {[
          { label: 'Average hits', value: 'average' as const },
          { label: 'Upside score', value: 'upside' as const },
          { label: 'Consistency', value: 'consistency' as const },
          { label: 'Baseline edge', value: 'baseline' as const },
        ].map((option) => {
          const active = rankingMode === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setRankingMode(option.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                border: '1px solid #e5e7eb',
                background: active ? '#111827' : '#fff',
                color: active ? '#fff' : '#111827',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 12,
              }}
              aria-pressed={active}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          textAlign: 'center',
          fontSize: 12,
          color: '#6b7280',
          marginBottom: 10,
        }}
      >
        {rankingMode === 'average'
          ? 'Ranked by average hits per prediction'
          : rankingMode === 'upside'
            ? 'Ranked by upside score'
            : rankingMode === 'consistency'
              ? 'Ranked by consistency score'
              : 'Ranked by how often the model beats Pure Random'}
      </div>

      {/* Table */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #eef2f7',
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        {isMobile ? (
          <div style={{ display: 'grid', gap: 10, padding: 12 }}>
            {filtered.map((r) => {
              const rank =
                filtered.findIndex((x) => x.model_key === r.model_key) + 1;
              const conf = r.confidence ?? 0;
              const jackpotPotLabel = formatNum(r.upside_score, 2);

              return (
                <div
                  key={r.model_key}
                  style={{
                    border: '1px solid #eef2f7',
                    borderRadius: 14,
                    padding: 12,
                    background: '#fff',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: rank === 1 ? '#f59e0b' : '#111827',
                        color: rank === 1 ? '#111827' : '#fff',
                        lineHeight: 1.2,
                        flex: '0 0 auto',
                      }}
                    >
                      #{rank}
                    </span>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 900,
                          color: '#111827',
                          lineHeight: 1.2,
                        }}
                      >
                        {r.model_display_name}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          flexWrap: 'wrap',
                          marginTop: 8,
                        }}
                      >
                        {r.model_key === 'strategy_mix' && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              padding: '3px 8px',
                              borderRadius: 999,
                              background: '#f5f3ff',
                              color: '#6d28d9',
                            }}
                          >
                            Strategy mix
                          </span>
                        )}

                        {r.model_key !== 'pure_random' &&
                          r.baseline_compared >= 5 && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                padding: '3px 8px',
                                borderRadius: 999,
                                background: '#f8fafc',
                                border: '1px dashed #cbd5f5',
                                color: '#475569',
                              }}
                            >
                              Baseline
                            </span>
                          )}

                        {r.personality !== 'stable' && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              padding: '3px 8px',
                              borderRadius: 999,
                              background:
                                r.personality === 'aggressive'
                                  ? '#fff7ed'
                                  : r.personality === 'balanced'
                                    ? '#ecfdf5'
                                    : '#faf5ff',
                              color:
                                r.personality === 'aggressive'
                                  ? '#c2410c'
                                  : r.personality === 'balanced'
                                    ? '#166534'
                                    : '#7c3aed',
                            }}
                          >
                            {r.personality === 'experimental'
                              ? 'Emerging'
                              : r.personality === 'aggressive'
                                ? 'High risk'
                                : 'Balanced'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 10,
                      marginTop: 12,
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <div style={{ color: '#6b7280' }}>Checked</div>
                      <strong>
                        {r.checked}/{r.total}
                      </strong>
                    </div>

                    <div>
                      <div style={{ color: '#6b7280' }}>Average hits</div>
                      <strong>{formatNum(r.avg_total_hits, 2)}</strong>
                    </div>

                    <div>
                      <div style={{ color: '#6b7280' }}>Jackpot potential</div>
                      <strong>{jackpotPotLabel}</strong>
                    </div>

                    <div>
                      <div style={{ color: '#6b7280' }}>Confidence</div>
                      <strong>{Math.round(conf * 100)}%</strong>
                    </div>
                  </div>

                  <div
                    style={{
                      height: 6,
                      borderRadius: 999,
                      background: '#eef2f7',
                      overflow: 'hidden',
                      marginTop: 10,
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.round(conf * 100)}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: '#6d28d9',
                        opacity: 0.9,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="dl-table-scroll">
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  {[
                    'Model',
                    'Checked',
                    'Average hits',
                    'Confidence',
                    'Jackpot potential',
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 12px',
                        fontSize: 12,
                        color: '#6b7280',
                        borderBottom: '1px solid #eef2f7',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filtered.map((r) => {
                  const rank =
                    filtered.findIndex((x) => x.model_key === r.model_key) + 1;
                  const conf = r.confidence ?? 0;
                  const jackpotPotLabel = formatNum(r.upside_score, 2);

                  return (
                    <tr key={r.model_key}>
                      <td
                        style={{
                          padding: '12px',
                          borderBottom: '1px solid #f1f5f9',
                          fontWeight: 700,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 900,
                              padding: '3px 8px',
                              borderRadius: 999,
                              background: rank === 1 ? '#f59e0b' : '#111827',
                              color: rank === 1 ? '#111827' : '#fff',
                              lineHeight: 1.2,
                              flex: '0 0 auto',
                            }}
                          >
                            #{rank}
                          </span>

                          <span style={{ color: '#111827' }}>
                            {r.model_display_name}
                          </span>
                        </div>
                      </td>

                      <td>
                        {r.checked}/{r.total}
                      </td>

                      <td
                        style={{
                          padding: '12px',
                          borderBottom: '1px solid #f1f5f9',
                          fontWeight: 700,
                        }}
                      >
                        {formatNum(r.avg_total_hits, 2)}
                      </td>

                      <td
                        style={{
                          padding: '12px',
                          borderBottom: '1px solid #f1f5f9',
                          minWidth: 140,
                        }}
                      >
                        <div
                          style={{
                            height: 6,
                            borderRadius: 999,
                            background: '#eef2f7',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.round(conf * 100)}%`,
                              height: '100%',
                              borderRadius: 999,
                              background: '#6d28d9',
                              opacity: 0.9,
                            }}
                          />
                        </div>
                      </td>

                      <td
                        style={{
                          padding: '12px',
                          borderBottom: '1px solid #f1f5f9',
                          whiteSpace: 'nowrap',
                          fontWeight: 700,
                        }}
                      >
                        {jackpotPotLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
