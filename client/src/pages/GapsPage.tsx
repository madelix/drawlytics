// client/src/pages/GapsPage.tsx
import { useEffect, useState } from 'react';
import { ResponsiveBar } from '@nivo/bar';

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
          setError(err?.message ?? 'Failed to load gaps data');
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

  const maxMainGap = mainGaps.reduce((max, d) => Math.max(max, d.gap), 0) || 1;
  const maxStarGap = starGaps.reduce((max, d) => Math.max(max, d.gap), 0) || 1;

  // colour scales – strong brand purple / blue
  const mainColourScale = (intensity: number) => {
    const t = Math.max(0, Math.min(1, intensity));
    const alpha = 0.35 + 0.55 * t; // 0.35–0.9
    return `rgba(128, 65, 152, ${alpha})`; // brand purple
  };

  const starColourScale = (intensity: number) => {
    const t = Math.max(0, Math.min(1, intensity));
    const alpha = 0.4 + 0.5 * t; // 0.4–0.9
    return `rgba(33, 64, 154, ${alpha})`; // brand blue
  };

  return (
    <div className="dl-page dl-page-gaps">
      {/* HEADER */}
      <header className="dl-gaps-header">
        <h1 className="dl-hero-title">Overdue Numbers</h1>
        <p className="dl-section-subtitle">
          Explore EuroMillions numbers that haven&apos;t been drawn for the
          longest time, based on the full draw history.
        </p>
      </header>

      {/* TOP SUMMARY CARDS */}
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

      {/* MAIN GAPS CHART */}
      <section className="dl-gaps-section">
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
                padding={0.3}
                valueScale={{ type: 'linear' }}
                indexScale={{ type: 'band', round: true }}
                axisBottom={{
                  tickSize: 0,
                  tickPadding: 8,
                  legend: 'Number',
                  legendPosition: 'middle',
                  legendOffset: 28,
                }}
                axisLeft={{
                  tickSize: 0,
                  tickPadding: 6,
                  legend: 'Draws since last seen',
                  legendPosition: 'middle',
                  legendOffset: -38,
                }}
                enableGridX={false}
                enableGridY={true}
                labelSkipHeight={16}
                label={(d) => `${d.value}`}
                labelTextColor="#4b5563"
                colors={(bar) =>
                  mainColourScale((bar.data.gap as number) / maxMainGap)
                }
                animate={true}
                motionConfig="gentle"
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

        {/* STAR GAPS CHART */}
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
                padding={0.35}
                valueScale={{ type: 'linear' }}
                indexScale={{ type: 'band', round: true }}
                axisBottom={{
                  tickSize: 0,
                  tickPadding: 8,
                  legend: 'Number',
                  legendPosition: 'middle',
                  legendOffset: 28,
                }}
                axisLeft={{
                  tickSize: 0,
                  tickPadding: 6,
                  legend: 'Draws since last seen',
                  legendPosition: 'middle',
                  legendOffset: -38,
                }}
                enableGridX={false}
                enableGridY={true}
                labelSkipHeight={16}
                label={(d) => `${d.value}`}
                labelTextColor="#4b5563"
                colors={(bar) =>
                  starColourScale((bar.data.gap as number) / maxStarGap)
                }
                animate={true}
                motionConfig="gentle"
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
    </div>
  );
}

export default GapsPage;
