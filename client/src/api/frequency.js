// client/src/api/frequency.js

export async function getFrequency() {
  const api = import.meta.env.VITE_API_BASE_URL;

  if (!api) {
    throw new Error('VITE_API_BASE_URL is not set');
  }

  const res = await fetch(`${api}/api/frequency`);
  if (!res.ok) {
    throw new Error(`Failed to fetch frequency data: ${res.status}`);
  }

  return res.json();
}
