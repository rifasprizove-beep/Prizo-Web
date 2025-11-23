import { getSupabase } from '../supabaseClient';
import type { TopBuyer } from '../types';

export async function listTopBuyers(raffleId: string, limit: number = 20): Promise<TopBuyer[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('top_buyers_for_raffle', { p_raffle_id: raffleId, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as TopBuyer[];
}