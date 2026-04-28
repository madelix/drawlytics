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

const MODEL_COLOR_MAP: Record<string, string> = {
  balanced_hot_cold: '#7C3AED', // purple
  hot_focused: '#EF4444', // red
  cold_focused: '#2563EB', // blue
  overdue: '#F97316', // orange
  pure_random: '#22C55E', // green
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

  avg_main_n: number;
  avg_stars_n: number;
  avg_total_hits: number;
  recent_avg_total_hits_n: number;

  confidence: number;
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
        padding: 14,
        boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
        minWidth: 280,
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
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [minChecked, setMinChecked] = useState(0);
  const [rankingMode, setRankingMode] = useState<
    'average' | 'upside' | 'consistency'
  >('average');
  const [strategyMode, setStrategyMode] = useState<
    'safe' | 'balanced' | 'aggressive'
  >('balanced');

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

        const recommendationScore =
          avgTotal * 0.35 +
          upsideScore * 0.25 +
          consistencyScore * 0.25 +
          confidenceScore * 0.15;

        const delta = recentAvgTotal - avgTotal;

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

        if (checked < 10) {
          personality = 'experimental'; // emerging / low sample
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

          avg_main_n: avgMain,
          avg_stars_n: avgStars,
          avg_total_hits: avgTotal,
          recent_avg_total_hits_n: recentAvgTotal,
          trend_delta: delta,
          consistency_score: consistencyScore,
          insight,
          recommendation_score: recommendationScore,

          confidence: confidenceScore,
          jackpots: r.jackpots ?? 0,
          high_hit_predictions: r.high_hit_predictions ?? 0,
          four_plus_hits: r.four_plus_hits ?? 0,
          five_plus_hits: r.five_plus_hits ?? 0,

          high_hit_rate: highHitRate,
          four_plus_rate: fourPlusRate,
          five_plus_rate: fivePlusRate,
          upside_score: upsideScore,
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
            : b.consistency_score - a.consistency_score,
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

  const bestModel = useMemo(() => {
    return filtered.length > 0 ? filtered[0] : null;
  }, [filtered]);

  const selectedModel = useMemo(() => {
    if (!selectedModelKey) return null;
    return filtered.find((r) => r.model_key === selectedModelKey) ?? null;
  }, [filtered, selectedModelKey]);

  useEffect(() => {
    if (!selectedModelKey) {
      setHistory([]);
      setBaselineHistory([]);
      return;
    }

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
      m.set(`#${rank} ${r.model_display_name}`, r);
    }
    return m;
  }, [filtered]);

  const barData = useMemo<NivoBarRow[]>(() => {
    return [...filtered]
      .map((r, i) => ({
        model: `#${i + 1} ${r.model_display_name}`,
        avg_total_hits:
          rankingMode === 'average'
            ? r.avg_total_hits
            : rankingMode === 'upside'
              ? r.upside_score
              : r.consistency_score,
      }))
      .reverse();
  }, [filtered, rankingMode]);

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

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 16px' }}>
      <header style={{ textAlign: 'center', marginBottom: 18 }}>
        <h1 style={{ fontSize: '2.2rem', margin: 0 }}>Model performance</h1>
        <p style={{ margin: '10px 0 0', color: '#6b7280' }}>
          A simple view: higher bars = more matches on average (main + stars).
        </p>
      </header>

      <div
        style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'center',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <label style={{ fontSize: 14, color: '#6b7280' }}>
          Lottery&nbsp;
          <input
            value={lottery}
            onChange={(e) => setLottery(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: '#fff',
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
          title={
            rankingMode === 'average'
              ? 'Top model (avg hits)'
              : rankingMode === 'upside'
                ? 'Top model (upside)'
                : 'Top model (consistency)'
          }
          value={bestModel ? bestModel.model_display_name : '—'}
          sub={
            bestModel ? (
              <>
                {rankingMode === 'average' && (
                  <>
                    Avg hits{' '}
                    <strong>{formatNum(bestModel.avg_total_hits, 2)}</strong>{' '}
                    <span style={{ fontSize: 12 }}>
                      (main {formatNum(bestModel.avg_main_n, 2)} + stars{' '}
                      {formatNum(bestModel.avg_stars_n, 2)})
                    </span>
                  </>
                )}

                {rankingMode === 'upside' && (
                  <>
                    Upside score{' '}
                    <strong>{formatNum(bestModel.upside_score, 2)}</strong>
                  </>
                )}

                {rankingMode === 'consistency' && (
                  <>
                    Consistency{' '}
                    <strong>{formatNum(bestModel.consistency_score, 2)}</strong>
                  </>
                )}
              </>
            ) : (
              <>No models available.</>
            )
          }
          right={
            bestModel ? (
              <span
                aria-hidden
                title="Model colour"
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: bestModel.color,
                  display: 'inline-block',
                  marginTop: 2,
                }}
              />
            ) : null
          }
        />

        <Card
          title="Most improved"
          value={
            biggestMover ? biggestMover.model_display_name : 'No change yet'
          }
          sub={
            biggestMover ? (
              <>Recent performance shift based on latest checked draws.</>
            ) : (
              <>No model has moved meaningfully in recent checked draws.</>
            )
          }
          right={
            biggestMover ? (
              <span
                aria-hidden
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: biggestMover.color,
                  display: 'inline-block',
                  marginTop: 2,
                }}
                title="Model colour"
              />
            ) : null
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

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                          padding: '4px 8px',
                          borderRadius: 999,
                          background: active ? '#111827' : '#f8fafc',
                          color: active ? '#fff' : '#374151',
                          border: active
                            ? '1px solid #111827'
                            : '1px solid #e5e7eb',
                          fontSize: 11,
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
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
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
              ? 'Bars = avg(main + stars). Hover for details.'
              : rankingMode === 'upside'
                ? 'Bars = upside score (high-hit potential).'
                : 'Bars = consistency score (stability + sample size).'}
          </div>
        </div>

        <div
          style={{
            height: Math.max(260, 48 + filtered.length * 38),
            padding: 10,
          }}
        >
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
            padding: 14,
            margin: '0 auto 14px',
            maxWidth: 980,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 10 }}>
            Performance over time
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

              return (
                <>
                  {history.length} recent draws · <strong>{trend}</strong>{' '}
                  performance ({formatNum(diff, 2)}) ·{' '}
                  <span style={{ opacity: 0.7 }}>
                    {history.length < 10
                      ? 'low reliability'
                      : history.length < 25
                        ? 'moderate reliability'
                        : 'high reliability'}
                  </span>
                </>
              );
            })()}
          </div>

          <div style={{ height: 210 }}>
            <svg width="100%" height="100%" viewBox="0 0 400 200">
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
                const y = 180 - toNum(point.avg_total_hits, 0) * 30; // scale visually

                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={4}
                    fill={selectedModel?.color ?? '#804198'}
                  />
                );
              })}

              {history.map((point, i) => {
                if (i === 0) return null;

                const prev = history[i - 1];

                const x1 = ((i - 1) / (history.length - 1)) * 380 + 10;
                const y1 = 180 - toNum(prev.avg_total_hits, 0) * 30;

                const x2 = (i / (history.length - 1)) * 380 + 10;
                const y2 = 180 - toNum(point.avg_total_hits, 0) * 30;

                return (
                  <line
                    key={`line-${i}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={selectedModel?.color ?? '#804198'}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                );
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 14,
                    height: 2,
                    background: selectedModel?.color || '#333',
                    display: 'inline-block',
                  }}
                />
                Selected model
              </div>

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

      {/* Confidence legend */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 10,
          flexWrap: 'wrap',
          margin: '10px 0 12px',
          fontSize: 12,
          color: '#6b7280',
          textAlign: 'center',
        }}
      >
        <span style={{ fontWeight: 700, color: '#111827' }}>Confidence:</span>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontWeight: 800,
          }}
          title="Low confidence (score < 0.33)"
        >
          Low <span style={{ fontWeight: 700, opacity: 0.8 }}>(0–0.32)</span>
        </span>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            background: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#b45309',
            fontWeight: 800,
          }}
          title="Medium confidence (0.33–0.65)"
        >
          Medium{' '}
          <span style={{ fontWeight: 700, opacity: 0.8 }}>(0.33–0.65)</span>
        </span>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#166534',
            fontWeight: 800,
          }}
          title="High confidence (score ≥ 0.66)"
        >
          High <span style={{ fontWeight: 700, opacity: 0.8 }}>(0.66+)</span>
        </span>
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
            : 'Ranked by consistency score'}
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
        {/* Scroll container (only scrolls when needed) */}
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
                const delta = rankDeltaByKey[r.model_key];
                const trend = r.trend;

                const reliabilityBg =
                  r.checked < 10
                    ? '#fef2f2'
                    : r.checked < 25
                      ? '#fffbeb'
                      : '#f0fdf4';
                const reliabilityBorder =
                  r.checked < 10
                    ? '1px solid #fecaca'
                    : r.checked < 25
                      ? '1px solid #fde68a'
                      : '1px solid #bbf7d0';
                const reliabilityColor =
                  r.checked < 10
                    ? '#b91c1c'
                    : r.checked < 25
                      ? '#b45309'
                      : '#166534';
                const reliabilityLabel =
                  r.checked < 10 ? 'Low' : r.checked < 25 ? 'Medium' : 'High';

                const conf = r.confidence ?? 0;
                const confLabel =
                  conf >= 0.66 ? 'High' : conf >= 0.33 ? 'Medium' : 'Low';
                const confColor =
                  conf >= 0.66
                    ? '#166534'
                    : conf >= 0.33
                      ? '#b45309'
                      : '#b91c1c';
                const confFill =
                  conf >= 0.66
                    ? '#22c55e'
                    : conf >= 0.33
                      ? '#f59e0b'
                      : '#ef4444';

                const jackpotScore = r.upside_score;

                const jackpotPotBg =
                  jackpotScore >= 0.35
                    ? '#ecfdf5'
                    : jackpotScore >= 0.15
                      ? '#fffbeb'
                      : '#fef2f2';

                const jackpotPotBorder =
                  jackpotScore >= 0.35
                    ? '1px solid #bbf7d0'
                    : jackpotScore >= 0.15
                      ? '1px solid #fde68a'
                      : '1px solid #fecaca';

                const jackpotPotColor =
                  jackpotScore >= 0.35
                    ? '#166534'
                    : jackpotScore >= 0.15
                      ? '#b45309'
                      : '#b91c1c';

                const jackpotPotLabel =
                  jackpotScore >= 0.35
                    ? 'High'
                    : jackpotScore >= 0.15
                      ? 'Medium'
                      : 'Low';

                return (
                  <tr key={r.model_key}>
                    {/* MODEL */}
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
                          title="Rank by avg total hits"
                        >
                          #{rank}
                        </span>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <span style={{ color: '#111827' }}>
                            {r.model_display_name}
                          </span>

                          {r.model_key === 'pure_random' && (
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
                                marginLeft: 6,
                              }}
                            >
                              Baseline
                            </span>
                          )}

                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              padding: '3px 8px',
                              borderRadius: 999,
                              background:
                                r.personality === 'stable'
                                  ? '#eef2ff' // soft blue
                                  : r.personality === 'aggressive'
                                    ? '#fff7ed' // orange (upside / risk)
                                    : r.personality === 'balanced'
                                      ? '#ecfdf5' // green
                                      : '#faf5ff', // purple (new)

                              color:
                                r.personality === 'stable'
                                  ? '#3730a3'
                                  : r.personality === 'aggressive'
                                    ? '#c2410c'
                                    : r.personality === 'balanced'
                                      ? '#166534'
                                      : '#7c3aed',
                              flex: '0 0 auto',
                            }}
                          >
                            {r.personality === 'experimental'
                              ? 'Emerging'
                              : r.personality === 'stable'
                                ? 'Reliable'
                                : r.personality === 'aggressive'
                                  ? 'High risk'
                                  : 'Balanced'}
                          </span>

                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              color:
                                delta === null
                                  ? '#6b7280'
                                  : delta > 0
                                    ? '#16a34a'
                                    : delta < 0
                                      ? '#dc2626'
                                      : '#6b7280',
                              flex: '0 0 auto',
                            }}
                            title={
                              delta === null
                                ? 'New model'
                                : delta > 0
                                  ? `Up ${delta}`
                                  : delta < 0
                                    ? `Down ${Math.abs(delta)}`
                                    : 'No change'
                            }
                          >
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                padding: '3px 8px',
                                borderRadius: 999,
                                background:
                                  trend === 'up'
                                    ? '#ecfdf5'
                                    : trend === 'down'
                                      ? '#fef2f2'
                                      : trend === 'flat'
                                        ? '#f8fafc'
                                        : '#faf5ff',
                                color:
                                  trend === 'up'
                                    ? '#166534'
                                    : trend === 'down'
                                      ? '#b91c1c'
                                      : trend === 'flat'
                                        ? '#475569'
                                        : '#7c3aed',
                                flex: '0 0 auto',
                              }}
                              title={
                                trend === 'up'
                                  ? 'Recent performance improving'
                                  : trend === 'down'
                                    ? 'Recent performance declining'
                                    : trend === 'flat'
                                      ? 'Recent performance stable'
                                      : 'Not enough previous data yet'
                              }
                            >
                              {trend === 'up'
                                ? `↑ +${formatNum(r.trend_delta, 2)}`
                                : trend === 'down'
                                  ? `↓ ${formatNum(Math.abs(r.trend_delta), 2)}`
                                  : 'Stable'}
                            </span>
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span title="Checked vs total predictions (only checked are evaluated)">
                          {r.checked}/{r.total}
                        </span>

                        <span
                          title={`Sample reliability: ${reliabilityLabel}`}
                          style={{
                            fontSize: 12,
                            opacity: 0.7,
                          }}
                        >
                          {r.checked >= 25
                            ? '🟢'
                            : r.checked >= 10
                              ? '🟡'
                              : '🔴'}
                        </span>
                      </div>
                    </td>

                    {/* AVERAGE HITS */}
                    <td
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid #f1f5f9',
                        fontWeight: 700,
                      }}
                    >
                      <div>{formatNum(r.avg_total_hits, 2)}</div>

                      {(() => {
                        const baseline = chartRows.find(
                          (x) => x.model_key === 'pure_random',
                        );
                        if (!baseline || r.model_key === 'pure_random')
                          return null;

                        const diff = r.avg_total_hits - baseline.avg_total_hits;

                        // hide tiny differences (noise)
                        if (Math.abs(diff) < 0.05) return null;

                        return (
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color:
                                diff > 0
                                  ? '#16a34a'
                                  : diff < 0
                                    ? '#dc2626'
                                    : '#6b7280',
                              marginTop: 2,
                            }}
                            title="Difference from Pure Random baseline"
                          >
                            {diff > 0
                              ? `+${formatNum(diff, 2)} over baseline`
                              : diff < 0
                                ? `${formatNum(diff, 2)} below baseline`
                                : '≈ random'}
                          </div>
                        );
                      })()}

                      {rankingMode === 'upside' && (
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#6b7280',
                            marginTop: 2,
                          }}
                        >
                          upside {formatNum(r.upside_score, 2)}
                        </div>
                      )}

                      {rankingMode === 'consistency' && (
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#6b7280',
                            marginTop: 2,
                          }}
                        >
                          consistency {formatNum(r.consistency_score, 2)}
                        </div>
                      )}

                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          opacity: 0.9,
                          color: reliabilityColor,
                        }}
                      >
                        n={r.checked}
                      </div>
                    </td>

                    {/* CONFIDENCE */}
                    <td
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid #f1f5f9',
                        minWidth: 140,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            color: confColor,
                          }}
                        >
                          {confLabel}
                        </span>

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
                              background: confFill,
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>

                        <span style={{ fontSize: 11, color: '#6b7280' }}>
                          conf {formatNum(conf, 2)}
                        </span>
                      </div>
                    </td>

                    {/* JACKPOT POTENTIAL */}
                    <td
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid #f1f5f9',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: jackpotPotBg,
                          border: jackpotPotBorder,
                          color: jackpotPotColor,
                        }}
                      >
                        {jackpotPotLabel} · {formatNum(jackpotScore, 2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
