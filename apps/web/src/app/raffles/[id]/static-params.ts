import { createClient } from '@supabase/supabase-js';

type Param = { id: string };

export async function generateStaticParams(): Promise<Param[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
  if (process.env.NEXT_PUBLIC_DEBUG === '1') console.warn('NEXT_PUBLIC_SUPABASE_URL/ANON_KEY no definidos en build. No se pre-generarán rutas dinámicas.');
    return [];
  }
  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('raffles')
      .select('id')
      .in('status', ['published', 'selling'])
      .limit(1000);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ id: String(r.id) }));
  } catch (e) {
  if (process.env.NEXT_PUBLIC_DEBUG === '1') console.warn('No se pudieron obtener rifas para SSG:', (e as any)?.message || e);
    return [];
  }
}
