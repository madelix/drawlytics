// client/src/api/draws.ts

// If you're deploying the frontend separately (e.g. Vercel) set VITE_API_BASE_URL
// to your Railway URL. Locally you can leave it empty and use a Vite proxy.
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export type LatestDrawResponse = {
  ok: boolean;
  draw?: {
    id: number;
    draw_date: string;
    numbers: number[];
    stars: number[];
    raw: Record<string, unknown>;
  };
  error?: string;
};

export async function getLatestDraw(): Promise<LatestDrawResponse> {
  const res = await fetch(`${API_BASE}/api/draws/latest`);

  if (!res.ok) {
    throw new Error(
      `Failed to fetch latest draw: ${res.status} ${res.statusText}`,
    );
  }

  const data = (await res.json()) as LatestDrawResponse;
  return data;
}
