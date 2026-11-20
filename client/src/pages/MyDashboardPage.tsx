import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPlayedLinesPage } from '../api/dashboard';
import { PlayedLineCard } from '../components/PlayedLineCard';
import { MostPlayedModelCard } from '../components/MostPlayedModelCard';
import { MyNumbersForm } from '../components/MyNumbersForm';
import { getSavedNumberSets, type SavedNumberSet } from '../api/myNumbers';
import { getLotteryConfig } from '../config/lotteries';

export default function MyDashboardPage() {
  const [playedOffset, setPlayedOffset] = useState(0);
  const [playedPage, setPlayedPage] = useState<Awaited<
    ReturnType<typeof getPlayedLinesPage>
  > | null>(null);
  const [playedError, setPlayedError] = useState<string | null>(null);
  const [savedSets, setSavedSets] = useState<SavedNumberSet[]>([]);
  const [setsLoading, setSetsLoading] = useState(true);
  const [setsError, setSetsError] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSavedSets() {
      try {
        const sets = await getSavedNumberSets();
        if (active) setSavedSets(sets);
      } catch {
        if (active) setSetsError(true);
      } finally {
        if (active) setSetsLoading(false);
      }
    }

    void loadSavedSets();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setPlayedPage(null);
    setPlayedError(null);

    async function loadPlayedPage() {
      try {
        const page = await getPlayedLinesPage(playedOffset);
        if (active) setPlayedPage(page);
      } catch {
        if (active) setPlayedError('Your played lines could not be loaded.');
      }
    }

    void loadPlayedPage();

    return () => {
      active = false;
    };
  }, [playedOffset]);

  return (
    <div
      style={{
        maxWidth: 980,
        margin: '0 auto',
        padding: '20px 14px 28px',
      }}
    >
      <header style={{ textAlign: 'center' }}>
        <h1>My Dashboard</h1>
      </header>

      <nav
        aria-label="Personal dashboard"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        {[
          { label: 'Overview', to: '/dashboard' },
          { label: 'My Predictions', to: '/predictions' },
        ].map(({ label, to }) => {
          const active = to === '/dashboard';

          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              style={{
                border: active ? '1px solid #111827' : '1px solid #d1d5db',
                background: active ? '#111827' : '#fff',
                color: active ? '#fff' : '#374151',
                borderRadius: 6,
                padding: '0.55rem 1rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: active
                  ? '0 4px 10px rgba(15, 23, 42, 0.18)'
                  : 'none',
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <section
        className="dl-config-card"
        aria-labelledby="played-lines-heading"
        style={{ marginTop: 20, padding: '1.25rem', textAlign: 'left' }}
      >
        <h2 id="played-lines-heading" style={{ margin: '0 0 14px' }}>
          My played lines
        </h2>

        {playedError ? (
          <p role="alert">{playedError}</p>
        ) : !playedPage ? (
          <p role="status">Loading your played lines…</p>
        ) : playedPage.pagination.total === 0 ? (
          <p>
            Mark a line as played in{' '}
            <Link to="/predictions">My Predictions</Link> to see it here.
          </p>
        ) : (
          <>
            <div style={{ display: 'grid', gap: 10 }}>
              {playedPage.predictions.map((line) => (
                <PlayedLineCard key={line.id} line={line} />
              ))}
            </div>

            <div className="dl-pagination-bar" style={{ width: '100%' }}>
              <button
                type="button"
                className="dl-pagination-btn"
                disabled={playedOffset === 0}
                style={{ opacity: playedOffset === 0 ? 0.5 : 1 }}
                onClick={() =>
                  setPlayedOffset(
                    Math.max(0, playedOffset - playedPage.pagination.limit),
                  )
                }
              >
                ← Previous
              </button>

              <div>
                Showing {playedOffset + 1}–
                {playedOffset + playedPage.predictions.length} of{' '}
                {playedPage.pagination.total} played{' '}
                {playedPage.pagination.total === 1 ? 'line' : 'lines'}
              </div>

              <button
                type="button"
                className="dl-pagination-btn"
                disabled={!playedPage.pagination.hasMore}
                style={{ opacity: playedPage.pagination.hasMore ? 1 : 0.5 }}
                onClick={() =>
                  setPlayedOffset(playedOffset + playedPage.pagination.limit)
                }
              >
                Next →
              </button>
            </div>
          </>
        )}
      </section>
      <section
        className="dl-config-card"
        aria-labelledby="my-numbers-heading"
        style={{ marginTop: 20, padding: '1.25rem', textAlign: 'left' }}
      >
        <h2 id="my-numbers-heading" style={{ margin: '0 0 14px' }}>
          My Numbers
        </h2>

        {setsLoading ? (
          <p role="status">Loading your number sets…</p>
        ) : (
          <>
            {setsError && (
              <p role="alert">
                Your saved sets could not be loaded. Refresh to try again.
              </p>
            )}

            {savedSets.map((set) => {
              const lottery = getLotteryConfig(set.lottery);

              return (
                <article key={set.id} style={{ marginBottom: 16 }}>
                  <small>{lottery.label}</small>
                  <h3 style={{ margin: '4px 0 8px', overflowWrap: 'anywhere' }}>
                    {set.name}
                  </h3>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      gap: '8px 20px',
                    }}
                  >
                    {lottery.numberGroups.map((group) => {
                      const isMain = group.key === 'main';
                      const numbers = isMain
                        ? set.main_numbers
                        : set.special_numbers;
                      if (!numbers.length) return null;

                      return (
                        <div
                          key={group.key}
                          style={{ textAlign: isMain ? 'left' : 'right' }}
                        >
                          <small>{group.label}</small>
                          <div>
                            {numbers.map((number) => (
                              <span
                                key={number}
                                className={`dl-draw-pill dl-draw-pill--${isMain ? 'main' : 'star'}`}
                              >
                                {number}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}

            <MyNumbersForm
              onSaved={(set) => setSavedSets((previous) => [set, ...previous])}
            />
          </>
        )}
      </section>
      {playedPage && <MostPlayedModelCard page={playedPage} />}
    </div>
  );
}
