import { getLotteryConfig } from '../config/lotteries';
import type { PredictionRow } from '../pages/MyPredictionsPage';
import { getModelDisplayName } from '../utils/modelDisplay';

export function PlayedLineCard({ line }: { line: PredictionRow }) {
  const lottery = getLotteryConfig(line.lottery);
  const dateLabel = line.draw_date.slice(0, 10).split('-').reverse().join('/');
  const results = line.draw_results ?? [];

  return (
    <article
      style={{
        padding: '14px 16px',
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        textAlign: 'left',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'start',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div>
          <small>{lottery.label}</small>
          <h3 style={{ margin: '4px 0', fontSize: '1rem' }}>
            {getModelDisplayName(line.model_name, line.source)} — draw{' '}
            {dateLabel}
          </h3>
        </div>
        <small style={{ textTransform: 'capitalize' }}>{line.status}</small>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'start',
          flexWrap: 'wrap',
          gap: '12px 20px',
          marginTop: 8,
        }}
      >
        {lottery.numberGroups.map((group) => {
          const isMain = group.key === 'main';
          const numbers = isMain ? line.main_numbers : line.star_numbers;
          if (!numbers?.length) return null;

          return (
            <div key={group.key}>
              <small>{group.label}</small>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 4,
                }}
              >
                {numbers.map((number) => {
                  const matchingDraws = results.filter((result) => {
                    const winningNumbers = isMain
                      ? result.winning_main_numbers
                      : result.winning_special_numbers;

                    return winningNumbers?.includes(number);
                  });

                  const isHit = matchingDraws.length > 0;
                  const hitLabel =
                    results.length > 1
                      ? matchingDraws
                          .map((draw) => `Hit in draw ${draw.draw_sequence}`)
                          .join(', ')
                      : 'Hit';

                  return (
                    <span
                      key={number}
                      className={`dl-draw-pill dl-draw-pill--${isMain ? 'main' : 'star'}`}
                      title={isHit ? hitLabel : undefined}
                      style={
                        isHit
                          ? {
                              background: '#dcfce7',
                              borderColor: '#22c55e',
                              color: '#14532d',
                              fontWeight: 700,
                              boxShadow: '0 0 0 2px rgba(34,197,94,0.15) inset',
                            }
                          : undefined
                      }
                    >
                      {number}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div style={{ marginLeft: 'auto' }}>
          <small>Confidence</small>
          <div>
            <strong>{Math.round(line.confidence)}%</strong>
          </div>
        </div>
      </div>

      {results.map((result) => (
        <p
          key={`${result.draw_date}-${result.draw_sequence}`}
          style={{ margin: '8px 0 0', fontSize: '0.85rem' }}
        >
          {results.length > 1 && `Draw ${result.draw_sequence} · `}
          Main hits: {result.matched_main} · {lottery.specialLabel}:{' '}
          {result.matched_special}
        </p>
      ))}
    </article>
  );
}
