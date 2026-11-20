import { useEffect, useState } from 'react';
import {
  getPersonalModelPerformance,
  type PersonalModelPerformanceRow,
} from '../api/dashboard';
import { LOTTERIES, type LotteryKey } from '../config/lotteries';
import { getModelColour } from '../config/modelPresentation';
import { getModelDisplayName } from '../utils/modelDisplay';
import './PersonalModelPerformanceCard.css';

function formatAverage(value: number | null) {
  return value === null ? '—' : value.toFixed(2);
}

function formatDifference(value: number | null) {
  if (value === null) return '—';

  const rounded = Number(value.toFixed(2));
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(2)}`;
}

function ModelResults({ lottery }: { lottery: LotteryKey }) {
  const [rows, setRows] = useState<PersonalModelPerformanceRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const models = await getPersonalModelPerformance(lottery);
        if (active) setRows(models);
      } catch {
        if (active) setFailed(true);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [lottery]);

  if (failed)
    return <p role="alert">Your model results could not be loaded.</p>;
  if (rows === null) return <p role="status">Loading your model results…</p>;
  if (rows.length === 0) {
    return (
      <p>
        Your results will appear once a played line has been checked for this
        lottery.
      </p>
    );
  }

  return (
    <table className="dl-personal-performance-table">
      <caption className="dl-personal-performance-caption">
        Average hits per line on draws shared with the global benchmark
      </caption>
      <thead>
        <tr>
          <th scope="col">Model</th>
          <th scope="col">Your average</th>
          <th scope="col">Global benchmark</th>
          <th scope="col">Difference</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.model_key}>
            <th scope="row">
              <span
                aria-hidden="true"
                className="dl-personal-model-dot"
                style={{ backgroundColor: getModelColour(row.model_key) }}
              />
              {getModelDisplayName(row.model_key)}
              <small className="dl-personal-model-sample">
                {row.checked_lines} checked{' '}
                {row.checked_lines === 1 ? 'line' : 'lines'}
                {' · '}
                {row.shared_draws === 0
                  ? 'No shared draws yet'
                  : `${row.shared_draws} shared ${row.shared_draws === 1 ? 'draw' : 'draws'}`}
              </small>
            </th>
            <td data-label="Your average">
              {formatAverage(row.personal_average)}
            </td>
            <td data-label="Benchmark">
              {formatAverage(row.benchmark_average)}
            </td>
            <td data-label="Difference">{formatDifference(row.difference)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PersonalModelPerformanceCard() {
  const [lottery, setLottery] = useState<LotteryKey>('euromillions');

  return (
    <section
      className="dl-config-card dl-personal-performance"
      aria-labelledby="personal-performance-heading"
    >
      <h2 id="personal-performance-heading">Your model performance</h2>
      <p>
        See how your played lines compare with each model’s global benchmark on
        the same draws.
      </p>

      <div
        className="dl-personal-lottery-buttons"
        role="group"
        aria-label="Choose a lottery"
      >
        {LOTTERIES.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={lottery === item.key}
            onClick={() => setLottery(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <ModelResults key={lottery} lottery={lottery} />
    </section>
  );
}
