-- Patch: add CI and top buyer fields to payments, and update RPC
-- Safe to run multiple times

alter table if exists public.payments
  add column if not exists ci text null,
  add column if not exists is_top_buyer boolean not null default false;

-- Update RPC to accept CI
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
  p_currency text default 'VES',
  p_ci text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
begin
  insert into payments(raffle_id, session_id, email, phone, city, method, reference, evidence_url, amount_ves, rate_used, rate_source, currency, status, ci)
  values (p_raffle_id, p_session_id, p_email, p_phone, p_city, p_method, p_reference, p_evidence_url, p_amount_ves, p_rate_used, p_rate_source, p_currency, 'pending', p_ci)
  returning id into v_payment_id;

  -- asociar tickets reservados por esa sesión para esa rifa
  insert into payment_tickets(payment_id, ticket_id)
  select v_payment_id, t.id
  from tickets t
  where t.raffle_id = p_raffle_id and t.reserved_by = p_session_id and t.status='reserved' and (t.reserved_until is null or t.reserved_until > now());

  return v_payment_id;
end;
$$;
