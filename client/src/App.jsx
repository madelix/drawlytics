import { useEffect, useState } from 'react';

export default function App() {
  const [health, setHealth] = useState(null);
  const [freq, setFreq] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth);
    fetch('/api/frequency')
      .then((r) => r.json())
      .then(setFreq);
  }, []);

  return (
    <main
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: 28,
        maxWidth: 860,
        margin: '0 auto',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <h1 style={{ margin: 0 }}>Drawlytics</h1>
        <a
          href="https://forms.gle/"
          target="_blank"
          rel="noreferrer"
          style={{
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: 10,
            textDecoration: 'none',
          }}
        >
          Join the Beta
        </a>
      </header>

      <p style={{ opacity: 0.75, marginTop: 8 }}>
        Analytics for every draw. See frequency, gaps and trends.
      </p>

      <section style={{ marginTop: 24 }}>
        <div
          style={{ padding: 16, border: '1px solid #eee', borderRadius: 12 }}
        >
          <strong>API status:</strong>{' '}
          {health ? JSON.stringify(health) : '…checking'}
        </div>

        <div style={{ marginTop: 20 }}>
          <h2 style={{ margin: '12px 0' }}>Number Frequency</h2>

          {!freq ? (
            <p>Loading…</p>
          ) : (
            <>
              <h3>Most frequent main number (top 10)</h3>
              <ul style={{ columns: 2, paddingLeft: 18 }}>
                {freq.main.slice(0, 10).map((x) => (
                  <li key={x.number}>
                    #{x.number} → {x.count}
                  </li>
                ))}
              </ul>

              <h3 style={{ marginTop: 16 }}>Most frequent star (top 5)</h3>
              <ul style={{ columns: 2, paddingLeft: 18 }}>
                {freq.stars.slice(0, 5).map((x) => (
                  <li key={x.number}>
                    ★{x.number} → {x.count}
                  </li>
                ))}
              </ul>

              <p style={{ opacity: 0.7 }}>Based on {freq.totalDraws} draws.</p>
            </>
          )}
        </div>
      </section>

      <footer style={{ marginTop: 32, fontSize: 12, opacity: 0.7 }}>
        For educational & entertainment use only. No ticket sales or betting.
      </footer>
    </main>
  );
}
