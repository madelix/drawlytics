import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Brain,
  CircleAlert,
  CircleCheck,
  FlaskConical,
  Layers3,
} from 'lucide-react';
import { LotterySelector } from '../components/LotterySelector';
import type { LotteryKey } from '../config/lotteries';

type ModelProfile = {
  model_key: string;
  display_name: string;
  category: string;
  implementation_type: string;
  learning_status: string;
  version: string;
  status: string;
  summary: string;
  purpose: string;
  how_it_works: string;
  strengths: string[];
  limitations: string[];
};

type ModelPerformance = {
  rank: number;
  models_analysed: number;
  avg_total_hits: number;
  checked_predictions: number;
  pure_random_avg_hits: number | null;
  difference: number | null;
  percentage_difference: number | null;
  beats_pure_random: boolean | null;
  evidence: {
    score: number;
    level: string;
    status: 'provisional' | 'validated';
    components: {
      sample_size: number;
      performance_gap: number;
      bootstrap_support: number;
    };
    bootstrap: {
      status: 'calculated' | 'insufficient_data';
      iterations: number;
      confidence: number | null;
      observed_difference: number | null;
      confidence_interval: {
        low: number | null;
        high: number | null;
      };
      interpretation?: {
        level: 'insufficient' | 'strong';
        title: string;
        explanation: string;
      };
    };
  };
};

