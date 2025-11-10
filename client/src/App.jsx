import './App.css';
import logo from '/Drawlytics.png'; // or "./assets/Drawlytics.png" if that's where it lives

export default function App() {
  const topMains = [
    { n: 23, c: 215 },
    { n: 42, c: 213 },
    { n: 44, c: 212 },
    { n: 19, c: 211 },
    { n: 21, c: 209 },
  ];

  const topStars = [
    { n: 3, c: 376 },
    { n: 2, c: 374 },
    { n: 8, c: 362 },
  ];

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
          EuroMillions: top numbers (sample)
        </div>

        <table className="dl-preview-table">
          <thead>
            <tr>
              <th>Main numbers</th>
              <th>Stars</th>
            </tr>
          </thead>
          <tbody>
            {topMains.map((m, i) => (
              <tr key={m.n}>
                <td>
                  #{m.n} → {m.c}
                </td>
                <td>
                  {topStars[i] ? `★ ${topStars[i].n} → ${topStars[i].c}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="dl-preview-note">
          Beta users will get full history per lottery, more models, and saved
          predictions — this is just a small live preview.
        </p>
      </section>

      {/* FOOTNOTE */}
      <footer className="dl-footnote">
        Drawlytics does not sell tickets or guarantee winnings. Analytics only —
        for informed, responsible play.
      </footer>
    </div>
  );
}
