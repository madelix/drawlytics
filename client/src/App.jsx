import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [freq, setFreq] = useState(null);
  const [status, setStatus] = useState('…checking');

  useEffect(() => {
    const base = API;

    fetch(`${base}/api/health`)
      .then((r) => r.json())
      .then((d) => setStatus(d.ok ? 'Online' : 'Issue'))
      .catch(() => setStatus('Offline'));

    fetch(`${base}/api/frequency`)
      .then((r) => r.json())
      .then(setFreq)
      .catch(() => setFreq(null));
  }, []);

  const topMain = freq?.main
    ? [...freq.main].sort((a, b) => b.count - a.count).slice(0, 5)
    : null;

  const topStars = freq?.stars
    ? [...freq.stars].sort((a, b) => b.count - a.count).slice(0, 3)
    : null;

  return (
    <div className="dl-page">
      {/* HEADER */}
      <header className="dl-header">
        <div className="dl-logo">
          {/* update path/name if your exported file differs */}
          <img
            src="/Drawlytics.svg"
            alt="Drawlytics"
            className="dl-logo-mark"
          />
          <div className="dl-logo-text">
            <div className="dl-logo-title">Drawlytics</div>
            <div className="dl-logo-tagline">
              Data-driven clarity for every draw
            </div>
          </div>
        </div>
      </header>

      <main className="dl-main">
        {/* HERO */}
        <section className="dl-hero">
          <h1 className="dl-title">
            Where lottery data meets meaningful insight
          </h1>
          <p className="dl-subtitle">
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
        </section>

        {/* BULLETS */}
        <ul className="dl-bullets">
          <li>Multi-lottery support: EuroMillions, UK Lotto, Set For Life.</li>
          <li>Number frequency &amp; gap analysis.</li>
          <li>Model playground &amp; performance tracking.</li>
          <li>“My predictions” (coming in beta).</li>
        </ul>

        {/* LIVE PREVIEW */}
        <section className="dl-preview">
          <div className="dl-preview-header">
            <span className="dl-preview-label">Preview from the live API</span>
            <span
              className={
                'dl-status' + (status === 'Online' ? ' dl-status-ok' : '')
              }
            >
              {status}
            </span>
          </div>

          <h2 className="dl-preview-title">
            EuroMillions: top numbers (sample)
          </h2>

          {topMain ? (
            <div className="dl-preview-grid">
              <div>
                <div className="dl-preview-col-label">Main numbers</div>
                {topMain.map((n) => (
                  <div key={n.number} className="dl-preview-row">
                    #{n.number} → {n.count}
                  </div>
                ))}
              </div>
              {topStars && (
                <div>
                  <div className="dl-preview-col-label">Stars</div>
                  {topStars.map((s) => (
                    <div key={s.number} className="dl-preview-row">
                      ★ {s.number} → {s.count}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="dl-preview-loading">Loading sample data…</p>
          )}

          <p className="dl-preview-footnote">
            Beta users will get full history per lottery, more models, and saved
            predictions — this is just a small live preview.
          </p>
        </section>

        {/* FOOTNOTE */}
        <footer className="dl-footnote">
          Drawlytics does not sell tickets or guarantee winnings. Analytics only
          — for informed, responsible play.
        </footer>
      </main>
    </div>
  );
}
