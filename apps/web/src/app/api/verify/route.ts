import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const includePending = (searchParams.get('include_pending') || 'true') === 'true';

  if (!q) {
    return NextResponse.json({ ok: true, data: [] });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, data: [], error: 'supabase_not_configured' }, { status: 200 });
  }

  const supabase = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
    },
  });

  // 1) Intentar RPC si existe
  try {
    const { data, error } = await supabase.rpc('verify_tickets', { p_query: q, p_include_pending: includePending });
    if (!error && Array.isArray(data)) {
      return NextResponse.json({ ok: true, data });
    }
  } catch {}

  // 2) Fallback: consulta embebida similar al backend
  try {
    const term = `*${q}*`;
    const pendingSet = includePending ? 'approved,pending,underpaid,overpaid,ref_mismatch' : 'approved';
    const select = 'payments!inner(id,email,ci,status,created_at),tickets(id,ticket_number,status,raffle_id,raffles(name))';
    const { data, error } = await supabase
      .from('payment_tickets')
      .select(select)
      .or(`payments.email.ilike.${term},payments.ci.ilike.${term}`)
      .in('payments.status', pendingSet.split(','));
    if (error) throw error;

    const rows = (data || []).map((r: any) => {
      const p = r.payments || {};
      const t = r.tickets || {};
      const rf = t.raffles?.name;
      return {
        raffle_id: t.raffle_id,
        raffle_name: rf,
        ticket_id: t.id,
        ticket_number: t.ticket_number,
        ticket_status: t.status,
        payment_id: p.id,
        payment_status: p.status,
        created_at: p.created_at,
      };
    });
    return NextResponse.json({ ok: true, data: rows });
  } catch {}

  // 3) Último intento: solo payments y luego tickets por payment_id
  try {
    const term = `*${q}*`;
    const pendingSet = includePending ? 'approved,pending,underpaid,overpaid,ref_mismatch' : 'approved';
    const { data: payments } = await supabase
      .from('payments')
      .select('id,email,ci,status,created_at')
      .or(`email.ilike.${term},ci.ilike.${term}`)
      .in('status', pendingSet.split(','));

    let rows: any[] = [];
    const ids = (payments || []).map((p: any) => p.id).filter(Boolean);
    if (ids.length) {
      const { data } = await supabase
        .from('payment_tickets')
        .select('payments!inner(id,email,ci,status,created_at),tickets(id,ticket_number,status,raffle_id,raffles(name))')
        .in('payment_id', ids);
      rows = (data || []).map((r: any) => {
        const p = r.payments || {};
        const t = r.tickets || {};
        const rf = t.raffles?.name;
        return {
          raffle_id: t.raffle_id,
          raffle_name: rf,
          ticket_id: t.id,
          ticket_number: t.ticket_number,
          ticket_status: t.status,
          payment_id: p.id,
          payment_status: p.status,
          created_at: p.created_at,
        };
      });
    }
    return NextResponse.json({ ok: true, data: rows });
  } catch {}

  return NextResponse.json({ ok: true, data: [] });
}
