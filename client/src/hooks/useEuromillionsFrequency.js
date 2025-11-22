import { useEffect, useState } from 'react';

export default function useEuromillionsFrequency() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const api = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    async function run() {
      try {
        const res = await fetch(`${api}/api/frequency`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Frequency fetch error:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    run();
  }, []);

  return { data, loading, error };
}
