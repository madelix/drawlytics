// client/src/pages/AllDrawsPage.tsx
import { useEffect, useState } from 'react';
import {
  getDraws,
  type DrawsListResponse,
  type LotteryDraw,
} from '../api/draws';
import { ScrollToTopButton } from '../components/ScrollToTopButton';
import { LOTTERIES, getLotteryConfig, LotteryKey } from '../config/lotteries';

type Status = 'idle' | 'loading' | 'success' | 'error';

const PAGE_SIZE = 20;

export function AllDrawsPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [data, setData] = useState<DrawsListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState<number>(0);
  const [selectedLottery, setSelectedLottery] =
    useState<LotteryKey>('euromillions');

  const lotteryConfig = getLotteryConfig(selectedLottery);

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

        const result = await getDraws({
          limit: PAGE_SIZE,
          offset,
          lottery: selectedLottery,
        });
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
  }, [offset, selectedLottery]);

  const draws = data?.draws ?? [];
  const pagination = data?.pagination;

  const canPrev = offset > 0;
  const canNext = !!pagination?.hasMore;

  const mainGroup = lotteryConfig.numberGroups.find(
    (group) => group.key === 'main',
  );

  const specialGroup = lotteryConfig.numberGroups.find(
    (group) => group.key !== 'main',
  );

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
          Browse official historical draw results across supported lotteries.
        </p>
      </header>

      <section className="dl-analysis-config">
        <div className="dl-config-card">
          <div
            className="dl-config-row"
            style={{
              alignItems: isMobile ? 'stretch' : undefined,
              flexDirection: isMobile ? 'column' : undefined,
              gap: isMobile ? '1rem' : undefined,
            }}
          >
            <div className="dl-config-item">
              <div className="dl-config-label">Lottery type</div>

              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  marginTop: '0.35rem',
                }}
              >
                {LOTTERIES.map((lottery) => {
                  const active = selectedLottery === lottery.key;

                  return (
                    <button
                      key={lottery.key}
                      type="button"
                      onClick={() => {
                        setSelectedLottery(lottery.key);
                        setOffset(0);
                      }}
                      style={{
                        borderRadius: 8,
                        border: active
                          ? '1px solid #111827'
                          : '1px solid rgba(148, 163, 184, 0.35)',
                        padding: '0.45rem 0.9rem',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                        background: active ? '#111827' : '#ffffff',
                        color: active ? '#ffffff' : '#334155',
                        boxShadow: active
                          ? '0 4px 10px rgba(15, 23, 42, 0.18)'
                          : 'none',
                      }}
                    >
                      {lottery.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <main>
        {status === 'loading' && <p>Loading draws…</p>}
        {status === 'error' && <p style={{ color: 'red' }}>Error: {error}</p>}

        {status === 'success' && draws.length === 0 && <p>No draws found.</p>}

        {status === 'success' && draws.length > 0 && (
          <>
            <div className="dl-draws-list">
              {draws.map((d: LotteryDraw) => {
                const dateLabel = new Date(d.draw_date).toLocaleDateString();

                const numbers = [d.n1, d.n2, d.n3, d.n4, d.n5, d.n6].filter(
                  (value): value is number => typeof value === 'number',
                );

                const specialNumbers = [
                  d.s1,
                  d.s2,
                  d.bonus_ball,
                  d.life_ball,
                ].filter((value): value is number => typeof value === 'number');

                return (
                  <div key={d.id} className="dl-draw-card">
                    <div className="dl-draw-card-kicker">
                      {lotteryConfig.label.toUpperCase()}
                    </div>

                    <div className="dl-draw-card-header">Draw {dateLabel}</div>

                    <div className="dl-draw-card-content">
                      <div className="dl-draw-card-section">
                        <div className="dl-draw-card-label">
                          {mainGroup?.label ?? 'Main numbers'}
                        </div>

                        <div className="dl-draw-pill-row">
                          {numbers.map((n: number) => (
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
                        <div className="dl-draw-card-label">
                          {specialGroup?.label ?? 'Special numbers'}
                        </div>

                        <div className="dl-draw-pill-row">
                          {specialNumbers.map((s: number) => (
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
