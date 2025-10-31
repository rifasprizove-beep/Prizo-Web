import { getSupabase } from './supabaseClient';

function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL || '';
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
    if (!res.ok) throw new Error(`reserveRandomTickets api failed: ${res.status}`);
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
    if (!res.ok) throw new Error(`ensureAndReserveRandomTickets api failed: ${res.status}`);
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
