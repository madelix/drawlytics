// client/src/hooks/useEuromillionsFrequency.js
import { useEffect, useState } from 'react';
import { apiUrl } from '../api/apiClient';

export default function useEuromillionsFrequency() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        // In dev: stays relative → Vite proxy → localhost:3000
        // In prod: Vercel rewrite → Railway
        const res = await fetch(apiUrl('/api/frequency'));

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text || 'Request failed'}`);
        }

        const json = await res.json();
        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        console.error('Frequency fetch error:', err);
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
