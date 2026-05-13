// client/src/pages/MakeMagicPage.tsx
import { useEffect, useState } from 'react';
import { apiUrl } from '../api/apiClient';
import { LOTTERIES, getLotteryConfig, LotteryKey } from '../config/lotteries';

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
    value: 'ai:xgboost',
    label: 'AI XGBoost',
    description: 'AI-style boosted model for pattern-weighted predictions.',
  },
  {
    value: 'ai:ensemble',
    label: 'AI Ensemble',
    description: 'Combines multiple AI-style model signals into one line.',
  },
  {
    value: 'ai:random_forest',
    label: 'AI Random Forest',
    description: 'Tree-based AI-style model using repeated pattern sampling.',
  },
  {
    value: 'ai:gradient_boosting',
    label: 'AI Gradient Boosting',
    description: 'Boosted AI-style model focused on stronger weighted signals.',
  },
  {
    value: 'ai:statistical_analysis',
    label: 'AI Statistical Analysis',
    description: 'AI-assisted statistical weighting using historical patterns.',
  },
  {
    value: 'ai:decision_tree',
    label: 'AI Decision Tree',
    description: 'Rule-based AI-style model using branching pattern logic.',
  },
  {
    value: 'ai:q_learning',
    label: 'AI Q-Learning',
    description:
      'Reinforcement-style model for testing reward-based selection.',
  },
  {
    value: 'ai:neural_network',
    label: 'AI Neural Network',
    description:
      'Neural-style weighted pattern model trained on historical draws.',
  },
  {
    value: 'ai:lstm',
    label: 'AI LSTM',
    description:
      'Sequence-focused AI model attempting temporal draw pattern learning.',
  },
  {
    value: 'ai:markov_chain',
    label: 'AI Markov Chain',
    description:
      'Transition-based model using historical sequence probabilities.',
  },
  {
    value: 'ai:bayesian',
    label: 'AI Bayesian',
    description:
      'Probability-driven AI model updating likelihoods from past outcomes.',
  },
  {
    value: 'ai:meta_learning',
    label: 'AI Meta Learning',
    description:
      'Adaptive AI model designed to learn which strategies perform best over time.',
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
  'ai:xgboost': '#06B6D4',
  'ai:ensemble': '#14B8A6',
  'ai:random_forest': '#0EA5E9',
  'ai:gradient_boosting': '#8B5CF6',
  'ai:statistical_analysis': '#6366F1',
  'ai:decision_tree': '#10B981',
  'ai:q_learning': '#EC4899',
  'ai:neural_network': '#7C3AED',
  'ai:lstm': '#2563EB',
  'ai:markov_chain': '#84CC16',
  'ai:bayesian': '#F59E0B',
  'ai:meta_learning': '#A855F7',
  pure_random: '#22C55E',
};

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export function MakeMagicPage() {
  const [selectedLottery, setSelectedLottery] =
    useState<LotteryKey>('euromillions');

  const lotteryConfig = getLotteryConfig(selectedLottery);
  const [strategy, setStrategy] = useState<string>('balanced_hot_cold');
  const [lines, setLines] = useState<number>(5);
  const [strategyLines, setStrategyLines] = useState<Record<string, number>>({
    balanced_hot_cold: 1,
    overdue: 1,
    hot_focused: 1,
    cold_focused: 1,
    'ai:xgboost': 1,
    'ai:ensemble': 1,
    'ai:random_forest': 1,
    'ai:gradient_boosting': 1,
    'ai:statistical_analysis': 1,
    'ai:decision_tree': 1,
    'ai:q_learning': 1,
    'ai:neural_network': 1,
    'ai:lstm': 1,
    'ai:markov_chain': 1,
    'ai:bayesian': 1,
    'ai:meta_learning': 1,
    pure_random: 1,
  });
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [generatingStrategy, setGeneratingStrategy] = useState<string | null>(
    null,
  );
  const [multiStatus, setMultiStatus] = useState<SaveStatus>('idle');
  const [allAiStatus, setAllAiStatus] = useState<SaveStatus>('idle');
  const [hasSuggestedMix, setHasSuggestedMix] = useState(false);
  const [isMobileFooter, setIsMobileFooter] = useState(false);
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

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 640px)');

    const updateFooterLayout = () => {
      setIsMobileFooter(mediaQuery.matches);
    };

    updateFooterLayout();
    mediaQuery.addEventListener('change', updateFooterLayout);

    return () => {
      mediaQuery.removeEventListener('change', updateFooterLayout);
    };
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
        'ai:xgboost': 0,
        'ai:ensemble': 0,
        'ai:random_forest': 0,
        'ai:gradient_boosting': 0,
        'ai:statistical_analysis': 0,
        'ai:decision_tree': 0,
        'ai:q_learning': 0,
        'ai:neural_network': 0,
        'ai:lstm': 0,
        'ai:markov_chain': 0,
        'ai:bayesian': 0,
        'ai:meta_learning': 0,
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
      setGeneratingStrategy(selectedStrategyValue);

      // IMPORTANT:
      // - In dev: apiUrl('/api/...') stays relative, so Vite proxy handles it (no CORS).
      // - In prod: apiUrl can prepend a base if you ever choose to.
      console.log('Generating prediction:', {
        lottery: selectedLottery,
        strategy: selectedStrategyValue,
        lines: selectedLineCount,
      });

      const res = await fetch(apiUrl('/api/predictions/generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lottery: selectedLottery,
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
      setStatus('idle');
      setGeneratingStrategy(null);
    } catch (err: any) {
      console.error('Generate & save failed:', err);
      setStatus('error');
      setGeneratingStrategy(null);
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
            lottery: selectedLottery,
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
  async function handleGenerateAllAiModels() {
    try {
      setAllAiStatus('saving');
      setError(null);

      const aiStrategies = STRATEGIES.filter((s) => s.value.startsWith('ai:'));

      for (const s of aiStrategies) {
        const res = await fetch(apiUrl('/api/predictions/generate'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lottery: selectedLottery,
            strategy: s.value,
            lines: 1,
            source: 'ai_lab',
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Failed to generate ${s.label}`);
        }
      }

      setAllAiStatus('success');
      setTimeout(() => setAllAiStatus('idle'), 2000);
    } catch (err: any) {
      console.error('Generate all AI models failed:', err);
      setAllAiStatus('error');
      setError(err?.message ?? 'Failed to generate all AI models');
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

              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  marginTop: '0.35rem',
                }}
              >
                {LOTTERIES.map((lottery) => {
                  const active = selectedLottery === lottery.key;

                  return (
                    <button
                      key={lottery.key}
                      type="button"
                      onClick={() => setSelectedLottery(lottery.key)}
                      style={{
                        borderRadius: 8,
                        border: active
                          ? '1px solid #111827'
                          : '1px solid rgba(148, 163, 184, 0.35)',
                        padding: '0.45rem 0.9rem',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                        background: active ? '#111827' : '#ffffff',
                        color: active ? '#ffffff' : '#334155',
                        boxShadow: active
                          ? '0 4px 10px rgba(15, 23, 42, 0.18)'
                          : 'none',
                      }}
                    >
                      {lottery.label}
                    </button>
                  );
                })}
              </div>

              <div className="dl-config-hint" style={{ marginTop: '0.5rem' }}>
                Strategy generation adapts to the selected lottery format.
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
                        disabled={generatingStrategy === s.value}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          background: '#111827',
                          color: '#fff',
                          border: 'none',
                          cursor:
                            generatingStrategy === s.value
                              ? 'default'
                              : 'pointer',
                          opacity: generatingStrategy === s.value ? 0.7 : 1,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {generatingStrategy === s.value
                          ? 'Generating…'
                          : 'Generate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FOOTER ROW: INFO + ACTIONS */}
          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '0.9rem',
              borderTop: '1px solid rgba(148, 163, 184, 0.25)',
              display: 'grid',
              gridTemplateColumns: isMobileFooter ? '1fr' : '1fr auto',
              alignItems: isMobileFooter ? 'stretch' : 'center',
              gap: isMobileFooter ? '0.9rem' : '1rem',
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

            <div
              style={{
                display: 'flex',
                gap: isMobileFooter ? 8 : 12,
                alignItems: 'center',
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: isMobileFooter ? 'center' : 'flex-end',
              }}
            >
              {hasSuggestedMix && (
                <button
                  type="button"
                  onClick={applySuggestedMix}
                  style={{
                    borderRadius: 14,
                    border: '1px solid #e5e7eb',
                    padding: '0.6rem 1rem',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    background: '#fff',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Apply strategy mix
                </button>
              )}

              <button
                type="button"
                onClick={handleGenerateAll}
                disabled={multiStatus === 'saving'}
                style={{
                  borderRadius: 14,
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: multiStatus === 'saving' ? 'default' : 'pointer',
                  background:
                    'linear-gradient(135deg, #804198 0%, #21409a 100%)',
                  color: '#ffffff',
                  opacity: multiStatus === 'saving' ? 0.7 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {multiStatus === 'saving'
                  ? 'Generating…'
                  : multiStatus === 'success'
                    ? 'Saved!'
                    : 'Generate predictions'}
              </button>

              <button
                type="button"
                onClick={handleGenerateAllAiModels}
                disabled={allAiStatus === 'saving'}
                style={{
                  borderRadius: 14,
                  border: '1px solid #e5e7eb',
                  padding: '0.6rem 1rem',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: allAiStatus === 'saving' ? 'default' : 'pointer',
                  background: '#ffffff',
                  color: '#111827',
                  opacity: allAiStatus === 'saving' ? 0.7 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {allAiStatus === 'saving'
                  ? 'Running AI lab…'
                  : allAiStatus === 'success'
                    ? 'AI lab saved!'
                    : 'Run AI lab'}
              </button>
            </div>

            {multiStatus === 'error' && error && (
              <div
                style={{
                  gridColumn: '1 / -1',
                  marginTop: 4,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: '0.85rem',
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
