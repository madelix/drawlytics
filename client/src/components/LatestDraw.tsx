// client/src/components/LatestDraw.tsx
import { useEffect, useState } from 'react';
import { apiUrl } from '../api/apiClient';

type DrawRow = {
  id: number;
  draw_date: string;
  n1: number;
  n2: number;
  n3: number;
  n4: number;
  n5: number;
  s1: number;
  s2: number;
};

type LatestDrawResponse = {
  ok: boolean;
  draw: DrawRow | null;
  error?: string;
};

export default function LatestDraw() {
  const [draw, setDraw] = useState<DrawRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(apiUrl('/api/draws/latest'));
        const text = await res.text();

        if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

        const data = text ? (JSON.parse(text) as LatestDrawResponse) : null;
        const latest = data?.draw ?? null;

        if (!cancelled) setDraw(latest);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load latest draw');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div>Loading latest draw…</div>;
  if (error)
    return <div style={{ color: 'red' }}>Latest draw error: {error}</div>;
  if (!draw) return <div>No draw found.</div>;

  const mains = [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5].filter(
    (n) => typeof n === 'number',
  );
  const stars = [draw.s1, draw.s2].filter((n) => typeof n === 'number');

  return (
    <div className="dl-latest-draw">
      <div style={{ fontWeight: 600, marginBottom: 6 }}>
        Latest draw: {new Date(draw.draw_date).toISOString().slice(0, 10)}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
            Main
          </div>
          <div>
            {mains.map((n) => (
              <span key={`m-${n}`} className="dl-draw-pill dl-draw-pill--main">
                {n}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
            Stars
          </div>
          <div>
            {stars.map((n) => (
              <span key={`s-${n}`} className="dl-draw-pill dl-draw-pill--star">
                {n}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
