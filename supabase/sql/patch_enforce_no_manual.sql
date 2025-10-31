-- Enforce: si la rifa tiene allow_manual=false, impedir seleccionar IDs manualmente
set search_path = public;

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

  if exists (
    select 1 from raffles r
    where r.id = any(coalesce(v_raffle_ids, array[]::uuid[]))
      and coalesce(r.allow_manual, true) = false
  ) then
    raise exception 'manual_selection_disabled';
  end if;

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
    select id
    from tickets
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
