// client/src/api/apiClient.ts

/**
 * Goal:
 * - In DEV: always use relative "/api/..." so Vite proxy handles it (no CORS, no Railway).
 * - In PROD: default to same-origin "/api/..." unless VITE_API_BASE_URL is explicitly set.
 */

function resolveApiBase(): string {
  // DEV must stay relative so Vite proxy works reliably
  if (import.meta.env.DEV) return '';

  const raw = String(import.meta.env.VITE_API_BASE_URL || '').trim();

  // If not set, use same-origin
  if (!raw) return '';

  // Normalize: no trailing slash
  return raw.replace(/\/+$/, '');
}

const API_BASE = resolveApiBase();

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}

async function readText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

function looksLikeHtml(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t.startsWith('<!doctype') || t.startsWith('<html') || t.includes('<body')
  );
}

export async function apiGetJson<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path), { method: 'GET' });
  const text = await readText(res);

  if (!res.ok) {
    if (looksLikeHtml(text)) {
      throw new Error(
        `API returned HTML (likely wrong server). GET ${path} status ${res.status}`,
      );
    }
    throw new Error(text || `GET ${path} failed (${res.status})`);
  }

  if (looksLikeHtml(text)) {
    throw new Error(`API returned HTML (likely wrong server). GET ${path}`);
  }

  return (text ? JSON.parse(text) : {}) as T;
}

export async function apiSendJson<T>(
  path: string,
  options: { method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: any },
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: options.method,
    headers: { 'Content-Type': 'application/json' },
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });

  const text = await readText(res);

  if (!res.ok) {
    if (looksLikeHtml(text)) {
      throw new Error(
        `API returned HTML (likely wrong server). ${options.method} ${path} status ${res.status}`,
      );
    }
    throw new Error(text || `${options.method} ${path} failed (${res.status})`);
  }

  if (!text) return {} as T;
  if (looksLikeHtml(text)) {
    throw new Error(
      `API returned HTML (likely wrong server). ${options.method} ${path}`,
    );
  }
  return JSON.parse(text) as T;
}
