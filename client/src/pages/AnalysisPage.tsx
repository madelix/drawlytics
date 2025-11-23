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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

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

  // Fetch frequency + hot/cold when range changes
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
          setFreqError(err?.message ?? 'Failed to load frequency data');
          setHotColdError(err?.message ?? 'Failed to load hot/cold data');
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

  // Fetch gaps once (full history)
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

  const mainFreq: NumberCount[] = freqData?.main ?? [];
  const starFreq: NumberCount[] = freqData?.stars ?? [];

  const overdueMain = gapsData?.main.slice(0, 5) ?? [];
  const overdueStars = gapsData?.stars.slice(0, 3) ?? [];

  return (
    <div className="dl-page">
      {/* PAGE TITLE */}
      <header className="dl-analysis-header">
        <h1 className="dl-hero-title">Number Analysis</h1>
        <p className="dl-hero-copy">
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

      {/* HOT / COLD SUMMARY + OVERDUE */}
      <section className="dl-analysis-grid">
        {/* Hot/Cold Main */}
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

        {/* OVERDUE / GAPS */}
        <div className="dl-analysis-card">
          <h2>Overdue Numbers</h2>
          {gapsLoading && <p>Calculating overdue numbers…</p>}
          {gapsError && <p style={{ color: 'red' }}>Error: {gapsError}</p>}
          {!gapsLoading && gapsData && (
            <>
              <p className="dl-config-hint">
                Based on full EuroMillions history (
                {gapsData.totalDrawsConsidered} draws).
              </p>

              <div style={{ marginTop: '0.75rem' }}>
                <h3 className="dl-overdue-subtitle">Main numbers</h3>
                <ul className="dl-gap-list">
                  {overdueMain.map((item) => (
                    <li key={item.number}>
                      <strong>{item.number}</strong> – {item.gap} draws since
                      last seen{' '}
                      {item.lastSeen ? `(${item.lastSeen})` : '(never seen)'}
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                <h3 className="dl-overdue-subtitle">Stars</h3>
                <ul className="dl-gap-list">
                  {overdueStars.map((item) => (
                    <li key={item.number}>
                      <strong>{item.number}</strong> – {item.gap} draws since
                      last seen{' '}
                      {item.lastSeen ? `(${item.lastSeen})` : '(never seen)'}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </section>

      {/* FREQUENCY CHARTS */}
      <section className="dl-analysis-charts">
        <div className="dl-analysis-card">
          <h2>Main Number Frequency</h2>
          {freqLoading && <p>Loading frequency…</p>}
          {freqError && <p style={{ color: 'red' }}>Error: {freqError}</p>}
          {!freqLoading && !freqError && mainFreq.length > 0 && (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={mainFreq}>
                  <XAxis dataKey="number" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="dl-analysis-card">
          <h2>Star Number Frequency</h2>
          {freqLoading && <p>Loading frequency…</p>}
          {freqError && <p style={{ color: 'red' }}>Error: {freqError}</p>}
          {!freqLoading && !freqError && starFreq.length > 0 && (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={starFreq}>
                  <XAxis dataKey="number" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
