import { getSupabase } from '../supabaseClient';
import { apiAvailable } from '../api';

export type RateInfo = {
  rate: number;
  source?: string;
  date?: string;
  rate_available?: boolean;
  stale?: boolean;
};

export type TicketPriceInfo = {
  baseUsd: number;          // USD calculado directo desde cents (precio base)
  fallbackRate?: number | null;
  bcvRate?: number | null;
  priceBsFromFallback: number | null; // USD base * fallback
  usdAtBcv: number;         // precio clave en USD tras normalizar por BCV
  bsAtBcv: number;          // precio en Bs usando la tasa BCV
};

export function centsToUsd(cents: number | undefined | null): number {
  if (!cents) return 0;
  return Math.round(cents) / 100;
}

export function round2(n: number | undefined | null): number {
  if (!n || !isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function round0(n: number | undefined | null): number {
  if (!n || !isFinite(n)) return 0;
  return Math.round(n);
}

export function round1(n: number | undefined | null): number {
  if (!n || !isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

/**
 * Calcula el precio clave del ticket en USD y Bs siguiendo el flujo solicitado:
 * 1) Convertir el precio del ticket (centavos) a USD base.
 * 2) Multiplicar por la tasa de entorno (fallback) para obtener Bs.
 * 3) Volver a USD usando la tasa BCV; ese USD es el que se muestra/guarda.
 * 4) Para mostrar en Bs, convertir ese USD a Bs con BCV (o fallback si no hay BCV).
 */
export function computeTicketPrice(
  ticketPriceCents: number,
  fallbackRate?: number | null,
  bcvRate?: number | null,
): TicketPriceInfo {
  const baseUsd = centsToUsd(ticketPriceCents ?? 0);
  const fallback = fallbackRate ?? null;
  const bcv = bcvRate ?? null;

  const priceBsFromFallback = fallback ? round2(baseUsd * fallback) : null;
  // USD normalizado por BCV; si falta BCV usamos el USD base como respaldo.
  const usdAtBcv = (priceBsFromFallback != null && bcv)
    ? round2(priceBsFromFallback / bcv)
    : round2(baseUsd);
  // Mostrar Bs usando BCV si existe; si no, caemos a Bs calculados por fallback.
  const bsAtBcv = bcv
    ? round0(usdAtBcv * bcv)
    : (priceBsFromFallback != null ? round0(priceBsFromFallback) : 0);

  return { baseUsd, fallbackRate: fallback, bcvRate: bcv, priceBsFromFallback, usdAtBcv, bsAtBcv };
}

/**
 * Intenta obtener la tasa USD->VES.
 * 1) Si existe NEXT_PUBLIC_RATE_URL, hace fetch a ese endpoint (debe retornar { rate, source?, date? }).
 * 2) Fallback: lee de tabla 'settings' en Supabase (key='usdves_rate') cuyo value es JSON { rate, source, date }.
 */
export async function getUsdVesRate(): Promise<RateInfo | null> {
  // 0) Cache rápido en localStorage para no bloquear UI
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('usdves_rate_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        const ts = Number(parsed?.ts || 0);
        const ageMs = Date.now() - ts;
        const twelveHours = 12 * 60 * 60 * 1000;
        const rate = Number(parsed?.rate);
        if (!isNaN(rate) && rate > 0 && ageMs < twelveHours) {
          return { rate, source: parsed?.source, date: parsed?.date, rate_available: true, stale: false };
        }
      }
    }
  } catch {}

  // 1) Intento rápido: open.er-api.com (mid-market) con timeout ~1.2s
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(to);
    if (res.ok) {
      const j: any = await res.json();
      const cand = j?.rates?.VES ?? j?.rates?.VEF ?? j?.rates?.VED;
      const rate = Number(cand);
      if (!isNaN(rate) && rate > 0) {
        const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
        try { if (typeof window !== 'undefined') localStorage.setItem('usdves_rate_v1', JSON.stringify({ rate, source: 'ERAPI', date: today, ts: Date.now() })); } catch {}
        return { rate, source: 'ERAPI', date: today, rate_available: true, stale: false };
      }
    }
  } catch (e) {
  if (process.env.NEXT_PUBLIC_DEBUG === '1') console.warn('getUsdVesRate (er-api) failed:', e);
  }

  // 2) Endpoint configurable o interno (/api/rate -> BCV)
  const baseApi = process.env.NEXT_PUBLIC_API_URL || '';
  const configuredUrl = process.env.NEXT_PUBLIC_RATE_URL || (baseApi ? `${baseApi}/api/rate` : '');
  const shouldTryApi = !!configuredUrl && (
    // si es la URL construida desde API_URL, verifica salud antes
    (configuredUrl.startsWith(baseApi) ? await apiAvailable().catch(() => false) : true)
  );
  if (typeof window !== 'undefined' && shouldTryApi) {
    try {
      const res = await fetch(configuredUrl, { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        const rate = Number(j?.rate ?? j?.data?.rate);
        if (!isNaN(rate) && rate > 0) {
          const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
          try { if (typeof window !== 'undefined') localStorage.setItem('usdves_rate_v1', JSON.stringify({ rate, source: j?.source ?? j?.data?.source ?? 'API', date: today, ts: Date.now() })); } catch {}
          return { rate, source: j?.source ?? j?.data?.source, date: j?.date ?? j?.data?.date, rate_available: true, stale: false };
        }
      }
    } catch (e) {
  if (process.env.NEXT_PUBLIC_DEBUG === '1') console.warn('getUsdVesRate (api) failed:', e);
    }
  }

  // 3) Fallback: Supabase settings.usdves_rate
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'usdves_rate')
      .maybeSingle();
    if (error) throw error;
    const v = typeof data?.value === 'string' ? JSON.parse(data.value) : data?.value;
    const rate = Number(v?.rate);
    if (!isNaN(rate) && rate > 0) {
      try { if (typeof window !== 'undefined') localStorage.setItem('usdves_rate_v1', JSON.stringify({ rate, source: v?.source ?? 'settings', date: v?.date, ts: Date.now() })); } catch {}
      return { rate, source: v?.source, date: v?.date, rate_available: true, stale: false };
    }
  } catch (e) {
  if (process.env.NEXT_PUBLIC_DEBUG === '1') console.warn('getUsdVesRate (supabase) failed:', e);
  }

  // 4) Fallback de entorno manual: NEXT_PUBLIC_RATE_FALLBACK (número)
  const fallbackEnv = process.env.NEXT_PUBLIC_RATE_FALLBACK;
  if (fallbackEnv) {
    const rate = Number(fallbackEnv);
    if (!isNaN(rate) && rate > 0) {
      const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
      try { if (typeof window !== 'undefined') localStorage.setItem('usdves_rate_v1', JSON.stringify({ rate, source: 'env', date: today, ts: Date.now() })); } catch {}
      return { rate, source: 'env', date: today };
    }
  }

  // 5) Fallback por defecto: 225 Bs/USD
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
  return { rate: 225, source: 'default', date: today, rate_available: true, stale: true };
}

