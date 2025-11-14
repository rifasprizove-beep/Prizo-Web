let lastCheck = 0;
let lastOk: boolean | null = null;

export function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL || '';
}

export async function apiAvailable(ttlMs: number = 60_000): Promise<boolean> {
  const base = apiBase();
  if (!base) return false;
  const now = Date.now();
  if (lastOk !== null && now - lastCheck < ttlMs) return Boolean(lastOk);
  lastCheck = now;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(`${base}/health`, { cache: 'no-store', signal: controller.signal });
    clearTimeout(t);
    lastOk = res.ok;
    return res.ok;
  } catch {
    clearTimeout(t);
    lastOk = false;
    return false;
  }
}

export function markApiDown() {
  lastOk = false;
  lastCheck = Date.now();
}
