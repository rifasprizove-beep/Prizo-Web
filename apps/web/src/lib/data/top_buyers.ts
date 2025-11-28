import { getSupabase } from '../supabaseClient';
import type { TopBuyer } from '../types';

export async function listTopBuyers(raffleId: string, limit: number = 20): Promise<TopBuyer[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('top_buyers_for_raffle', { p_raffle_id: raffleId, p_limit: limit });
  if (error) throw error;
  const rows = (data ?? []) as TopBuyer[];

  // Enriquecer con instagram (último registrado por email para esta rifa) usando columna instagram_user
  try {
    const enriched = await Promise.all(rows.map(async (r) => {
      if (!r.buyer_email) return r;
      try {
        const { data: payData, error: payErr } = await supabase
          .from('payments')
          .select('instagram_user')
          .eq('raffle_id', raffleId)
          .eq('email', r.buyer_email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!payErr && payData && (payData as any).instagram_user) {
          return { ...r, instagram: (payData as any).instagram_user } as TopBuyer;
        }
      } catch {}
      return r;
    }));
    return enriched;
  } catch (e) {
    return rows;
  }
}