// client/src/pages/MyPredictionsPage.tsx
import React, { CSSProperties, useEffect, useMemo, useState } from 'react';

type PredictionRow = {
  id: number;
  lottery: string;
  model_name: string;
  draw_date: string; // "YYYY-MM-DD" or ISO
  main_numbers: number[];
  star_numbers: number[];
  confidence: number;
  status: 'pending' | 'checked' | 'won' | 'lost' | 'error';
  matched_main: number | null;
  matched_stars: number | null;
  result_label: string | null;
};

type DrawRow = {
  id: number;
  draw_date: string; // "YYYY-MM-DD" or ISO
  n1: number;
  n2: number;
  n3: number;
  n4: number;
  n5: number;
  s1: number;
  s2: number;
};

type PredictionsResponse = {
  ok: boolean;
  predictions?: PredictionRow[];
  error?: string;
};

type DrawsAllResponse = {
  ok: boolean;
  draws?: DrawRow[];
  error?: string;
};

type CheckResponse = {
  ok: boolean;
  checked?: number;
  updated?: number;
  skipped?: number;
  error?: string;
};

type PlayedMapResponse = {
  ok: boolean;
  played?: Array<{ prediction_id: number }>;
  error?: string;
};

async function fetchJsonOrThrow<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore parse error, we’ll throw below
  }

  if (!res.ok) {
    const msg = json?.error || json?.message || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json as T;
}

function toDayKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;

  // If already YYYY-MM-DD
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  return d.toISOString().slice(0, 10);
}

function formatDayLabel(dayKey: string): string {
  // dayKey is YYYY-MM-DD
  const [y, m, d] = dayKey.split('-');
  return `${d}/${m}/${y}`;
}

