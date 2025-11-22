// client/src/components/FrequencyDebug.jsx
import { useEffect, useState } from 'react';

const apiBase = import.meta.env.VITE_API_BASE_URL;

export default function FrequencyDebug() {
  const [status, setStatus] = useState('idle');
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    async function checkApi() {
      try {
        setStatus('loading');
        const res = await fetch(`${apiBase}/api/frequency`);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        await res.json(); // we don’t need the body, just that it works
        setStatus('ok');
        setLastUpdated(new Date());
      } catch (err) {
        console.error('FrequencyDebug error:', err);
        setStatus('error');
      }
    }

    checkApi();
  }, []);

  let label = 'Checking…';
  let dotClass = 'dl-status-dot';

  if (status === 'ok') {
    label = 'Live API connected';
    dotClass = 'dl-status-dot dl-status-ok';
  } else if (status === 'error') {
    label = 'API error';
    dotClass = 'dl-status-dot dl-status-error';
  }

  return (
    <div className="dl-api-status">
      <span className={dotClass} />
      <span>{label}</span>
      {lastUpdated && (
        <span className="dl-api-status-time">
          · updated {lastUpdated.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
