// client/src/api/apiClient.ts

/**
 * API URL strategy:
 * - Dev: always use relative "/api/..." so Vite proxy handles it (localhost:5173 -> localhost:3000)
 * - Prod: default to "/api/..." as well (same-origin). If you ever need a different backend,
 *   set VITE_API_BASE_URL (e.g. https://your-backend) and we'll prefix it.
 */

function normalizeBase(base: string) {
  return base.replace(/\/+$/, '');
}

export function apiUrl(path: string) {
  const p = path.startsWith('/') ? path : `/${path}`;

  // In dev, force relative so we never bypass the Vite proxy.
  if (import.meta.env.DEV) return p;

  // In prod, prefer same-origin unless an explicit base URL is provided.
  const base = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (!base) return p;

  return `${normalizeBase(base)}${p}`;
}

export async function apiGetJson<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path), {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API GET failed: ${res.status} ${text}`);
  }

  return (await res.json()) as T;
}
