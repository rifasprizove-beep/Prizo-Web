import { getSupabase } from './supabaseClient';
import { apiAvailable, apiBase, markApiDown } from './api';

// legacy alias for existing calls
function legacyBase() { return apiBase(); }

export async function getApiHealth(timeoutMs: number = 2000): Promise<{ ok: boolean; detail?: string } | null> {
  const base = apiBase();
  if (!base) return null; // sin API externa configurada
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/health`, { cache: 'no-store', signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, detail: `${res.status} ${txt}`.trim() };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, detail: e?.message ?? String(e) };
  }
}

export async function createPaymentForSession(args: {
  p_raffle_id: string;
  p_session_id: string;
  p_email: string | null;
  p_phone: string | null;
  p_city: string | null;
  p_method: string | null;
  p_reference: string | null;
  p_evidence_url: string | null;
  p_amount_ves: string | null;
  p_rate_used: string | null;
  p_rate_source: string | null;
  p_currency?: string;
  p_ci?: string | null;
  p_instagram?: string | null;
}): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('create_payment_for_session', args);
  if (error) throw error;
  return data as string;
}

export async function reserveRandomTickets(args: {
  p_raffle_id: string;
  p_session_id: string;
  p_quantity: number;
  p_minutes?: number;
}) {
  const base = legacyBase();
  if (base && (await apiAvailable().catch(() => false))) {
    try {
      const res = await fetch(`${base}/reservations/random`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...args, p_total: args.p_quantity }),
        cache: 'no-store',
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        let detail = raw;
        try {
          const err = raw ? JSON.parse(raw) : null;
          if (err && typeof err === 'object' && 'detail' in err) detail = (err as any).detail ?? raw;
        } catch {}
        throw new Error(`reserveRandomTickets api failed: ${res.status} ${detail}`.trim());
      }
      const json = await res.json();
      return json?.data ?? [];
    } catch (e) {
      // Fallback a Supabase directo si la API está caída / CORS / timeout
      markApiDown();
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('ensure_and_reserve_random_tickets', {
          p_raffle_id: args.p_raffle_id,
            p_total: args.p_quantity, // creamos si faltan
            p_session_id: args.p_session_id,
            p_quantity: args.p_quantity,
            p_minutes: args.p_minutes ?? 10,
        });
        if (error) throw error as any;
        return data ?? [];
      } catch (inner) {
        throw inner;
      }
    }
  } else {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('reserve_random_tickets', args);
    if (error) throw error;
    return data ?? [];
  }
}

export async function ensureAndReserveRandomTickets(args: {
  p_raffle_id: string;
  p_total: number;
  p_session_id: string;
  p_quantity: number;
  p_minutes?: number;
}) {
  const base = legacyBase();
  if (base && (await apiAvailable().catch(() => false))) {
    try {
      const res = await fetch(`${base}/reservations/random`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
        cache: 'no-store',
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        let detail = raw;
        try {
          const err = raw ? JSON.parse(raw) : null;
          if (err && typeof err === 'object' && 'detail' in err) detail = (err as any).detail ?? raw;
        } catch {}
        throw new Error(`ensureAndReserveRandomTickets api failed: ${res.status} ${detail}`.trim());
      }
      const json = await res.json();
      return json?.data ?? [];
    } catch (e) {
      // Fallback directo
      markApiDown();
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('ensure_and_reserve_random_tickets', args);
        if (error) throw error as any;
        return data ?? [];
      } catch (inner) {
        throw inner;
      }
    }
  } else {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('ensure_and_reserve_random_tickets', args);
    if (error) throw error;
    return data ?? [];
  }
}

export async function ensureSession(p_session_id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('ensure_session', { p_session_id });
  if (error) throw error;
  return true;
}

// Verificar por email o cédula si ya hay tickets/pagos relacionados
export async function verifyTicketsClient(q: string, includePending: boolean = true): Promise<any[] | null> {
  const base = apiBase();
  if (base) {
    try {
      const res = await fetch(`${base}/verify?q=${encodeURIComponent(q)}&include_pending=${includePending ? 'true' : 'false'}`, { cache: 'no-store' });
      if (!res.ok) return null;
      const json = await res.json().catch(() => null);
      return json && json.data ? (json.data as any[]) : [];
    } catch {
      // sigue al fallback
    }
  }
  // Fallback: intentar RPC directo en Supabase si existe
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('verify_tickets', { p_query: q, p_include_pending: includePending });
    if (error) return null;
    return (data ?? []) as any[];
  } catch {
    return null;
  }
}

export async function setPaymentCi(paymentId: string, ci: string): Promise<boolean> {
  const base = apiBase();
  if (!base) {
    // eslint-disable-next-line no-console
      if (process.env.NEXT_PUBLIC_DEBUG === '1') console.warn('[prizo] NEXT_PUBLIC_API_URL no está definido; omitiendo setPaymentCi');
    return false;
  }
  const attempt = async (n: number) => {
    const res = await fetch(`${base}/payments/set-ci`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: paymentId, ci }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
    if (process.env.NEXT_PUBLIC_DEBUG === '1') console.warn(`[prizo] setPaymentCi intento ${n} falló: ${res.status} ${txt}`.trim());
    }
    return res.ok;
  };
  // Reintentos con backoff simple
  const max = 3;
  for (let i = 0; i < max; i++) {
    const ok = await attempt(i + 1);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 200 * (i + 1)));
  }
  return false;
}
