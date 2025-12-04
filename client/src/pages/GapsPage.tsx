// client/src/pages/GapsPage.tsx
import { useEffect, useState } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { ScrollToTopButton } from '../components/ScrollToTopButton';

import { getGaps, GapsResponse } from '../api/analysis';

type GapDatum = {
  label: string; // number as text
  gap: number; // draws since last seen
  lastSeenLabel: string; // formatted last-seen string
  [key: string]: string | number;
};

export function GapsPage() {
  const [gapsData, setGapsData] = useState<GapsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await getGaps();
        if (!cancelled) {
          setGapsData(res);
        }
      } catch (err: any) {
        if (!cancelled) {
          const msg = err?.message ?? 'Failed to load gaps';
          setError(msg);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const mainGapsRaw = gapsData?.main ?? [];
  const starGapsRaw = gapsData?.stars ?? [];

  const mainGaps: GapDatum[] = mainGapsRaw.slice(0, 20).map((item) => ({
    label: String(item.number),
    gap: item.gap,
    lastSeenLabel: item.lastSeen ?? 'Never seen',
  }));

  const starGaps: GapDatum[] = starGapsRaw.slice(0, 12).map((item) => ({
    label: String(item.number),
    gap: item.gap,
    lastSeenLabel: item.lastSeen ?? 'Never seen',
  }));

  const overdueMainTop = mainGapsRaw.slice(0, 5);
  const overdueStarsTop = starGapsRaw.slice(0, 5);

  return (
    <div className="dl-page dl-analysis-page">
      <header className="dl-analysis-header">
        <h1 className="dl-hero-title">Overdue Numbers</h1>
        <p className="dl-section-subtitle">
          Explore EuroMillions numbers that haven&apos;t been drawn for the
          longest time, based on the full draw history.
        </p>
      </header>

      <section className="dl-gaps-top">
        <div className="dl-gaps-summary-card">
          <h3>Most overdue main numbers</h3>
          {gapsData && (
            <p className="dl-gaps-summary-meta">
              Based on full EuroMillions history (
              {gapsData.totalDrawsConsidered} draws).
            </p>
          )}

          {loading && <p>Loading main gaps…</p>}
          {error && <p style={{ color: 'red' }}>Error: {error}</p>}
          {!loading && !error && (
            <ul className="dl-gap-list">
              {overdueMainTop.map((item) => (
                <li key={item.number}>
                  <span className="dl-gap-number">{item.number}</span>
                  <span className="dl-gap-text">
                    {item.gap} draws since last seen{' '}
                    {item.lastSeen ? `(${item.lastSeen})` : '(never seen)'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dl-gaps-summary-card">
          <h3>Most overdue stars</h3>
          {gapsData && (
            <p className="dl-gaps-summary-meta">
              Based on full EuroMillions history (
              {gapsData.totalDrawsConsidered} draws).
            </p>
          )}

          {loading && <p>Loading star gaps…</p>}
          {error && <p style={{ color: 'red' }}>Error: {error}</p>}
          {!loading && !error && (
            <ul className="dl-gap-list">
              {overdueStarsTop.map((item) => (
                <li key={item.number}>
                  <span className="dl-gap-number dl-gap-number-star">
                    {item.number}
                  </span>
                  <span className="dl-gap-text">
                    {item.gap} draws since last seen{' '}
                    {item.lastSeen ? `(${item.lastSeen})` : '(never seen)'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="dl-analysis-charts">
        <div className="dl-gaps-chart-card">
          <h2>Main number gaps</h2>
          <p className="dl-config-hint">
            Top 20 main numbers ordered by time since last drawn.
          </p>

          {loading && <p>Loading chart…</p>}
          {error && <p style={{ color: 'red' }}>Error: {error}</p>}
          {!loading && !error && mainGaps.length > 0 && (
            <div className="dl-chart-shell dl-chart-shell--gaps">
              <ResponsiveBar
                data={mainGaps}
                keys={['gap']}
                indexBy="label"
                margin={{ top: 20, right: 20, bottom: 40, left: 40 }}
                padding={0.25}
                valueScale={{ type: 'linear' }}
                indexScale={{ type: 'band', round: true }}
                colors="#804198"
                animate={true}
                motionConfig="gentle"
                enableGridX={false}
                enableGridY={true}
                axisBottom={{
                  tickSize: 0,
                  tickPadding: 6,
                  tickRotation: 0,
                  legend: 'Number',
                  legendOffset: 32,
                  legendPosition: 'middle',
                }}
                axisLeft={{
                  tickSize: 0,
                  tickPadding: 6,
                  tickRotation: 0,
                  legend: 'Draws since last seen',
                  legendOffset: -50,
                  legendPosition: 'middle',
                }}
                theme={{
                  text: {
                    fontSize: 11,
                    fill: '#4b5563',
                  },
                  grid: {
                    line: {
                      stroke: '#e5e7eb',
                      strokeWidth: 1,
                      strokeDasharray: '2 4',
                    },
                  },
                  tooltip: {
                    container: {
                      background: '#ffffff',
                      borderRadius: 12,
                      padding: '8px 10px',
                      boxShadow: '0 8px 20px rgba(15, 23, 42, 0.18)',
                    },
                  },
                }}
                tooltip={({ data }: { data: GapDatum }) => (
                  <div className="dl-chart-tooltip">
                    <strong>Number {data.label}</strong>
                    <span>{data.gap} draws since last seen</span>
                    <span className="dl-chart-tooltip-sub">
                      Last seen: {data.lastSeenLabel}
                    </span>
                  </div>
                )}
                role="application"
                ariaLabel="Main number gaps bar chart"
              />
            </div>
          )}
        </div>

        <div className="dl-gaps-chart-card">
          <h2>Star number gaps</h2>
          <p className="dl-config-hint">
            Top 12 star numbers ordered by time since last drawn.
          </p>

          {loading && <p>Loading chart…</p>}
          {error && <p style={{ color: 'red' }}>Error: {error}</p>}
          {!loading && !error && starGaps.length > 0 && (
            <div className="dl-chart-shell dl-chart-shell--gaps">
              <ResponsiveBar
                data={starGaps}
                keys={['gap']}
                indexBy="label"
                margin={{ top: 20, right: 20, bottom: 40, left: 40 }}
                padding={0.25}
                valueScale={{ type: 'linear' }}
                indexScale={{ type: 'band', round: true }}
                colors="#21409a"
                animate={true}
                motionConfig="gentle"
                enableGridX={false}
                enableGridY={true}
                axisBottom={{
                  tickSize: 0,
                  tickPadding: 6,
                  tickRotation: 0,
                  legend: 'Star',
                  legendOffset: 32,
                  legendPosition: 'middle',
                }}
                axisLeft={{
                  tickSize: 0,
                  tickPadding: 6,
                  tickRotation: 0,
                  legend: 'Draws since last seen',
                  legendOffset: -50,
                  legendPosition: 'middle',
                }}
                theme={{
                  text: {
                    fontSize: 11,
                    fill: '#4b5563',
                  },
                  grid: {
                    line: {
                      stroke: '#e5e7eb',
                      strokeWidth: 1,
                      strokeDasharray: '2 4',
                    },
                  },
                  tooltip: {
                    container: {
                      background: '#ffffff',
                      borderRadius: 12,
                      padding: '8px 10px',
                      boxShadow: '0 8px 20px rgba(15, 23, 42, 0.18)',
                    },
                  },
                }}
                tooltip={({ data }: { data: GapDatum }) => (
                  <div className="dl-chart-tooltip">
                    <strong>Star {data.label}</strong>
                    <span>{data.gap} draws since last seen</span>
                    <span className="dl-chart-tooltip-sub">
                      Last seen: {data.lastSeenLabel}
                    </span>
                  </div>
                )}
                role="application"
                ariaLabel="Star number gaps bar chart"
              />
            </div>
          )}
        </div>
      </section>

      <ScrollToTopButton />
    </div>
  );
}

export default GapsPage;
