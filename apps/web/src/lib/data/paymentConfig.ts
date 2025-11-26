import { getSupabase } from '../supabaseClient';

export type RafflePaymentInfo = {
  bank?: string | null;
  phone?: string | null;
  id_number?: string | null;
  holder?: string | null;
  type?: string | null;
  account?: string | null;
  active?: boolean | null;
  method_label?: string | null;
};

export type RafflePaymentMethod = RafflePaymentInfo & { key?: string | null };

function friendlyLabelFromKey(key?: string | null): string | null {
  const k = (key || '').toLowerCase();
  if (!k) return null;
  if (/pago[_\s-]*movil|movil|móvil/.test(k)) return 'Pago Móvil';
  if (/transfer|transferen|bank|cuenta/.test(k)) return 'Transferencia';
  // Title Case fallback
  const clean = k.replace(/[_-]+/g, ' ').trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : null;
}

export async function getRafflePaymentMethods(raffleId: string): Promise<RafflePaymentMethod[] | null> {
  const supabase = getSupabase();
  try {
    const { data, error } = await supabase
      .from('raffles')
      .select('payment_methods')
      .eq('id', raffleId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    let pm = (data as any).payment_methods ?? null;
    if (!pm) return null;

    const pick = (obj: any, keyHint?: string | null): RafflePaymentMethod => {
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
        holder: first(obj, ['holder', 'pm_holder', 'titular', 'name']),
        type: first(obj, ['type', 'pm_type', 'account_type']),
        account: first(obj, ['account', 'pm_account', 'account_number', 'cuenta']),
        active: first(obj, ['active', 'pm_active']),
        method_label: first(obj, ['method_label', 'pm_method_label', 'label']) ?? friendlyLabelFromKey(keyHint),
        key: first(obj, ['key', 'id', 'name']),
      } as RafflePaymentMethod;
    };

    const out: RafflePaymentMethod[] = [];
    if (Array.isArray(pm)) {
      pm.forEach((m: any, i: number) => out.push(pick(m, String(m?.key ?? i))));
    } else if (typeof pm === 'object') {
      // Si viene como objeto con claves por método
      Object.keys(pm).forEach((k) => {
        const obj = (pm as any)[k];
        if (obj && typeof obj === 'object') {
          const m = pick(obj, k);
          m.key = m.key ?? k;
          out.push(m);
        }
      });
      if (!out.length) out.push(pick(pm));
    }
    return out.length ? out : null;
  } catch (e) {
    console.warn('Payment methods not available on raffles table:', e);
    return null;
  }
}

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

    let pm = (data as any).payment_methods ?? null;
    if (!pm) return null;

    // Soportar objeto o array de métodos. Si es array, tomar el primero activo o el primero.
    const pick = (obj: any, keyHint?: string | null): RafflePaymentInfo => {
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
        // Muchos esquemas usan "name" para el titular
        holder: first(obj, ['holder', 'pm_holder', 'titular', 'name']),
        // Algunos esquemas usan "account_type" para el tipo de cuenta
        type: first(obj, ['type', 'pm_type', 'account_type']),
        account: first(obj, ['account', 'pm_account', 'account_number', 'cuenta']),
        active: first(obj, ['active', 'pm_active']),
        method_label: first(obj, ['method_label', 'pm_method_label', 'label']) ?? friendlyLabelFromKey(keyHint),
      } as RafflePaymentInfo;
    };

    // Si viene anidado bajo una clave como "pago_movil" u otra, tomar ese objeto
    if (!Array.isArray(pm) && typeof pm === 'object') {
      const keys = Object.keys(pm);
      if (keys.length === 1 && typeof (pm as any)[keys[0]] === 'object') {
        pm = (pm as any)[keys[0]];
      } else if ((pm as any)['pago_movil']) {
        pm = (pm as any)['pago_movil'];
      }
    }

    if (Array.isArray(pm)) {
      const firstActive = pm.find((m: any) => !!m?.active) ?? pm[0];
      return firstActive ? pick(firstActive) : null;
    } else if (typeof pm === 'object') {
      // si viene con claves de método, tomar una amigable
      const keys = Object.keys(pm ?? {});
      if (keys.length && typeof (pm as any)[keys[0]] === 'object') {
        return pick((pm as any)[keys[0]], keys[0]);
      }
      return pick(pm);
    }

    return null;
  } catch (e) {
    console.warn('Payment info not available on raffles table:', e);
    return null;
  }
}
