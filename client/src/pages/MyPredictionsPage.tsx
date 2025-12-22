// client/src/pages/MyPredictionsPage.tsx
import { useEffect, useMemo, useState } from 'react';

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

// 👇 optional in dev; if missing we fall back to relative /api calls (works with Vite proxy)
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

type CheckResponse = {
  ok: boolean;
  checked?: number;
  updated?: number;
  skipped?: number;
  error?: string;
};

type DrawRow = {
  id: number;
  draw_date: string; // YYYY-MM-DD
  n1: number;
  n2: number;
  n3: number;
  n4: number;
  n5: number;
  s1: number;
  s2: number;
};

type DrawMapEntry = {
  main: Set<number>;
  stars: Set<number>;
};

function isHtml(text: string) {
  const t = text.trim().toLowerCase();
  return t.startsWith('<!doctype') || t.startsWith('<html');
}

export default function MyPredictionsPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);

  const [drawMap, setDrawMap] = useState<Record<string, DrawMapEntry>>({});

  // Endpoint helper:
  // - if VITE_API_BASE_URL is set => use it
  // - else => use relative /api (works with Vite proxy)
  const api = useMemo(() => {
    const base = (API_BASE_URL || '').trim();
    return (path: string) => (base ? `${base}${path}` : path);
  }, []);

  async function loadPredictions() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(api('/api/predictions'));
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to load predictions (status ${res.status}): ${text}`,
        );
      }

      const data = await res.json();
      setPredictions(data.predictions ?? []);
    } catch (err) {
      console.error(err);
      setError('Could not load predictions');
    } finally {
      setLoading(false);
    }
  }

  async function loadDrawsForHighlighting() {
    try {
      // Pull enough to cover your recent predictions
      const res = await fetch(api('/api/draws/all?limit=200&offset=0'));
      if (!res.ok) return;

      const data = await res.json();
      const draws: DrawRow[] = data.draws ?? [];

      const map: Record<string, DrawMapEntry> = {};
      for (const d of draws) {
        map[d.draw_date] = {
          main: new Set([d.n1, d.n2, d.n3, d.n4, d.n5]),
          stars: new Set([d.s1, d.s2]),
        };
      }
      setDrawMap(map);
    } catch (e) {
      console.warn('Could not load draws for highlighting:', e);
    }
  }

  useEffect(() => {
    loadPredictions();
    loadDrawsForHighlighting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(id: number) {
    const ok = window.confirm(
      'Delete this prediction? This action cannot be undone.',
    );
    if (!ok) return;

    try {
      setDeletingId(id);

      const res = await fetch(api(`/api/predictions/${id}`), {
        method: 'DELETE',
      });

      if (!res.ok && res.status !== 204) {
        const text = await res.text();
        throw new Error(
          `Failed to delete (status ${res.status}): ${text || 'Unknown error'}`,
        );
      }

      setPredictions((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Delete prediction failed:', err);
      alert('Could not delete prediction. Check console/logs for details.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCheckResults() {
    setCheckMsg(null);

    try {
      setChecking(true);

      const res = await fetch(api('/api/predictions/check'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const text = await res.text();

      if (!res.ok) {
        if (isHtml(text)) {
          throw new Error(
            `Your request hit the frontend server, not the API. Ensure VITE_API_BASE_URL is set to the API URL (port 3000 in dev) or rely on the Vite proxy.`,
          );
        }
        throw new Error(text || `Request failed (${res.status})`);
      }

      let data: CheckResponse | null = null;
      try {
        data = text ? (JSON.parse(text) as CheckResponse) : null;
      } catch {
        data = null;
      }

      const checked = data?.checked ?? 0;
      const updated = data?.updated ?? 0;
      const skipped = data?.skipped ?? 0;

      setCheckMsg(
        `Checked: ${checked} • Updated: ${updated} • Skipped: ${skipped}`,
      );

      await loadPredictions();
      await loadDrawsForHighlighting();
    } catch (err: any) {
      console.error(err);
      setCheckMsg(`Check failed: ${err?.message ?? 'Unknown error'}`);
    } finally {
      setChecking(false);
    }
  }

  function hitStyle(isHit: boolean) {
    // Only override when it’s a hit (so default pills match other pages)
    return isHit
      ? ({
          background: '#ecfdf3',
          borderColor: '#86efac',
          color: '#166534',
        } as React.CSSProperties)
      : undefined;
  }

  return (
    <main className="dl-page">
      <header className="dl-analysis-header">
        <div
          style={{
            maxWidth: 960,
            margin: '0 auto',
            padding: '0 1rem',
            textAlign: 'center',
          }}
        >
          <h1 style={{ margin: 0 }}>My Predictions</h1>

          <p className="dl-section-subtitle" style={{ marginTop: 8 }}>
            View saved predictions across your lotteries. (Generator &amp;
            performance analytics coming next.)
          </p>

          <div
            style={{
              marginTop: 12,
              display: 'flex',
              justifyContent: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={handleCheckResults}
              disabled={checking || loading}
              style={{
                border: '1px solid rgba(15,23,42,0.12)',
                background: checking ? '#f3f4f6' : '#ffffff',
                borderRadius: 999,
                padding: '0.5rem 0.85rem',
                fontSize: '0.85rem',
                cursor: checking || loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
              }}
            >
              {checking ? 'Checking…' : 'Check results'}
            </button>

            <button
              type="button"
              onClick={async () => {
                await loadPredictions();
                await loadDrawsForHighlighting();
              }}
              disabled={loading || checking}
              style={{
                border: '1px solid rgba(15,23,42,0.12)',
                background: loading ? '#f3f4f6' : '#ffffff',
                borderRadius: 999,
                padding: '0.5rem 0.85rem',
                fontSize: '0.85rem',
                cursor: loading || checking ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {checkMsg && (
            <p
              style={{
                margin: '10px auto 0',
                color: '#6b7280',
                fontSize: '0.9rem',
                maxWidth: 760,
              }}
            >
              {checkMsg}
            </p>
          )}
        </div>
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
          {predictions.map((p) => {
            const draw = drawMap[p.draw_date];

            const mainHitCount = draw
              ? p.main_numbers.reduce(
                  (acc, n) => acc + (draw.main.has(n) ? 1 : 0),
                  0,
                )
              : null;

            const starHitCount = draw
              ? p.star_numbers.reduce(
                  (acc, n) => acc + (draw.stars.has(n) ? 1 : 0),
                  0,
                )
              : null;

            return (
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
                    flexWrap: 'wrap',
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
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
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
                              : p.status === 'checked'
                                ? '#f5f3ff'
                                : '#eff6ff',
                        color:
                          p.status === 'won'
                            ? '#166534'
                            : p.status === 'lost'
                              ? '#991b1b'
                              : p.status === 'checked'
                                ? '#6d28d9'
                                : '#1d4ed8',
                      }}
                    >
                      {p.status}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#9ca3af',
                        fontSize: '0.8rem',
                        cursor: deletingId === p.id ? 'default' : 'pointer',
                        padding: '0.1rem 0.4rem',
                      }}
                    >
                      {deletingId === p.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
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
                      {mainHitCount != null ? ` (hits: ${mainHitCount})` : ''}
                    </div>

                    <div>
                      {p.main_numbers.map((n) => {
                        const isHit = Boolean(draw?.main.has(n));
                        return (
                          <span
                            key={n}
                            className="dl-draw-pill dl-draw-pill--main"
                            style={hitStyle(isHit)}
                            title={isHit ? 'Hit' : undefined}
                          >
                            {n}
                          </span>
                        );
                      })}
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
                      {starHitCount != null ? ` (hits: ${starHitCount})` : ''}
                    </div>

                    <div>
                      {p.star_numbers.map((n) => {
                        const isHit = Boolean(draw?.stars.has(n));
                        return (
                          <span
                            key={n}
                            className="dl-draw-pill dl-draw-pill--star"
                            style={hitStyle(isHit)}
                            title={isHit ? 'Hit' : undefined}
                          >
                            {n}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    style={{
                      marginLeft: 'auto',
                      textAlign: 'right',
                      minWidth: 170,
                    }}
                  >
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
                        Hits: {p.matched_main ?? 0} main /{' '}
                        {p.matched_stars ?? 0} stars
                        {p.result_label ? ` • ${p.result_label}` : ''}
                      </div>
                    )}

                    {!draw && (
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#9ca3af',
                          marginTop: 6,
                        }}
                      >
                        (No draw data loaded for {p.draw_date})
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
