// client/src/pages/MakeMagicPage.tsx
import { useState } from 'react';

type StrategyId =
  | 'balanced_hot_cold'
  | 'pure_random'
  | 'hot_focused'
  | 'cold_focused'
  | 'overdue';

type StrategyOption = {
  id: StrategyId;
  label: string;
  description: string;
};

const STRATEGY_OPTIONS: StrategyOption[] = [
  {
    id: 'balanced_hot_cold',
    label: 'Balanced hot/cold',
    description: 'Mix of frequently and infrequently drawn numbers.',
  },
  {
    id: 'pure_random',
    label: 'Pure random',
    description: 'Uniform random within valid ranges.',
  },
  {
    id: 'hot_focused',
    label: 'Hot-focused',
    description: 'Leans towards recently frequent numbers.',
  },
  {
    id: 'cold_focused',
    label: 'Cold-focused',
    description: 'Leans towards less frequent / “ignored” numbers.',
  },
  {
    id: 'overdue',
    label: 'Overdue',
    description: 'Prioritises numbers with long gaps.',
  },
];

// 👇 must match client/.env
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

type GeneratorStatus = 'idle' | 'loading' | 'success' | 'error';

export function MakeMagicPage() {
  const [strategyId, setStrategyId] = useState<StrategyId>('balanced_hot_cold');
  const [lines, setLines] = useState<number>(5);
  const [status, setStatus] = useState<GeneratorStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const currentStrategy =
    STRATEGY_OPTIONS.find((s) => s.id === strategyId) ?? STRATEGY_OPTIONS[0];

  async function handleGenerate() {
    try {
      setStatus('loading');
      setError(null);

      if (!API_BASE_URL) {
        throw new Error('VITE_API_BASE_URL is not configured');
      }

      const res = await fetch(`${API_BASE_URL}/api/predictions/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lottery: 'Euromillions',
          strategy: strategyId,
          lines,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `API error (${res.status}): ${text || 'Failed to generate predictions'}`,
        );
      }

      setStatus('success');
      // (Optional: you could toast or link to /predictions here)
    } catch (err: any) {
      console.error('Generate & save failed:', err);
      setStatus('error');
      setError(err?.message ?? 'Failed to generate predictions');
    }
  }

  return (
    <div className="dl-page dl-analysis-page">
      {/* HEADER */}
      <header className="dl-analysis-header">
        <h1 className="dl-hero-title">Make magic</h1>
        <p className="dl-section-subtitle">
          Generate EuroMillions lines using different strategies, then review
          them on the <strong>My predictions</strong> page.
        </p>
      </header>

      {/* CONFIG CARD */}
      <section className="dl-analysis-config">
        <div className="dl-config-card">
          {/* Lottery row */}
          <div className="dl-config-row">
            <div className="dl-config-item">
              <div className="dl-config-label">Lottery</div>
              <div className="dl-config-value">EuroMillions</div>
              <div className="dl-config-hint">
                Other lotteries coming later (UK Lotto, Set For Life).
              </div>
            </div>
          </div>

          {/* Strategy + lines row */}
          <div className="dl-config-row" style={{ marginTop: '1.25rem' }}>
            {/* Strategy */}
            <div className="dl-config-item">
              <label className="dl-config-label" htmlFor="dl-strategy-select">
                Strategy
              </label>
              <select
                id="dl-strategy-select"
                className="dl-range-select"
                value={strategyId}
                onChange={(e) => setStrategyId(e.target.value as StrategyId)}
              >
                {STRATEGY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="dl-config-hint">
                {currentStrategy.description}
              </div>
            </div>

            {/* Number of lines */}
            <div className="dl-config-item dl-config-item--right">
              <label className="dl-config-label" htmlFor="dl-lines-select">
                Number of lines
              </label>
              <select
                id="dl-lines-select"
                className="dl-range-select"
                value={lines}
                onChange={(e) => setLines(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <div className="dl-config-hint">
                Generate between 1 and 5 lines per request.
              </div>
            </div>
          </div>

          {/* Footer / status row */}
          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid rgba(148, 163, 184, 0.25)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <p
              style={{
                fontSize: '0.8rem',
                color: 'var(--dl-text-subtle, #6b7280)',
                margin: 0,
              }}
            >
              Generated lines are stored in your predictions history. You can
              view them later under <strong>My predictions</strong>.
            </p>

            <div style={{ textAlign: 'right' }}>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={status === 'loading'}
                style={{
                  borderRadius: 999,
                  border: 'none',
                  padding: '0.6rem 1.4rem',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  cursor: status === 'loading' ? 'default' : 'pointer',
                  background:
                    'linear-gradient(135deg, #804198 0%, #21409a 100%)',
                  color: '#ffffff',
                  opacity: status === 'loading' ? 0.75 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {status === 'loading' ? 'Generating…' : 'Generate & save'}
              </button>

              {status === 'success' && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: '0.75rem',
                    color: '#16a34a',
                  }}
                >
                  Saved! Check the My predictions page.
                </div>
              )}

              {status === 'error' && error && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: '0.75rem',
                    color: '#b91c1c',
                    maxWidth: 260,
                  }}
                >
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
