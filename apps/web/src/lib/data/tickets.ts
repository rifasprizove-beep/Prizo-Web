import { getSupabase } from '../supabaseClient';

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
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('reserve_tickets', {
    p_ticket_ids: ids,
    p_session_id: sessionId,
    p_minutes: minutes,
  });
  if (error) throw error;
  return data ?? [];
}

export async function releaseTickets(ids: string[], sessionId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('release_tickets', {
    p_ticket_ids: ids,
    p_session_id: sessionId,
  });
  if (error) throw error;
  return data ?? [];
}
