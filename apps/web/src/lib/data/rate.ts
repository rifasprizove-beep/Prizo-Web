import { getSupabase } from '../supabaseClient';

export type RateInfo = {
  rate: number;
  source?: string;
  date?: string;
  rate_available?: boolean;
  stale?: boolean;
};

export function centsToUsd(cents: number | undefined | null): number {
  if (!cents) return 0;
  return Math.round(cents) / 100;
}

export function round2(n: number | undefined | null): number {
  if (!n || !isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
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
    console.warn('getUsdVesRate (er-api) failed:', e);
  }

  // 2) Endpoint configurable o interno (/api/rate -> BCV)
  const rateUrl = process.env.NEXT_PUBLIC_RATE_URL || `${process.env.NEXT_PUBLIC_API_URL || ''}/api/rate`;
  if (typeof window !== 'undefined' && rateUrl) {
    try {
      const res = await fetch(rateUrl, { cache: 'no-store' });
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
      console.warn('getUsdVesRate (api) failed:', e);
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
    console.warn('getUsdVesRate (supabase) failed:', e);
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
