// client/src/pages/AnalysisPage.tsx
import { useEffect, useState } from 'react';
import {
  getFrequencyLatestN,
  getHotCold,
  getGaps,
  FrequencyLatestNResponse,
  HotColdResponse,
  GapsResponse,
  NumberCount,
} from '../api/analysis';
import { ResponsiveBar } from '@nivo/bar';

// ---------- Types ----------
type RangeOption = {
  label: string;
  value: number;
};

const RANGE_OPTIONS: RangeOption[] = [
  { label: 'Last 50 draws', value: 50 },
  { label: 'Last 100 draws', value: 100 },
  { label: 'Last 200 draws', value: 200 },
];

const HOT_COLD_TOP = 5;

// Small helper type for Nivo
type BarDatum = {
  number: number;
  count: number;
};

export function AnalysisPage() {
  const [range, setRange] = useState<number>(100);

  const [freqData, setFreqData] = useState<FrequencyLatestNResponse | null>(
    null,
  );
  const [freqLoading, setFreqLoading] = useState(false);
  const [freqError, setFreqError] = useState<string | null>(null);

  const [hotColdData, setHotColdData] = useState<HotColdResponse | null>(null);
  const [hotColdLoading, setHotColdLoading] = useState(false);
  const [hotColdError, setHotColdError] = useState<string | null>(null);

  const [gapsData, setGapsData] = useState<GapsResponse | null>(null);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapsError, setGapsError] = useState<string | null>(null);

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
          getFrequencyLatestN(range),
          getHotCold(range, HOT_COLD_TOP),
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
  }, [range]);

  // ---------- Load gaps once (full history) ----------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setGapsLoading(true);
      setGapsError(null);

      try {
        const gaps = await getGaps();
        if (!cancelled) {
          setGapsData(gaps);
        }
      } catch (err: any) {
        if (!cancelled) {
          setGapsError(err?.message ?? 'Failed to load gaps data');
        }
      } finally {
        if (!cancelled) {
          setGapsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Massage data for charts ----------
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

  const overdueMain = gapsData?.main.slice(0, 5) ?? [];
  const overdueStars = gapsData?.stars.slice(0, 5) ?? [];

  // ---------- Colour helpers ----------
  const mainColourScale = (intensity: number) => {
    const t = Math.max(0, Math.min(1, intensity));
    const alpha = 0.2 + 0.6 * t; // 0.2 – 0.8
    return `rgba(128, 65, 152, ${alpha})`;
  };

  const starColourScale = (intensity: number) => {
    const t = Math.max(0, Math.min(1, intensity));
    const alpha = 0.25 + 0.55 * t;
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
        legend: 'Hits',
        legendOffset: -32,
        legendPosition: 'middle',
      }}
      tooltip={({ data }) => (
        <div className="dl-chart-tooltip">
          <div className="dl-chart-tooltip-title">
            {labelPrefix} {data.number}
          </div>
          <div className="dl-chart-tooltip-body">
            {data.count} hits in the last {range} draws
          </div>
        </div>
      )}
      borderRadius={4}
      theme={{
        background: 'transparent',
        text: {
          fill: '#4b5563',
          fontSize: 11,
        },
        tooltip: {
          container: {
            background: '#ffffff',
            boxShadow: '0 4px 12px rgba(15,23,42,0.18)',
            borderRadius: 10,
            padding: '6px 10px',
          },
        },
        grid: {
          line: {
            stroke: 'rgba(148,163,184,0.25)',
            strokeWidth: 1,
          },
        },
      }}
      role="img"
    />
  );

  // ---------- Render ----------
  return (
    <div className="dl-page dl-analysis-page">
      {/* PAGE TITLE */}
      <header className="dl-analysis-header">
        <h1 className="dl-hero-title">Number Analysis</h1>
        <p className="dl-section-subtitle">
          Discover trends, hot &amp; cold numbers, and overdue numbers from
          recent EuroMillions draws.
        </p>
      </header>

      {/* CONFIG BAR */}
      <section className="dl-analysis-config">
        <div className="dl-config-card">
          <div className="dl-config-row">
            <div>
              <div className="dl-config-label">Lottery Type</div>
              <div className="dl-config-value">EuroMillions</div>
            </div>

            <div>
              <div className="dl-config-label">Number of draws to analyse</div>
              <select
                value={range}
                onChange={(e) => setRange(Number(e.target.value))}
                className="dl-config-select"
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

      {/* HOT / COLD / OVERDUE SUMMARY */}
      <section className="dl-analysis-grid">
        {/* Hot Main */}
        <div className="dl-analysis-card">
          <h2>Hot Numbers (Main)</h2>
          {hotColdLoading && <p>Loading hot numbers…</p>}
          {hotColdError && (
            <p style={{ color: 'red' }}>Error: {hotColdError}</p>
          )}
          {!hotColdLoading && hotColdData && (
            <div className="dl-chip-row">
              {hotColdData.hot.main.map((item) => (
                <span key={item.number} className="dl-chip-main">
                  {item.number}
                  <span className="dl-chip-sub">
                    {item.count} hits (last {hotColdData.requestedN} draws)
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Cold Main */}
        <div className="dl-analysis-card">
          <h2>Cold Numbers (Main)</h2>
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
                    {item.count} hits (last {hotColdData.requestedN} draws)
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Overdue / Gaps */}
        <div className="dl-analysis-card dl-analysis-card-overdue">
          <h2>Overdue Numbers</h2>
          {gapsLoading && <p>Calculating overdue numbers…</p>}
          {gapsError && <p style={{ color: 'red' }}>Error: {gapsError}</p>}
          {!gapsLoading && gapsData && (
            <>
              <p className="dl-config-hint">
                Based on full EuroMillions history (
                {gapsData.totalDrawsConsidered} draws).
              </p>

              <div className="dl-overdue-grid">
                {/* Main numbers column */}
                <div className="dl-overdue-column">
                  <h3 className="dl-overdue-subtitle">Main numbers</h3>
                  <ul className="dl-gap-list">
                    {overdueMain.map((item) => (
                      <li key={item.number}>
                        <span className="dl-gap-number">{item.number}</span>
                        <span className="dl-gap-text">
                          {item.gap} draws since last seen{' '}
                          {item.lastSeen
                            ? `(${item.lastSeen})`
                            : '(never seen)'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Stars column */}
                <div className="dl-overdue-column">
                  <h3 className="dl-overdue-subtitle">Stars</h3>
                  <ul className="dl-gap-list">
                    {overdueStars.map((item) => (
                      <li key={item.number}>
                        <span className="dl-gap-number dl-gap-number-star">
                          {item.number}
                        </span>
                        <span className="dl-gap-text">
                          {item.gap} draws since last seen{' '}
                          {item.lastSeen
                            ? `(${item.lastSeen})`
                            : '(never seen)'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* FREQUENCY CHARTS */}
      <section className="dl-analysis-charts">
        {/* MAIN NUMBERS */}
        <div className="dl-analysis-card">
          <h2>Main Number Frequency</h2>
          <p className="dl-config-hint">
            Frequency of each main number in the last {range} draws.
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
          <h2>Star Number Frequency</h2>
          <p className="dl-config-hint">
            Frequency of each star number in the last {range} draws.
          </p>

          {freqLoading && <p>Loading frequency…</p>}
          {freqError && <p style={{ color: 'red' }}>Error: {freqError}</p>}
          {!freqLoading && !freqError && sortedStarFreq.length > 0 && (
            <div className="dl-chart-shell">
              {renderBarChart(
                sortedStarFreq,
                maxStarCount,
                starColourScale,
                'Star',
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
