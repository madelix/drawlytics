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
            fontSize: 12,
            fontWeight: 700,
            color: '#6b7280',
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Executive summary
        </div>

        <div
          style={{
            fontSize: 20,
            fontWeight: 900,
            color: '#111827',
            lineHeight: 1.25,
            marginBottom: 8,
          }}
        >
          {loading
            ? 'Loading current evidence...'
            : (summary?.headline ??
              'There is not enough checked prediction history to assess model honesty yet.')}
        </div>

        <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
          This page compares model performance against the Pure Random baseline
          using checked predictions, sample size, consistency and trend.
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Current leader</div>
            <div style={{ fontWeight: 800 }}>
              {summary?.current_leader ?? '—'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Evidence level</div>
            <div style={{ fontWeight: 800 }}>
              {summary?.evidence_level ?? '—'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Checked predictions
            </div>
            <div style={{ fontWeight: 800 }}>
              {summary?.checked_predictions?.toLocaleString() ?? '—'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Models analysed
            </div>
            <div style={{ fontWeight: 800 }}>
              {summary?.models_analysed?.toLocaleString() ?? '—'}
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
        <div style={{ fontWeight: 900, marginBottom: 6 }}>
          Model evidence rankings
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
        <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
          Coming soon: a transparent explanation of baseline comparison, sample
          size, variance, trend and trust scoring.
        </div>
      </section>
    </div>
  );
}
