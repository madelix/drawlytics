// client/src/pages/AnalysisPage.tsx
import { useEffect, useState } from 'react';
import {
  getFrequencyLatestN,
  getHotCold,
  FrequencyLatestNResponse,
  HotColdResponse,
  NumberCount,
} from '../api/analysis';
import { ResponsiveBar } from '@nivo/bar';
import { ScrollToTopButton } from '../components/ScrollToTopButton';
import { apiUrl } from '../api/apiClient';
import { LOTTERIES, LotteryKey, getLotteryConfig } from '../config/lotteries';

// ---------- Types ----------
type RangeOption = {
  label: string;
  value: number;
};

const RANGE_OPTIONS: RangeOption[] = [
  { label: 'Last 50 draws', value: 50 },
  { label: 'Last 100 draws', value: 100 },
  { label: 'Last 200 draws', value: 200 },
  { label: 'All draws', value: -1 },
];

const HOT_COLD_TOP = 5;

// Small helper type for Nivo
type BarDatum = {
  number: number;
  count: number;
};

export function AnalysisPage() {
  const [range, setRange] = useState<number>(100);

  const [selectedLottery, setSelectedLottery] =
    useState<LotteryKey>('euromillions');

  const selectedLotteryConfig = getLotteryConfig(selectedLottery);

  const [freqData, setFreqData] = useState<FrequencyLatestNResponse | null>(
    null,
  );
  const [freqLoading, setFreqLoading] = useState(false);
  const [freqError, setFreqError] = useState<string | null>(null);

  const [hotColdData, setHotColdData] = useState<HotColdResponse | null>(null);
  const [hotColdLoading, setHotColdLoading] = useState(false);
  const [hotColdError, setHotColdError] = useState<string | null>(null);

  // quick generate state
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

  // ---------- Load frequency + hot/cold whenever range changes ----------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setFreqLoading(true);
      setFreqError(null);
      setHotColdLoading(true);
      setHotColdError(null);

      try {
        const [freq, hotCold] = await Promise.all([
          getFrequencyLatestN(range, selectedLottery),
          getHotCold(range, HOT_COLD_TOP, selectedLottery),
        ]);

        if (!cancelled) {
          setFreqData(freq);
          setHotColdData(hotCold);
        }
      } catch (err: any) {
        if (!cancelled) {
          const msg = err?.message ?? 'Failed to load data';
          setFreqError(msg);
          setHotColdError(msg);
        }
      } finally {
        if (!cancelled) {
          setFreqLoading(false);
          setHotColdLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [range, selectedLottery]);

  // ---------- Basic derived data ----------
  const mainFreq: NumberCount[] = freqData?.main ?? [];
  const starFreq: NumberCount[] = freqData?.stars ?? [];

  const sortedMainFreq: BarDatum[] = [...mainFreq]
    .sort((a, b) => a.number - b.number)
    .map((d) => ({ number: d.number, count: d.count }));

  const sortedStarFreq: BarDatum[] = [...starFreq]
    .sort((a, b) => a.number - b.number)
    .map((d) => ({ number: d.number, count: d.count }));

  const maxMainCount =
    sortedMainFreq.reduce((max, item) => Math.max(max, item.count), 0) || 1;
  const maxStarCount =
    sortedStarFreq.reduce((max, item) => Math.max(max, item.count), 0) || 1;

  const rangeLabel =
    range === -1 ? 'all recorded draws' : `the last ${range} draws`;

  // ---------- Colour helpers ----------
  const mainColourScale = (intensity: number) => {
    const t = Math.max(0, Math.min(1, intensity));
    const alpha = 0.2 + 0.6 * t; // 0.2 – 0.8
    return `rgba(128, 65, 152, ${alpha})`;
  };

  const starColourScale = (intensity: number) => {
    const t = Math.max(0, Math.min(1, intensity));
    const alpha = 0.2 + 0.6 * t; // 0.2 – 0.8
    return `rgba(33, 64, 154, ${alpha})`;
  };

  // ---------- Reusable Nivo bar chart ----------
  const renderBarChart = (
    data: BarDatum[],
    maxCount: number,
    colourFn: (intensity: number) => string,
    labelPrefix: string,
  ) => (
    <ResponsiveBar<BarDatum>
      data={data}
      keys={['count']}
      indexBy="number"
      margin={{ top: 10, right: 10, bottom: 40, left: 40 }}
      padding={0.25}
      valueScale={{ type: 'linear' }}
      indexScale={{ type: 'band', round: true }}
      colors={(bar) => colourFn((bar.data.count ?? 0) / maxCount)}
      animate={true}
      motionConfig="gentle"
      enableGridX={false}
      enableGridY={true}
      enableLabel={!isMobile}
      axisBottom={{
        tickSize: isMobile ? 0 : 5,
        tickPadding: isMobile ? 4 : 5,
        tickRotation: 0,
        legend: 'Number',
        legendPosition: 'middle',
        legendOffset: 36,
        format: (value) => {
          const n = Number(value);

          if (!isMobile) return String(value);
          if (!Number.isFinite(n)) return String(value);

          if (data.length <= 12) return String(value);

          return n % 5 === 0 ? String(value) : '';
        },
      }}
      axisLeft={{
        tickSize: 0,
        tickPadding: 6,
        tickRotation: 0,
        legend: 'Hits',
        legendOffset: -32,
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
      tooltip={({ data }) => (
        <div className="dl-chart-tooltip">
          <strong>
            {labelPrefix} {data.number}
          </strong>
          <span>{data.count} hits</span>
          <span className="dl-chart-tooltip-sub">
            Based on the last {freqData?.totalDrawsConsidered ?? range} draws.
          </span>
        </div>
      )}
      role="application"
      ariaLabel={`${labelPrefix} number frequency bar chart`}
    />
  );

  return (
    <div
      className="dl-page dl-analysis-page"
      style={{
        padding: isMobile ? '1rem 0.75rem 4rem' : undefined,
      }}
    >
      {/* HEADER */}
      <header className="dl-analysis-header">
        <h1 className="dl-hero-title">Number Analysis</h1>
        <p className="dl-section-subtitle">
          Compare hot, cold, and frequency patterns across supported lottery
          draws.
        </p>
      </header>

      {/* CONFIG BAR */}
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

            <div className="dl-config-item dl-config-item--right">
              <label className="dl-config-label" htmlFor="dl-range-select">
                Number of draws to analyse
              </label>
              <select
                id="dl-range-select"
                className="dl-range-select"
                value={range}
                onChange={(e) => setRange(Number(e.target.value))}
              >
                {RANGE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <div className="dl-config-hint">
                Analysing {freqData?.totalDrawsConsidered ?? range} draws
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOT / COLD SUMMARY */}
      <section
        className="dl-analysis-grid"
        style={{
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
        }}
      >
        {/* Hot Main */}
        <div className="dl-analysis-card">
          <h2>Hot Main Numbers</h2>

          {hotColdLoading && <p>Loading hot numbers…</p>}

          {hotColdError && (
            <p style={{ color: 'red' }}>Error: {hotColdError}</p>
          )}

          {!hotColdLoading && hotColdData && (
            <div className="dl-chip-row">
              {hotColdData.hot.main.map((item) => (
                <span
                  key={item.number}
                  className={`dl-chip-main ${selectedLotteryConfig.hotChipClass}`}
                >
                  {item.number}
                  <span className="dl-chip-sub">
                    {item.count} hits ({rangeLabel})
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Hot Special */}
        <div className="dl-analysis-card">
          <h2>Hot {selectedLotteryConfig.specialLabel}</h2>

          {hotColdLoading && <p>Loading hot numbers…</p>}

          {hotColdError && (
            <p style={{ color: 'red' }}>Error: {hotColdError}</p>
          )}

          {!hotColdLoading && hotColdData && (
            <div className="dl-chip-row">
              {hotColdData.hot.stars.map((item) => (
                <span
                  key={item.number}
                  className={`dl-chip-main ${selectedLotteryConfig.hotChipClass}`}
                >
                  {item.number}
                  <span className="dl-chip-sub">
                    {item.count} hits ({rangeLabel})
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Cold Main */}
        <div className="dl-analysis-card">
          <h2>Cold Main Numbers</h2>

          {hotColdLoading && <p>Loading cold numbers…</p>}

          {hotColdError && (
            <p style={{ color: 'red' }}>Error: {hotColdError}</p>
          )}

          {!hotColdLoading && hotColdData && (
            <div className="dl-chip-row">
              {hotColdData.cold.main.map((item) => (
                <span key={item.number} className="dl-chip-main dl-chip-cold">
                  {item.number}
                  <span className="dl-chip-sub">
                    {item.count} hits ({rangeLabel})
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Cold Special */}
        <div className="dl-analysis-card">
          <h2>Cold {selectedLotteryConfig.specialLabel}</h2>

          {hotColdLoading && <p>Loading cold numbers…</p>}

          {hotColdError && (
            <p style={{ color: 'red' }}>Error: {hotColdError}</p>
          )}

          {!hotColdLoading && hotColdData && (
            <div className="dl-chip-row">
              {hotColdData.cold.stars.map((item) => (
                <span key={item.number} className="dl-chip-main dl-chip-cold">
                  {item.number}
                  <span className="dl-chip-sub">
                    {item.count} hits ({rangeLabel})
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FREQUENCY CHARTS */}
      <section className="dl-analysis-charts">
        {/* MAIN */}
        <div className="dl-analysis-card">
          <h2>Main Number Frequency</h2>
          <p className="dl-config-hint">
            Frequency of each main number across {rangeLabel}.
          </p>

          {freqLoading && <p>Loading frequency…</p>}
          {freqError && <p style={{ color: 'red' }}>Error: {freqError}</p>}
          {!freqLoading && !freqError && sortedMainFreq.length > 0 && (
            <div className="dl-chart-shell">
              {renderBarChart(
                sortedMainFreq,
                maxMainCount,
                mainColourScale,
                'Number',
              )}
            </div>
          )}
        </div>

        {/* STARS */}
        <div className="dl-analysis-card">
          <h2>{selectedLotteryConfig.specialLabel} Frequency</h2>
          <p className="dl-config-hint">
            Frequency of each {selectedLotteryConfig.specialLabel.toLowerCase()}{' '}
            number across {rangeLabel}.
          </p>

          {freqLoading && <p>Loading frequency…</p>}
          {freqError && <p style={{ color: 'red' }}>Error: {freqError}</p>}
          {!freqLoading && !freqError && sortedStarFreq.length > 0 && (
            <div className="dl-chart-shell">
              {renderBarChart(
                sortedStarFreq,
                maxStarCount,
                starColourScale,
                selectedLotteryConfig.specialLabel,
              )}
            </div>
          )}
        </div>
      </section>

      <ScrollToTopButton />
    </div>
  );
}
