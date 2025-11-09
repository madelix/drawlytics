// client/src/App.jsx
import { useEffect, useState } from 'react';
import './App.css';

const API =
  import.meta.env.VITE_API_URL ??
  (window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://drawlytics-production.up.railway.app');

export default function App() {
  const [freq, setFreq] = useState(null);
  const [statusOk, setStatusOk] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/frequency`)
      .then((r) => {
        if (!r.ok) throw new Error('bad status');
        return r.json();
      })
      .then((data) => {
        setFreq(data);
        setStatusOk(true);
      })
      .catch(() => {
        setStatusOk(false);
      });
  }, []);

  const top = freq
    ? {
        main: freq.main.slice(0, 5),
        stars: freq.stars.slice(0, 3),
      }
    : null;

  return (
    <main className="dl-page">
      {/* HEADER / LOGO */}
      <header className="dl-header">
        <div className="dl-logo-wrap">
          <img
            src="/Drawlytics.svg"
            alt="Drawlytics"
            className="dl-logo-mark"
          />
          <div className="dl-logo-tagline">
            Data-driven clarity for every draw
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="dl-main">
        <h1 className="dl-hero-title">
          Where lottery data meets meaningful insight
        </h1>
        <p className="dl-hero-body">
          Drawlytics transforms official EuroMillions, UK Lotto and Set For Life
          results into measurable insight — analysing draw history, numerical
          behaviour and model performance. Designed for players who value
          understanding over luck.
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
          <li>Multi-lottery support: EuroMillions, UK Lotto, Set For Life.</li>
          <li>Number frequency &amp; gap analysis.</li>
          <li>Model playground &amp; performance tracking.</li>
          <li>“My predictions” (coming in beta).</li>
        </ul>
      </section>

      {/* LIVE PREVIEW */}
      <section className="dl-preview">
        <div className="dl-preview-header">
          <span className="dl-preview-label">Preview from the live API</span>
          <span className={`dl-status-dot ${statusOk ? 'ok' : 'bad'}`} />
          <span className="dl-status-text">
            {statusOk ? 'Online' : 'Offline'}
          </span>
        </div>

        {top ? (
          <>
            <div className="dl-preview-title">
              EuroMillions: top numbers (sample)
            </div>
            <div className="dl-preview-grid">
              <div>
                <div className="dl-preview-subtitle">Main numbers</div>
                {top.main.map((n) => (
                  <div key={n.number} className="dl-preview-row">
                    <span>#{n.number}</span>
                    <span>→ {n.count}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="dl-preview-subtitle">Stars</div>
                {top.stars.map((n) => (
                  <div key={n.number} className="dl-preview-row">
                    <span>★ {n.number}</span>
                    <span>→ {n.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="dl-preview-loading">Loading live sample…</p>
        )}

        <p className="dl-preview-footnote">
          Beta users will get full history per lottery, more models, and saved
          predictions — this is just a small live preview.
        </p>
      </section>

      {/* FOOTER DISCLAIMER */}
      <footer className="dl-footnote">
        Drawlytics does not sell tickets or guarantee winnings. Analytics only —
        for informed, responsible play.
      </footer>
    </main>
  );
}
