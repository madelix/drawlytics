// client/src/pages/MyPredictionsPage.tsx
import { useEffect, useState } from 'react';

type Prediction = {
  id: number;
  lottery: string;
  draw_date: string;
  model_name: string;
  main_numbers: number[];
  star_numbers: number[];
  confidence: string; // numeric(5,2) comes back as string
  status: string;
  created_at: string;
  matched_main: number | null;
  matched_stars: number | null;
  result_label: string | null;
};

// 👇 this must match client/.env
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function MyPredictionsPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        if (!API_BASE_URL) {
          throw new Error('Missing VITE_API_BASE_URL');
        }

        const res = await fetch(`${API_BASE_URL}/api/predictions`);
        if (!res.ok) throw new Error('Failed to load predictions');

        const data = await res.json();
        setPredictions(data.predictions ?? []);
      } catch (err) {
        console.error(err);
        setError('Could not load predictions');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <main className="dl-page">
      <header className="dl-analysis-header">
        <h1>My Predictions</h1>
        <p className="dl-section-subtitle">
          View saved predictions across your lotteries. (Generator & performance
          analytics coming next.)
        </p>
      </header>

      {loading && <p>Loading predictions…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && !error && predictions.length === 0 && (
        <p>No predictions saved yet.</p>
      )}

      {!loading && !error && predictions.length > 0 && (
        <section
          style={{
            width: '100%',
            maxWidth: 960,
            margin: '0 auto',
            display: 'grid',
            gap: '1rem',
          }}
        >
          {predictions.map((p) => (
            <article
              key={p.id}
              style={{
                background: '#ffffff',
                borderRadius: '18px',
                padding: '1rem 1.25rem',
                boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  marginBottom: '0.4rem',
                  alignItems: 'baseline',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#6b7280',
                      marginBottom: 2,
                    }}
                  >
                    {p.lottery}
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {p.model_name} — draw {p.draw_date}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.2rem 0.6rem',
                    borderRadius: 999,
                    background:
                      p.status === 'won'
                        ? '#ecfdf3'
                        : p.status === 'lost'
                          ? '#fef2f2'
                          : '#eff6ff',
                    color:
                      p.status === 'won'
                        ? '#166534'
                        : p.status === 'lost'
                          ? '#991b1b'
                          : '#1d4ed8',
                  }}
                >
                  {p.status}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  alignItems: 'center',
                  marginTop: '0.4rem',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#6b7280',
                      marginBottom: 4,
                    }}
                  >
                    Main numbers
                  </div>
                  <div>
                    {p.main_numbers.map((n) => (
                      <span key={n} className="dl-draw-pill dl-draw-pill--main">
                        {n}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#6b7280',
                      marginBottom: 4,
                    }}
                  >
                    Stars
                  </div>
                  <div>
                    {p.star_numbers.map((n) => (
                      <span key={n} className="dl-draw-pill dl-draw-pill--star">
                        {n}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#6b7280',
                    }}
                  >
                    Confidence
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {Number(p.confidence).toFixed(2)}%
                  </div>
                  {(p.matched_main != null || p.matched_stars != null) && (
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        marginTop: 2,
                      }}
                    >
                      Hits: {p.matched_main ?? 0} main / {p.matched_stars ?? 0}{' '}
                      stars
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
