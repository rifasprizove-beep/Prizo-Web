let lastCheck = 0;
let lastOk: boolean | null = null;

export function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL || '';
}

export async function apiAvailable(ttlMs: number = 60_000): Promise<boolean> {
  const base = apiBase();
  if (!base) return false;
  // Silenciar completamente el ping de salud para evitar errores CORS en consola.
  // En modo silencioso, no intentamos llamar a /health en el navegador.
  // Devolvemos false para forzar el uso del fallback (Supabase) en el cliente.
  lastCheck = Date.now();
  lastOk = false;
  return false;
}

export function markApiDown() {
  lastOk = false;
  lastCheck = Date.now();
}