function formatModelDisplayName(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return 'Unknown model';

  const lower = s.toLowerCase();

  // If the DB already stores a nice name, keep it.
  // (But still normalize common “generator” suffix/prefix patterns.)
  const stripGenerator = (x: string) => x.replace(/\s+generator$/i, '').trim();

  // 1) make_magic:* canonical mappings
  if (lower.startsWith('make_magic:')) {
    const key = lower.slice('make_magic:'.length).trim();

    const map: Record<string, string> = {
      cold_focused: 'Cold Focused',
      hot_focused: 'Hot Focused',
      balanced_hot_cold: 'Balanced Hot/Cold',
      pure_random: 'Pure Random',
      overdue: 'Overdue',
    };

    if (map[key]) return map[key];

    // Fallback: prettify unknown keys
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }

  // 2) Older human strings (from your screenshot)
  // Examples: "Cold-focused generator", "Overdue-focused generator", etc.
  if (lower.includes('generator')) {
    let cleaned = stripGenerator(s);

    // Normalize "-focused" variants
    cleaned = cleaned.replace(/-focused\b/gi, '');
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

    // Special-case “Balanced hot/cold”
    if (/balanced\s+hot\/cold/i.test(cleaned)) return 'Balanced Hot/Cold';

    // Title case
    return cleaned
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }

  // 3) Default: just clean underscores and title-case
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

type DrawLookup = {
  main: Set<number>;
  stars: Set<number>;
};

export default function MyPredictionsPage() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [playedMap, setPlayedMap] = useState<Record<number, boolean>>({});
  const [playingId, setPlayingId] = useState<number | null>(null);

  const [drawMap, setDrawMap] = useState<Record<string, DrawLookup>>({});

  const [usage, setUsage] = useState<{
    used: number;
    limit: number | null;
    limits_disabled: boolean;
  } | null>(null);

  useEffect(() => {
    void loadPredictions();
    void loadPlayedMap();
    void loadDrawsForHighlighting();
    void loadUsage();
  }, []);

  async function loadPredictions() {
    setError(null);
    setLoading(true);

    try {
      const data =
        await fetchJsonOrThrow<PredictionsResponse>('/api/predictions');

      if (!data.ok) {
        throw new Error(data.error || 'Could not load predictions');
      }

      setPredictions(data.predictions ?? []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? 'Could not load predictions');
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlayedMap() {
    try {
      const data = await fetchJsonOrThrow<PlayedMapResponse>(
        '/api/predictions/played',
      );

      if (!data.ok) return;

      const next: Record<number, boolean> = {};
      for (const row of data.played ?? []) {
        next[row.prediction_id] = true;
      }

      setPlayedMap(next);
    } catch (e) {
      console.warn('Could not load played map:', e);
    }
  }

  async function markPlayed(predictionId: number) {
    await fetchJsonOrThrow(`/api/predictions/${predictionId}/played`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async function unmarkPlayed(predictionId: number) {
    await fetchJsonOrThrow(`/api/predictions/${predictionId}/played`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async function loadDrawsForHighlighting() {
    try {
      const data = await fetchJsonOrThrow<DrawsAllResponse>(
        '/api/draws/all?limit=200&offset=0',
      );

      if (!data.ok) return;

      const nextMap: Record<string, DrawLookup> = {};

      for (const row of data.draws ?? []) {
        const dayKey = toDayKey(row.draw_date);
        if (!dayKey) continue;

        nextMap[dayKey] = {
          main: new Set([row.n1, row.n2, row.n3, row.n4, row.n5]),
          stars: new Set([row.s1, row.s2]),
        };
      }

      setDrawMap(nextMap);
    } catch (e) {
      console.warn('Could not load draws for highlighting:', e);
    }
  }

  async function loadUsage() {
    try {
      const res = await fetch('/api/predictions/usage');
      const json = await res.json();
      if (json?.ok) {
        setUsage(json);
      }
    } catch (err) {
      console.warn('Could not load usage', err);
    }
  }

  const predictionsSorted = useMemo(() => {
    const copy = [...predictions];
    copy.sort((a, b) => {
      const da = toDayKey(a.draw_date) ?? a.draw_date;
      const db = toDayKey(b.draw_date) ?? b.draw_date;
      return db.localeCompare(da);
    });
    return copy;
  }, [predictions]);

  async function handleDelete(id: number) {
    const ok = window.confirm(
      'Delete this prediction? This action cannot be undone.',
    );
    if (!ok) return;

    try {
      setDeletingId(id);
      await fetchJsonOrThrow(`/api/predictions/${id}`, { method: 'DELETE' });

      setPredictions((prev) => prev.filter((p) => p.id !== id));
      void loadUsage();
      setPlayedMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
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

      const data = await fetchJsonOrThrow<CheckResponse>(
        '/api/predictions/check',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      );

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

  async function handleTogglePlayed(predictionId: number) {
    const isPlayed = Boolean(playedMap[predictionId]);

    setPlayingId(predictionId);
    setPlayedMap((prev) => ({ ...prev, [predictionId]: !isPlayed }));

    try {
      if (isPlayed) {
        await unmarkPlayed(predictionId);
      } else {
        await markPlayed(predictionId);
      }
    } catch (e) {
      console.error(e);
      setPlayedMap((prev) => ({ ...prev, [predictionId]: isPlayed }));
      alert(
        isPlayed
          ? 'Could not unmark as played. Please try again.'
          : 'Could not mark as played. Please try again.',
      );
    } finally {
      setPlayingId(null);
    }
  }

  function hitStyle(isHit: boolean): CSSProperties | undefined {
    if (!isHit) return undefined;

    return {
      background: '#dcfce7',
      borderColor: '#22c55e',
      color: '#14532d',
      fontWeight: 700,
      boxShadow: '0 0 0 2px rgba(34,197,94,0.15) inset',
    };
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

          {usage && (
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: '1px solid rgba(15,23,42,0.12)',
                  background: '#ffffff',
                  fontSize: '0.85rem',
                  color: '#6b7280',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: usage.limits_disabled ? '#10b981' : '#6366f1',
                    display: 'inline-block',
                  }}
                />
                {usage.limits_disabled
                  ? `Predictions saved: ${usage.used} (unlimited – dev mode)`
                  : `Predictions saved: ${usage.used} / ${usage.limit}`}
              </span>
            </div>
          )}

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
                await loadUsage();
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

      {!loading && !error && predictionsSorted.length === 0 && (
        <p>No predictions saved yet.</p>
      )}

      {!loading && !error && predictionsSorted.length > 0 && (
        <section
          style={{
            width: '100%',
            maxWidth: 960,
            margin: '0 auto',
            display: 'grid',
            gap: '1rem',
          }}
        >
          {predictionsSorted.map((p) => {
            const dayKey = toDayKey(p.draw_date);
            const draw = dayKey ? drawMap[dayKey] : undefined;

            const isPlayed = Boolean(playedMap[p.id]);

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
                  background: isPlayed ? '#f8fafc' : '#ffffff',
                  borderRadius: '18px',
                  padding: '1rem 1.25rem',
                  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                  border: isPlayed
                    ? '1px solid #e5e7eb'
                    : '1px solid transparent',
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
                      {formatModelDisplayName(p.model_name)} — draw{' '}
                      {dayKey ? formatDayLabel(dayKey) : p.draw_date}
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
                        background: isPlayed
                          ? '#eef2ff'
                          : p.status === 'won'
                            ? '#ecfdf3'
                            : p.status === 'lost'
                              ? '#fef2f2'
                              : p.status === 'checked'
                                ? '#f5f3ff'
                                : '#eff6ff',
                        color: isPlayed
                          ? '#3730a3'
                          : p.status === 'won'
                            ? '#166534'
                            : p.status === 'lost'
                              ? '#991b1b'
                              : p.status === 'checked'
                                ? '#6d28d9'
                                : '#1d4ed8',
                      }}
                    >
                      {isPlayed ? 'played' : p.status}
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
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      alignItems: 'flex-end',
                    }}
                  >
                    <div style={{ textAlign: 'right' }}>
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
                          (No draw data loaded for{' '}
                          {dayKey ? formatDayLabel(dayKey) : p.draw_date})
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTogglePlayed(p.id)}
                      disabled={playingId === p.id}
                      style={{
                        border: '1px solid rgba(15,23,42,0.12)',
                        background: isPlayed ? '#eef2ff' : '#ffffff',
                        borderRadius: 999,
                        padding: '0.45rem 0.8rem',
                        fontSize: '0.85rem',
                        cursor: playingId === p.id ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        opacity: playingId === p.id ? 0.6 : 1,
                        color: isPlayed ? '#3730a3' : '#0f172a',
                      }}
                      title={
                        isPlayed
                          ? 'Click to undo (unmark as played)'
                          : 'Play this line'
                      }
                    >
                      {playingId === p.id
                        ? 'Saving…'
                        : isPlayed
                          ? 'Played (undo)'
                          : 'Play this line'}
                    </button>
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
