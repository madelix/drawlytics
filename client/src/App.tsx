// client/src/App.tsx
import './App.css';

import {
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { Show, SignInButton, UserButton, useAuth } from '@clerk/react';
import { Suspense, lazy, useEffect, useLayoutEffect, useState } from 'react';

import MyDashboardPage from './pages/MyDashboardPage';
import MyPredictionsPage from './pages/MyPredictionsPage';
import { MakeMagicPage } from './pages/MakeMagicPage';
import ModelPerformancePage from './pages/ModelPerformancePage';
import HonestyDashboardPage from './pages/HonestyDashboardPage';
import ModelRegistryPage from './pages/ModelRegistryPage';
import ModelProfilePage from './pages/ModelProfilePage';
import { setApiAuthTokenGetter } from './api/apiClient';

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
            Draws
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
            to="/models"
            className={({ isActive }) =>
              `dl-nav-link ${isActive ? 'dl-nav-link--active' : ''}`
            }
          >
            Models
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
            to="/honesty"
            className={({ isActive }) =>
              `dl-nav-link ${isActive ? 'dl-nav-link--active' : ''}`
            }
          >
            Honesty
          </NavLink>

          <Show when="signed-in">
            <NavLink
              to="/predictions"
              className={({ isActive }) =>
                `dl-nav-link ${isActive ? 'dl-nav-link--active' : ''}`
              }
            >
              My predictions
            </NavLink>
          </Show>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Show when="signed-out">
            <SignInButton mode="modal" fallbackRedirectUrl="/dashboard">
              <button
                type="button"
                aria-label="Sign in"
                title="Sign in"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#374151',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                👤
              </button>
            </SignInButton>
          </Show>

          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>

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
            Draws
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
            to="/models"
            className={({ isActive }) =>
              `dl-nav-link dl-nav-link--mobile ${
                isActive ? 'dl-nav-link--active' : ''
              }`
            }
          >
            Models
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
            to="/honesty"
            className={({ isActive }) =>
              `dl-nav-link dl-nav-link--mobile ${
                isActive ? 'dl-nav-link--active' : ''
              }`
            }
          >
            Honesty
          </NavLink>

          <Show when="signed-in">
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
          </Show>

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
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { getToken } = useAuth();

  useLayoutEffect(() => {
    setApiAuthTokenGetter(() => getToken());

    return () => {
      setApiAuthTokenGetter(async () => null);
    };
  }, [getToken]);

  return (
    <>
      <AppHeader />
      <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Show when="signed-in">
                  <Navigate to="/dashboard" replace />
                </Show>
                <Show when="signed-out">
                  <LandingPage />
                </Show>
              </>
            }
          />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/gaps" element={<GapsPage />} />
          <Route path="/draws" element={<AllDrawsPage />} />
          <Route path="/make-magic" element={<MakeMagicPage />} />
          <Route path="/models" element={<ModelRegistryPage />} />
          <Route path="/models/:modelKey" element={<ModelProfilePage />} />
          <Route path="/performance" element={<ModelPerformancePage />} />
          <Route path="/honesty" element={<HonestyDashboardPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <MyDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/predictions"
            element={
              <ProtectedRoute>
                <MyPredictionsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </>
  );
}

/* ──────────────────────────────────────────────
   LANDING PAGE
   ────────────────────────────────────────────── */

function LandingPage() {
  return (
    <div className="dl-page dl-page--landing">
      {/* Logo + tagline */}
      <header className="dl-landing-header">
        <img src={logo} alt="Drawlytics" className="dl-logo" />
        <p className="dl-landing-tagline">Data-driven clarity for every draw</p>
      </header>

      <h1 className="dl-hero-title">How would your numbers have done?</h1>

      <p className="dl-hero-copy">
        Pick your numbers and find their closest match in official EuroMillions,
        UK Lotto or Set For Life draw history. Then see how the strategies you
        follow compare with Pure Random.
      </p>

      <section
        className="dl-preview-card dl-landing-match"
        aria-labelledby="landing-match-heading"
      >
        <p className="dl-preview-note">EuroMillions · Historical example</p>
        <h2 id="landing-match-heading">3 main numbers and 1 Lucky Star</h2>

        {[
          {
            label: 'Example set',
            main: [11, 14, 15, 32, 48],
            stars: [2, 10],
            isDraw: false,
          },
          {
            label: 'Draw on 19 April 2016',
            main: [11, 14, 15, 27, 44],
            stars: [2, 7],
            isDraw: true,
          },
        ].map((row) => (
          <div key={row.label} className="dl-landing-match-row">
            <h3>{row.label}</h3>

            <div
              style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}
            >
              {[
                {
                  label: 'Main numbers',
                  kind: 'main',
                  numbers: row.main,
                  hits: [11, 14, 15],
                },
                {
                  label: 'Lucky Stars',
                  kind: 'star',
                  numbers: row.stars,
                  hits: [2],
                },
              ].map((group) => (
                <div key={group.kind}>
                  <small>{group.label}</small>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    {group.numbers.map((number) => {
                      const matched = row.isDraw && group.hits.includes(number);

                      return (
                        <span
                          key={number}
                          className={`dl-draw-pill dl-draw-pill--${group.kind}`}
                          aria-label={
                            matched ? `${number}, matched` : undefined
                          }
                          style={{
                            margin: 0,
                            ...(matched && {
                              background: '#dcfce7',
                              borderColor: '#22c55e',
                              color: '#14532d',
                              fontWeight: 700,
                            }),
                          }}
                        >
                          {number}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <div
        className="dl-cta-wrap"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem 1.25rem',
        }}
      >
        <a
          href="https://tally.so/r/OD1k5g"
          target="_blank"
          rel="noreferrer"
          className="dl-cta-btn"
        >
          Request beta access
        </a>

        <a
          href="/draws"
          style={{
            color: '#21409a',
            fontWeight: 600,
            textUnderlineOffset: '0.2em',
          }}
        >
          Explore draw history <span aria-hidden="true">→</span>
        </a>
      </div>

      <section
        className="dl-preview-card dl-landing-performance"
        aria-labelledby="landing-performance-heading"
      >
        <h2 id="landing-performance-heading">
          How does Balanced Hot/Cold compare with Pure Random?
        </h2>

        <p>
          See how many numbers each strategy matched on the same official draws.
          Compare their average hits and see how many draws each comparison
          covers.
        </p>

        <a href="/performance" className="dl-landing-performance-link">
          Explore model performance <span aria-hidden="true">→</span>
        </a>
      </section>

      <footer className="dl-footnote">
        Drawlytics does not sell tickets or guarantee winnings. Analytics only —
        for informed, responsible play.
      </footer>
    </div>
  );
}
