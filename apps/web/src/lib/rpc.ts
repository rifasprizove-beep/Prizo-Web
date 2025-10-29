import { getSupabase } from './supabaseClient';

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
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('reserve_random_tickets', args);
  if (error) throw error;
  return data ?? [];
}

export async function ensureAndReserveRandomTickets(args: {
  p_raffle_id: string;
  p_total: number;
  p_session_id: string;
  p_quantity: number;
  p_minutes?: number;
}) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('ensure_and_reserve_random_tickets', args);
  if (error) throw error;
  return data ?? [];
}

export async function ensureSession(p_session_id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('ensure_session', { p_session_id });
  if (error) throw error;
  return true;
}
