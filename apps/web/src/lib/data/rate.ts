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
  // 1) Endpoint externo configurable
  const rateUrl = process.env.NEXT_PUBLIC_RATE_URL || `${process.env.NEXT_PUBLIC_API_URL || ''}/api/rate`;
  if (typeof window !== 'undefined' && rateUrl) {
    try {
      const res = await fetch(rateUrl, { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        // Acepta variantes de forma
        const rate = Number(j?.rate ?? j?.data?.rate);
        if (!isNaN(rate) && rate > 0) {
          return {
            rate,
            source: j?.source ?? j?.data?.source,
            date: j?.date ?? j?.data?.date,
            rate_available: true,
            stale: false,
          };
        }
      }
    } catch (e) {
      // Ignorar y continuar al fallback
      console.warn('getUsdVesRate (api) failed:', e);
    }
  }

  // 2) Fallback: Supabase settings.usdves_rate
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'usdves_rate')
      // Permite 0 filas sin provocar 406 (PGRST116):
      .maybeSingle();
    if (error) throw error;
    const v = typeof data?.value === 'string' ? JSON.parse(data.value) : data?.value;
    const rate = Number(v?.rate);
    if (!isNaN(rate) && rate > 0) {
      return {
        rate,
        source: v?.source,
        date: v?.date,
        rate_available: true,
        stale: false,
      };
    }
  } catch (e) {
    console.warn('getUsdVesRate (supabase) failed:', e);
  }

  // 3) Fallback de entorno manual: NEXT_PUBLIC_RATE_FALLBACK (número)
  const fallbackEnv = process.env.NEXT_PUBLIC_RATE_FALLBACK;
  if (fallbackEnv) {
    const rate = Number(fallbackEnv);
    if (!isNaN(rate) && rate > 0) {
      return { rate, source: 'env', date: new Date().toISOString().slice(0,10).replace(/-/g,'') };
    }
  }

  // 4) Fallback por defecto: 225 Bs/USD
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
  return { rate: 225, source: 'default', date: today, rate_available: true, stale: true };
}
