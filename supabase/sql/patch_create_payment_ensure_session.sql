-- Patch: ensure session before inserting into payments (idempotent)
set search_path = public;

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
as $$
declare
  v_payment_id uuid;
begin
  -- Make sure the referenced session exists to avoid FK errors
  perform ensure_session(p_session_id);

  -- For free method, do explicit duplicate validations to return friendly errors
  if p_method = 'free' then
    if p_email is not null then
      if exists (
        select 1 from payments
        where raffle_id = p_raffle_id and method = 'free' and lower(email) = lower(p_email)
      ) then
        raise exception 'Este correo ya participó en este sorteo gratis.' using errcode = 'P0001';
      end if;
    end if;
    if p_instagram is not null then
      if exists (
        select 1 from payments
        where raffle_id = p_raffle_id and method = 'free' and lower(instagram) = lower(p_instagram)
      ) then
        raise exception 'Este usuario de Instagram ya participó en este sorteo gratis.' using errcode = 'P0001';
      end if;
    end if;
    if p_phone is not null then
      if exists (
        select 1 from payments
        where raffle_id = p_raffle_id and method = 'free'
          and regexp_replace(phone, '\\D', '', 'g') = regexp_replace(p_phone, '\\D', '', 'g')
      ) then
        raise exception 'Este teléfono ya participó en este sorteo gratis.' using errcode = 'P0001';
      end if;
    end if;
    if p_ci is not null then
      if exists (
        select 1 from payments
        where raffle_id = p_raffle_id and method = 'free'
          and upper(regexp_replace(coalesce(ci,''), '[^0-9A-Za-z]', '', 'g')) = upper(regexp_replace(p_ci, '[^0-9A-Za-z]', '', 'g'))
      ) then
        raise exception 'Esta cédula ya participó en este sorteo gratis.' using errcode = 'P0001';
      end if;
    end if;
  end if;

  insert into payments(raffle_id, session_id, email, phone, city, method, reference, evidence_url, amount_ves, rate_used, rate_source, currency, status, ci, instagram)
  values (p_raffle_id, p_session_id, p_email, p_phone, p_city, p_method, p_reference, p_evidence_url, p_amount_ves, p_rate_used, p_rate_source, p_currency, 'pending', p_ci, p_instagram)
  returning id into v_payment_id;

  -- Link reserved tickets of this session for this raffle
  insert into payment_tickets(payment_id, ticket_id)
  select v_payment_id, t.id
  from tickets t
  where t.raffle_id = p_raffle_id and t.reserved_by = p_session_id and t.status='reserved' and (t.reserved_until is null or t.reserved_until > now());

  -- Freeze: drop timer and detach from session so they remain locked to the payment
  update tickets t
     set reserved_until = null,
         reserved_by = null
   where t.id in (select pt.ticket_id from payment_tickets pt where pt.payment_id = v_payment_id)
     and t.status = 'reserved';

  return v_payment_id;
end;
$$;

-- Grant for the 14-arg signature (uuid, uuid, 6x text, 2x numeric, 4x text)
grant execute on function public.create_payment_for_session(uuid,uuid,text,text,text,text,text,text,numeric,numeric,text,text,text,text) to anon, authenticated;
