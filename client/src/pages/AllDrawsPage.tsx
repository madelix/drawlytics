// client/src/pages/AllDrawsPage.tsx
import { useEffect, useState } from 'react';
import {
  getDraws,
  type DrawsListResponse,
  type EuromillionsDraw,
} from '../api/draws';
import LatestDraw from '../components/LatestDraw';
import { ScrollToTopButton } from '../components/ScrollToTopButton';

type Status = 'idle' | 'loading' | 'success' | 'error';

const PAGE_SIZE = 20;

export function AllDrawsPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [data, setData] = useState<DrawsListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchPage() {
      try {
        setStatus('loading');
        setError(null);

        const result = await getDraws({ limit: PAGE_SIZE, offset });
        if (cancelled) return;

        if (!result.ok) {
          setStatus('error');
          setError(result.error || 'Failed to load draws.');
          return;
        }

        setData(result);
        setStatus('success');
      } catch (err: unknown) {
        if (cancelled) return;
        console.error(err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to load draws.');
      }
    }

    fetchPage();

    return () => {
      cancelled = true;
    };
  }, [offset]);

  const draws = data?.draws ?? [];
  const pagination = data?.pagination;

  const canPrev = offset > 0;
  const canNext = !!pagination?.hasMore;

  const handlePrev = () => {
    if (!canPrev) return;
    setOffset((prev) => Math.max(prev - PAGE_SIZE, 0));
  };

  const handleNext = () => {
    if (!canNext) return;
    setOffset((prev) => prev + PAGE_SIZE);
  };

  return (
    <div className="dl-page dl-analysis-page">
      <header className="dl-analysis-header">
        <h1 className="dl-hero-title">EuroMillions draw history</h1>
        <p className="dl-section-subtitle">
          Browsing 20 draws at a time. Most recent first.
        </p>
      </header>

      <main>
        <section style={{ marginBottom: '2rem' }}>
          <LatestDraw />
        </section>

        {status === 'loading' && <p>Loading draws…</p>}
        {status === 'error' && <p style={{ color: 'red' }}>Error: {error}</p>}

        {status === 'success' && draws.length === 0 && <p>No draws found.</p>}

        {status === 'success' && draws.length > 0 && (
          <>
            <table
              className="dl-preview-table"
              style={{ width: '100%', marginBottom: '1rem' }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Date</th>
                  <th style={{ textAlign: 'left' }}>Numbers</th>
                  <th style={{ textAlign: 'left' }}>Stars</th>
                </tr>
              </thead>
              <tbody>
                {draws.map((d: EuromillionsDraw) => {
                  const dateLabel = new Date(d.draw_date).toLocaleDateString();
                  const numbers = [d.n1, d.n2, d.n3, d.n4, d.n5];
                  const stars = [d.s1, d.s2];

                  return (
                    <tr key={d.id}>
                      <td>{dateLabel}</td>
                      <td>
                        {numbers.map((n) => (
                          <span
                            key={n}
                            className="dl-draw-pill dl-draw-pill--main"
                          >
                            {n}
                          </span>
                        ))}
                      </td>
                      <td>
                        {stars.map((s) => (
                          <span
                            key={s}
                            className="dl-draw-pill dl-draw-pill--star"
                          >
                            {s}
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {pagination && (
              <div className="dl-pagination-bar">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={!canPrev}
                  className="dl-cta-btn"
                  style={{ opacity: canPrev ? 1 : 0.5 }}
                >
                  ← Previous
                </button>
                <div>
                  Showing {offset + 1}–{offset + draws.length} of{' '}
                  {pagination.total}
                </div>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canNext}
                  className="dl-cta-btn"
                  style={{ opacity: canNext ? 1 : 0.5 }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <ScrollToTopButton />
    </div>
  );
}

export default AllDrawsPage;
