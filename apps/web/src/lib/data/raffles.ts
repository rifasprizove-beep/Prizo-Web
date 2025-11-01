import { getSupabase } from '../supabaseClient';
import type { Raffle, RaffleTicketCounters } from '../types';

export async function getRaffle(id: string): Promise<Raffle | null> {
  let supabase;
  try { supabase = getSupabase(); } catch (e) { console.error('Supabase no configurado:', e); return null; }
  // Intentar incluir allow_manual; si no existe la columna, reintentar sin ella
  const trySelect = async (withAllow: boolean) => {
    const fields = withAllow
      ? 'id,name,description,status,currency,ticket_price_cents,is_free,prize_amount_cents,top_buyer_prize_cents,image_url,total_tickets,allow_manual'
      : 'id,name,description,status,currency,ticket_price_cents,is_free,prize_amount_cents,top_buyer_prize_cents,image_url,total_tickets';
    return supabase.from('raffles').select(fields).eq('id', id).maybeSingle();
  };
  let res: any = await trySelect(true);
  if (res.error) {
    // Si falla por columna desconocida, reintenta sin allow_manual
    res = await trySelect(false);
  }
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
  const trySelect = async (withAllow: boolean) => {
    const fields = withAllow
      ? 'id,name,description,status,currency,ticket_price_cents,is_free,prize_amount_cents,top_buyer_prize_cents,image_url,total_tickets,allow_manual'
      : 'id,name,description,status,currency,ticket_price_cents,is_free,prize_amount_cents,top_buyer_prize_cents,image_url,total_tickets';
    return supabase
      .from('raffles')
      .select(fields)
      .in('status', ['published', 'selling'])
      .order('created_at', { ascending: false });
  };
  let res: any = await trySelect(true);
  if (res.error) res = await trySelect(false);
  if (res.error) throw res.error;
  return (res.data ?? []) as Raffle[];
}
