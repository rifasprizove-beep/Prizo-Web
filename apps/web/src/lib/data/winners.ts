import { getSupabase } from '../supabaseClient';
import type { Winner } from '../types';

export async function listWinners(raffleId: string): Promise<Winner[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('winners')
    .select('*')
    .eq('raffle_id', raffleId)
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Winner[];
}