export default function ModelProfilePage() {
  const { modelKey } = useParams();
  const [lottery, setLottery] = useState<LotteryKey>('euromillions');
  const [model, setModel] = useState<ModelProfile | null>(null);
  const [performance, setPerformance] = useState<ModelPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!modelKey) {
      setError(true);
      setLoading(false);
      return;
    }

    Promise.all([
      fetch(`/api/performance/model-registry/${modelKey}`),
      fetch(
        `/api/performance/model-registry/${modelKey}/performance?lottery=${lottery}`,
      ),
    ])
      .then(async ([profileResponse, performanceResponse]) => {
        if (!profileResponse.ok) {
          throw new Error('Model not found');
        }

        const profileData = await profileResponse.json();

        const performanceData = performanceResponse.ok
          ? await performanceResponse.json()
          : null;

        setModel(profileData.model ?? null);
        setPerformance(performanceData?.performance ?? null);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [modelKey, lottery]);

  if (loading) {
    return (
      <main style={{ maxWidth: 980, margin: '0 auto', padding: 24 }}>
        Loading model profile…
      </main>
    );
  }

  if (error || !model) {
    return (
      <main style={{ maxWidth: 980, margin: '0 auto', padding: 24 }}>
        <h1>Model not found</h1>
        <p style={{ color: '#6b7280' }}>This model profile is not available.</p>
      </main>
    );
  }

  const isLearning = model.learning_status !== 'not_learning';

  return (
    <main
      style={{
        maxWidth: 980,
        margin: '0 auto',
        padding: '24px',
      }}
    >
      <section
        style={{
          background: '#fff',
          border: '1px solid #eef2f7',
          borderRadius: 18,
          padding: 24,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                color: '#804198',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {model.category}
            </div>

            <h1
              style={{
                fontSize: 38,
                lineHeight: 1.1,
                fontWeight: 900,
                margin: '8px 0 10px',
              }}
            >
              {model.display_name}
            </h1>

            <p
              style={{
                maxWidth: 680,
                color: '#4b5563',
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              {model.summary}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span className="pill-chip">{model.status}</span>
            <span className="pill-chip">v{model.version}</span>
          </div>
        </div>
        <div style={{ marginTop: 24 }}>
          <LotterySelector selectedLottery={lottery} onChange={setLottery} />
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 14,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            background: '#fff',
            border: '1px solid #eef2f7',
            borderRadius: 16,
            padding: 18,
          }}
        >
          <Layers3 size={20} color="#804198" />

          <div
            style={{
              fontSize: 11,
              color: '#6b7280',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginTop: 14,
            }}
          >
            Implementation
          </div>

          <div
            style={{
              fontSize: 20,
              fontWeight: 900,
              marginTop: 5,
            }}
          >
            {model.implementation_type.replace(/_/g, ' ')}
          </div>
        </div>

        <div
          style={{
            background: isLearning ? '#f0fdf4' : '#fffbeb',
            border: isLearning ? '1px solid #bbf7d0' : '1px solid #fde68a',
            borderRadius: 16,
            padding: 18,
          }}
        >
          <Brain size={20} color={isLearning ? '#16a34a' : '#b45309'} />

          <div
            style={{
              fontSize: 11,
              color: '#6b7280',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginTop: 14,
            }}
          >
            Learning status
          </div>

          <div
            style={{
              fontSize: 20,
              fontWeight: 900,
              marginTop: 5,
            }}
          >
            {model.learning_status.replace(/_/g, ' ')}
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #eef2f7',
            borderRadius: 16,
            padding: 18,
          }}
        >
          <FlaskConical size={20} color="#804198" />

          <div
            style={{
              fontSize: 11,
              color: '#6b7280',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginTop: 14,
            }}
          >
            Model status
          </div>

          <div
            style={{
              fontSize: 20,
              fontWeight: 900,
              marginTop: 5,
            }}
          >
            {model.status}
          </div>
        </div>
      </section>

      {performance && (
        <section
          style={{
            background: '#fff',
            border: '1px solid #eef2f7',
            borderRadius: 16,
            padding: 22,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontWeight: 900,
              fontSize: 20,
              marginBottom: 16,
            }}
          >
            Live performance
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 14,
            }}
          >
            <div
              style={{
                border: '1px solid #eef2f7',
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#6b7280',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Current rank
              </div>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  marginTop: 6,
                }}
              >
                #{performance.rank}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  marginTop: 6,
                }}
              >
                Out of {performance.models_analysed} models
              </div>
            </div>

            <div
              style={{
                border: '1px solid #eef2f7',
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#6b7280',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Average hits
              </div>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  marginTop: 6,
                }}
              >
                {performance.avg_total_hits.toFixed(2)}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  marginTop: 6,
                }}
              >
                Per checked prediction
              </div>
            </div>

            <div
              style={{
                border: '1px solid #eef2f7',
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#6b7280',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Checked predictions
              </div>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  marginTop: 6,
                }}
              >
                {performance.checked_predictions}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  marginTop: 6,
                }}
              >
                Evaluated against real results
              </div>
            </div>

            <div
              style={{
                border:
                  performance.beats_pure_random === true
                    ? '1px solid #bbf7d0'
                    : '1px solid #fde68a',
                borderRadius: 14,
                padding: 18,
                background:
                  performance.beats_pure_random === true
                    ? '#f0fdf4'
                    : '#fffbeb',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color:
                    performance.beats_pure_random === true
                      ? '#166534'
                      : '#92400e',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Vs Pure Random
              </div>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  marginTop: 6,
                  color:
                    performance.beats_pure_random === true
                      ? '#16a34a'
                      : '#b45309',
                }}
              >
                {performance.percentage_difference !== null
                  ? `${performance.percentage_difference >= 0 ? '+' : ''}${performance.percentage_difference.toFixed(1)}%`
                  : '—'}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color:
                    performance.beats_pure_random === true
                      ? '#166534'
                      : '#92400e',
                  marginTop: 6,
                }}
              >
                {performance.beats_pure_random === true
                  ? 'Currently ahead of baseline'
                  : 'Not currently ahead of baseline'}
              </div>
            </div>
          </div>
        </section>
      )}

      {performance?.evidence && (
        <section
          style={{
            background: '#fff',
            border: '1px solid #eef2f7',
            borderRadius: 16,
            padding: 22,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontWeight: 900,
              fontSize: 20,
              marginBottom: 6,
            }}
          >
            Model evidence
          </div>

          <div
            style={{
              fontSize: 13,
              color: '#6b7280',
              marginBottom: 16,
            }}
          >
            How strongly the current checked predictions support this model’s
            observed performance.
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 14,
            }}
          >
            <div
              style={{
                border: '1px solid #eef2f7',
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#6b7280',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Evidence score
              </div>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  marginTop: 6,
                }}
              >
                {performance.evidence.score}/100
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  marginTop: 6,
                }}
              >
                {performance.evidence.level} · {performance.evidence.status}
              </div>
            </div>

            <div
              style={{
                border: '1px solid #eef2f7',
                borderRadius: 14,
                padding: 18,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#6b7280',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Bootstrap support
              </div>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  marginTop: 6,
                }}
              >
                {performance.evidence.bootstrap.confidence !== null
                  ? `${performance.evidence.bootstrap.confidence.toFixed(1)}%`
                  : '—'}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  marginTop: 6,
                }}
              >
                Based on{' '}
                {performance.evidence.bootstrap.iterations.toLocaleString()}{' '}
                resamples
              </div>
            </div>

            <div
              style={{
                border:
                  performance.evidence.bootstrap.interpretation?.level ===
                  'strong'
                    ? '1px solid #bbf7d0'
                    : '1px solid #fde68a',
                borderRadius: 14,
                padding: 18,
                background:
                  performance.evidence.bootstrap.interpretation?.level ===
                  'strong'
                    ? '#f0fdf4'
                    : '#fffbeb',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color:
                    performance.evidence.bootstrap.interpretation?.level ===
                    'strong'
                      ? '#166534'
                      : '#92400e',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Interpretation
              </div>

              <div
                style={{
                  fontSize: 14,
                  color: '#374151',
                  lineHeight: 1.6,
                  marginTop: 8,
                }}
              >
                {performance.evidence.bootstrap.interpretation?.title ??
                  'No interpretation is available yet.'}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  lineHeight: 1.6,
                  marginTop: 8,
                }}
              >
                {performance.evidence.bootstrap.interpretation?.explanation}
              </div>
            </div>
            <div
              style={{
                marginTop: 18,
                paddingTop: 18,
                borderTop: '1px solid #eef2f7',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 18,
              }}
            >
              {[
                {
                  label: 'Sample size',
                  value: performance.evidence.components.sample_size,
                },
                {
                  label: 'Performance gap',
                  value: performance.evidence.components.performance_gap,
                },
                {
                  label: 'Bootstrap support',
                  value: performance.evidence.components.bootstrap_support,
                },
              ].map((component) => (
                <div key={component.label}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      fontSize: 12,
                      color: '#6b7280',
                      marginBottom: 7,
                    }}
                  >
                    <span>{component.label}</span>
                    <span style={{ fontWeight: 700 }}>{component.value}</span>
                  </div>

                  <div
                    style={{
                      height: 7,
                      borderRadius: 999,
                      background: '#eef2f7',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${component.value}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: '#804198',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            background: '#fff',
            border: '1px solid #eef2f7',
            borderRadius: 16,
            padding: 22,
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Why it exists</h2>

          <p
            style={{
              color: '#4b5563',
              lineHeight: 1.75,
              marginBottom: 0,
            }}
          >
            {model.purpose}
          </p>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #eef2f7',
            borderRadius: 16,
            padding: 22,
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 20 }}>How it works</h2>

          <p
            style={{
              color: '#4b5563',
              lineHeight: 1.75,
              marginBottom: 0,
            }}
          >
            {model.how_it_works}
          </p>
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 16,
        }}
      >
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 16,
            padding: 22,
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Strengths</h2>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {model.strengths.map((strength) => (
              <div
                key={strength}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  color: '#166534',
                  lineHeight: 1.6,
                }}
              >
                <CircleCheck
                  size={18}
                  strokeWidth={2}
                  style={{ flexShrink: 0, marginTop: 3 }}
                />
                <span>{strength}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 16,
            padding: 22,
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Limitations</h2>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {model.limitations.map((limitation) => (
              <div
                key={limitation}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  color: '#92400e',
                  lineHeight: 1.6,
                }}
              >
                <CircleAlert
                  size={18}
                  strokeWidth={2}
                  style={{ flexShrink: 0, marginTop: 3 }}
                />
                <span>{limitation}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
