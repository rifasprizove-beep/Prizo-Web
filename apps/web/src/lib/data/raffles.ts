import { getSupabase } from '../supabaseClient';
import type { Raffle, RaffleTicketCounters } from '../types';

export async function getRaffle(id: string): Promise<Raffle | null> {
  let supabase;
  try { supabase = getSupabase(); } catch (e) { console.error('Supabase no configurado:', e); return null; }
  // Intento 1: incluir allow_manual (nuevo). Si la columna no existe (BD antigua), reintenta sin ella.
  let { data, error } = await supabase
    .from('raffles')
    .select('id,name,description,status,currency,ticket_price_cents,image_url,total_tickets,allow_manual')
    .eq('id', id)
    .maybeSingle();
  if (error && String(error.message || '').toLowerCase().includes('allow_manual')) {
    const res2 = await supabase
      .from('raffles')
      .select('id,name,description,status,currency,ticket_price_cents,image_url,total_tickets')
      .eq('id', id)
      .maybeSingle();
    if (res2.error) throw res2.error;
    return (res2.data ?? null) as Raffle | null;
  }
  if (error) throw error;
  return (data ?? null) as Raffle | null;
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
  let { data, error } = await supabase
    .from('raffles')
    .select('id,name,description,status,currency,ticket_price_cents,image_url,total_tickets,allow_manual')
    .in('status', ['published', 'selling'])
    .order('created_at', { ascending: false });
  if (error && String(error.message || '').toLowerCase().includes('allow_manual')) {
    const res2 = await supabase
      .from('raffles')
      .select('id,name,description,status,currency,ticket_price_cents,image_url,total_tickets')
      .in('status', ['published', 'selling'])
      .order('created_at', { ascending: false });
    if (res2.error) throw res2.error;
    return (res2.data ?? []) as Raffle[];
  }
  if (error) throw error;
  return (data ?? []) as Raffle[];
}
