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
  const visibleModels = showAll ? models : leaders;

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
        id="played-model-breakdown"
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gap: 12,
        }}
      >
        {visibleModels.map((model) => {
          const share = (model.count / total) * 100;

          return (
            <li key={model.key}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '2px 12px',
                }}
              >
                <strong>
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: model.colour,
                      marginRight: 8,
                    }}
                  />
                  {model.name}
                </strong>
                <small>
                  {model.count} of {total} {total === 1 ? 'line' : 'lines'}
                  {' · '}
                  {Number(share.toFixed(1))}%
                </small>
              </div>

              <div
                aria-hidden="true"
                style={{
                  height: 6,
                  marginTop: 5,
                  borderRadius: 999,
                  background: '#eef2f7',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${share}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: model.colour,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {models.length > leaders.length && (
        <button
          type="button"
          className="dl-pagination-btn"
          aria-expanded={showAll}
          aria-controls="played-model-breakdown"
          onClick={() => setShowAll((current) => !current)}
          style={{ marginTop: 14 }}
        >
          {showAll ? 'Show fewer models' : 'Show all models'}
        </button>
      )}
    </section>
  );
}
