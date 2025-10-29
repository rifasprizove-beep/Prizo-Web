import { getSupabase } from '../supabaseClient';
import type { Raffle, RaffleTicketCounters } from '../types';

export async function getRaffle(id: string): Promise<Raffle | null> {
  let supabase;
  try { supabase = getSupabase(); } catch (e) { console.error('Supabase no configurado:', e); return null; }
  // Evitar 400 si la columna allow_manual aún no existe: consultar sin esa columna.
  const res = await supabase
    .from('raffles')
    .select('id,name,description,status,currency,ticket_price_cents,image_url,total_tickets')
    .eq('id', id)
    .maybeSingle();
  if (res.error) throw res.error;
  return (res.data ?? null) as Raffle | null;
}

export async function getRaffleCounters(raffleId: string): Promise<RaffleTicketCounters | null> {
  let supabase;
  try { supabase = getSupabase(); } catch (e) { console.error('Supabase no configurado:', e); return null; }
  const { data, error } = await supabase
    .from('raffle_ticket_counters')
    .select('*')
    .eq('raffle_id', raffleId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as RaffleTicketCounters | null;
}

export async function listRaffles(): Promise<Raffle[]> {
  let supabase;
  try { supabase = getSupabase(); } catch (e) { console.error('Supabase no configurado:', e); return []; }
  // Para evitar 400 en consolas cuando la columna allow_manual aún no existe, consultamos sin esa columna.
  const res = await supabase
    .from('raffles')
    .select('id,name,description,status,currency,ticket_price_cents,image_url,total_tickets')
    .in('status', ['published', 'selling'])
    .order('created_at', { ascending: false });
  if (res.error) throw res.error;
  return (res.data ?? []) as Raffle[];
}
