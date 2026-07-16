import { useEffect, useState } from 'react';
import { getHonestySummary, type HonestySummary } from '../api/honesty';
import { type LotteryKey } from '../config/lotteries';
import { LotterySelector } from '../components/LotterySelector';

export default function HonestyDashboardPage() {
  const [summary, setSummary] = useState<HonestySummary | null>(null);
  const [selectedLottery, setSelectedLottery] =
    useState<LotteryKey>('euromillions');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSummary() {
      setLoading(true);
      setError(null);

      try {
        const response = await getHonestySummary({
          lottery: selectedLottery,
        });

        setSummary(response.summary);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load honesty summary');
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, [selectedLottery]);

  return (
    <div
      style={{
        maxWidth: 980,
        margin: '0 auto',
        padding: '20px 14px 28px',
      }}
    >
      <header style={{ textAlign: 'center', marginBottom: 14 }}>
        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 2.2rem)',
            lineHeight: 1.05,
            margin: 0,
          }}
        >
          Model honesty
        </h1>

        <p
          style={{
            margin: '8px auto 0',
            color: '#6b7280',
            maxWidth: 680,
            lineHeight: 1.45,
          }}
        >
          A simple view of whether Drawlytics models are genuinely performing
          better than random.
        </p>
      </header>

      <section
        style={{
          width: '100%',
          margin: '16px 0 14px',
        }}
      >
        <div
          className="dl-config-card"
          style={{
            width: '100%',
            maxWidth: 'none',
            padding: '1.25rem',
            textAlign: 'left',
            boxSizing: 'border-box',
          }}
        >
          <div className="dl-config-row">
            <div className="dl-config-item" style={{ width: '100%' }}>
              <div className="dl-config-label">Lottery type</div>

              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  marginTop: '0.35rem',
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                <LotterySelector
                  selectedLottery={selectedLottery}
                  onChange={setSelectedLottery}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <p style={{ color: '#b91c1c', textAlign: 'center' }}>{error}</p>
      )}

      <section
        style={{
          background: '#fff',
          border: '1px solid #eef2f7',
          borderRadius: 16,
          padding: '16px 18px',
          margin: '16px auto 14px',
          maxWidth: 980,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 0.9fr) minmax(280px, 1.4fr)',
            gap: 28,
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 10,
              }}
            >
              Current strongest evidence
            </div>

            <div
              style={{
                fontSize: 30,
                fontWeight: 900,
                color: '#111827',
                marginBottom: 12,
                lineHeight: 1.1,
              }}
            >
              {loading ? 'Loading...' : (summary?.current_leader ?? 'Unknown')}
            </div>

            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  marginBottom: 6,
                  fontWeight: 700,
                }}
              >
                Confidence
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 220,
                    height: 10,
                    borderRadius: 999,
                    background: '#eef2f7',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width:
                        summary?.evidence_level === 'High'
                          ? '82%'
                          : summary?.evidence_level === 'Moderate'
                            ? '62%'
                            : summary?.evidence_level === 'Building'
                              ? '42%'
                              : '24%',
                      height: '100%',
                      borderRadius: 999,
                      background: '#16a34a',
                    }}
                  />
                </div>

                <div
                  style={{
                    color: '#166534',
                    fontWeight: 800,
                    fontSize: 13,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {summary?.evidence_level ?? 'Building'} confidence
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: 16,
              color: '#374151',
              lineHeight: 1.7,
              borderLeft: '1px solid #e5e7eb',
              paddingLeft: 24,
            }}
          >
            {loading
              ? 'Loading current evidence...'
              : (summary?.headline ??
                'There is not enough checked prediction history to assess model honesty yet.')}
          </div>
        </div>
      </section>

      <section
        style={{
          background: '#fff',
          border: '1px solid #eef2f7',
          borderRadius: 16,
          padding: '14px 16px',
          margin: '0 auto 14px',
          maxWidth: 980,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 8 }}>
          Evidence overview
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 12,
            marginTop: 12,
          }}
        >
          <div
            style={{
              border: '1px solid #eef2f7',
              borderRadius: 14,
              padding: 14,
              background: '#fff',
              minHeight: 132,
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 12 }}>🛡️</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Trust score</div>
            <div style={{ fontWeight: 900, fontSize: 28, marginTop: 4 }}>—</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
              Calculating as evidence grows.
            </div>
          </div>

          <div
            style={{
              border: '1px solid #eef2f7',
              borderRadius: 14,
              padding: 14,
              background: '#fff',
              minHeight: 132,
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Evidence level</div>
            <div style={{ fontWeight: 900, fontSize: 28, marginTop: 4 }}>
              {summary?.evidence_level ?? '—'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
              Current confidence in the evidence.
            </div>
          </div>

          <div
            style={{
              border: '1px solid #eef2f7',
              borderRadius: 14,
              padding: 14,
              background: '#fff',
              minHeight: 132,
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 12 }}>🗄️</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Checked predictions
            </div>
            <div style={{ fontWeight: 900, fontSize: 28, marginTop: 4 }}>
              {summary?.checked_predictions?.toLocaleString() ?? '—'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
              Evaluated against actual results.
            </div>
          </div>

          <div
            style={{
              border: '1px solid #eef2f7',
              borderRadius: 14,
              padding: 14,
              background: '#fff',
              minHeight: 132,
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Models analysed
            </div>
            <div style={{ fontWeight: 900, fontSize: 28, marginTop: 4 }}>
              {summary?.models_analysed?.toLocaleString() ?? '—'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
              Active models in this evaluation.
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          background: '#fff',
          border: '1px solid #eef2f7',
          borderRadius: 16,
          padding: '14px 16px',
          margin: '0 auto 14px',
          maxWidth: 980,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              background: '#f4efff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            ⚖️
          </div>

          <div>
            <div style={{ fontWeight: 900 }}>Performance vs Pure Random</div>

            <div
              style={{
                fontSize: 13,
                color: '#6b7280',
                marginTop: 2,
              }}
            >
              See whether the current strongest model is genuinely outperforming
              the Pure Random baseline.
              <div
                style={{
                  marginTop: 18,
                  borderTop: '1px solid #eef2f7',
                  paddingTop: 18,
                  textAlign: 'center',
                  color: '#6b7280',
                  fontSize: 14,
                }}
              >
                Comparison chart will appear here.
              </div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          Coming soon: models ranked by evidence quality, not just average hits.
        </div>
      </section>

      <section
        style={{
          background: '#fff',
          border: '1px solid #eef2f7',
          borderRadius: 16,
          padding: '14px 16px',
          margin: '0 auto 14px',
          maxWidth: 980,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Current findings</div>
        <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
          Coming soon: key observations about random, AI models, consistency,
          trend and sample reliability.
        </div>
      </section>

      <section
        style={{
          background: '#fff',
          border: '1px solid #eef2f7',
          borderRadius: 16,
          padding: '14px 16px',
          margin: '0 auto',
          maxWidth: 980,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 6 }}>
          How honesty is measured
        </div>
      </section>
    </div>
  );
}
