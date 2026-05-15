import { LOTTERIES, type LotteryKey } from '../config/lotteries';

type LotterySelectorProps = {
  selectedLottery: LotteryKey | null;
  onChange: (lottery: LotteryKey) => void;
};

export function LotterySelector({
  selectedLottery,
  onChange,
}: LotterySelectorProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap',
        alignItems: 'center',
        width: 'auto',
      }}
    >
      {LOTTERIES.map((lottery) => {
        const active = selectedLottery === lottery.key;

        return (
          <button
            key={lottery.key}
            type="button"
            onClick={() => onChange(lottery.key)}
            style={{
              border: active ? '1px solid #111827' : '1px solid #d1d5db',
              background: active ? '#111827' : '#ffffff',
              color: active ? '#ffffff' : '#374151',
              borderRadius: 6,
              padding: '0.55rem 1rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: active ? '0 4px 10px rgba(15, 23, 42, 0.18)' : 'none',
            }}
          >
            {lottery.label}
          </button>
        );
      })}
    </div>
  );
}
