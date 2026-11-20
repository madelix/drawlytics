import { useState } from 'react';
import {
  getSavedSetComparison,
  type SavedNumberSet,
  type SavedSetComparison,
  type SavedSetDrawResult,
} from '../api/myNumbers';
import { getLotteryConfig } from '../config/lotteries';

const hitStyle = {
  background: '#dcfce7',
  borderColor: '#22c55e',
  color: '#14532d',
  fontWeight: 700,
};

export function SavedSetComparisonCard({ set }: { set: SavedNumberSet }) {
  const [comparison, setComparison] = useState<SavedSetComparison | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const lottery = getLotteryConfig(set.lottery);
  const isUkLotto = set.lottery === 'uk_lotto';

  async function toggleComparison() {
    if (open) {
      setOpen(false);
      return;
    }

    setOpen(true);
    if (comparison) return;

    setLoading(true);
    setError(false);
    try {
      setComparison(await getSavedSetComparison(set.id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function renderDraw(title: string, draw: SavedSetDrawResult) {
    const date = draw.draw_date.split('-').reverse().join('/');
    const specialChoices = isUkLotto ? set.main_numbers : set.special_numbers;

    return (
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
        <strong>{title}</strong>
        <div>
          {date}
          {isUkLotto && ` · Draw ${draw.draw_sequence}`}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 20px',
            marginTop: 6,
          }}
        >
          {lottery.numberGroups.map((group) => {
            const isMain = group.key === 'main';
            const drawn = isMain ? draw.main_numbers : draw.special_numbers;
            const chosen = isMain ? set.main_numbers : specialChoices;
            const hits = isMain ? draw.matched_main : draw.matched_special;

            return (
              <div key={group.key}>
                <small>
                  {group.label} · {hits} matched
                </small>
                <div>
                  {drawn.map((number) => {
                    const isHit = chosen.includes(number);

                    return (
                      <span
                        key={number}
                        className={`dl-draw-pill dl-draw-pill--${isMain ? 'main' : 'star'}`}
                        style={isHit ? hitStyle : undefined}
                        aria-label={isHit ? `${number}, matched` : undefined}
                        title={isHit ? 'Matched' : undefined}
                      >
                        {number}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const panelId = `saved-set-comparison-${set.id}`;
  const latest = comparison?.latest;
  const best = comparison?.best;
  const sameDraw =
    latest &&
    best &&
    latest.draw_date === best.draw_date &&
    latest.draw_sequence === best.draw_sequence;

  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        className="dl-pagination-btn"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={loading}
        onClick={toggleComparison}
      >
        {open ? 'Hide comparison' : 'Compare with past draws'}
      </button>

      <div id={panelId} hidden={!open}>
        {loading && <p role="status">Comparing your numbers…</p>}
        {error && (
          <p role="alert">
            Could not load the comparison. Close and reopen to retry.
          </p>
        )}
        {comparison && (
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            <small>
              {comparison.draws_compared} official{' '}
              {comparison.draws_compared === 1 ? 'draw' : 'draws'} compared
            </small>
            {latest ? (
              renderDraw(
                sameDraw
                  ? 'Latest draw · Best historical match'
                  : 'Latest draw',
                latest,
              )
            ) : (
              <p>No official draws are available yet.</p>
            )}
            {best && !sameDraw && renderDraw('Best historical match', best)}
          </div>
        )}
      </div>
    </div>
  );
}
