// client/src/pages/AnalysisPage.tsx
import { useEffect, useState } from 'react';
import {
  getFrequencyLatestN,
  getHotCold,
  type FrequencyLatestNResponse,
  type HotColdResponse,
  type NumberCount,
} from '../api/analysis';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

type Status = 'idle' | 'loading' | 'success' | 'error';

type RangeOption = {
  value: number;
  label: string;
};

const RANGE_OPTIONS: RangeOption[] = [
  { value: 50, label: 'Last 50 draws' },
  { value: 100, label: 'Last 100 draws' },
  { value: 200, label: 'Last 200 draws' },
];

const HOT_COLD_TOP = 5;

// Simple little chip for numbers (main / star / cold)
function NumberChip({
  value,
  variant,
}: {
  value: number;
  variant: 'main' | 'star' | 'cold';
}) {
  const base: React.CSSProperties = {
    display: 'inline-block',
    minWidth: '2rem',
    padding: '0.25rem 0.6rem',
    marginRight: '0.4rem',
    marginBottom: '0.3rem',
    borderRadius: '999px',
    fontSize: '0.9rem',
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
  };

  let style: React.CSSProperties = { ...base, border: '1px solid #ccc' };

  if (variant === 'star') {
    style = {
      ...base,
      border: '1px solid #ffd54f',
      background: '#fffaf0',
    };
  } else if (variant === 'cold') {
    style = {
      ...base,
      border: '1px solid #c5cae9',
      background: '#eef2ff',
    };
  }

  return <span style={style}>{value}</span>;
}

export function AnalysisPage() {
  const [range, setRange] = useState<number>(100);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const [frequency, setFrequency] = useState<FrequencyLatestNResponse | null>(
    null,
  );
  const [hotCold, setHotCold] = useState<HotColdResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      try {
        setStatus('loading');
        setError(null);

        const [freqRes, hotColdRes] = await Promise.all([
          getFrequencyLatestN(range),
          getHotCold(range, HOT_COLD_TOP),
        ]);

        if (cancelled) return;

        if (!freqRes.ok) {
          throw new Error('Frequency API returned ok=false');
        }
        if (!hotColdRes.ok) {
          throw new Error('Hot/Cold API returned ok=false');
        }

        setFrequency(freqRes);
        setHotCold(hotColdRes);
        setStatus('success');
      } catch (err: unknown) {
        if (cancelled) return;
        console.error(err);
        setStatus('error');
        setError(
          err instanceof Error ? err.message : 'Failed to load analysis data.',
        );
      }
    }

    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [range]);

  const handleRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value, 10);
    setRange(value);
  };

  const mainFreq: NumberCount[] = frequency?.main ?? [];
  const starFreq: NumberCount[] = frequency?.stars ?? [];

  const hotMain = hotCold?.hot.main ?? [];
  const hotStars = hotCold?.hot.stars ?? [];
  const coldMain = hotCold?.cold.main ?? [];
  const coldStars = hotCold?.cold.stars ?? [];

  return (
    <div
      className="dl-page"
      style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1rem' }}
    >
      <h1 className="dl-hero-title" style={{ marginBottom: '0.25rem' }}>
        Number Analysis
      </h1>
      <p className="dl-hero-copy" style={{ marginBottom: '1.5rem' }}>
        Discover trends and hot / cold numbers from recent EuroMillions draws.
      </p>

      {/* Configuration Card */}
      <section
        className="dl-preview-card"
        style={{ marginBottom: '2rem', padding: '1.25rem 1.5rem' }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.5rem',
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.85rem',
                textTransform: 'uppercase',
                opacity: 0.7,
                marginBottom: '0.25rem',
              }}
            >
              Lottery Type
            </div>
            <div>EuroMillions</div>
          </div>

          <div>
            <div
              style={{
                fontSize: '0.85rem',
                textTransform: 'uppercase',
                opacity: 0.7,
                marginBottom: '0.25rem',
              }}
            >
              Number of draws to analyse
            </div>
            <select
              value={range}
              onChange={handleRangeChange}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '999px',
                border: '1px solid #ccc',
                fontSize: '0.95rem',
              }}
            >
              {RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {frequency && (
            <div style={{ marginLeft: 'auto', fontSize: '0.85rem' }}>
              Analysing{' '}
              <strong>{frequency.totalDrawsConsidered.toLocaleString()}</strong>{' '}
              draws
            </div>
          )}
        </div>
      </section>

      {/* Hot / Cold overview */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}
      >
        <div className="dl-preview-card" style={{ padding: '1rem 1.25rem' }}>
          <h2
            style={{
              fontSize: '1rem',
              marginBottom: '0.5rem',
              fontWeight: 600,
            }}
          >
            Hot Numbers (Main)
          </h2>
          {hotMain.length === 0 && <p>No data yet.</p>}
          {hotMain.length > 0 && (
            <div>
              {hotMain.map((item) => (
                <NumberChip
                  key={item.number}
                  value={item.number}
                  variant="main"
                />
              ))}
            </div>
          )}

          {hotStars.length > 0 && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
              Stars:{' '}
              {hotStars.map((item) => (
                <NumberChip
                  key={item.number}
                  value={item.number}
                  variant="star"
                />
              ))}
            </p>
          )}
        </div>

        <div className="dl-preview-card" style={{ padding: '1rem 1.25rem' }}>
          <h2
            style={{
              fontSize: '1rem',
              marginBottom: '0.5rem',
              fontWeight: 600,
            }}
          >
            Cold Numbers (Main)
          </h2>
          {coldMain.length === 0 && <p>No data yet.</p>}
          {coldMain.length > 0 && (
            <div>
              {coldMain.map((item) => (
                <NumberChip
                  key={item.number}
                  value={item.number}
                  variant="cold"
                />
              ))}
            </div>
          )}

          {coldStars.length > 0 && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
              Stars:{' '}
              {coldStars.map((item) => (
                <NumberChip
                  key={item.number}
                  value={item.number}
                  variant="cold"
                />
              ))}
            </p>
          )}
        </div>

        <div
          className="dl-preview-card"
          style={{ padding: '1rem 1.25rem', opacity: 0.6 }}
        >
          <h2
            style={{
              fontSize: '1rem',
              marginBottom: '0.5rem',
              fontWeight: 600,
            }}
          >
            Overdue Numbers
          </h2>
          <p style={{ fontSize: '0.9rem' }}>
            Gap / overdue analysis coming soon. This will show numbers with the
            longest time since last appearance.
          </p>
        </div>
      </section>

      {/* Status messages */}
      {status === 'loading' && <p>Loading analysis…</p>}
      {status === 'error' && (
        <p style={{ color: 'red' }}>Error: {error ?? 'Unknown error'}</p>
      )}

      {/* Charts */}
      {status === 'success' && (
        <>
          <section
            className="dl-preview-card"
            style={{ marginBottom: '1.75rem', padding: '1.25rem 1.5rem' }}
          >
            <h2
              style={{
                fontSize: '1rem',
                marginBottom: '0.75rem',
                fontWeight: 600,
              }}
            >
              Main Number Frequency
            </h2>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={mainFreq}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="number" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section
            className="dl-preview-card"
            style={{ marginBottom: '1.75rem', padding: '1.25rem 1.5rem' }}
          >
            <h2
              style={{
                fontSize: '1rem',
                marginBottom: '0.75rem',
                fontWeight: 600,
              }}
            >
              Star Number Frequency
            </h2>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={starFreq}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="number" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
