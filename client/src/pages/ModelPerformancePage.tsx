// client/src/pages/ModelPerformancePage.tsx
import { useEffect, useMemo, useState } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import {
  getModelPerformance,
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
  jackpots: number;

  color: string;
};

type NivoBarRow = {
  // indexBy uses this string, so this is what appears on the Y axis
  model: string;
  avg_total_hits: number;
};

function Card({
  title,
  value,
  sub,
  right,
}: {
  title: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #eef2f7',
        borderRadius: 16,
        padding: 14,
        boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
        minWidth: 220,
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

export default function ModelPerformancePage() {
  const [lottery, setLottery] = useState('euromillions');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<ModelPerformanceRow[]>([]);
  const [minChecked, setMinChecked] = useState(5);

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

        return {
          model_key: r.model_key,
          model_display_name: r.model_display_name,

          checked: r.checked_predictions,
          total: r.total_predictions,
          checked_rate_pct: r.checked_rate_pct,

          avg_main_n: avgMain,
          avg_stars_n: avgStars,
          avg_total_hits: avgTotal,
          jackpots: r.jackpots ?? 0,

          // ✅ stable colour by canonical key
          color: modelColor(r.model_key),
        };
      })
      .sort((a, b) => b.avg_total_hits - a.avg_total_hits);
  }, [rows]);

  const filtered = useMemo(() => {
    return chartRows.filter((r) => r.checked >= minChecked);
  }, [chartRows, minChecked]);

  const hiddenCount = useMemo(() => {
    return Math.max(0, rows.length - filtered.length);
  }, [rows.length, filtered.length]);

  const bestModel = useMemo(() => {
    return filtered.length > 0 ? filtered[0] : null;
  }, [filtered]);

  // Map by display label for chart tooltip/color, but include stable key inside the value.
  const byLabel = useMemo(() => {
    const m = new Map<string, ChartRow>();
    for (const r of filtered) m.set(r.model_display_name, r);
    return m;
  }, [filtered]);

  const barData = useMemo<NivoBarRow[]>(() => {
    return filtered.map((r) => ({
      model: r.model_display_name,
      avg_total_hits: r.avg_total_hits,
    }));
  }, [filtered]);

  const checkedCoveragePct = useMemo(() => {
    if (!summary.total) return null;
    return (100 * summary.checked) / summary.total;
  }, [summary.total, summary.checked]);

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

        <label style={{ fontSize: 14, color: '#6b7280' }}>
          Min checked&nbsp;
          <input
            type="number"
            value={minChecked}
            min={0}
            max={9999}
            onChange={(e) =>
              setMinChecked(Math.max(0, parseInt(e.target.value || '0', 10)))
            }
            style={{
              width: 110,
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: '#fff',
            }}
          />
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginTop: 6,
              flexWrap: 'wrap',
            }}
          >
            {[
              { label: 'All', v: 0 },
              { label: 'Small', v: 5 },
              { label: 'Medium', v: 25 },
              { label: 'Large', v: 100 },
            ].map((p) => {
              const active = minChecked === p.v;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setMinChecked(p.v)}
                  style={{
                    padding: '6px 10px',
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
                  {p.label}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: '#9ca3af' }}>
            Hide models with fewer than <strong>{minChecked}</strong> checked
            predictions.
          </div>
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

      {/* Summary cards */}
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
          title="Top model (avg hits)"
          value={bestModel ? bestModel.model_display_name : '—'}
          sub={
            bestModel ? (
              <>
                Avg hits{' '}
                <strong>{formatNum(bestModel.avg_total_hits, 2)}</strong>{' '}
                <span style={{ fontSize: 12 }}>
                  (main {formatNum(bestModel.avg_main_n, 2)} + stars{' '}
                  {formatNum(bestModel.avg_stars_n, 2)})
                </span>
              </>
            ) : (
              <>No models meet “Min checked”.</>
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
          title="Checked predictions"
          value={
            <>
              {summary.checked} <span style={{ fontWeight: 700 }}>/</span>{' '}
              {summary.total}
            </>
          }
          sub={
            checkedCoveragePct === null ? (
              <>No predictions yet.</>
            ) : (
              <>
                Coverage: <strong>{checkedCoveragePct.toFixed(1)}%</strong> of
                saved predictions are checked.
              </>
            )
          }
        />

        <Card
          title="Models shown"
          value={
            <>
              {filtered.length} <span style={{ fontWeight: 700 }}>/</span>{' '}
              {rows.length}
            </>
          }
          sub={
            hiddenCount > 0 ? (
              <>
                Hidden by filter: <strong>{hiddenCount}</strong> (need ≥{' '}
                <strong>{minChecked}</strong> checked)
              </>
            ) : (
              <>Nothing hidden by the filter.</>
            )
          }
        />
      </div>

      {error && (
        <p style={{ color: '#b91c1c', textAlign: 'center' }}>{error}</p>
      )}

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
          <div style={{ fontWeight: 800 }}>Average hits per prediction</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            Bars = avg(main + stars). Hover for details.
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
            tooltip={({ indexValue, value }) => {
              const label = String(indexValue);
              const meta = byLabel.get(label);
              if (!meta) return null;

              return (
                <div
                  style={{
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    padding: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                    maxWidth: 320,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>
                    {meta.model_display_name}
                  </div>
                  <div style={{ fontSize: 13, color: '#111827' }}>
                    Avg total hits:{' '}
                    <strong>{formatNum(toNum(value, 0), 2)}</strong>
                    <div
                      style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}
                    >
                      main {formatNum(meta.avg_main_n, 2)} + stars{' '}
                      {formatNum(meta.avg_stars_n, 2)}
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                    Checked: <strong>{meta.checked}</strong> / {meta.total} ·
                    Checked %:{' '}
                    <strong>
                      {formatPctFromString(meta.checked_rate_pct)}
                    </strong>
                    <br />
                    Jackpots: <strong>{meta.jackpots}</strong>
                  </div>
                </div>
              );
            }}
            theme={{
              axis: {
                ticks: {
                  text: { fill: '#6b7280', fontSize: 12 },
                },
                legend: {
                  text: { fill: '#6b7280', fontSize: 12 },
                },
              },
              grid: {
                line: { stroke: '#eef2f7', strokeWidth: 1 },
              },
              labels: {
                text: { fontSize: 12, fontWeight: 700 },
              },
            }}
          />
        </div>
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
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                {[
                  'Model',
                  'Checked',
                  'Checked %',
                  'Avg main',
                  'Avg stars',
                  'Avg total',
                  'Jackpots',
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
              {filtered.map((r) => (
                <tr key={r.model_key}>
                  <td
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f1f5f9',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: r.color,
                        display: 'inline-block',
                      }}
                    />
                    {r.model_display_name}
                  </td>

                  <td
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    {r.checked}/{r.total}
                  </td>

                  <td
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    {formatPctFromString(r.checked_rate_pct)}
                  </td>

                  <td
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    {formatNum(r.avg_main_n, 2)}
                  </td>

                  <td
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    {formatNum(r.avg_stars_n, 2)}
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
                    }}
                  >
                    {r.jackpots}
                  </td>
                </tr>
              ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: 18,
                      textAlign: 'center',
                      color: '#6b7280',
                    }}
                  >
                    No models match the current filter (try lowering “Min
                    checked”).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ marginTop: 14, textAlign: 'center', color: '#6b7280' }}>
        Minimum sample size applied: {minChecked} checked predictions.
      </p>
    </div>
  );
}
