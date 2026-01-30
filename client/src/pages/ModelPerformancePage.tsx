// client/src/pages/ModelPerformancePage.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  getModelPerformance,
  type ModelPerformanceRow,
} from '../api/performance';

function formatPct(n: number) {
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function ModelPerformancePage() {
  const [lottery, setLottery] = useState('euromillions');
  const [limit, setLimit] = useState(500);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ModelPerformanceRow[]>([]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const data = await getModelPerformance({ lottery, limit });
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
    const checked = rows.reduce((acc, r) => acc + (r.checked || 0), 0);
    const total = rows.reduce((acc, r) => acc + (r.total || 0), 0);
    return { total, checked };
  }, [rows]);

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 16px' }}>
      <header style={{ textAlign: 'center', marginBottom: 18 }}>
        <h1 style={{ fontSize: '2.2rem', margin: 0 }}>Model performance</h1>
        <p style={{ margin: '10px 0 0', color: '#6b7280' }}>
          Based on checked predictions (matched_main / matched_stars).
        </p>
      </header>

      <div
        style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'center',
          alignItems: 'center',
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
          Limit&nbsp;
          <input
            type="number"
            value={limit}
            min={1}
            max={5000}
            onChange={(e) => setLimit(parseInt(e.target.value || '500', 10))}
            style={{
              width: 110,
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

      <div style={{ textAlign: 'center', color: '#6b7280', marginBottom: 18 }}>
        Models: {rows.length} · Total predictions: {summary.total} · Checked:{' '}
        {summary.checked}
      </div>

      {error && (
        <p style={{ color: '#b91c1c', textAlign: 'center' }}>{error}</p>
      )}

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
                  'Hit rate (any)',
                  'Avg main',
                  'Avg stars',
                  '2+ main',
                  '3+ main',
                  '4+ main',
                  '5 main',
                  'Saved conf',
                  'Last run',
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
              {rows.map((r) => (
                <tr key={r.model_name}>
                  <td
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f1f5f9',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.model_name}
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
                    {formatPct(r.hit_rate_any)}
                  </td>

                  <td
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    {Number.isFinite(r.avg_main_hits)
                      ? r.avg_main_hits.toFixed(2)
                      : '—'}
                  </td>

                  <td
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    {Number.isFinite(r.avg_star_hits)
                      ? r.avg_star_hits.toFixed(2)
                      : '—'}
                  </td>

                  <td
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    {r.main_2plus}
                  </td>

                  <td
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    {r.main_3plus}
                  </td>

                  <td
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    {r.main_4plus}
                  </td>

                  <td
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    {r.main_5}
                  </td>

                  <td
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    {formatPct(r.avg_saved_confidence)}
                  </td>

                  <td
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f1f5f9',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDate(r.last_created_at)}
                  </td>
                </tr>
              ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    style={{
                      padding: 18,
                      textAlign: 'center',
                      color: '#6b7280',
                    }}
                  >
                    No performance data yet (no predictions found / none
                    checked).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ marginTop: 14, textAlign: 'center', color: '#6b7280' }}>
        Note: “Played model” selection is legacy and has been removed. Use the
        “Play this line” flow on prediction cards instead.
      </p>
    </div>
  );
}
