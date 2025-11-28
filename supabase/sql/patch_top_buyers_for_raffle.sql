-- Agrega función para obtener ranking de top compradores por rifa
create or replace function top_buyers_for_raffle(
  p_raffle_id uuid,
  p_limit int default 20
) returns table(
  buyer_email text,
  tickets bigint,
  payments_count bigint,
  first_payment timestamptz,
  last_payment timestamptz,
  instagram text
)
language sql
security definer
set search_path = public
as $$
  select
    p.email as buyer_email,
    count(pt.ticket_id)::bigint as tickets,
    count(distinct p.id)::bigint as payments_count,
    min(p.created_at) as first_payment,
    max(p.created_at) as last_payment,
    -- obtener el último instagram asociado a ese email dentro de la misma rifa
    (
      select instagram_user from payments p2
      where p2.raffle_id = p_raffle_id and p2.email = p.email and p2.instagram_user is not null
      order by p2.created_at desc
      limit 1
    ) as instagram
  from payments p
  join payment_tickets pt on pt.payment_id = p.id
  where p.status = 'approved'
    and p.raffle_id = p_raffle_id
    and p.email is not null
  group by p.email
  order by tickets desc, last_payment desc
  limit p_limit;
$$;

grant execute on function top_buyers_for_raffle(uuid,int) to anon, authenticated;