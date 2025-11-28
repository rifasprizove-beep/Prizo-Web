-- RPC para verificar tickets por email o cédula (ci)
drop function if exists public.verify_tickets(text, boolean);

create or replace function verify_tickets(
  p_query text,
  p_include_pending boolean default true
) returns table (
  raffle_id uuid,
  raffle_name text,
  ticket_id uuid,
  ticket_number text,
  ticket_status ticket_status,
  payment_id uuid,
  payment_status payment_status,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  -- Filtra resultados por email o cédula y excluye rifas con estado fuera de los visibles
  -- Estados visibles: published, selling, drawn (ajusta esta lista si quieres menos o más)
  select r.id as raffle_id,
         r.name as raffle_name,
         t.id as ticket_id,
         t.ticket_number, -- ahora text tras patch_ticket_number_to_text
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
  and r.status in ('published','selling','drawn')
  and (
    p.status = 'approved'
    or (
      p_include_pending and p.status in ('pending','underpaid','overpaid','ref_mismatch')
    )
  )
  order by p.created_at desc, r.name asc, t.ticket_number asc;
$$;

grant execute on function verify_tickets(text, boolean) to anon, authenticated;
