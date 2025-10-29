-- Patch: asegura sesiones y funciones de reserva con SECURITY DEFINER

-- 1) Sesiones (si no existe)
create table if not exists public.sessions (
  id uuid primary key,
  created_at timestamptz not null default now()
);

-- 2) Helper: asegurar sesión
create or replace function public.ensure_session(p_session_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into sessions (id) values (p_session_id)
  on conflict (id) do nothing;
$$;

grant execute on function public.ensure_session(uuid) to anon, authenticated;

-- 3) Asegurar tickets hasta un total (idempotente)
create or replace function public.ensure_tickets_for_raffle(
  p_raffle_id uuid,
  p_total int
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted int := 0;
begin
  insert into tickets (raffle_id, ticket_number, status)
  select p_raffle_id, gs, 'available'
  from generate_series(1, p_total) as gs
  on conflict (raffle_id, ticket_number) do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

grant execute on function public.ensure_tickets_for_raffle(uuid,int) to anon, authenticated;

-- 4) Reservar aleatorios (crea primero si faltan)
create or replace function public.ensure_and_reserve_random_tickets(
  p_raffle_id uuid,
  p_total int,
  p_session_id uuid,
  p_quantity int,
  p_minutes int default 10
) returns setof public.tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  perform public.ensure_session(p_session_id);
  perform public.ensure_tickets_for_raffle(p_raffle_id, p_total);

  -- Liberar cualquier reserva previa de esta sesión en esta rifa
  update tickets
     set status = 'available', reserved_by = null, reserved_until = null
   where raffle_id = p_raffle_id and reserved_by = p_session_id;

  -- Elegir aleatorios disponibles
  select array_agg(id) into v_ids
  from tickets
  where raffle_id = p_raffle_id
    and status = 'available'
  order by random()
  limit p_quantity;

  if v_ids is null or array_length(v_ids,1) is null then
    return;
  end if;

  -- Reservar exactamente los elegidos
  update tickets
     set status = 'reserved',
         reserved_by = p_session_id,
         reserved_until = now() + make_interval(mins => p_minutes)
   where id = any(v_ids)
     and status = 'available';

  return query select * from tickets where id = any(v_ids);
end;
$$;

grant execute on function public.ensure_and_reserve_random_tickets(uuid,int,uuid,int,int)
  to anon, authenticated;

-- 5) Reservar por IDs concretos
create or replace function public.reserve_tickets(
  p_ticket_ids uuid[],
  p_session_id uuid,
  p_minutes int default 10
) returns setof public.tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raffle_ids uuid[];
begin
  perform public.ensure_session(p_session_id);

  -- Identificar las rifas involucradas en la lista de IDs
  select array_agg(distinct raffle_id)
    into v_raffle_ids
  from tickets
  where id = any(p_ticket_ids);

  -- Defensa: liberar cualquier reserva previa de esta sesión dentro de esas rifas que NO esté en la lista solicitada
  update tickets
     set status = 'available',
         reserved_by = null,
         reserved_until = null
   where reserved_by = p_session_id
     and raffle_id = any(coalesce(v_raffle_ids, array[]::uuid[]))
     and not (id = any(p_ticket_ids));

  -- Reservar exactamente los tickets indicados (si están disponibles)
  update tickets
     set status = 'reserved',
         reserved_by = p_session_id,
         reserved_until = now() + make_interval(mins => p_minutes)
   where id = any(p_ticket_ids)
     and status = 'available';

  -- Devolver únicamente los tickets solicitados
  return query select * from tickets where id = any(p_ticket_ids);
end;
$$;

grant execute on function public.reserve_tickets(uuid[],uuid,int) to anon, authenticated;

-- 6) Libera reservas
create or replace function public.release_tickets(
  p_ticket_ids uuid[],
  p_session_id uuid
) returns setof public.tickets
language sql
security definer
set search_path = public
as $$
  update tickets
     set status = 'available',
         reserved_by = null,
         reserved_until = null
   where id = any(p_ticket_ids)
     and reserved_by = p_session_id;
  select * from tickets where id = any(p_ticket_ids);
$$;

grant execute on function public.release_tickets(uuid[],uuid) to anon, authenticated;
