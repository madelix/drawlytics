// client/src/components/LatestDraw.tsx
import { useEffect, useState } from 'react';
import { getLatestDraw, type LatestDrawResponse } from '../api/draws';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function LatestDraw() {
  const [status, setStatus] = useState<Status>('idle');
  const [data, setData] = useState<LatestDrawResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchLatest() {
      try {
        setStatus('loading');
        setError(null);

        const result = await getLatestDraw();
        if (cancelled) return;

        if (!result.ok || !result.draw) {
          setStatus('error');
          setError(result.error || 'No draw data available.');
          return;
        }

        setData(result);
        setStatus('success');
      } catch (err: unknown) {
        if (cancelled) return;
        console.error(err);
        setStatus('error');
        setError(
          err instanceof Error ? err.message : 'Failed to load latest draw.',
        );
      }
    }

    fetchLatest();

    return () => {
      cancelled = true;
    };
  }, []);

  // Basic UI states
  if (status === 'loading' || status === 'idle') {
    return (
      <section className="latest-draw">
        <h2>Latest EuroMillions Draw</h2>
        <p>Loading latest draw…</p>
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className="latest-draw">
        <h2>Latest EuroMillions Draw</h2>
        <p style={{ color: 'red' }}>Error: {error}</p>
      </section>
    );
  }

  const draw = data?.draw;
  if (!draw) {
    return (
      <section className="latest-draw">
        <h2>Latest EuroMillions Draw</h2>
        <p>No draw data available.</p>
      </section>
    );
  }

  const formattedDate = new Date(draw.draw_date).toLocaleDateString();

  return (
    <section className="latest-draw">
      <h2>Latest EuroMillions Draw</h2>
      <p>
        Draw date: <strong>{formattedDate}</strong>
      </p>

      <div style={{ marginTop: '0.5rem' }}>
        <div>
          <span style={{ fontWeight: 'bold' }}>Numbers:</span>{' '}
          {draw.numbers.map((n) => (
            <span
              key={n}
              style={{
                display: 'inline-block',
                marginRight: '0.3rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '999px',
                border: '1px solid #ccc',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {n}
            </span>
          ))}
        </div>

        <div style={{ marginTop: '0.4rem' }}>
          <span style={{ fontWeight: 'bold' }}>Stars:</span>{' '}
          {draw.stars.map((s) => (
            <span
              key={s}
              style={{
                display: 'inline-block',
                marginRight: '0.3rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '999px',
                border: '1px solid #ffd54f',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
