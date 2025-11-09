import { useEffect, useState } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [freq, setFreq] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    const base = API_BASE; // "" in dev (Vite proxy), full URL in prod

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

  // simple helper: top N main numbers
  const topMain = freq?.main
    ? [...freq.main].sort((a, b) => b.count - a.count).slice(0, 5)
    : [];

  const topStars = freq?.stars
    ? [...freq.stars].sort((a, b) => b.count - a.count).slice(0, 3)
    : [];

  return (
    <div className="dl-page">
      {/* HEADER */}
      <header className="dl-header">
        <div className="dl-logo-wrap">
          <img
            src="/Drawlytics.svg"
            alt="Drawlytics logo"
            className="dl-logo-img"
          />
          <div classNName="dl-logo-text">
            <div className="dl-logo-name">Drawlytics</div>
            <div className="dl-logo-tagline">
              Data-driven insight for every draw
            </div>
          </div>
        </div>

        <a
          href="https://forms.gle/YOUR_REAL_FORM_ID"
          target="_blank"
          rel="noreferrer"
          className="dl-cta"
        >
          Join the beta
        </a>
      </header>

      {/* MAIN CONTENT */}
      <main className="dl-main">
        <section className="dl-hero">
          <h1 className="dl-hero-title">
            Where lottery data
            <br />
            meets meaningful insight
          </h1>

          <p className="dl-hero-body">
            Drawlytics transforms official EuroMillions, UK Lotto and Set For
            Life results into measurable insight&nbsp;— analysing draw history,
            numerical behaviour and model performance. Designed for players who
            value understanding over luck.
          </p>

          <a
            href="https://forms.gle/YOUR_REAL_FORM_ID"
            target="_blank"
            rel="noreferrer"
            className="dl-cta dl-cta-large"
          >
            Join the beta
          </a>

          <ul className="dl-bullets">
            <li>
              Multi-lottery support: EuroMillions, UK Lotto, Set For Life.
            </li>
            <li>Number frequency and gap analysis.</li>
            <li>Model playground &amp; performance tracking.</li>
            <li>“My predictions” (coming in beta).</li>
          </ul>
        </section>

        {/* LIVE PREVIEW */}
        <section className="dl-preview">
          <div className="dl-preview-header">
            <span className="dl-preview-label">Preview from the live API</span>
            <span className="dl-status-dot" />{' '}
            <span className="dl-status-text">
              {health?.ok ? 'Online' : 'Checking…'}
            </span>
          </div>

          <div className="dl-preview-content">
            <div className="dl-preview-title">
              EuroMillions: top numbers (sample)
            </div>

            {!freq && <div className="dl-preview-loading">Loading…</div>}

            {freq && (
              <div className="dl-preview-grid">
                <div>
                  <div className="dl-preview-sub">Main numbers</div>
                  {topMain.map((n) => (
                    <div key={n.number} className="dl-preview-row">
                      <span className="dl-num">#{n.number}</span>
                      <span className="dl-arrow">→</span>
                      <span>{n.count}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="dl-preview-sub">Stars</div>
                  {topStars.map((n) => (
                    <div key={n.number} className="dl-preview-row">
                      <span className="dl-num">★{n.number}</span>
                      <span className="dl-arrow">→</span>
                      <span>{n.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="dl-preview-note">
              Beta users will get full history per lottery, more models, and
              saved predictions — this is just a small live preview.
            </p>
          </div>
        </section>
      </main>

      {/* FOOTER DISCLAIMER */}
      <footer className="dl-footer">
        Drawlytics does not sell tickets or guarantee winnings. Analytics only —
        for informed, responsible play.
      </footer>
    </div>
  );
}
