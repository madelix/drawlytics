import React, { useEffect, useState } from 'react';
import { apiGetJson } from '../api/apiClient';

export default function FrequencyDebug() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setErr('');
        const json = await apiGetJson('/api/frequency');
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setErr(String(e?.message ?? e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <h3>Frequency debug</h3>
      {err ? <pre style={{ color: 'red' }}>{err}</pre> : null}
      <pre>{data ? JSON.stringify(data, null, 2) : 'Loading...'}</pre>
    </div>
  );
}
