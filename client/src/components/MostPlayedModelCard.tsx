import { useState } from 'react';
import type { getPlayedLinesPage } from '../api/dashboard';
import { getModelColour } from '../config/modelPresentation';
import { getModelDisplayName, normalizeModelKey } from '../utils/modelDisplay';

type PlayedPage = Awaited<ReturnType<typeof getPlayedLinesPage>>;

export function MostPlayedModelCard({ page }: { page: PlayedPage }) {
  const [showAll, setShowAll] = useState(false);
  const counts = new Map<string, number>();

  for (const row of page.played_model_counts ?? []) {
    const key = normalizeModelKey(row.model_name, row.source);
    counts.set(key, (counts.get(key) ?? 0) + row.played_count);
  }

  const total = page.pagination.total;
  if (counts.size === 0 || total === 0) return null;

  const models = Array.from(counts, ([key, count]) => ({
    key,
    count,
    name: getModelDisplayName(key),
    colour: getModelColour(key),
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const leaders = models.filter((model) => model.count === models[0].count);
  return (
    <section
      className="dl-config-card"
      aria-labelledby="most-played-heading"
      style={{ marginTop: 16, padding: '1.25rem', textAlign: 'left' }}
    >
      <h2 id="most-played-heading" style={{ margin: '0 0 14px' }}>
        {leaders.length > 1
          ? 'Your most-played models'
          : 'Your most-played model'}
      </h2>

      <ul
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
          gap: 12,
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
      >
        {leaders.map((model) => (
          <li
            key={model.key}
            style={{
              padding: '14px 16px',
              border: '1px solid #e5e7eb',
              borderRadius: 14,
              background: '#fff',
            }}
          >
            <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  flexShrink: 0,
                  borderRadius: '50%',
                  background: model.colour,
                }}
              />
              {model.name}
            </strong>

            <div
              style={{
                marginTop: 10,
                fontSize: '1.65rem',
                fontWeight: 750,
                lineHeight: 1.15,
              }}
            >
              {model.count} {model.count === 1 ? 'line' : 'lines'}
            </div>

            <small style={{ display: 'block', marginTop: 4, color: '#4b5563' }}>
              {Number(((model.count / total) * 100).toFixed(1))}% of your played
              lines
            </small>
          </li>
        ))}
      </ul>

      {models.length > leaders.length && (
        <>
          <button
            type="button"
            aria-expanded={showAll}
            aria-controls="played-model-breakdown"
            onClick={() => setShowAll((current) => !current)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 8,
              padding: '8px 0',
              background: 'transparent',
              border: 0,
              color: '#21409a',
              font: 'inherit',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showAll ? 'Hide breakdown' : `View all ${models.length} models`}
            <span aria-hidden="true">{showAll ? '▴' : '▾'}</span>
          </button>

          <div id="played-model-breakdown" hidden={!showAll}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {models.map((model) => {
                const share = (model.count / total) * 100;

                return (
                  <li key={model.key} style={{ padding: '7px 0' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '2px 12px',
                      }}
                    >
                      <strong>{model.name}</strong>
                      <small>
                        {model.count} {model.count === 1 ? 'line' : 'lines'}
                        {' · '}
                        {Number(share.toFixed(1))}%
                      </small>
                    </div>

                    <div
                      aria-hidden="true"
                      style={{
                        height: 6,
                        marginTop: 5,
                        background: '#eef2f7',
                        borderRadius: 999,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${share}%`,
                          height: '100%',
                          background: model.colour,
                          borderRadius: 999,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
