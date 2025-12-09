// client/src/pages/MakeMagicPage.tsx
import { useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Canonical strategy keys + labels + descriptions.
// These keys must match what the server understands.
const STRATEGIES = [
  {
    value: 'balanced_hot_cold',
    label: 'Balanced hot/cold',
    description: 'Mix of frequently and infrequently drawn numbers.',
  },
  {
    value: 'pure_random',
    label: 'Pure random',
    description: 'Uniform random within valid ranges.',
  },
  {
    value: 'hot_focused',
    label: 'Hot-focused',
    description: 'Leans towards recently frequent numbers.',
  },
  {
    value: 'cold_focused',
    label: 'Cold-focused',
    description: 'Leans towards less frequent / “ignored” numbers.',
  },
  {
    value: 'overdue',
    label: 'Overdue',
    description: 'Prioritises numbers with long gaps.',
  },
];

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export function MakeMagicPage() {
  const [strategy, setStrategy] = useState<string>('balanced_hot_cold');
  const [lines, setLines] = useState<number>(5);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const selectedStrategy = STRATEGIES.find((s) => s.value === strategy)!;

  async function handleGenerate() {
    try {
      setStatus('saving');
      setError(null);

      if (!API_BASE_URL) {
        throw new Error('VITE_API_BASE_URL is not configured');
      }

      const res = await fetch(`${API_BASE_URL}/api/predictions/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lottery: 'Euromillions',
          strategy, // 👈 send canonical key
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
      // tiny auto-reset after a moment
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err: any) {
      console.error('Generate & save failed:', err);
      setStatus('error');
      setError(err?.message ?? 'Failed to generate predictions');
    }
  }

  return (
    <div className="dl-page dl-analysis-page">
      <header className="dl-analysis-header">
        <h1 className="dl-hero-title">Make magic</h1>
        <p className="dl-section-subtitle">
          Generate EuroMillions lines using different strategies, then review
          them on the <strong>My predictions</strong> page.
        </p>
      </header>

      <section className="dl-analysis-config">
        <div className="dl-config-card">
          {/* LOTTERY ROW */}
          <div className="dl-config-row">
            <div className="dl-config-item">
              <div className="dl-config-label">Lottery</div>
              <div className="dl-config-value">EuroMillions</div>
              <div className="dl-config-hint">
                Other lotteries coming later (UK Lotto, Set For Life).
              </div>
            </div>
          </div>

          {/* STRATEGY + LINES ROW */}
          <div className="dl-config-row" style={{ marginTop: '1.5rem' }}>
            {/* Strategy */}
            <div className="dl-config-item">
              <label className="dl-config-label" htmlFor="dl-strategy-select">
                Strategy
              </label>
              <div className="dl-select-shell">
                <select
                  id="dl-strategy-select"
                  className="dl-range-select"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                >
                  {STRATEGIES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="dl-config-hint">
                {selectedStrategy.description}
              </div>
            </div>

            {/* Lines */}
            <div className="dl-config-item dl-config-item--right">
              <label className="dl-config-label" htmlFor="dl-lines-input">
                Number of lines
              </label>
              <input
                id="dl-lines-input"
                className="dl-range-select"
                type="number"
                min={1}
                max={5}
                value={lines}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v)) {
                    setLines(Math.min(Math.max(v, 1), 5));
                  }
                }}
              />
              <div className="dl-config-hint">
                Generate between 1 and 5 lines per request.
              </div>
            </div>
          </div>

          {/* FOOTER ROW: INFO + BUTTON */}
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
                disabled={status === 'saving'}
                style={{
                  borderRadius: 999,
                  border: 'none',
                  padding: '0.6rem 1.4rem',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  cursor: status === 'saving' ? 'default' : 'pointer',
                  background:
                    'linear-gradient(135deg, #804198 0%, #21409a 100%)',
                  color: '#ffffff',
                  opacity: status === 'saving' ? 0.7 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {status === 'saving'
                  ? 'Generating…'
                  : status === 'success'
                    ? 'Saved!'
                    : 'Generate & save'}
              </button>
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
