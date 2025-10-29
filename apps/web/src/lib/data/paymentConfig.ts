import { getSupabase } from '../supabaseClient';

export type RafflePaymentInfo = {
  bank?: string | null;
  phone?: string | null;
  id_number?: string | null;
  holder?: string | null;
  type?: string | null;
  active?: boolean | null;
  method_label?: string | null;
};

export async function getRafflePaymentInfo(raffleId: string): Promise<RafflePaymentInfo | null> {
  const supabase = getSupabase();
  try {
    // Lectura preferente desde el campo JSONB payment_methods
    const { data, error } = await supabase
      .from('raffles')
      .select('payment_methods')
      .eq('id', raffleId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const pm = (data as any).payment_methods ?? null;
    if (!pm) return null;

    // Soportar objeto o array de métodos. Si es array, tomar el primero activo o el primero.
    const pick = (obj: any): RafflePaymentInfo => {
      // Función utilitaria para encontrar la primera clave disponible entre varias alternativas
      const first = (o: any, keys: string[]) => {
        for (const k of keys) {
          if (o && o[k] != null && o[k] !== '') return o[k];
        }
        return null;
      };
      return {
        bank: first(obj, ['bank', 'pm_bank']),
        phone: first(obj, ['phone', 'pm_phone']),
        id_number: first(obj, ['id_number', 'id', 'pm_id', 'cedula', 'rif']),
        holder: first(obj, ['holder', 'pm_holder', 'titular']),
        type: first(obj, ['type', 'pm_type']),
        active: first(obj, ['active', 'pm_active']),
        method_label: first(obj, ['method_label', 'pm_method_label', 'label']),
      } as RafflePaymentInfo;
    };

    if (Array.isArray(pm)) {
      const firstActive = pm.find((m: any) => !!m?.active) ?? pm[0];
      return firstActive ? pick(firstActive) : null;
    } else if (typeof pm === 'object') {
      return pick(pm);
    }

    return null;
  } catch (e) {
    console.warn('Payment info not available on raffles table:', e);
    return null;
  }
}
