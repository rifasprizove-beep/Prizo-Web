import { getSupabase } from '../supabaseClient';

function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL || '';
}

export async function listTickets(raffleId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('raffle_id', raffleId)
    .order('ticket_number', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function reserveTickets(ids: string[], sessionId: string, minutes = 10) {
  const base = apiBase();
  if (base) {
    const res = await fetch(`${base}/reservations/ids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_ticket_ids: ids, p_session_id: sessionId, p_minutes: minutes }),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`reserveTickets api failed: ${res.status}`);
    const json = await res.json();
    return json?.data ?? [];
  } else {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('reserve_tickets', {
      p_ticket_ids: ids,
      p_session_id: sessionId,
      p_minutes: minutes,
    });
    if (error) throw error;
    return data ?? [];
  }
}

export async function releaseTickets(ids: string[], sessionId: string) {
  const base = apiBase();
  if (base) {
    const res = await fetch(`${base}/reservations/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_ticket_ids: ids, p_session_id: sessionId }),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`releaseTickets api failed: ${res.status}`);
    const json = await res.json();
    return json?.data ?? [];
  } else {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('release_tickets', {
      p_ticket_ids: ids,
      p_session_id: sessionId,
    });
    if (error) throw error;
    return data ?? [];
  }
}
