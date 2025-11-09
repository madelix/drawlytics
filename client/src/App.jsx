import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [health, setHealth] = useState(null);
  const [freq, setFreq] = useState(null);

  useEffect(() => {
    const base = API_BASE;

    fetch(`${base}/api/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch((err) => {
        console.error('Health check failed', err);
        setHealth(null);
      });

    fetch(`${base}/api/frequency`)
      .then((r) => r.json())
      .then(setFreq)
      .catch((err) => {
        console.error('Frequency fetch failed', err);
        setFreq(null);
      });
  }, []);

  const topMain =
    freq?.main
      ?.slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 5) || [];

  const topStars =
    freq?.stars
      ?.slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 3) || [];

  return (
    <div className="dl-page">
      {/* HEADER / LOGO */}
      <header className="dl-header">
        <div className="dl-logo-wrap">
          {/* Logo mark from /public */}
          <img
            src="/Drawlytics.svg"
            alt="Drawlytics logo"
            className="dl-logo-mark"
          />
          <div className="dl-logo-text">
            <div className="dl-logo-wordmark">Drawlytics</div>
            <div className="dl-logo-tagline">
              Data-driven clarity for every draw
            </div>
          </div>
        </div>
      </header>

      <main className="dl-main">
        {/* HERO COPY */}
        <section className="dl-hero">
          <h1 className="dl-hero-title">
            Where lottery data
            <br />
            meets meaningful insight
          </h1>

          <p className="dl-hero-body">
            Drawlytics transforms official EuroMillions, UK Lotto and Set For
            Life results into measurable insight — analysing draw history,
            numerical behaviour and model performance. Designed for players who
            value understanding over luck.
          </p>

          <a
            href="https://tally.so/r/OD1k5g"
            target="_blank"
            rel="noreferrer"
            className="dl-cta"
          >
            Join the Beta
          </a>

          <ul className="dl-bullets">
            <li>
              Multi-lottery support: EuroMillions, UK Lotto, Set For Life.
            </li>
            <li>Number frequency &amp; gap analysis.</li>
            <li>Model playground &amp; performance tracking.</li>
            <li>“My predictions” (coming in beta).</li>
          </ul>
        </section>

        {/* LIVE PREVIEW CARD */}
        <section className="dl-preview">
          <div className="dl-preview-header">
            <span className="dl-preview-label">Preview from the live API</span>
            <span className="dl-status-dot" />
            <span className="dl-status-text">
              {health ? 'Online' : 'Checking…'}
            </span>
          </div>

          <div className="dl-preview-body">
            <h2 className="dl-preview-title">
              EuroMillions: top numbers (sample)
            </h2>

            {!freq ? (
              <p className="dl-preview-loading">Loading sample data…</p>
            ) : (
              <div className="dl-preview-grid">
                <div>
                  <div className="dl-preview-subtitle">Main numbers</div>
                  {topMain.map((n) => (
                    <div key={n.number} className="dl-preview-row">
                      <span>#{n.number}</span>
                      <span>→ {n.count}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="dl-preview-subtitle">Stars</div>
                  {topStars.map((s) => (
                    <div key={s.number} className="dl-preview-row">
                      <span>★ {s.number}</span>
                      <span>→ {s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="dl-preview-footnote">
              Beta users will get full history per lottery, more models, and
              saved predictions — this is just a small live preview.
            </p>
          </div>
        </section>
      </main>

      <footer className="dl-footnote">
        Drawlytics does not sell tickets or guarantee winnings. Analytics only —{' '}
        for informed, responsible play.
      </footer>
    </div>
  );
}
