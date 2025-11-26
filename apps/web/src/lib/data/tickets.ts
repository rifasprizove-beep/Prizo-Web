import { getSupabase } from '../supabaseClient';
import { apiAvailable, apiBase, markApiDown } from '../api';

// legacy alias
function legacyBase() { return apiBase(); }

export async function listTickets(raffleId: string) {
  const supabase = getSupabase();
  // Supabase limita ~1000 filas por request. Paginamos en bloques.
  const PAGE = 1000;
  let from = 0;
  const all: any[] = [];
  // Límite de seguridad por si hay datos inconsistentes (p.ej. > 100k)
  const HARD_CAP = 100_000;
  while (from < HARD_CAP) {
    const to = from + PAGE - 1;
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('raffle_id', raffleId)
      .order('ticket_number', { ascending: true })
      .range(from, to);
    if (error) throw error;
    const chunk = data ?? [];
    all.push(...chunk);
    if (chunk.length < PAGE) break; // última página
    from += PAGE;
  }
  // Asegurar orden por ticket_number por si el backend no lo respeta entre páginas
  all.sort((a, b) => (Number(a.ticket_number) || 0) - (Number(b.ticket_number) || 0));
  return all;
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
