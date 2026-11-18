import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getLatestPlayedResults,
  type LatestPlayedResult,
} from '../api/dashboard';
import { getLotteryConfig } from '../config/lotteries';

export default function MyDashboardPage() {
  const [latestResults, setLatestResults] = useState<LatestPlayedResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [resultsError, setResultsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadLatestResults() {
      try {
        const results = await getLatestPlayedResults();
        if (active) setLatestResults(results);
      } catch {
        if (active)
          setResultsError('Your latest played results could not be loaded.');
      } finally {
        if (active) setLoadingResults(false);
      }
    }

    void loadLatestResults();

    return () => {
      active = false;
    };
  }, []);

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
        aria-labelledby="latest-played-heading"
        style={{ marginTop: 20, padding: '1.25rem', textAlign: 'left' }}
      >
        <h2 id="latest-played-heading" style={{ margin: 0 }}>
          Latest played result
        </h2>

        {loadingResults ? (
          <p role="status">Loading your played results…</p>
        ) : resultsError ? (
          <p role="alert">{resultsError}</p>
        ) : latestResults.length === 0 ? (
          <p>
            Your result will appear here once a line you’ve marked as played has
            been checked against the official draw.
          </p>
        ) : (
          latestResults.map((result) => {
            const lottery = getLotteryConfig(result.lottery);
            const dateLabel = new Date(
              `${result.draw_date}T00:00:00Z`,
            ).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            });

            return (
              <div
                key={`${result.lottery}-${result.draw_date}-${result.draw_sequence}`}
                style={{ marginTop: 16 }}
              >
                <h3 style={{ margin: 0, fontSize: '1rem' }}>
                  {lottery.label} · {dateLabel}
                  {result.lottery === 'uk_lotto' &&
                    ` · Draw ${result.draw_sequence}`}
                </h3>

                <p style={{ margin: '6px 0' }}>
                  {result.checked_lines} played{' '}
                  {result.checked_lines === 1 ? 'line' : 'lines'} checked
                </p>

                <p style={{ margin: 0 }}>
                  <strong>Best played line</strong> · Main matches:{' '}
                  {result.matched_main}
                  {' · '}
                  {lottery.specialLabel}: {result.matched_special}
                </p>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
