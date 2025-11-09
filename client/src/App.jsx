import { useEffect, useState } from 'react';

const API =
  import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== ''
    ? import.meta.env.VITE_API_URL
    : '';

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function App() {
  const [health, setHealth] = useState(null);
  const [freq, setFreq] = useState(null);

  useEffect(() => {
    const base = API;

    fetch(`${base}/api/health`)
      .then((r) => r.json())
      .then((data) => setHealth(data))
      .catch((err) => console.error('Error fetching health:', err));

    fetch(`${base}/api/frequency`)
      .then((r) => r.json())
      .then((data) => setFreq(data))
      .catch((err) => console.error('Error fetching frequency:', err));
  }, []);

  const apiOk = health && health.ok;

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#ffffff',
        color: '#111827',
        fontFamily:
          'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* Top bar */}
      <header
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #21409a, #804198)',
            }}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              lineHeight: 1.1,
            }}
          >
            <span
              style={{
                fontWeight: 800,
                letterSpacing: '0.02em',
                fontSize: 18,
              }}
            >
              Drawlytics
            </span>
            <span
              style={{
                fontSize: 10,
                color: '#6b7280',
              }}
            >
              Where luck meets logic
            </span>
          </div>
        </div>

        <a
          href="https://forms.gle/YOUR_REAL_FORM_ID"
          target="_blank"
          rel="noreferrer"
          style={{
            padding: '8px 16px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #21409a, #804198)',
            color: '#ffffff',
            boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
            whiteSpace: 'nowrap',
          }}
        >
          Join the beta
        </a>
      </header>

      {/* Hero */}
      <main
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '10px 20px 40px',
        }}
      >
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1.4fr)',
            gap: 32,
            alignItems: 'flex-start',
          }}
        >
          {/* Left: copy */}
          <div>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 800,
                margin: '10px 0 10px',
                letterSpacing: '-0.02em',
              }}
            >
              Analytics for EuroMillions and UK draws, not superstition.
            </h1>
            <p
              style={{
                fontSize: 15,
                color: '#4b5563',
                maxWidth: 560,
                margin: '0 0 14px',
              }}
            >
              Drawlytics ingests official draw history for EuroMillions, UK
              Lotto, and Set For Life, and turns it into frequency, gaps,
              trends, and experimental model performance. Built for players who
              like numbers, not “lucky charms”.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                marginBottom: 16,
              }}
            >
              <a
                href="https://tally.so/r/OD1k5g"
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '9px 20px',
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                  background: 'linear-gradient(135deg, #21409a, #804198)',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.16)',
                }}
              >
                Join the beta
              </a>
              <div
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  alignSelf: 'center',
                }}
              >
                Early access to analytics, predictions & model insights.
              </div>
            </div>

            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'grid',
                gap: 4,
                fontSize: 13,
                color: '#374151',
              }}
            >
              <li>
                • Multi-lottery support: EuroMillions, UK Lotto, Set For Life.
              </li>
              <li>• Number frequency, gaps, hot/cold analysis.</li>
              <li>
                • Model playground: baselines, ensembles & performance tracking.
              </li>
              <li>• “My predictions” tracking — see what would have hit.</li>
            </ul>

            <p
              style={{
                fontSize: 10,
                color: '#9ca3af',
                marginTop: 10,
              }}
            >
              Drawlytics does not sell tickets or guarantee winnings. Analytics
              only — for informed, responsible play.
            </p>
          </div>

          {/* Right: live preview / trust panel */}
          <div
            style={{
              padding: 14,
              borderRadius: 18,
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#6b7280',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>Live system status</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 10,
                  color: apiOk ? '#059669' : '#9ca3af',
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '999px',
                    backgroundColor: apiOk ? '#22c55e' : '#9ca3af',
                  }}
                />
                {apiOk ? 'Online' : 'Checking'}
              </span>
            </div>

            <div
              style={{
                fontSize: 11,
                padding: 8,
                borderRadius: 12,
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
              }}
            >
              <div style={{ marginBottom: 4 }}>
                <strong>API health:</strong>{' '}
                {health ? JSON.stringify(health) : '…checking'}
              </div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>
                Backed by a live API and real draw history. This preview shows
                the same engine beta users will access.
              </div>
            </div>

            <div
              style={{
                fontSize: 11,
                padding: 8,
                borderRadius: 12,
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                EuroMillions number frequency (sample)
              </div>
              {!freq ? (
                <div>Loading…</div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 2,
                    fontSize: 10,
                    color: '#374151',
                  }}
                >
                  {freq.main.slice(0, 10).map((x) => (
                    <div key={x.number}>
                      #{x.number} → {x.count}
                    </div>
                  ))}
                </div>
              )}
              <div
                style={{
                  fontSize: 9,
                  color: '#9ca3af',
                  marginTop: 4,
                }}
              >
                Full history + per-lottery analytics will be available in beta.
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
