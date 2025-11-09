import { useEffect, useState } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [health, setHealth] = useState(null);
  const [freq, setFreq] = useState(null);

  useEffect(() => {
    // Health
    fetch(`${API_BASE}/api/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false }));

    // Frequency (EuroMillions sample)
    fetch(`${API_BASE}/api/frequency`)
      .then((r) => r.json())
      .then(setFreq)
      .catch(() => setFreq(null));
  }, []);

  const topMain = freq?.main
    ? [...freq.main].sort((a, b) => b.count - a.count).slice(0, 5)
    : null;

  const topStars = freq?.stars
    ? [...freq.stars].sort((a, b) => b.count - a.count).slice(0, 5)
    : null;

  return (
    <div className="page">
      {/* Top bar */}
      <header className="hero">
        <div className="brand">
          <div className="brand-icon">
            <span className="brand-node" />
            <span className="brand-node" />
            <span className="brand-node" />
          </div>
          <div className="brand-text">
            <div className="brand-name">Drawlytics</div>
            <div className="brand-tagline">
              Data-driven insight for every draw
            </div>
          </div>
        </div>

        <a
          className="beta-pill beta-pill--desktop"
          href="https://forms.gle/YOUR_REAL_FORM_ID"
          target="_blank"
          rel="noreferrer"
        >
          Join the Beta
        </a>
      </header>

      {/* Main content */}
      <main className="content">
        <section className="hero-copy">
          <h1>Where lottery data meets meaningful insight</h1>
          <p>
            Drawlytics transforms official EuroMillions, UK Lotto and Set For
            Life results into measurable insights – analysing draw history,
            numerical behaviour, and model performance. Designed for those who
            value understanding over luck.
          </p>

          <a
            className="beta-pill beta-pill--primary"
            href="https://forms.gle/YOUR_REAL_FORM_ID"
            target="_blank"
            rel="noreferrer"
          >
            Join the Beta
          </a>

          <ul className="feature-list">
            <li>Multi-lottery support.</li>
            <li>Number frequency &amp; gap analysis.</li>
            <li>Model playground &amp; performance tracking.</li>
            <li>“My predictions” (coming in beta).</li>
          </ul>
        </section>

        <aside className="preview-card">
          <div className="preview-header">
            <span>Preview from the live API</span>
            <span
              className={`status-dot ${
                health?.ok ? 'status-dot--online' : 'status-dot--offline'
              }`}
            />
            <span className="status-label">
              {health?.ok ? 'Online' : 'Checking'}
            </span>
          </div>

          <div className="preview-body">
            <div className="preview-title">
              EuroMillions: top numbers (sample)
            </div>

            {!topMain ? (
              <div className="preview-loading">Loading…</div>
            ) : (
              <div className="preview-grid">
                <div>
                  {topMain.map((n) => (
                    <div key={`m-${n.number}`} className="preview-row">
                      <span className="num-label">#{n.number}</span>
                      <span className="num-arrow">➜</span>
                      <span className="num-count">{n.count}</span>
                    </div>
                  ))}
                </div>
                {topStars && (
                  <div>
                    {topStars.map((n) => (
                      <div key={`s-${n.number}`} className="preview-row">
                        <span className="num-label num-label--star">
                          ★{n.number}
                        </span>
                        <span className="num-arrow">➜</span>
                        <span className="num-count">{n.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="preview-note">
              Beta users will get full history per lottery, more models, and
              saved predictions — this is just a small live preview.
            </p>
          </div>
        </aside>
      </main>

      <footer className="legal">
        Drawlytics does not sell tickets or guarantee winnings. Analytics only —
        for informed, responsible play.
      </footer>
    </div>
  );
}