// Solo lee la tasa de entorno (NEXT_PUBLIC_RATE_FALLBACK) sin hacer red.
export function getEnvFallbackRate(): number | null {
  const raw = process.env.NEXT_PUBLIC_RATE_FALLBACK;
  if (!raw) return null;
  const n = Number(raw);
  return !isNaN(n) && n > 0 ? n : null;
}

// Obtiene preferiblemente la tasa BCV desde API (NEXT_PUBLIC_RATE_URL o API_URL/api/rate).
// Si falla, intenta open.er-api y finalmente usa entorno como stale.
export async function getBcvRatePreferApi(): Promise<RateInfo | null> {
  const baseApi = process.env.NEXT_PUBLIC_API_URL || '';
  const configuredUrl = process.env.NEXT_PUBLIC_RATE_URL || (baseApi ? `${baseApi}/api/rate` : '');
  const shouldTryApi = !!configuredUrl && (
    configuredUrl.startsWith(baseApi) ? await apiAvailable().catch(() => false) : true
  );
  if (shouldTryApi) {
    try {
      const res = await fetch(configuredUrl, { cache: 'no-store' });
      if (res.ok) {
        const j: any = await res.json();
        const r = Number(j?.rate ?? j?.data?.rate);
        if (!isNaN(r) && r > 0) {
          return { rate: r, source: j?.source ?? j?.data?.source ?? 'BCV', date: j?.date ?? j?.data?.date, rate_available: true, stale: false };
        }
      }
    } catch (e) {
  if (process.env.NEXT_PUBLIC_DEBUG === '1') console.warn('getBcvRatePreferApi API error:', e);
    }
  }
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(to);
    if (res.ok) {
      const j: any = await res.json();
      const cand = j?.rates?.VES ?? j?.rates?.VEF ?? j?.rates?.VED;
      const r = Number(cand);
      if (!isNaN(r) && r > 0) {
        const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
        return { rate: r, source: 'ERAPI', date: today, rate_available: true, stale: false };
      }
    }
  } catch (e) {
  if (process.env.NEXT_PUBLIC_DEBUG === '1') console.warn('getBcvRatePreferApi er-api error:', e);
  }
  const env = getEnvFallbackRate();
  if (env) {
    const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
    return { rate: env, source: 'env', date: today, rate_available: true, stale: true };
  }
  return null;
}
