-- RPC para verificar tickets por email o cédula (ci)
set search_path = public;

create or replace function verify_tickets(
  p_query text,
  p_include_pending boolean default true
) returns table (
  raffle_id uuid,
  raffle_name text,
  ticket_id uuid,
  ticket_number int,
  ticket_status ticket_status,
  payment_id uuid,
  payment_status payment_status,
  created_at timestamptz
)
language sql
security definer
as $$
  select r.id as raffle_id,
         r.name as raffle_name,
         t.id as ticket_id,
         t.ticket_number,
         t.status as ticket_status,
         p.id as payment_id,
         p.status as payment_status,
         p.created_at
  from payments p
  join payment_tickets pt on pt.payment_id = p.id
  join tickets t on t.id = pt.ticket_id
  join raffles r on r.id = t.raffle_id
  where (
    (p.email is not null and p.email ilike '%' || p_query || '%')
    or (p.ci is not null and p.ci ilike '%' || p_query || '%')
  )
  and (
    p.status = 'approved' or (p_include_pending and p.status = 'pending')
  )
  order by p.created_at desc, r.name asc, t.ticket_number asc;
$$;

grant execute on function verify_tickets(text, boolean) to anon, authenticated;
