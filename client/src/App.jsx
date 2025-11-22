import './App.css';
import logo from '/Drawlytics.png';
import FrequencyDebug from './components/FrequencyDebug';
import useEuromillionsFrequency from './hooks/useEuromillionsFrequency';

export default function App() {
  // Live data from your Railway API
  const { data, loading, error } = useEuromillionsFrequency();

  // Fallback sample data (same shape as API: { number, count })
  const fallbackMains = [
    { number: 23, count: 215 },
    { number: 42, count: 213 },
    { number: 44, count: 212 },
    { number: 19, count: 211 },
    { number: 21, count: 209 },
  ];

  const fallbackStars = [
    { number: 3, count: 376 },
    { number: 2, count: 374 },
    { number: 8, count: 362 },
  ];

  // Use live data if available, otherwise fall back
  const mains = data?.main?.slice(0, 5) ?? fallbackMains;
  const stars = data?.stars?.slice(0, 3) ?? fallbackStars;

  return (
    <div className="dl-page">
      {/* LOGO */}
      <header className="dl-logo-wrap">
        <img src={logo} alt="Drawlytics" className="dl-logo" />
        <div className="dl-tagline">Data-driven clarity for every draw</div>
      </header>

      {/* HERO */}
      <h1 className="dl-hero-title">
        Where lottery data meets meaningful insight
      </h1>

      <p className="dl-hero-copy">
        Drawlytics transforms official EuroMillions, UK Lotto and Set For Life
        results into measurable insight — analysing draw history, numerical
        behaviour and model performance. Designed for players who value
        understanding over luck.
      </p>

      {/* CTA */}
      <div className="dl-cta-wrap">
        <a
          href="https://tally.so/r/OD1k5g"
          target="_blank"
          rel="noreferrer"
          className="dl-cta-btn"
        >
          Join the Beta
        </a>
      </div>

      {/* FEATURES */}
      <ul className="dl-feature-list">
        <li>Multi-lottery support: EuroMillions, UK Lotto, Set For Life.</li>
        <li>Number frequency &amp; gap analysis.</li>
        <li>Model playground &amp; performance tracking.</li>
        <li>&ldquo;My predictions&rdquo; (coming in beta).</li>
      </ul>

      {/* LIVE PREVIEW */}
      <section className="dl-preview-card">
        <div className="dl-preview-header">
          <span>Preview from the live API</span>
          <span className="dl-status-dot" />
          <span>Online</span>
        </div>

        <div className="dl-preview-title">
          EuroMillions: top numbers (live sample)
        </div>

        <table className="dl-preview-table">
          <thead>
            <tr>
              <th>Main numbers</th>
              <th>Stars</th>
            </tr>
          </thead>
          <tbody>
            {mains.map((m, i) => (
              <tr key={m.number}>
                <td>
                  #{m.number} → {m.count}
                </td>
                <td>
                  {stars[i] ? `★ ${stars[i].number} → ${stars[i].count}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Status messages for the preview */}
        {loading && <p className="dl-preview-note">Loading live data…</p>}
        {error && (
          <p className="dl-preview-note" style={{ color: 'red' }}>
            Live data unavailable, showing sample numbers.
          </p>
        )}

        {!loading && !error && (
          <p className="dl-preview-note">
            Beta users will get full history per lottery, more models, and saved
            predictions — this is just a small live preview.
          </p>
        )}
      </section>

      {/* Small API status line */}
      <FrequencyDebug />

      {/* FOOTNOTE */}
      <footer className="dl-footnote">
        Drawlytics does not sell tickets or guarantee winnings. Analytics only —
        for informed, responsible play.
      </footer>
    </div>
  );
}
