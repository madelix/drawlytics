// client/src/pages/MyPredictionsPage.tsx
import React, { CSSProperties, useEffect, useMemo, useState } from 'react';
import { getModelDisplayName } from '../utils/modelDisplay';
import { getLotteryConfig } from '../config/lotteries';

type PredictionRow = {
  id: number;
  lottery: string;
  model_name: string;
  source?: string | null;
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
    // ignore parse error
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
  const [y, m, d] = dayKey.split('-');
  return `${d}/${m}/${y}`;
}

type DrawLookup = {
  main: Set<number>;
  stars: Set<number>;
};

function countHits(
  pred: PredictionRow,
  draw: DrawLookup | undefined,
): { main: number; stars: number; total: number } | null {
  if (!draw) return null;

  const main = pred.main_numbers.reduce(
    (acc, n) => acc + (draw.main.has(n) ? 1 : 0),
    0,
  );
  const stars = pred.star_numbers.reduce(
    (acc, n) => acc + (draw.stars.has(n) ? 1 : 0),
    0,
  );

  return { main, stars, total: main + stars };
}

function bestLabelForGroup(
  dayKey: string,
  items: PredictionRow[],
  drawMap: Record<string, DrawLookup>,
): string {
  if (dayKey === 'unknown') return '—';

  const draw = drawMap[dayKey];
  if (!draw) return '—';

  let bestMain = 0;
  let bestStars = 0;

  for (const p of items) {
    const hits = countHits(p, draw);
    if (!hits) continue;

    if (
      hits.main > bestMain ||
      (hits.main === bestMain && hits.stars > bestStars)
    ) {
      bestMain = hits.main;
      bestStars = hits.stars;
    }
  }

  return `${bestMain}+${bestStars}`;
}

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
  const [isMobile, setIsMobile] = useState(false);

  const [usage, setUsage] = useState<{
    used: number;
    limit: number | null;
    limits_disabled: boolean;
  } | null>(null);

  // Collapsible state
  const [openDraws, setOpenDraws] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('drawlytics_open_draws');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    void loadPredictions();
    void loadPlayedMap();
    void loadDrawsForHighlighting();
    void loadUsage();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 700px)');

    const updateIsMobile = () => {
      setIsMobile(mediaQuery.matches);
    };

    updateIsMobile();
    mediaQuery.addEventListener('change', updateIsMobile);

    return () => {
      mediaQuery.removeEventListener('change', updateIsMobile);
    };
  }, []);

  async function loadUsage() {
    try {
      const res = await fetch('/api/predictions/usage');
      const json = await res.json();
      if (json?.ok) setUsage(json);
    } catch (err) {
      console.warn('Could not load usage', err);
    }
  }

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
        '/api/played-predictions',
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
    await fetchJsonOrThrow('/api/played-predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // send both keys to be safe with backend naming
      body: JSON.stringify({ predictionId, prediction_id: predictionId }),
    });
  }

  async function unmarkPlayed(predictionId: number) {
    await fetchJsonOrThrow(`/api/played-predictions/${predictionId}`, {
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

  const predictionsSorted = useMemo(() => {
    const copy = [...predictions];
    copy.sort((a, b) => {
      const da = toDayKey(a.draw_date) ?? a.draw_date;
      const db = toDayKey(b.draw_date) ?? b.draw_date;
      return db.localeCompare(da);
    });
    return copy;
  }, [predictions]);

  const predictionsByDraw = useMemo(() => {
    const map: Record<string, PredictionRow[]> = {};
    for (const p of predictionsSorted) {
      const dayKey = toDayKey(p.draw_date) ?? 'unknown';
      if (!map[dayKey]) map[dayKey] = [];
      map[dayKey].push(p);
    }
    return map;
  }, [predictionsSorted]);

  const drawGroups = useMemo(() => {
    const entries = Object.entries(predictionsByDraw);

    // newest draw first, unknown last
    entries.sort(([a], [b]) => {
      if (a === 'unknown' && b === 'unknown') return 0;
      if (a === 'unknown') return 1;
      if (b === 'unknown') return -1;
      return b.localeCompare(a);
    });

    return entries;
  }, [predictionsByDraw]);

  // Keep openDraws in sync with the current drawGroups keys (persisted)
  useEffect(() => {
    setOpenDraws((prev) => {
      const keys = new Set(drawGroups.map(([k]) => k));

      let changed = false;
      const next: Record<string, boolean> = { ...prev };

      // Add new draws (default open)
      for (const k of keys) {
        if (next[k] === undefined) {
          next[k] = true;
          changed = true;
        }
      }

      // Remove draws that no longer exist
      for (const k of Object.keys(next)) {
        if (!keys.has(k)) {
          delete next[k];
          changed = true;
        }
      }

      if (changed) {
        try {
          localStorage.setItem('drawlytics_open_draws', JSON.stringify(next));
        } catch {}
        return next;
      }

      return prev;
    });
  }, [drawGroups]);

  async function handleDelete(id: number) {
    const ok = window.confirm(
      'Delete this prediction? This action cannot be undone.',
    );
    if (!ok) return;

    try {
      setDeletingId(id);
      await fetchJsonOrThrow(`/api/predictions/${id}`, { method: 'DELETE' });

      setPredictions((prev) => prev.filter((p) => p.id !== id));
      setPlayedMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      void loadUsage();
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
      await loadUsage();
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
            <button
              type="button"
              onClick={() => {
                const next: Record<string, boolean> = {};
                for (const [dayKey] of drawGroups) next[dayKey] = true;
                setOpenDraws(next);
                try {
                  localStorage.setItem(
                    'drawlytics_open_draws',
                    JSON.stringify(next),
                  );
                } catch {}
              }}
              disabled={loading || checking}
              style={{
                border: '1px solid rgba(15,23,42,0.12)',
                background: '#ffffff',
                borderRadius: 999,
                padding: '0.5rem 0.85rem',
                fontSize: '0.85rem',
                cursor: loading || checking ? 'not-allowed' : 'pointer',
              }}
            >
              Open all
            </button>

            <button
              type="button"
              onClick={() => {
                const next: Record<string, boolean> = {};
                for (const [dayKey] of drawGroups) next[dayKey] = false;
                setOpenDraws(next);
                try {
                  localStorage.setItem(
                    'drawlytics_open_draws',
                    JSON.stringify(next),
                  );
                } catch {}
              }}
              disabled={loading || checking}
              style={{
                border: '1px solid rgba(15,23,42,0.12)',
                background: '#ffffff',
                borderRadius: 999,
                padding: '0.5rem 0.85rem',
                fontSize: '0.85rem',
                cursor: loading || checking ? 'not-allowed' : 'pointer',
              }}
            >
              Collapse all
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
            gap: '1.25rem',
          }}
        >
          {drawGroups.map(([dayKey, items]) => {
            const groupLabel =
              dayKey === 'unknown'
                ? 'Unknown draw date'
                : `Draw ${formatDayLabel(dayKey)}`;

            const isOpen = openDraws[dayKey] ?? true;

            const playedCount = items.reduce(
              (acc, p) => acc + (playedMap[p.id] ? 1 : 0),
              0,
            );

            const hasDraw = dayKey !== 'unknown' && Boolean(drawMap[dayKey]);
            const resultsCount = hasDraw ? items.length : 0;

            const bestResult = (() => {
              if (dayKey === 'unknown' || !drawMap[dayKey]) return null;

              const draw = drawMap[dayKey];

              let bestMain = 0;
              let bestStars = 0;
              let bestModel: string | null = null;

              for (const p of items) {
                const hits = countHits(p, draw);
                if (!hits) continue;

                if (
                  hits.main > bestMain ||
                  (hits.main === bestMain && hits.stars > bestStars)
                ) {
                  bestMain = hits.main;
                  bestStars = hits.stars;
                  bestModel = getModelDisplayName(p.model_name);
                }
              }

              return {
                label: `${bestMain}+${bestStars}`,
                model: bestModel,
              };
            })();

            const bestPlayedResult = (() => {
              if (dayKey === 'unknown' || !drawMap[dayKey]) return null;

              const draw = drawMap[dayKey];

              let bestMain = 0;
              let bestStars = 0;
              let bestModel: string | null = null;
              let anyPlayed = false;

              for (const p of items) {
                if (!playedMap[p.id]) continue;
                anyPlayed = true;

                const hits = countHits(p, draw);
                if (!hits) continue;

                if (
                  hits.main > bestMain ||
                  (hits.main === bestMain && hits.stars > bestStars)
                ) {
                  bestMain = hits.main;
                  bestStars = hits.stars;
                  bestModel = getModelDisplayName(p.model_name);
                }
              }

              if (!anyPlayed) return null;

              return {
                label: `${bestMain}+${bestStars}`,
                model: bestModel,
              };
            })();

            const winning =
              dayKey !== 'unknown' && drawMap[dayKey]
                ? (() => {
                    const d = drawMap[dayKey];
                    const main = Array.from(d.main)
                      .sort((a, b) => a - b)
                      .join(' ');
                    const stars = Array.from(d.stars)
                      .sort((a, b) => a - b)
                      .join(' ');
                    return `Winning: ${main} ★ ${stars}`;
                  })()
                : null;

            return (
              <div key={dayKey} style={{ display: 'grid', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() =>
                    setOpenDraws((prev) => {
                      const next = {
                        ...prev,
                        [dayKey]: !(prev[dayKey] ?? true),
                      };
                      try {
                        localStorage.setItem(
                          'drawlytics_open_draws',
                          JSON.stringify(next),
                        );
                      } catch {}
                      return next;
                    })
                  }
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'translateY(1px)';
                    e.currentTarget.style.filter = 'brightness(0.98)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = '';
                    e.currentTarget.style.filter = '';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = '';
                    e.currentTarget.style.filter = '';
                  }}
                  aria-expanded={isOpen}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    padding: '10px 12px',
                    borderRadius: 14,
                    border: 'none',
                    background: 'linear-gradient(90deg, #21409a, #804198)',
                    color: '#ffffff',
                    boxShadow: '0 6px 18px rgba(15,23,42,0.12)',
                    transition:
                      'transform 120ms ease, box-shadow 120ms ease, filter 120ms ease',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.9rem',
                        color: 'rgba(255,255,255,0.85)',
                        opacity: 0.9,
                        display: 'inline-block',
                        transition: 'transform 180ms ease',
                        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                      }}
                      aria-hidden
                    >
                      ▸
                    </span>

                    <span
                      style={{
                        fontWeight: 800,
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {groupLabel}
                    </span>
                  </div>

                  <div
                    style={{
                      marginLeft: 'auto',
                      display: 'grid',
                      gap: 4,
                      justifyItems: 'end',
                      textAlign: 'right',
                      color: 'rgba(255,255,255,0.85)',
                      fontSize: '0.78rem',
                      lineHeight: 1.2,
                      flexBasis: 260,
                      maxWidth: 420,
                      minWidth: 220,
                    }}
                  >
                    <div style={{ opacity: 0.9 }}>
                      {items.length} {items.length === 1 ? 'line' : 'lines'} ·
                      Results {resultsCount}/{items.length} · Played{' '}
                      {playedCount}/{items.length}
                    </div>

                    <div style={{ opacity: 0.95 }}>
                      {bestPlayedResult
                        ? `Best played: ${bestPlayedResult.model ?? 'Model'} (${bestPlayedResult.label})`
                        : `Best saved: ${bestResult?.label ?? '—'}${
                            bestResult?.model ? ` (${bestResult.model})` : ''
                          }`}
                    </div>

                    {winning ? (
                      <div style={{ opacity: 0.85 }}>{winning}</div>
                    ) : null}
                  </div>
                </button>

                {isOpen &&
                  items.map((p) => {
                    const predDayKey = toDayKey(p.draw_date);
                    const lotteryConfig = getLotteryConfig(p.lottery);
                    const mainGroup = lotteryConfig.numberGroups.find(
                      (group) => group.key === 'main',
                    );
                    const secondaryGroup = lotteryConfig.numberGroups.find(
                      (group) => group.key !== 'main',
                    );
                    const draw = predDayKey ? drawMap[predDayKey] : undefined;
                    const canTogglePlayed = !draw; // lock played when results exist
                    const isPlayed = Boolean(playedMap[p.id]);

                    const statusText = draw
                      ? 'checked'
                      : isPlayed
                        ? 'played'
                        : p.status;
                    const statusKey = String(statusText ?? '')
                      .toLowerCase()
                      .trim();

                    const hits = countHits(p, draw);
                    const mainHitCount = hits ? hits.main : null;
                    const starHitCount = hits ? hits.stars : null;

                    return (
                      <article
                        key={p.id}
                        style={{
                          background:
                            p.source === 'strategy_mix'
                              ? '#faf7ff'
                              : isPlayed
                                ? '#f8fafc'
                                : '#ffffff',
                          borderRadius: isMobile ? '22px' : '18px',
                          padding: isMobile ? '1rem' : '1rem 1.25rem',
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
                              {lotteryConfig.displayName}
                              {p.source === 'strategy_mix' && (
                                <span
                                  style={{
                                    marginLeft: 8,
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    padding: '2px 7px',
                                    borderRadius: 999,
                                    background: '#f5f3ff',
                                    color: '#6d28d9',
                                    letterSpacing: '0.04em',
                                  }}
                                >
                                  Strategy mix
                                </span>
                              )}
                            </div>

                            <div style={{ fontWeight: 600 }}>
                              {getModelDisplayName(p.model_name)} — draw{' '}
                              {predDayKey
                                ? formatDayLabel(predDayKey)
                                : p.draw_date}
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
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                letterSpacing: '0.02em',
                                textTransform: 'capitalize',
                                padding: '0.2rem 0.6rem',
                                borderRadius: 999,
                                background:
                                  statusKey === 'played'
                                    ? '#eef2ff'
                                    : statusKey === 'won'
                                      ? '#ecfdf3'
                                      : statusKey === 'lost'
                                        ? '#fef2f2'
                                        : statusKey === 'checked'
                                          ? '#f5f3ff'
                                          : '#eff6ff',
                                color:
                                  statusKey === 'played'
                                    ? '#3730a3'
                                    : statusKey === 'won'
                                      ? '#166534'
                                      : statusKey === 'lost'
                                        ? '#991b1b'
                                        : statusKey === 'checked'
                                          ? '#6d28d9'
                                          : '#1d4ed8',
                              }}
                            >
                              {statusText}
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
                                cursor:
                                  deletingId === p.id ? 'default' : 'pointer',
                                padding: '0.1rem 0.4rem',
                              }}
                            >
                              {deletingId === p.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        </div>

                        <div
                          style={{
                            display: isMobile ? 'grid' : 'flex',
                            gridTemplateColumns: isMobile
                              ? 'minmax(0, 1fr) auto'
                              : undefined,
                            flexWrap: isMobile ? undefined : 'wrap',
                            gap: isMobile ? '0.85rem 1rem' : '0.75rem',
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
                              {mainGroup?.label ?? 'Main numbers'}
                              {mainHitCount != null
                                ? ` (hits: ${mainHitCount})`
                                : ''}
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
                              {secondaryGroup?.label ?? 'Stars'}
                              {starHitCount != null
                                ? ` (hits: ${starHitCount})`
                                : ''}
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
                              marginLeft: isMobile ? 0 : 'auto',
                              textAlign: isMobile ? 'left' : 'right',
                              minWidth: isMobile ? 0 : 170,
                              width: isMobile ? '100%' : 'auto',
                              display: 'flex',
                              flexDirection: isMobile ? 'row' : 'column',
                              gap: isMobile ? 12 : 8,
                              alignItems: isMobile ? 'center' : 'flex-end',
                              justifyContent: isMobile
                                ? 'space-between'
                                : undefined,
                              gridColumn: isMobile ? '1 / -1' : undefined,
                            }}
                          >
                            <div
                              style={{
                                textAlign: isMobile ? 'left' : 'right',
                                display: isMobile ? 'flex' : 'block',
                                alignItems: isMobile ? 'baseline' : undefined,
                                gap: isMobile ? 6 : undefined,
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
                                {`${Math.round(Number(p.confidence) || 0)}%`}
                              </div>

                              {(p.matched_main != null ||
                                p.matched_stars != null) && (
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

                              {!isMobile && !draw && (
                                <div
                                  style={{
                                    fontSize: '0.75rem',
                                    color: '#9ca3af',
                                    marginTop: 6,
                                  }}
                                >
                                  (No draw data loaded for{' '}
                                  {predDayKey
                                    ? formatDayLabel(predDayKey)
                                    : p.draw_date}
                                  )
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleTogglePlayed(p.id)}
                              disabled={playingId === p.id || !canTogglePlayed}
                              style={{
                                border: '1px solid rgba(15,23,42,0.12)',
                                background: !canTogglePlayed
                                  ? '#f3f4f6'
                                  : isPlayed
                                    ? '#eef2ff'
                                    : '#ffffff',
                                borderRadius: 999,
                                padding: '0.45rem 0.8rem',
                                fontSize: '0.85rem',
                                cursor:
                                  playingId === p.id
                                    ? 'not-allowed'
                                    : 'pointer',
                                fontWeight: 600,
                                opacity:
                                  playingId === p.id || !canTogglePlayed
                                    ? 0.6
                                    : 1,
                                color: !canTogglePlayed
                                  ? '#9ca3af'
                                  : isPlayed
                                    ? '#3730a3'
                                    : '#0f172a',
                              }}
                              title={
                                !canTogglePlayed
                                  ? 'This draw already has results, so played status is locked.'
                                  : isPlayed
                                    ? 'Click to undo (unmark as played)'
                                    : 'Play this line'
                              }
                            >
                              {!canTogglePlayed
                                ? isPlayed
                                  ? 'Played (locked)'
                                  : 'Locked'
                                : playingId === p.id
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
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
