// client/src/pages/ModelPerformancePage.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  getModelPerformance,
  type ModelPerformanceRow,
} from '../api/performance';

function formatPctFromString(s: string) {
  const n = Number(s);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

function formatNumFromString(s: string, decimals = 2) {
  const n = Number(s);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(decimals);
}

export default function ModelPerformancePage() {
  const [lottery, setLottery] = useState('euromillions');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ModelPerformanceRow[]>([]);

  const MIN_CHECKED = 5;

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

  const filteredRows = useMemo(
    () => rows.filter((r) => r.checked_predictions >= MIN_CHECKED),
    [rows],
  );

  const summary = useMemo(() => {
    const checked = filteredRows.reduce(
      (acc, r) => acc + r.checked_predictions,
      0,
    );
    const total = filteredRows.reduce((acc, r) => acc + r.total_predictions, 0);
    return { total, checked };
  }, [filteredRows]);

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
        Models: {filteredRows.length} · Total predictions: {summary.total} ·
        Checked: {summary.checked}
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
                  'Checked %',
                  'Avg main',
                  'Avg stars',
                  'Jackpots',
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '12px',
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
              {filteredRows.map((r) => (
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
                    {r.checked_predictions}/{r.total_predictions}
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
                    {formatNumFromString(r.avg_main)}
                  </td>

                  <td
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    {formatNumFromString(r.avg_stars)}
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

              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: 18,
                      textAlign: 'center',
                      color: '#6b7280',
                    }}
                  >
                    No models meet the minimum checked prediction threshold (
                    {MIN_CHECKED}).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ marginTop: 14, textAlign: 'center', color: '#6b7280' }}>
        Minimum sample size applied: {MIN_CHECKED} checked predictions.
      </p>
    </div>
  );
}
