// client/src/pages/MakeMagicPage.tsx
import { useEffect, useState } from 'react';
import { apiUrl } from '../api/apiClient';

// Canonical strategy keys + labels + descriptions.
// These keys must match what the server understands.
const STRATEGIES = [
  {
    value: 'balanced_hot_cold',
    label: 'Balanced hot/cold',
    description: 'Mix of frequently and infrequently drawn numbers.',
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
  {
    value: 'pure_random',
    label: 'Pure random',
    description: 'Uniform random within valid ranges.',
  },
];

const STRATEGY_COLORS: Record<string, string> = {
  balanced_hot_cold: '#7C3AED',
  overdue: '#F97316',
  hot_focused: '#EF4444',
  cold_focused: '#2563EB',
  pure_random: '#22C55E',
};

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export function MakeMagicPage() {
  const [strategy, setStrategy] = useState<string>('balanced_hot_cold');
  const [lines, setLines] = useState<number>(5);
  const [strategyLines, setStrategyLines] = useState<Record<string, number>>({
    balanced_hot_cold: 1,
    overdue: 1,
    hot_focused: 1,
    cold_focused: 1,
    pure_random: 1,
  });
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [multiStatus, setMultiStatus] = useState<SaveStatus>('idle');
  const [hasSuggestedMix, setHasSuggestedMix] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStrategy = STRATEGIES.find((s) => s.value === strategy)!;
  useEffect(() => {
    try {
      const raw = localStorage.getItem('drawlytics_suggested_strategy_mix');
      setHasSuggestedMix(Boolean(raw));
    } catch {
      setHasSuggestedMix(false);
    }
  }, []);

  function applySuggestedMix() {
    try {
      const raw = localStorage.getItem('drawlytics_suggested_strategy_mix');
      if (!raw) return;

      const mix = JSON.parse(raw) as { model_key: string; weight: number }[];

      const next: Record<string, number> = {
        balanced_hot_cold: 0,
        overdue: 0,
        hot_focused: 0,
        cold_focused: 0,
        pure_random: 0,
      };

      for (const item of mix) {
        next[item.model_key] = Math.round(item.weight * 5);
      }

      setStrategyLines(next);
    } catch {
      setError('Could not apply suggested mix.');
    }
  }

  async function handleGenerate(
    selectedStrategyValue = strategy,
    selectedLineCount = lines,
  ) {
    try {
      setStatus('saving');
      setError(null);

      // IMPORTANT:
      // - In dev: apiUrl('/api/...') stays relative, so Vite proxy handles it (no CORS).
      // - In prod: apiUrl can prepend a base if you ever choose to.
      const res = await fetch(apiUrl('/api/predictions/generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lottery: 'Euromillions',
          strategy: selectedStrategyValue,
          lines: selectedLineCount,
        }),
      });

      if (!res.ok) {
        const text = await res.text();

        let msg = text;
        try {
          const j = JSON.parse(text);
          msg = j?.message || j?.error || text;
        } catch {
          // not JSON, keep text
        }

        throw new Error(
          msg || 'Something went wrong while generating predictions.',
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

  async function handleGenerateAll() {
    try {
      setMultiStatus('saving');
      setError(null);

      const entries = Object.entries(strategyLines).filter(
        ([_, count]) => count > 0,
      );

      if (entries.length === 0) {
        setMultiStatus('error');
        setError('Set at least one strategy to 1 or more lines.');
        return;
      }

      for (const [strategyKey, count] of entries) {
        const res = await fetch(apiUrl('/api/predictions/generate'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lottery: 'Euromillions',
            strategy: strategyKey,
            lines: count,
            source: 'strategy_mix',
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Failed on one of the strategies');
        }
      }

      setMultiStatus('success');
      setTimeout(() => setMultiStatus('idle'), 2000);
    } catch (err: any) {
      console.error('Multi generate failed:', err);
      setMultiStatus('error');
      setError(err?.message ?? 'Failed to generate multi-strategy predictions');
    }
  }

  return (
    <div className="dl-page dl-analysis-page">
      <header className="dl-analysis-header">
        <h1 className="dl-hero-title">Strategy Builder</h1>
        <p className="dl-section-subtitle">
          Build and test combinations of strategies, then save them to your{' '}
          <strong>My predictions</strong> page.
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
            <div className="dl-config-item" style={{ width: '100%' }}>
              <div className="dl-config-label">Strategy</div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  width: '100%',
                }}
              >
                {STRATEGIES.map((s) => (
                  <div
                    key={s.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '14px 14px',
                      borderRadius: 10,
                      border: '1px solid #e5e7eb',
                      borderLeft: `4px solid ${STRATEGY_COLORS[s.value]}`,
                      overflow: 'hidden',
                      background: '#fafafa',
                    }}
                  >
                    {/* LEFT: name + description */}
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 14,
                          color: '#111827',
                        }}
                      >
                        {s.label}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {s.description}
                      </div>
                    </div>

                    {/* RIGHT: lines + save */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexShrink: 0,
                      }}
                    >
                      <input
                        type="number"
                        min={0}
                        max={5}
                        value={strategyLines[s.value]}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isNaN(v)) {
                            setStrategyLines((prev) => ({
                              ...prev,
                              [s.value]: Math.min(Math.max(v, 0), 5),
                            }));
                          }
                        }}
                        style={{
                          width: 50,
                          padding: '4px 6px',
                          borderRadius: 6,
                          border: '1px solid #e5e7eb',
                        }}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          handleGenerate(s.value, strategyLines[s.value])
                        }
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          background: '#111827',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ))}
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

            {hasSuggestedMix && (
              <button
                type="button"
                onClick={applySuggestedMix}
                style={{
                  borderRadius: 999,
                  border: '1px solid #e5e7eb',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  background: '#fff',
                  cursor: 'pointer',
                  marginRight: 8,
                }}
              >
                Apply suggested mix
              </button>
            )}

            <button
              type="button"
              onClick={handleGenerateAll}
              disabled={multiStatus === 'saving'}
              style={{
                borderRadius: 999,
                border: 'none',
                padding: '0.6rem 1.2rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: multiStatus === 'saving' ? 'default' : 'pointer',
                background: 'linear-gradient(135deg, #804198 0%, #21409a 100%)',
                color: '#ffffff',
                opacity: multiStatus === 'saving' ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {multiStatus === 'saving'
                ? 'Generating…'
                : multiStatus === 'success'
                  ? 'Saved!'
                  : 'Generate strategy mix'}
            </button>

            {multiStatus === 'error' && error && (
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: '0.85rem',
                  maxWidth: 420,
                  lineHeight: 1.4,
                }}
              >
                {error}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
