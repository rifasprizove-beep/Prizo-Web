-- Allow total_tickets = 0 when is_free = true
-- Drop any previous constraint name variants to avoid conflicts
alter table raffles drop constraint if exists raffles_total_tickets_chk;
alter table raffles drop constraint if exists chk_raffles_total_tickets;

alter table raffles add constraint chk_raffles_total_tickets
check (total_tickets > 0 or (is_free = true and total_tickets >= 0));

-- Clamp available to >= 0 in counters view to avoid negatives when total_tickets = 0
create or replace view raffle_ticket_counters as
select
  r.id as raffle_id,
  r.total_tickets,
  coalesce(sum(case when t.status = 'sold' then 1 else 0 end),0)::bigint as sold,
  coalesce(sum(case when t.status = 'reserved' and t.reserved_until is not null and t.reserved_until > now() then 1 else 0 end),0)::bigint as reserved,
  greatest(0, (r.total_tickets - (coalesce(sum(case when t.status = 'sold' then 1 else 0 end),0) + coalesce(sum(case when t.status = 'reserved' and t.reserved_until is not null and t.reserved_until > now() then 1 else 0 end),0))))::bigint as available
from raffles r
left join tickets t on t.raffle_id = r.id
group by r.id, r.total_tickets;

-- Update ensure_and_reserve_random_tickets to create on-demand tickets for free raffles with total_tickets=0
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
  v_is_free boolean := false;
  v_total_tickets int := 0;
begin
  perform ensure_session(p_session_id);
  perform ensure_tickets_for_raffle(p_raffle_id, p_total);

  -- Special case: free raffle declared with total_tickets=0 (unlimited semantics)
  select r.is_free, coalesce(r.total_tickets,0) into v_is_free, v_total_tickets from raffles r where r.id = p_raffle_id;
  if v_is_free = true and v_total_tickets = 0 then
    -- lock raffle row to avoid race for next numbers
    perform 1 from raffles where id = p_raffle_id for update;

    with base as (
      select coalesce(max(ticket_number), 0) as maxn from tickets where raffle_id = p_raffle_id
    ), nums as (
      select generate_series((select maxn from base) + 1, (select maxn from base) + greatest(0, p_quantity)) as n
    ), ins as (
      insert into tickets (raffle_id, ticket_number, status, reserved_by, reserved_until)
      select p_raffle_id, n, 'reserved', p_session_id, v_until
      from nums
      on conflict (raffle_id, ticket_number) do nothing
      returning id
    )
    select count(*) into v_reserved from ins;

    return query
    select * from tickets
    where raffle_id = p_raffle_id and reserved_by = p_session_id and status = 'reserved'
    order by reserved_until desc
    limit greatest(0, p_quantity);
  end if;

  -- default path (finite tickets) stays the same
  -- Release existing reservations by this session in this raffle (that aren't tied to pending payments)
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
      exit; -- no more available
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
