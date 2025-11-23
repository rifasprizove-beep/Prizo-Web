-- Patch: add instagram to payments and update create_payment_for_session (idempotent)
set search_path = public;

alter table if exists public.payments
  add column if not exists instagram text null;

-- Update RPC to accept instagram and keep "hold" behavior from latest patch
create or replace function create_payment_for_session(
  p_raffle_id uuid,
  p_session_id uuid,
  p_email text,
  p_phone text,
  p_city text,
  p_method text,
  p_reference text,
  p_evidence_url text,
  p_amount_ves numeric,
  p_rate_used numeric,
  p_rate_source text,
  p_currency text default 'VES',
  p_ci text default null,
  p_instagram text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
begin
  insert into payments(raffle_id, session_id, email, phone, city, method, reference, evidence_url, amount_ves, rate_used, rate_source, currency, status, ci, instagram)
  values (p_raffle_id, p_session_id, p_email, p_phone, p_city, p_method, p_reference, p_evidence_url, p_amount_ves, p_rate_used, p_rate_source, p_currency, 'pending', p_ci, p_instagram)
  returning id into v_payment_id;

  -- Asociar tickets reservados por esa sesión para esa rifa (si aplica)
  insert into payment_tickets(payment_id, ticket_id)
  select v_payment_id, t.id
  from tickets t
  where t.raffle_id = p_raffle_id and t.reserved_by = p_session_id and t.status='reserved' and (t.reserved_until is null or t.reserved_until > now());

  -- "Congelar" los tickets enlazados al pago (quitar temporizador y sesión)
  update tickets t
     set reserved_until = null,
         reserved_by = null
   where t.id in (select pt.ticket_id from payment_tickets pt where pt.payment_id = v_payment_id)
     and t.status = 'reserved';

  return v_payment_id;
end;
$$;

grant execute on function create_payment_for_session(uuid,uuid,text,text,text,text,text,text,numeric,numeric,text,text,text,text) to anon, authenticated;
