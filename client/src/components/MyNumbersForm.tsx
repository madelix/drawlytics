import { useState, type FormEvent } from 'react';
import { saveNumberSet, type SavedNumberSet } from '../api/myNumbers';
import {
  LOTTERIES,
  getLotteryConfig,
  type LotteryKey,
} from '../config/lotteries';

type Props = {
  onSaved: (set: SavedNumberSet) => void;
};

export function MyNumbersForm({ onSaved }: Props) {
  const [lottery, setLottery] = useState<LotteryKey>('euromillions');
  const [name, setName] = useState('');
  const [entries, setEntries] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const config = getLotteryConfig(lottery);
  const groups = config.numberGroups.filter((group) => group.key !== 'bonus');

  function selectLottery(key: LotteryKey) {
    if (key === lottery) return;
    setLottery(key);
    setEntries({});
    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setError('');
    if (!name.trim()) {
      setError('Give this number set a name.');
      return;
    }

    let mainNumbers: number[] = [];
    let specialNumbers: number[] = [];

    for (const group of groups) {
      const numbers = Array.from({ length: group.count }, (_, index) =>
        Number(entries[group.key]?.[index]),
      );

      if (
        numbers.some(
          (n) => !Number.isInteger(n) || n < group.min || n > group.max,
        )
      ) {
        setError(
          `${group.label}: enter ${group.count} from ${group.min} to ${group.max}.`,
        );
        return;
      }

      if (new Set(numbers).size !== numbers.length) {
        setError(
          `${group.label}: choose a different number for each position.`,
        );
        return;
      }

      if (group.key === 'main') mainNumbers = numbers;
      else specialNumbers = numbers;
    }

    setSaving(true);
    try {
      const saved = await saveNumberSet({
        name: name.trim(),
        lottery,
        main_numbers: mainNumbers,
        special_numbers: specialNumbers,
      });
      setName('');
      setEntries({});
      onSaved(saved);
    } catch {
      setError('Your number set could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset
        disabled={saving}
        style={{
          border: 0,
          padding: 0,
          margin: 0,
          minWidth: 0,
          display: 'grid',
          gap: 16,
        }}
      >
        <div
          role="group"
          aria-label="Lottery"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
        >
          {LOTTERIES.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={lottery === item.key}
              onClick={() => selectLottery(item.key)}
              style={{
                padding: '0.5rem 0.8rem',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: lottery === item.key ? '#111827' : '#fff',
                color: lottery === item.key ? '#fff' : '#374151',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label style={{ display: 'grid', gap: 4 }}>
          Set name
          <input
            type="text"
            value={name}
            required
            placeholder="e.g. Family birthdays"
            onChange={(event) => setName(event.target.value)}
            style={{
              padding: '0.55rem',
              border: '1px solid #d1d5db',
              borderRadius: 6,
            }}
          />
        </label>

        {groups.map((group) => {
          const selected = entries[group.key] ?? [];
          const isFull = selected.length === group.count;
          const isMain = group.key === 'main';
          const accent = isMain ? '#6d28d9' : '#1d4ed8';

          function toggleNumber(value: string) {
            setEntries((previous) => {
              const current = previous[group.key] ?? [];

              if (current.includes(value)) {
                return {
                  ...previous,
                  [group.key]: current.filter((item) => item !== value),
                };
              }

              if (current.length >= group.count) return previous;
              return { ...previous, [group.key]: [...current, value] };
            });
            setError('');
          }

          return (
            <fieldset
              key={group.key}
              style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
            >
              <legend style={{ padding: 0, marginBottom: 8 }}>
                <strong>{group.label}</strong>
                <span
                  aria-live="polite"
                  style={{ marginLeft: 8, color: '#475569' }}
                >
                  {selected.length} of {group.count}
                </span>
              </legend>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Array.from(
                  { length: group.max - group.min + 1 },
                  (_, index) => {
                    const value = String(group.min + index);
                    const picked = selected.includes(value);
                    const unavailable = isFull && !picked;

                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={picked}
                        disabled={unavailable}
                        onClick={() => toggleNumber(value)}
                        style={{
                          width: '2.65rem',
                          height: '2.65rem',
                          padding: 0,
                          borderRadius: '50%',
                          border: `1px solid ${picked ? accent : '#cbd5e1'}`,
                          background: picked ? accent : '#fff',
                          color: picked ? '#fff' : '#1f2937',
                          font: 'inherit',
                          fontWeight: picked ? 700 : 500,
                          opacity: unavailable ? 0.5 : 1,
                          cursor: unavailable ? 'default' : 'pointer',
                        }}
                      >
                        {value}
                      </button>
                    );
                  },
                )}
              </div>
            </fieldset>
          );
        })}

        {error && <div role="alert">{error}</div>}

        <button
          type="submit"
          className="dl-pagination-btn"
          style={{ justifySelf: 'start' }}
        >
          {saving ? 'Saving…' : 'Save number set'}
        </button>
      </fieldset>
    </form>
  );
}
