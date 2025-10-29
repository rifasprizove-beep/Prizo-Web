import { getSupabase } from '../supabaseClient';
import type { Draw } from '../types';

export async function getLastDraw(raffleId: string): Promise<Draw | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('draws')
    .select('*')
    .eq('raffle_id', raffleId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Draw | null;
}
