import { getSupabase } from '../supabaseClient';
import type { Raffle, RaffleTicketCounters } from '../types';

export async function getRaffle(id: string): Promise<Raffle | null> {
  let supabase;
  try { supabase = getSupabase(); } catch (e) { if (process.env.NEXT_PUBLIC_DEBUG === '1') console.error('Supabase no configurado:', e); return null; }
  // Intentar incluir allow_manual y min_ticket_purchase; hacer fallbacks si alguna columna no existe
  const trySelect = async (mode: 'both' | 'onlyAllow' | 'none') => {
    const base = 'id,name,description,status,currency,ticket_price_cents,is_free,prize_amount_cents,top_buyer_prize_cents,image_url,total_tickets';
    const withAllow = `${base},allow_manual`;
    const withBoth = `${withAllow},min_ticket_purchase`;
    const fields = mode === 'both' ? withBoth : mode === 'onlyAllow' ? withAllow : base;
    return supabase.from('raffles').select(fields).eq('id', id).maybeSingle();
  };
  let res: any = await trySelect('both');
  if (res.error) res = await trySelect('onlyAllow');
  if (res.error) res = await trySelect('none');
  if (res.error) throw res.error;
  return (res.data ?? null) as Raffle | null;
}

export async function getRaffleCounters(raffleId: string): Promise<RaffleTicketCounters | null> {
  let supabase;
  try { supabase = getSupabase(); } catch (e) { if (process.env.NEXT_PUBLIC_DEBUG === '1') console.error('Supabase no configurado:', e); return null; }
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
  try { supabase = getSupabase(); } catch (e) { if (process.env.NEXT_PUBLIC_DEBUG === '1') console.error('Supabase no configurado:', e); return []; }
  const trySelect = async (mode: 'both' | 'onlyAllow' | 'none') => {
    const base = 'id,name,description,status,currency,ticket_price_cents,is_free,prize_amount_cents,top_buyer_prize_cents,image_url,total_tickets';
    const withAllow = `${base},allow_manual`;
    const withBoth = `${withAllow},min_ticket_purchase`;
    const fields = mode === 'both' ? withBoth : mode === 'onlyAllow' ? withAllow : base;
    return supabase
      .from('raffles')
      .select(fields)
      .in('status', ['published', 'selling', 'drawn'])
      .order('created_at', { ascending: false });
  };
  let res: any = await trySelect('both');
  if (res.error) res = await trySelect('onlyAllow');
  if (res.error) res = await trySelect('none');
  if (res.error) throw res.error;
  return (res.data ?? []) as Raffle[];
}
