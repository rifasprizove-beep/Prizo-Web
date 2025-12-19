import { getSupabase } from './supabaseClient';
import { apiAvailable, apiBase, markApiDown } from './api';

// legacy alias for existing calls
function legacyBase() { return apiBase(); }

export async function getApiHealth(timeoutMs: number = 2000): Promise<{ ok: boolean; detail?: string } | null> {
  const base = apiBase();
  if (!base) return null; // sin API externa configurada
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/health`, { cache: 'no-store', signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, detail: `${res.status} ${txt}`.trim() };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, detail: e?.message ?? String(e) };
  }
}

export async function createPaymentForSession(args: {
  p_raffle_id: string;
  p_session_id: string;
  p_email: string | null;
  p_phone: string | null;
  p_city: string | null;
  p_method: string | null;
  p_reference: string | null;
  p_evidence_url: string | null;
  p_amount_ves: number | null;
  p_rate_used: number | null;
  p_rate_source: string | null;
  p_currency?: string;
  p_ci?: string | null;
  p_instagram?: string | null;
  // Compatibilidad con despliegues antiguos que usaban instagram_user
  p_instagram_user?: string | null;
}): Promise<string> {
  const supabase = getSupabase();
  // Limpiar payload: usar sólo parámetros válidos y normalizar números
  const clean: any = {
    p_raffle_id: args.p_raffle_id,
    p_session_id: args.p_session_id,
    p_email: args.p_email ?? null,
    p_phone: args.p_phone ?? null,
    p_city: args.p_city ?? null,
    p_method: args.p_method ?? null,
    p_reference: args.p_reference ?? null,
    p_evidence_url: args.p_evidence_url ?? null,
    p_amount_ves: args.p_amount_ves == null ? null : Number(args.p_amount_ves),
    p_rate_used: args.p_rate_used == null ? null : Number(args.p_rate_used),
    p_rate_source: args.p_rate_source ?? null,
    p_currency: args.p_currency ?? 'VES',
    p_ci: args.p_ci ?? null,
    p_instagram: args.p_instagram ?? null,
  };

  try {
    const { data, error } = await supabase.rpc('create_payment_for_session', clean);
    if (error) throw error;
    return data as string;
  } catch (err: any) {
    // Fallback para instalaciones antiguas: reintentar sin p_instagram o con p_instagram_user
    const msg = (err?.message || err?.toString?.() || '') as string;
    const isNotFound = msg.includes('Could not find the function') || msg.includes('PGRST202');
    if (!isNotFound) throw err;

    // 1) Reintentar cambiando a p_instagram_user
    const legacy: any = { ...clean };
    if (legacy.p_instagram != null) {
      legacy.p_instagram_user = legacy.p_instagram;
    }
    delete legacy.p_instagram;
    try {
      const { data, error } = await supabase.rpc('create_payment_for_session', legacy);
      if (error) throw error;
      return data as string;
    } catch (err2) {
      // 2) Último intento: sin instagram del todo
      const noIg: any = { ...legacy };
      delete noIg.p_instagram_user;
      const { data, error } = await supabase.rpc('create_payment_for_session', noIg);
      if (error) throw error;
      return data as string;
    }
  }
}

export async function reserveRandomTickets(args: {
  p_raffle_id: string;
  p_session_id: string;
  p_quantity: number;
  p_minutes?: number;
  p_total?: number; // optional: if provided, used to ensure tickets for raffle
}) {
  const base = legacyBase();
  // Ensure we send a correct p_total to the backend. If caller didn't provide it,
  // fetch the raffle's `total_tickets` from Supabase instead of falling back to
  // `p_quantity` (that previously caused creating incorrect number of tickets).
  let p_total_to_send: number | undefined = args.p_total;
  if (p_total_to_send == null) {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('raffles').select('total_tickets').eq('id', args.p_raffle_id).maybeSingle();
      if (!error && data && typeof data.total_tickets === 'number') {
        p_total_to_send = data.total_tickets;
      }
    } catch {
      // ignore and let fallback below use p_quantity if we couldn't fetch
    }
  }

  if (base && (await apiAvailable().catch(() => false))) {
    try {
      const body = { ...args, ...(p_total_to_send != null ? { p_total: p_total_to_send } : {}) };
      const res = await fetch(`${base}/reservations/random`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        let detail = raw;
        try {
          const err = raw ? JSON.parse(raw) : null;
          if (err && typeof err === 'object' && 'detail' in err) detail = (err as any).detail ?? raw;
        } catch {}
        throw new Error(`reserveRandomTickets api failed: ${res.status} ${detail}`.trim());
      }
      const json = await res.json();
      return json?.data ?? [];
    } catch (e) {
      // Fallback a Supabase directo si la API está caída / CORS / timeout
      markApiDown();
      try {
          const supabase = getSupabase();
          // Si no conseguimos obtener el p_total canónico, NO utilices la función
          // que crea tickets (`ensure_and_reserve_random_tickets`) porque puede
          // insertar nuevos tickets. En su lugar, intenta reservar sólo entre
          // los tickets existentes usando `reserve_random_tickets`.
          if (p_total_to_send == null) {
            const { data, error } = await supabase.rpc('reserve_random_tickets', {
              p_raffle_id: args.p_raffle_id,
              p_session_id: args.p_session_id,
              p_quantity: args.p_quantity,
              p_minutes: args.p_minutes ?? 10,
            });
            if (error) throw error as any;
            return data ?? [];
          }

          // Si sí tenemos el total canónico, está bien llamar a la función que
          // puede crear tickets hasta ese total.
          const { data, error } = await supabase.rpc('ensure_and_reserve_random_tickets', {
            p_raffle_id: args.p_raffle_id,
            p_total: p_total_to_send,
            p_session_id: args.p_session_id,
            p_quantity: args.p_quantity,
            p_minutes: args.p_minutes ?? 10,
          });
          if (error) throw error as any;
          return data ?? [];
      } catch (inner) {
        throw inner;
      }
    }
  } else {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('reserve_random_tickets', args);
    if (error) throw error;
    return data ?? [];
  }
}

export async function ensureAndReserveRandomTickets(args: {
  p_raffle_id: string;
  p_total: number;
  p_session_id: string;
  p_quantity: number;
  p_minutes?: number;
}) {
  const base = legacyBase();
  if (base && (await apiAvailable().catch(() => false))) {
    try {
      const res = await fetch(`${base}/reservations/random`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
        cache: 'no-store',
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        let detail = raw;
        try {
          const err = raw ? JSON.parse(raw) : null;
          if (err && typeof err === 'object' && 'detail' in err) detail = (err as any).detail ?? raw;
        } catch {}
        throw new Error(`ensureAndReserveRandomTickets api failed: ${res.status} ${detail}`.trim());
      }
      const json = await res.json();
      return json?.data ?? [];
    } catch (e) {
      // Fallback directo
      markApiDown();
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.rpc('ensure_and_reserve_random_tickets', args);
        if (error) throw error as any;
        return data ?? [];
      } catch (inner) {
        throw inner;
      }
    }
  } else {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('ensure_and_reserve_random_tickets', args);
    if (error) throw error;
    return data ?? [];
  }
}

export async function ensureSession(p_session_id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('ensure_session', { p_session_id });
  if (error) throw error;
  return true;
}

// Verificar por email o cédula si ya hay tickets/pagos relacionados
export async function verifyTicketsClient(q: string, includePending: boolean = false): Promise<any[] | null> {
  // Normalización ligera de cédula: quitar espacios y mayúsculas
  let query = q.trim();
  if (/^(?:[VE]-)?\d{5,10}$/i.test(query)) {
    query = query.toUpperCase();
  }

  // Preferir proxy local para evitar CORS y usar service key
  try {
    const res = await fetch(`/api/verify?q=${encodeURIComponent(query)}&include_pending=${includePending ? 'true' : 'false'}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && Array.isArray(json.data)) {
        const initial = json.data as any[];
        // Si la respuesta del proxy alcanza exactamente 1000 filas, intentar paginación extendida vía RPC
        if (initial.length >= 1000) {
          try {
            const supabase = getSupabase();
            const PAGE = 1000;
            let from = 0;
            let all: any[] = [];
            for (let pageIdx = 0; pageIdx < 50; pageIdx++) { // ampliar límite a 50k potenciales
              const to = from + PAGE - 1;
              const rq = supabase
                .rpc('verify_tickets', { p_query: query, p_include_pending: includePending })
                .range(from, to);
              const { data, error } = await rq;
              if (error) break;
              const chunk = (data ?? []) as any[];
              all = all.concat(chunk);
              if (chunk.length < PAGE) break;
              from += PAGE;
            }
            if (all.length > initial.length) return all;
          } catch {}
        }
        return initial;
      }
    }
  } catch {}

  // Último fallback / paginación manual para superar límite de 1000 filas
  try {
    const supabase = getSupabase();
    const PAGE = 1000;
    let from = 0;
    let all: any[] = [];
    for (let pageIdx = 0; pageIdx < 30; pageIdx++) { // seguridad: máximo 30k filas
      const to = from + PAGE - 1;
      // Supabase permite range() sobre RPC que retorna TABLE
      const rq = supabase
        .rpc('verify_tickets', { p_query: query, p_include_pending: includePending })
        .range(from, to);
      const { data, error } = await rq;
      if (error) {
        // Si hubo algún error y no tenemos resultados previos, devolver null
        return all.length ? all : null;
      }
      const chunk = (data ?? []) as any[];
      all = all.concat(chunk);
      if (chunk.length < PAGE) break; // última página
      from += PAGE;
    }
    return all;
  } catch {
    return null;
  }
}

export async function setPaymentCi(paymentId: string, ci: string): Promise<boolean> {
  const base = apiBase();
  if (!base) {
    // eslint-disable-next-line no-console
      if (process.env.NEXT_PUBLIC_DEBUG === '1') console.warn('[prizo] NEXT_PUBLIC_API_URL no está definido; omitiendo setPaymentCi');
    return false;
  }
  const attempt = async (n: number) => {
    const res = await fetch(`${base}/payments/set-ci`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: paymentId, ci }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
    if (process.env.NEXT_PUBLIC_DEBUG === '1') console.warn(`[prizo] setPaymentCi intento ${n} falló: ${res.status} ${txt}`.trim());
    }
    return res.ok;
  };
  // Reintentos con backoff simple
  const max = 3;
  for (let i = 0; i < max; i++) {
    const ok = await attempt(i + 1);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 200 * (i + 1)));
  }
  return false;
}
