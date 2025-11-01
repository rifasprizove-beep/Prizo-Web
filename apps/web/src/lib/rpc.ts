import { getSupabase } from './supabaseClient';

function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL || '';
}

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
  const base = apiBase();
  if (base) {
    const res = await fetch(`${base}/reservations/random`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...args, p_total: args.p_quantity }),
      cache: 'no-store',
    });
    if (!res.ok) {
      try {
        const err = await res.json();
        throw new Error(`reserveRandomTickets api failed: ${res.status} ${err?.detail ?? ''}`.trim());
      } catch {
        const txt = await res.text();
        throw new Error(`reserveRandomTickets api failed: ${res.status} ${txt}`.trim());
      }
    }
    const json = await res.json();
    return json?.data ?? [];
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
  const base = apiBase();
  if (base) {
    const res = await fetch(`${base}/reservations/random`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      cache: 'no-store',
    });
    if (!res.ok) {
      try {
        const err = await res.json();
        throw new Error(`ensureAndReserveRandomTickets api failed: ${res.status} ${err?.detail ?? ''}`.trim());
      } catch {
        const txt = await res.text();
        throw new Error(`ensureAndReserveRandomTickets api failed: ${res.status} ${txt}`.trim());
      }
    }
    const json = await res.json();
    return json?.data ?? [];
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
