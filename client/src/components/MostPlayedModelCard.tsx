import type { getPlayedLinesPage } from '../api/dashboard';
import { getModelDisplayName, normalizeModelKey } from '../utils/modelDisplay';

type PlayedPage = Awaited<ReturnType<typeof getPlayedLinesPage>>;

export function MostPlayedModelCard({ page }: { page: PlayedPage }) {
  const counts = new Map<string, number>();

  for (const row of page.played_model_counts ?? []) {
    const key = normalizeModelKey(row.model_name, row.source);
    counts.set(key, (counts.get(key) ?? 0) + row.played_count);
  }

  if (counts.size === 0) return null;

  const highestCount = Math.max(...counts.values());
  const leaders = [...counts.entries()]
    .filter(([, count]) => count === highestCount)
    .map(([key]) => getModelDisplayName(key))
    .sort((a, b) => a.localeCompare(b));

  const tied = leaders.length > 1;
  const total = page.pagination.total;

  return (
    <section
      className="dl-config-card"
      aria-labelledby="most-played-heading"
      style={{ marginTop: 16, padding: '1.25rem', textAlign: 'left' }}
    >
      <h2 id="most-played-heading" style={{ margin: '0 0 10px' }}>
        {tied ? 'Your most-played models' : 'Your most-played model'}
      </h2>

      <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
        {leaders.join(' · ')}
      </p>

      <p style={{ margin: '4px 0 0', color: '#4b5563' }}>
        {tied ? 'Each played' : 'Played'} on {highestCount} of your {total}{' '}
        {total === 1 ? 'line' : 'lines'}.
      </p>
    </section>
  );
}
