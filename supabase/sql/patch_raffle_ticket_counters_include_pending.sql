-- Modifica la vista para que cuente como reservados también los tickets asociados a un pago pendiente (status 'pending', 'underpaid', 'overpaid', 'ref_mismatch')
create or replace view raffle_ticket_counters as
select
  r.id as raffle_id,
  r.total_tickets,
  coalesce(sum(case when t.status = 'sold' then 1 else 0 end),0)::bigint as sold,
  coalesce(sum(
    case 
      when t.status = 'reserved' and t.reserved_until is not null and t.reserved_until > now() then 1
      when t.status = 'reserved' and exists (
        select 1 from payment_tickets pt
        join payments p on p.id = pt.payment_id
        where pt.ticket_id = t.id and p.status in ('pending','underpaid','overpaid','ref_mismatch')
      ) then 1
      else 0
    end
  ),0)::bigint as reserved,
  greatest(0, (r.total_tickets - (coalesce(sum(case when t.status = 'sold' then 1 else 0 end),0) + coalesce(sum(
    case 
      when t.status = 'reserved' and t.reserved_until is not null and t.reserved_until > now() then 1
      when t.status = 'reserved' and exists (
        select 1 from payment_tickets pt
        join payments p on p.id = pt.payment_id
        where pt.ticket_id = t.id and p.status in ('pending','underpaid','overpaid','ref_mismatch')
      ) then 1
      else 0
    end
  ),0))))::bigint as available
from raffles r
left join tickets t on t.raffle_id = r.id
group by r.id, r.total_tickets;
