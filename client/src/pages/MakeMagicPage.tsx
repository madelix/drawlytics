// client/src/pages/MakeMagicPage.tsx
import { useEffect, useState } from 'react';
import { apiSendJson, apiUrl } from '../api/apiClient';
import { LOTTERIES, getLotteryConfig, LotteryKey } from '../config/lotteries';
import { LotterySelector } from '../components/LotterySelector';
import { getModelColour } from '../config/modelPresentation';

// Strategy Builder models are loaded from the canonical backend registry.
// This list only controls which registered models the generator currently supports.
type RegistryModel = {
  model_key: string;
  display_name: string;
  category: string;
  implementation_type: string;
  learning_status: string;
  version: string;
  status: string;
  summary: string;
};

type StrategyOption = RegistryModel & {
  value: string;
  label: string;
  description: string;
};

const STRATEGY_MODEL_KEYS = [
  'balanced_hot_cold',
  'hot_focused',
  'cold_focused',
  'overdue',
  'ai_xgboost',
  'ai_ensemble',
  'ai_random_forest',
  'ai_gradient_boosting',
  'ai_statistical_analysis',
  'ai_decision_tree',
  'ai_q_learning',
  'ai_neural_network',
  'ai_lstm',
  'ai_markov_chain',
  'ai_bayesian',
  'ai_meta_learning',
  'pure_random',
] as const;

function toGeneratorStrategyKey(modelKey: string): string {
  return modelKey.startsWith('ai_') ? `ai:${modelKey.slice(3)}` : modelKey;
}

function normalizeStrategyMixKey(modelKey: string): string {
  if (modelKey.startsWith('ai_')) {
    return `ai:${modelKey.slice(3)}`;
  }

  return modelKey;
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export function MakeMagicPage() {
  const [selectedLottery, setSelectedLottery] = useState<LotteryKey>(() => {
    const params = new URLSearchParams(window.location.search);
    const lottery = params.get('lottery');

    if (lottery === 'uk_lotto') return 'uk_lotto';
    if (lottery === 'set_for_life') return 'set_for_life';

    return 'euromillions';
  });

  const [registryModels, setRegistryModels] = useState<RegistryModel[]>([]);

  const [registryLoading, setRegistryLoading] = useState(true);

  const lotteryConfig = getLotteryConfig(selectedLottery);
  const strategies: StrategyOption[] = registryModels
    .filter((model) =>
      STRATEGY_MODEL_KEYS.includes(
        model.model_key as (typeof STRATEGY_MODEL_KEYS)[number],
      ),
    )
    .map((model) => ({
      ...model,
      value: toGeneratorStrategyKey(model.model_key),
      label: model.display_name,
      description: model.summary,
    }));
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
  const [hasAppliedSuggestedMix, setHasAppliedSuggestedMix] = useState(false);
  const [isMobileFooter, setIsMobileFooter] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadModelRegistry() {
      try {
        const response = await fetch('/api/performance/model-registry');

        if (!response.ok) {
          throw new Error('Failed to load model registry');
        }

        const data = await response.json();

        if (!cancelled) {
          setRegistryModels(data.models ?? []);
        }
      } catch (error) {
        console.error('Could not load model registry:', error);

        if (!cancelled) {
          setError('Could not load the available prediction strategies.');
        }
      } finally {
        if (!cancelled) {
          setRegistryLoading(false);
        }
      }
    }

    void loadModelRegistry();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(
        `drawlytics_suggested_strategy_mix_${selectedLottery}`,
      );
      setHasSuggestedMix(Boolean(raw));
    } catch {
      setHasSuggestedMix(false);
    }
  }, [selectedLottery]);

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
      const raw = localStorage.getItem(
        `drawlytics_suggested_strategy_mix_${selectedLottery}`,
      );
      if (!raw) return;

      const mix = JSON.parse(raw) as {
        model_key?: string;
        key?: string;
        weight: number;
      }[];

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
        const rawKey = item.model_key ?? item.key;
        if (!rawKey) continue;

        const normalizedKey = normalizeStrategyMixKey(rawKey);

        if (normalizedKey in next) {
          next[normalizedKey] = Math.max(1, Math.round(item.weight * 5));
        }
      }

      setStrategyLines(next);
      setHasAppliedSuggestedMix(true);
    } catch {
      setError('Could not apply suggested mix.');
    }
  }

  function resetToDefaultMix() {
    setStrategyLines({
      balanced_hot_cold: 1,
      overdue: 1,
      hot_focused: 1,
      cold_focused: 1,
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
      pure_random: 1,
    });
    setHasAppliedSuggestedMix(false);
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

      await apiSendJson('/api/predictions/generate', {
        method: 'POST',
        body: {
          lottery: selectedLottery,
          strategy: selectedStrategyValue,
          lines: selectedLineCount,
        },
      });

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
        await apiSendJson('/api/predictions/generate', {
          method: 'POST',
          body: {
            lottery: selectedLottery,
            strategy: strategyKey,
            lines: count,
            source: hasAppliedSuggestedMix
              ? 'strategy_mix'
              : 'strategy_builder',
          },
        });
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

      const aiStrategies = strategies.filter((s) => s.value.startsWith('ai:'));

      for (const s of aiStrategies) {
        await apiSendJson('/api/predictions/generate', {
          method: 'POST',
          body: {
            lottery: selectedLottery,
            strategy: s.value,
            lines: 1,
            source: 'ai_lab',
          },
        });
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
                <LotterySelector
                  selectedLottery={selectedLottery}
                  onChange={setSelectedLottery}
                />
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
                {registryLoading ? (
                  <div
                    style={{
                      padding: 24,
                      textAlign: 'center',
                      color: '#6b7280',
                      fontSize: 14,
                    }}
                  >
                    Loading available strategies...
                  </div>
                ) : (
                  strategies.map((s) => (
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
                        borderLeft: `4px solid ${getModelColour(s.value)}`,
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
                  ))
                )}
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
              <button
                type="button"
                onClick={applySuggestedMix}
                disabled={!hasSuggestedMix}
                style={{
                  borderRadius: 14,
                  border: '1px solid #e5e7eb',
                  padding: '0.6rem 1rem',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  background: '#fff',
                  cursor: hasSuggestedMix ? 'pointer' : 'not-allowed',
                  opacity: hasSuggestedMix ? 1 : 0.5,
                  whiteSpace: 'nowrap',
                }}
              >
                Apply strategy mix
              </button>

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
