// client/src/App.tsx
import './App.css';

import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect, useState } from 'react';

import useEuromillionsFrequency from './hooks/useEuromillionsFrequency';

import MyPredictionsPage from './pages/MyPredictionsPage';
import { MakeMagicPage } from './pages/MakeMagicPage';
import ModelPerformancePage from './pages/ModelPerformancePage';

// --- Lazy-loaded pages ---
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
    <header className="dl-main-header">
      <div className="dl-header-inner">
        {/* Brand / logo */}
        <NavLink to="/" className="dl-logo-link">
          <img src={logo} alt="Drawlytics" className="dl-header-logo" />
        </NavLink>

        {/* Desktop nav */}
        <nav className="dl-nav-desktop">
          <NavLink
            to="/analysis"
            className={({ isActive }) =>
              `dl-nav-link ${isActive ? 'dl-nav-link--active' : ''}`
            }
          >
            Analysis
          </NavLink>

          <NavLink
            to="/gaps"
            className={({ isActive }) =>
              `dl-nav-link ${isActive ? 'dl-nav-link--active' : ''}`
            }
          >
            Gaps
          </NavLink>

          <NavLink
            to="/draws"
            className={({ isActive }) =>
              `dl-nav-link ${isActive ? 'dl-nav-link--active' : ''}`
            }
          >
            All draws
          </NavLink>

          <NavLink
            to="/make-magic"
            className={({ isActive }) =>
              `dl-nav-link ${isActive ? 'dl-nav-link--active' : ''}`
            }
          >
            Strategy
          </NavLink>

          <NavLink
            to="/performance"
            className={({ isActive }) =>
              `dl-nav-link ${isActive ? 'dl-nav-link--active' : ''}`
            }
          >
            Performance
          </NavLink>

          <NavLink
            to="/predictions"
            className={({ isActive }) =>
              `dl-nav-link ${isActive ? 'dl-nav-link--active' : ''}`
            }
          >
            My predictions
          </NavLink>
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="dl-nav-toggle"
          aria-label="Toggle navigation"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="dl-nav-toggle-bars" />
        </button>
      </div>

      {open && (
        <nav className="dl-nav-mobile">
          <NavLink
            to="/analysis"
            className={({ isActive }) =>
              `dl-nav-link dl-nav-link--mobile ${
                isActive ? 'dl-nav-link--active' : ''
              }`
            }
          >
            Analysis
          </NavLink>

          <NavLink
            to="/gaps"
            className={({ isActive }) =>
              `dl-nav-link dl-nav-link--mobile ${
                isActive ? 'dl-nav-link--active' : ''
              }`
            }
          >
            Gaps
          </NavLink>

          <NavLink
            to="/draws"
            className={({ isActive }) =>
              `dl-nav-link dl-nav-link--mobile ${
                isActive ? 'dl-nav-link--active' : ''
              }`
            }
          >
            All draws
          </NavLink>

          <NavLink
            to="/make-magic"
            className={({ isActive }) =>
              `dl-nav-link dl-nav-link--mobile ${
                isActive ? 'dl-nav-link--active' : ''
              }`
            }
          >
            Strategy
          </NavLink>

          <NavLink
            to="/performance"
            className={({ isActive }) =>
              `dl-nav-link dl-nav-link--mobile ${
                isActive ? 'dl-nav-link--active' : ''
              }`
            }
          >
            Performance
          </NavLink>

          <NavLink
            to="/predictions"
            className={({ isActive }) =>
              `dl-nav-link dl-nav-link--mobile ${
                isActive ? 'dl-nav-link--active' : ''
              }`
            }
          >
            My predictions
          </NavLink>

          <span
            style={{
              marginTop: '4px',
              fontSize: '0.75rem',
              color: 'var(--dl-text-subtle)',
            }}
          >
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
          <Route path="/make-magic" element={<MakeMagicPage />} />
          <Route path="/performance" element={<ModelPerformancePage />} />
          <Route path="/predictions" element={<MyPredictionsPage />} />
        </Routes>
      </Suspense>
    </>
  );
}

/* ──────────────────────────────────────────────
   LANDING PAGE
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
    { number: 11, count: 360 },
    { number: 9, count: 355 },
    { number: 7, count: 350 },
  ];

  const mainsPreview = data?.main?.slice(0, 5) ?? fallbackMains;
  const starsPreview = data?.stars?.slice(0, 5) ?? fallbackStars;

  return (
    <div className="dl-page dl-page--landing">
      {/* Logo + tagline */}
      <header className="dl-landing-header">
        <img src={logo} alt="Drawlytics" className="dl-logo" />
        <p className="dl-landing-tagline">Data-driven clarity for every draw</p>
      </header>

      <h1 className="dl-hero-title">
        Where lottery data meets meaningful insight
      </h1>

      <p className="dl-hero-copy">
        Drawlytics transforms official EuroMillions, UK Lotto and Set For Life
        results into measurable insight — analysing draw history, numerical
        behaviour and model performance. Designed for players who value
        understanding over luck.
      </p>

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

      <ul className="dl-feature-list">
        <li>Multi-lottery support: EuroMillions, UK Lotto, Set For Life.</li>
        <li>Number frequency &amp; gap analysis.</li>
        <li>Model playground &amp; performance tracking.</li>
        <li>&ldquo;My predictions&rdquo; (coming in beta).</li>
      </ul>

      <section className="dl-preview-card">
        <div className="dl-preview-header">
          <span className="dl-preview-title">Preview from the live API</span>
          {!error && (
            <span className="dl-preview-status">
              <span className="dl-status-dot" /> Online
            </span>
          )}
          {error && (
            <span className="dl-preview-status dl-preview-status--error">
              <span className="dl-status-dot dl-status-dot--error" /> Offline
            </span>
          )}
        </div>

        <p className="dl-preview-note">
          EuroMillions: top numbers (live sample)
        </p>

        <table className="dl-preview-table">
          <thead>
            <tr>
              <th>Main numbers</th>
              <th>Stars</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, idx) => {
              const main = mainsPreview[idx];
              const star = starsPreview[idx];

              return (
                <tr key={idx}>
                  <td>
                    #{main.number} → {main.count}
                  </td>
                  <td>
                    ★ {star.number} → {star.count}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="dl-preview-note">
          Beta users will get full history per lottery, more models, and saved
          predictions — this is just a small live preview.
        </p>
      </section>

      <footer className="dl-footnote">
        Drawlytics does not sell tickets or guarantee winnings. Analytics only —
        for informed, responsible play.
      </footer>
    </div>
  );
}
