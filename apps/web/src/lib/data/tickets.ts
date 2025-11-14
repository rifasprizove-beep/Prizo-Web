import { getSupabase } from '../supabaseClient';
import { apiAvailable, apiBase, markApiDown } from '../api';

// legacy alias
function legacyBase() { return apiBase(); }

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
  const base = legacyBase();
  if (base && (await apiAvailable().catch(() => false))) {
    try {
      const res = await fetch(`${base}/reservations/ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_ticket_ids: ids, p_session_id: sessionId, p_minutes: minutes }),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`reserveTickets api failed: ${res.status}`);
      const json = await res.json();
      return json?.data ?? [];
    } catch (e) {
      markApiDown();
      // Fallback transparente a Supabase directo si el backend está caído / CORS / 502.
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('reserve_tickets', {
          p_ticket_ids: ids,
          p_session_id: sessionId,
          p_minutes: minutes,
        });
        if (error) throw error as any;
        return data ?? [];
      } catch (inner) {
        throw inner;
      }
    }
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
  const base = legacyBase();
  if (base && (await apiAvailable().catch(() => false))) {
    try {
      const res = await fetch(`${base}/reservations/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_ticket_ids: ids, p_session_id: sessionId }),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`releaseTickets api failed: ${res.status}`);
      const json = await res.json();
      return json?.data ?? [];
    } catch (e) {
      markApiDown();
      // Fallback a Supabase directo
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('release_tickets', {
          p_ticket_ids: ids,
          p_session_id: sessionId,
        });
        if (error) throw error as any;
        return data ?? [];
      } catch (inner) {
        throw inner;
      }
    }
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
