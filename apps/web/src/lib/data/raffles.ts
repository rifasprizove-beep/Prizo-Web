import { getSupabase } from '../supabaseClient';
import type { Raffle, RaffleTicketCounters } from '../types';

export async function getRaffle(id: string): Promise<Raffle | null> {
  let supabase;
  try { supabase = getSupabase(); } catch (e) { if (process.env.NEXT_PUBLIC_DEBUG === '1') console.error('Supabase no configurado:', e); return null; }
  // Intentar incluir allow_manual y min_ticket_purchase; hacer fallbacks si alguna columna no existe
  const trySelect = async (mode: 'both' | 'onlyAllow' | 'none') => {
    const base = 'id,name,description,status,currency,ticket_price_cents,is_free,prize_amount_cents,top_buyer_prize_cents,winners_count,image_url,total_tickets,starts_at,ends_at';
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
  // Intentar primero por RPC (si existe la función `raffle_ticket_counters()`)
  try {
    const rpcRes: any = await supabase.rpc('raffle_ticket_counters');
    if (rpcRes.error) throw rpcRes.error;
    const rows = rpcRes.data ?? rpcRes;
    if (process.env.NEXT_PUBLIC_DEBUG === '1') {
      try {
        // eslint-disable-next-line no-console
        console.debug('[getRaffleCounters] rpcRes:', rpcRes);
      } catch {}
    }
    if (Array.isArray(rows)) {
      const found = rows.find((r: any) => String(r.raffle_id) === String(raffleId));
      return found ? (found as RaffleTicketCounters) : null;
    }
    // Si la RPC devolvió un único objeto
    if (rows && String((rows as any).raffle_id) === String(raffleId)) {
      return rows as RaffleTicketCounters;
    }
    return null;
  } catch (err) {
    // Si RPC falla o no existe, intentar fallback directo sobre tickets
    if (process.env.NEXT_PUBLIC_DEBUG === '1') {
      try {
        // eslint-disable-next-line no-console
        console.warn('[getRaffleCounters] rpc failed, falling back to direct tickets query', err);
      } catch {}
    }
  }

  // Fallback: contar directamente desde la tabla `tickets` y obtener total_tickets desde `raffles`.
  try {
    const soldRes: any = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('raffle_id', raffleId)
      .eq('status', 'sold');
    const reservedRes: any = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('raffle_id', raffleId)
      .eq('status', 'reserved')
      .gt('reserved_until', new Date().toISOString());
    const raffleRes: any = await supabase
      .from('raffles')
      .select('total_tickets')
      .eq('id', raffleId)
      .maybeSingle();

    const sold = (soldRes && typeof soldRes.count === 'number') ? soldRes.count : (soldRes?.data?.length ?? 0);
    const reserved = (reservedRes && typeof reservedRes.count === 'number') ? reservedRes.count : (reservedRes?.data?.length ?? 0);
    const total = raffleRes && raffleRes.data && raffleRes.data.total_tickets != null ? Number(raffleRes.data.total_tickets) : 0;
    const available = Math.max(0, total - (Number(sold) + Number(reserved)));
    return {
      raffle_id: raffleId,
      total_tickets: total,
      sold: Number(sold),
      reserved: Number(reserved),
      available: available,
    } as RaffleTicketCounters;
  } catch (finalErr) {
    if (process.env.NEXT_PUBLIC_DEBUG === '1') {
      try {
        // eslint-disable-next-line no-console
        console.error('[getRaffleCounters] final fallback failed', finalErr);
      } catch {}
    }
    throw finalErr;
  }
}

export async function listRaffles(): Promise<Raffle[]> {
  let supabase;
  try { supabase = getSupabase(); } catch (e) { if (process.env.NEXT_PUBLIC_DEBUG === '1') console.error('Supabase no configurado:', e); return []; }
  const trySelect = async (mode: 'both' | 'onlyAllow' | 'none') => {
    const base = 'id,name,description,status,currency,ticket_price_cents,is_free,prize_amount_cents,top_buyer_prize_cents,winners_count,image_url,total_tickets,starts_at,ends_at';
    const withAllow = `${base},allow_manual`;
    const withBoth = `${withAllow},min_ticket_purchase`;
    const fields = mode === 'both' ? withBoth : mode === 'onlyAllow' ? withAllow : base;
    return supabase
      .from('raffles')
      .select(fields)
      // Excluir draft y archived: sólo estados visibles para usuarios.
      .in('status', ['published', 'selling', 'closed', 'drawn'])
      .order('created_at', { ascending: false });
  };
  let res: any = await trySelect('both');
  if (res.error) res = await trySelect('onlyAllow');
  if (res.error) res = await trySelect('none');
  if (res.error) throw res.error;
  return (res.data ?? []) as Raffle[];
}
