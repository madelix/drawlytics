// client/src/api/frequency.js
import { apiUrl } from './apiClient';

export async function getFrequency() {
  // In dev: stays relative → Vite proxy → localhost:3000
  // In prod: relative → Vercel rewrite → Railway
  const res = await fetch(apiUrl('/api/frequency'));

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to fetch frequency data: ${res.status} ${text || ''}`,
    );
  }

  return res.json();
}
