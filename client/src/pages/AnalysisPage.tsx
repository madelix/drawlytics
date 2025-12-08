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
import { ScrollToTopButton } from '../components/ScrollToTopButton';

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

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

// 👇 must match client/.env
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

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

  // NEW: quick generate state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

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
          const msg = err?.message ?? 'Failed to load gaps';
          setGapsError(msg);
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

  // ---------- Quick generate prediction ----------
  async function handleQuickGenerate() {
    try {
      setSaveStatus('saving');
      setSaveError(null);

      if (!API_BASE_URL) {
        throw new Error('VITE_API_BASE_URL is not configured');
      }

      const res = await fetch(`${API_BASE_URL}/api/predictions/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lottery: 'Euromillions',
          strategy: 'balanced_hot_cold',
          lines: 1,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `API error (${res.status}): ${
            text || 'Failed to generate prediction'
          }`,
        );
      }

      // We *could* read the returned prediction here if we wanted,
      // but for now we just show a success message.
      // const json = await res.json();

      setSaveStatus('success');
    } catch (err: any) {
      console.error('Quick generate failed:', err);
      setSaveError(err?.message ?? 'Failed to generate prediction');
      setSaveStatus('error');
    }
  }

  return (
    <div className="dl-page dl-analysis-page">
      {/* HEADER */}
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
            <div className="dl-config-item">
              <div className="dl-config-label">Lottery type</div>
              <div className="dl-config-value">EuroMillions</div>
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

          {/* NEW: Quick generate action */}
          <div
            style={{
              marginTop: '1rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid rgba(148, 163, 184, 0.25)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <p
              style={{
                fontSize: '0.8rem',
                color: 'var(--dl-text-subtle, #6b7280)',
                margin: 0,
              }}
            >
              Generate a quick line based on a balanced strategy and save it to
              your <strong>My Predictions</strong> page.
            </p>

            <div style={{ textAlign: 'right' }}>
              <button
                type="button"
                onClick={handleQuickGenerate}
                disabled={saveStatus === 'saving'}
                style={{
                  borderRadius: 999,
                  border: 'none',
                  padding: '0.45rem 1.1rem',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: saveStatus === 'saving' ? 'default' : 'pointer',
                  background:
                    'linear-gradient(135deg, #804198 0%, #21409a 100%)',
                  color: '#ffffff',
                  opacity: saveStatus === 'saving' ? 0.7 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {saveStatus === 'saving'
                  ? 'Generating…'
                  : 'Generate quick prediction'}
              </button>
              {saveStatus === 'success' && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: '0.75rem',
                    color: '#16a34a',
                  }}
                >
                  Done! Check the My Predictions page.
                </div>
              )}
              {saveStatus === 'error' && saveError && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: '0.75rem',
                    color: '#b91c1c',
                    maxWidth: 260,
                  }}
                >
                  {saveError}
                </div>
              )}
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

        {/* Overdue summary */}
        <div className="dl-analysis-card">
          <h2>Overdue Numbers</h2>
          {gapsLoading && <p>Loading overdue numbers…</p>}
          {gapsError && <p style={{ color: 'red' }}>Error: {gapsError}</p>}

          <div className="dl-overdue-grid">
            <div className="dl-overdue-col">
              <h3 className="dl-overdue-subtitle">Main numbers</h3>
              {gapsData && (
                <p className="dl-gaps-summary-meta dl-overdue-meta">
                  Based on full EuroMillions history (
                  {gapsData.totalDrawsConsidered} draws).
                </p>
              )}

              {!gapsLoading && !gapsError && (
                <ul className="dl-gap-list">
                  {overdueMain.map((item) => (
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

            <div className="dl-overdue-col">
              <h3 className="dl-overdue-subtitle">Stars</h3>
              {gapsData && (
                <p className="dl-gaps-summary-meta dl-overdue-meta">
                  Based on full EuroMillions history (
                  {gapsData.totalDrawsConsidered} draws).
                </p>
              )}

              {!gapsLoading && !gapsError && (
                <ul className="dl-gap-list">
                  {overdueStars.map((item) => (
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
          </div>
        </div>
      </section>

      {/* FREQUENCY CHARTS */}
      <section className="dl-analysis-charts">
        {/* MAIN */}
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

      <ScrollToTopButton />
    </div>
  );
}
