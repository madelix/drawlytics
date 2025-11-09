import { useEffect, useState } from 'react';

const API =
  import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== ''
    ? import.meta.env.VITE_API_URL
    : '';

export default function App() {
  const [health, setHealth] = useState(null);
  const [freq, setFreq] = useState(null);

  useEffect(() => {
    const base = API;

    fetch(`${base}/api/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch((err) => console.error('health error', err));

    fetch(`${base}/api/frequency`)
      .then((r) => r.json())
      .then(setFreq)
      .catch((err) => console.error('freq error', err));
  }, []);

  const apiOnline = !!(health && health.ok);

  // brand colors
  const gradient = 'linear-gradient(135deg, #21409a, #804198)';

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
      {/* NAV */}
      <header
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '18px 20px 8px',
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
              borderRadius: 9,
              background: gradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* tiny three-node motif */}
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                border: '1.4px solid rgba(255,255,255,0.9)',
                borderTopColor: 'transparent',
                transform: 'rotate(35deg)',
              }}
            />
          </div>
          <div style={{ lineHeight: 1.1 }}>
            <div
              style={{
                fontWeight: 800,
                letterSpacing: '0.01em',
                fontSize: 18,
              }}
            >
              Drawlytics
            </div>
            <div
              style={{
                fontSize: 10,
                color: '#6b7280',
              }}
            >
              Where luck meets logic
            </div>
          </div>
        </div>

        <a
          href="https://forms.gle/YOUR_REAL_FORM_ID"
          target="_blank"
          rel="noreferrer"
          style={{
            padding: '9px 20px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            background: gradient,
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.14)',
            whiteSpace: 'nowrap',
          }}
        >
          Join the beta
        </a>
      </header>

      {/* MAIN */}
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
            gridTemplateColumns: 'minmax(0, 3fr) minmax(260px, 2fr)',
            gap: 32,
            alignItems: 'flex-start',
          }}
        >
          {/* LEFT: copy */}
          <div>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 800,
                margin: '8px 0 10px',
                letterSpacing: '-0.01em',
              }}
            >
              Analytics for EuroMillions and UK draws, not superstition.
            </h1>
            <p
              style={{
                fontSize: 14,
                color: '#4b5563',
                maxWidth: 540,
                margin: '0 0 14px',
              }}
            >
              Drawlytics ingests official draw history for EuroMillions, UK
              Lotto and Set For Life, and turns it into frequency, gaps, trends
              and experimental model performance. Built for people who like
              numbers, not “lucky charms”.
            </p>

            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 14px',
                fontSize: 13,
                color: '#374151',
              }}
            >
              <li>• Multi-lottery support.</li>
              <li>• Number frequency & gap analysis.</li>
              <li>• Model playground & performance tracking.</li>
              <li>• “My predictions” (coming in beta).</li>
            </ul>

            <p
              style={{
                fontSize: 10,
                color: '#9ca3af',
                margin: 0,
              }}
            >
              Drawlytics does not sell tickets or guarantee winnings. Analytics
              only — for informed, responsible play.
            </p>
          </div>

          {/* RIGHT: tiny preview card */}
          <div
            style={{
              padding: 14,
              borderRadius: 18,
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: '0 10px 26px rgba(15,23,42,0.06)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 11,
                color: '#6b7280',
              }}
            >
              <span>Preview from the live API</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 10,
                  color: apiOnline ? '#059669' : '#9ca3af',
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '999px',
                    backgroundColor: apiOnline ? '#22c55e' : '#9ca3af',
                  }}
                />
                {apiOnline ? 'Online' : 'Checking'}
              </span>
            </div>

            <div
              style={{
                fontSize: 11,
                padding: 8,
                borderRadius: 12,
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                minHeight: 40,
              }}
            >
              {!freq ? (
                <span>Loading sample frequency…</span>
              ) : (
                <>
                  <div
                    style={{
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    EuroMillions: top numbers (sample)
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 2,
                      fontSize: 10,
                      color: '#374151',
                    }}
                  >
                    {freq.main.slice(0, 8).map((x) => (
                      <div key={x.number}>
                        #{x.number} → {x.count}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div
              style={{
                fontSize: 9,
                color: '#9ca3af',
              }}
            >
              Beta users will get full history per lottery, more models, and
              saved predictions — this is just a small live preview.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
