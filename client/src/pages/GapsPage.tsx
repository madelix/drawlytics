// client/src/pages/GapsPage.tsx
import { useEffect, useState } from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { ScrollToTopButton } from '../components/ScrollToTopButton';

import { LOTTERIES, getLotteryConfig, LotteryKey } from '../config/lotteries';

import { getGaps, GapsResponse } from '../api/analysis';

type GapDatum = {
  label: string; // number as text
  gap: number; // draws since last seen
  lastSeenLabel: string; // formatted last-seen string
  [key: string]: string | number;
};

export function GapsPage() {
  const [selectedLottery, setSelectedLottery] =
    useState<LotteryKey>('euromillions');

  const lotteryConfig = getLotteryConfig(selectedLottery);
  const [gapsData, setGapsData] = useState<GapsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  }, [selectedLottery]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await getGaps(selectedLottery);
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
  }, [selectedLottery]);

  const mainGapsRaw = gapsData?.main ?? [];
  const starGapsRaw = gapsData?.stars ?? [];
  const specialLabel = lotteryConfig.specialLabel;

  const mainGaps: GapDatum[] = mainGapsRaw.slice(0, 20).map((item) => ({
    label: String(item.number),
    gap: Number(item.gap), // ✅ coerce to number for charts
    lastSeenLabel: item.lastSeen ?? 'Never seen',
  }));

  const starGaps: GapDatum[] = starGapsRaw.slice(0, 12).map((item) => ({
    label: String(item.number),
    gap: Number(item.gap), // ✅ coerce to number for charts
    lastSeenLabel: item.lastSeen ?? 'Never seen',
  }));

  const overdueMainTop = mainGapsRaw.slice(0, 5);
  const overdueStarsTop = starGapsRaw.slice(0, 5);

  return (
    <div
      className="dl-page dl-analysis-page"
      style={{
        padding: isMobile ? '1rem 0.75rem 4rem' : undefined,
      }}
    >
      <header className="dl-analysis-header">
        <h1 className="dl-hero-title">Overdue Numbers</h1>

        <p className="dl-section-subtitle">
          Explore {lotteryConfig.label} numbers that haven&apos;t been drawn for
          the longest time, based on the full draw history.
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
                      onClick={() => setSelectedLottery(lottery.key)}
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
          <h3>
            Most overdue {specialLabel.toLowerCase()}
            {specialLabel.endsWith('s') ? '' : ' numbers'}
          </h3>
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
                colors={() => 'rgba(128, 65, 152, 0.75)'}
                animate={true}
                motionConfig="gentle"
                enableGridX={false}
                enableGridY={true}
                enableLabel={!isMobile}
                axisBottom={{
                  tickSize: 0,
                  tickPadding: 6,
                  tickRotation: 0,
                  legend: 'Number',
                  legendOffset: 32,
                  legendPosition: 'middle',
                  format: (value) => {
                    if (!isMobile) return String(value);

                    const index = mainGaps.findIndex(
                      (item) => item.label === String(value),
                    );

                    return index % 3 === 0 ? String(value) : '';
                  },
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
          <h2>{specialLabel} gaps</h2>
          <p className="dl-config-hint">
            Top special numbers ordered by time since last drawn.
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
                colors={() => 'rgba(33, 64, 154, 0.75)'}
                animate={true}
                motionConfig="gentle"
                enableGridX={false}
                enableGridY={true}
                enableLabel={!isMobile}
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
                    <strong>
                      {specialLabel} {data.label}
                    </strong>
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
