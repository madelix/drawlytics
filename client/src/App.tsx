// client/src/App.tsx
import './App.css';

import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect, useState } from 'react';

import FrequencyDebug from './components/FrequencyDebug';
import useEuromillionsFrequency from './hooks/useEuromillionsFrequency';

// --- Lazy-loaded pages (helps with bundle size) ---
const AnalysisPage = lazy(() =>
  import('./pages/AnalysisPage').then((m) => ({ default: m.AnalysisPage })),
);
const GapsPage = lazy(() =>
  import('./pages/GapsPage').then((m) => ({ default: m.GapsPage })),
);
const AllDrawsPage = lazy(() =>
  import('./pages/AllDrawsPage').then((m) => ({ default: m.AllDrawsPage })),
);

// Logo lives in /public
const logo = '/Drawlytics.png';

/* ──────────────────────────────────────────────
   Types for landing page live preview
   ────────────────────────────────────────────── */

type NumberCount = {
  number: number;
  count: number;
};

type FrequencyData = {
  main: NumberCount[];
  stars: NumberCount[];
};

type FrequencyHookResult = {
  data: FrequencyData | null;
  loading: boolean;
  error: boolean | null;
};

/* ──────────────────────────────────────────────
   Global header (inner pages only)
   ────────────────────────────────────────────── */

function AppHeader() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close mobile menu whenever route changes
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Hide header on landing page
  if (location.pathname === '/') return null;

  return (
    <header className="dl-header">
      <div className="dl-header-inner">
        <NavLink to="/" className="dl-header-brand">
          <img src={logo} alt="Drawlytics" className="dl-header-logo" />
          <span className="dl-header-wordmark">Drawlytics</span>
        </NavLink>

        {/* Desktop nav */}
        <nav className="dl-header-nav">
          <NavLink
            to="/analysis"
            className={({ isActive }) =>
              `dl-header-link ${isActive ? 'dl-header-link--active' : ''}`
            }
          >
            Analysis
          </NavLink>
          <NavLink
            to="/gaps"
            className={({ isActive }) =>
              `dl-header-link ${isActive ? 'dl-header-link--active' : ''}`
            }
          >
            Gaps
          </NavLink>
          <NavLink
            to="/draws"
            className={({ isActive }) =>
              `dl-header-link ${isActive ? 'dl-header-link--active' : ''}`
            }
          >
            All draws
          </NavLink>
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="dl-header-toggle"
          aria-label="Toggle navigation"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="dl-header-burger" />
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {open && (
        <nav className="dl-header-mobile-menu">
          <NavLink
            to="/analysis"
            className={({ isActive }) =>
              `dl-header-mobile-link ${
                isActive ? 'dl-header-mobile-link--active' : ''
              }`
            }
          >
            Analysis
          </NavLink>
          <NavLink
            to="/gaps"
            className={({ isActive }) =>
              `dl-header-mobile-link ${
                isActive ? 'dl-header-mobile-link--active' : ''
              }`
            }
          >
            Gaps
          </NavLink>
          <NavLink
            to="/draws"
            className={({ isActive }) =>
              `dl-header-mobile-link ${
                isActive ? 'dl-header-mobile-link--active' : ''
              }`
            }
          >
            All draws
          </NavLink>
          <span className="dl-header-mobile-link dl-header-mobile-link--muted">
            Drawlytics does not sell tickets. Analytics only.
          </span>
        </nav>
      )}
    </header>
  );
}

/* ──────────────────────────────────────────────
   ROOT APP
   ────────────────────────────────────────────── */

export default function App() {
  return (
    <>
      <AppHeader />

      <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/gaps" element={<GapsPage />} />
          <Route path="/draws" element={<AllDrawsPage />} />
        </Routes>
      </Suspense>
    </>
  );
}

/* ──────────────────────────────────────────────
   LANDING PAGE (unchanged visually)
   ────────────────────────────────────────────── */

function LandingPage() {
  const { data, loading, error } =
    useEuromillionsFrequency() as FrequencyHookResult;

  // Fallback sample data for preview card
  const fallbackMains: NumberCount[] = [
    { number: 23, count: 215 },
    { number: 42, count: 213 },
    { number: 44, count: 212 },
    { number: 19, count: 212 },
    { number: 21, count: 210 },
  ];

  const fallbackStars: NumberCount[] = [
    { number: 3, count: 377 },
    { number: 2, count: 375 },
    { number: 8, count: 363 },
  ];

  const mains: NumberCount[] = data?.main?.slice(0, 5) ?? fallbackMains;
  const stars: NumberCount[] = data?.stars?.slice(0, 3) ?? fallbackStars;

  return (
    <div className="dl-page dl-page--landing">
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

      {/* CTA BUTTON */}
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

      {/* LIVE PREVIEW CARD */}
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

      {/* SMALL API STATUS LINE */}
      <FrequencyDebug />

      {/* FOOTNOTE */}
      <footer className="dl-footnote">
        Drawlytics does not sell tickets or guarantee winnings. Analytics only —
        for informed, responsible play.
      </footer>
    </div>
  );
}
