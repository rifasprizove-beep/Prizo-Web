-- Congelar reservas al enviar pago y permitir nuevas compras en la misma sesión
-- 1) Modifica create_payment_for_session para quitar temporizador y desvincular de la sesión
-- 2) Ajusta reserve_tickets/ensure_and_reserve_random_tickets para no liberar reservas ya adjuntas a pagos pendientes
-- 3) Crea reject_payment para liberar al rechazar

set search_path = public;

-- reserve_tickets: no liberar boletos ya enlazados a pagos 'pending'
create or replace function reserve_tickets(p_ticket_ids uuid[], p_session_id uuid, p_minutes int default 10)
returns setof tickets
language plpgsql
security definer
as $$
declare
  v_until timestamptz := now() + make_interval(mins => p_minutes);
  v_raffle_ids uuid[];
begin
  select array_agg(distinct raffle_id) into v_raffle_ids from tickets where id = any(p_ticket_ids);

  update tickets
     set status='available', reserved_by=null, reserved_until=null
   where reserved_by = p_session_id
     and raffle_id = any(coalesce(v_raffle_ids, array[]::uuid[]))
     and not (id = any(p_ticket_ids))
     and not exists (
       select 1 from payment_tickets pt
       join payments p on p.id = pt.payment_id
       where pt.ticket_id = tickets.id and p.status = 'pending'
     );

  return query
  with picked as (
    select id from tickets
    where id = any(p_ticket_ids) and status='available'
    for update skip locked
  )
  update tickets t
     set status='reserved', reserved_by=p_session_id, reserved_until=v_until
  from picked
  where t.id = picked.id
  returning t.*;
end;
$$;

-- ensure_and_reserve_random_tickets: no liberar boletos ya enlazados a pagos 'pending'
create or replace function ensure_and_reserve_random_tickets(
  p_raffle_id uuid,
  p_total int,
  p_session_id uuid,
  p_quantity int,
  p_minutes int default 10
) returns setof tickets
language plpgsql
security definer
as $$
declare
  v_until timestamptz := now() + make_interval(mins => p_minutes);
  v_reserved int := 0;
  v_to_pick int := 0;
  v_round int := 0;
begin
  perform ensure_session(p_session_id);
  perform ensure_tickets_for_raffle(p_raffle_id, p_total);

  update tickets
     set status='available', reserved_by=null, reserved_until=null
   where raffle_id = p_raffle_id and reserved_by = p_session_id
     and not exists (
       select 1 from payment_tickets pt
       join payments p on p.id = pt.payment_id
       where pt.ticket_id = tickets.id and p.status = 'pending'
     );

  loop
    exit when v_reserved >= greatest(0, p_quantity);
    v_round := v_round + 1;
    v_to_pick := greatest(0, p_quantity - v_reserved);

    with picked as (
      select id
      from tickets
      where raffle_id = p_raffle_id
        and status = 'available'
      order by random()
      limit v_to_pick
      for update skip locked
    ), upd as (
      update tickets t
         set status = 'reserved', reserved_by = p_session_id, reserved_until = v_until
      from picked
      where t.id = picked.id
      returning t.id
    )
    select count(*) into v_to_pick from upd;

    if v_to_pick = 0 then
      exit;
    end if;
    v_reserved := v_reserved + v_to_pick;
  end loop;

  return query
  select * from tickets
  where raffle_id = p_raffle_id and reserved_by = p_session_id and status = 'reserved'
  order by reserved_until desc
  limit greatest(0, p_quantity);
end;
$$;

-- create_payment_for_session: congelar reservas
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

  insert into payment_tickets(payment_id, ticket_id)
  select v_payment_id, t.id
  from tickets t
  where t.raffle_id = p_raffle_id and t.reserved_by = p_session_id and t.status='reserved' and (t.reserved_until is null or t.reserved_until > now());

  update tickets t
     set reserved_until = null,
         reserved_by = null
   where t.id in (select pt.ticket_id from payment_tickets pt where pt.payment_id = v_payment_id)
     and t.status = 'reserved';

  return v_payment_id;
end;
$$;

-- reject_payment: marcar pago como rechazado y liberar tickets a disponibles
create or replace function reject_payment(p_payment_id uuid, p_rejected_by text)
returns void
language plpgsql
security definer
as $$
begin
  update payments set status='rejected', approved_by = p_rejected_by, approved_at = now()
  where id = p_payment_id;

  update tickets t
     set status='available', reserved_by=null, reserved_until=null
  from payment_tickets pt
  where pt.payment_id = p_payment_id and pt.ticket_id = t.id;
end;
$$;

grant execute on function reject_payment(uuid,text) to anon, authenticated;
