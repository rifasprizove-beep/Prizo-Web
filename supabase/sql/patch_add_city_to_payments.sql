-- Patch: add city to payments and extend function create_payment_for_session
-- Safe to run multiple times

-- 1) Add column if not exists
alter table if exists public.payments
  add column if not exists city text null;

-- 2) Replace function signature to include p_city
create or replace function public.create_payment_for_session(
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
  p_currency text default 'VES'
) returns uuid
language plpgsql
security definer
as $$
declare
  v_payment_id uuid;
begin
  insert into public.payments(raffle_id, session_id, email, phone, city, method, reference, evidence_url, amount_ves, rate_used, rate_source, currency, status)
  values (p_raffle_id, p_session_id, p_email, p_phone, p_city, p_method, p_reference, p_evidence_url, p_amount_ves, p_rate_used, p_rate_source, p_currency, 'pending')
  returning id into v_payment_id;

  insert into public.payment_tickets(payment_id, ticket_id)
  select v_payment_id, t.id
  from public.tickets t
  where t.raffle_id = p_raffle_id and t.reserved_by = p_session_id and t.status='reserved' and (t.reserved_until is null or t.reserved_until > now());

  return v_payment_id;
end;
$$;

-- 3) Ensure privileges (anon + authenticated)
grant execute on function public.create_payment_for_session(uuid,uuid,text,text,text,text,text,text,numeric,numeric,text,text) to anon, authenticated;
