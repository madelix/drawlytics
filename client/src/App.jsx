  return (
    <main className="dl-page">
      {/* HERO */}
      <header className="dl-hero">
        <img
          src="/Drawlytics.svg"
          alt="Drawlytics"
          className="dl-logo-img"
        />
        <div className="dl-logo-tagline">
          Data-driven clarity for every draw
        </div>

        <h1 className="dl-hero-title">
          Where lottery data meets meaningful insight
        </h1>

        <p className="dl-hero-subtitle">
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
      </header>

      {/* KEY POINTS */}
      <section className="dl-section dl-points">
        <ul>
          <li>Multi-lottery support: EuroMillions, UK Lotto, Set For Life.</li>
          <li>Number frequency &amp; gap analysis.</li>
          <li>Model playground &amp; performance tracking.</li>
          <li>“My predictions” (coming in beta).</li>
        </ul>
      </section>

      {/* LIVE PREVIEW */}
      <section className="dl-section dl-api">
        <div className="dl-api-header">
          <h2>Preview from the live API</h2>
          <div className="dl-api-status">
            <span className="dl-status-dot" />
            Online
          </div>
        </div>

        <div className="dl-api-card">
          <h3>EuroMillions: top numbers (sample)</h3>
          <div className="dl-api-columns">
            <div>
              <div className="dl-api-label">Main numbers</div>
              <ul>
                {topStars.main.slice(0, 5).map((n) => (
                  <li key={`m-${n.number}`}>
                    #{n.number} → {n.count}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="dl-api-label">Stars</div>
              <ul>
                {topStars.stars.slice(0, 3).map((n) => (
                  <li key={`s-${n.number}`}>
                    ★{n.number} → {n.count}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="dl-api-footnote">
            Beta users will get full history per lottery, more models, and saved
            predictions — this is just a small live preview.
          </p>
        </div>
      </section>

      <footer className="dl-footnote">
        Drawlytics does not sell tickets or guarantee winnings. Analytics only
        — for informed, responsible play.
      </footer>
    </main>
  );
}
