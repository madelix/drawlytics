// client/src/pages/AllDrawsPage.tsx
import { useEffect, useState } from 'react';
import {
  getDraws,
  type DrawsListResponse,
  type EuromillionsDraw,
} from '../api/draws';
import { ScrollToTopButton } from '../components/ScrollToTopButton';

type Status = 'idle' | 'loading' | 'success' | 'error';

const PAGE_SIZE = 20;

export function AllDrawsPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [data, setData] = useState<DrawsListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState<number>(0);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();

    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

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
        <h1 className="dl-hero-title">Draw History</h1>
        <p className="dl-section-subtitle">
          Browse official draw results. EuroMillions is available now, with UK
          Lotto and Set For Life planned.
        </p>
      </header>

      <main>
        {status === 'loading' && <p>Loading draws…</p>}
        {status === 'error' && <p style={{ color: 'red' }}>Error: {error}</p>}

        {status === 'success' && draws.length === 0 && <p>No draws found.</p>}

        {status === 'success' && draws.length > 0 && (
          <>
            <div className="dl-draws-list">
              {draws.map((d: EuromillionsDraw) => {
                const dateLabel = new Date(d.draw_date).toLocaleDateString();
                const numbers = [d.n1, d.n2, d.n3, d.n4, d.n5];
                const stars = [d.s1, d.s2];

                return (
                  <div key={d.id} className="dl-draw-card">
                    <div className="dl-draw-card-kicker">EUROMILLIONS</div>
                    <div className="dl-draw-card-header">Draw {dateLabel}</div>

                    <div className="dl-draw-card-content">
                      <div className="dl-draw-card-section">
                        <div className="dl-draw-card-label">Main numbers</div>

                        <div className="dl-draw-pill-row">
                          {numbers.map((n) => (
                            <span
                              key={n}
                              className="dl-draw-pill dl-draw-pill--main"
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="dl-draw-card-section">
                        <div className="dl-draw-card-label">Stars</div>

                        <div className="dl-draw-pill-row">
                          {stars.map((s) => (
                            <span
                              key={s}
                              className="dl-draw-pill dl-draw-pill--star"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {pagination && (
              <div className="dl-pagination-bar">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={!canPrev}
                  className="dl-pagination-btn"
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
                  className="dl-pagination-btn"
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
