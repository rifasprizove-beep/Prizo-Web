-- Prizo schema full setup for Supabase
-- Enums
create type if not exists payment_status as enum ('pending','approved','rejected','cancelled');
create type if not exists raffle_status as enum ('draft','published','selling','closed','drawn','archived');
create type if not exists ticket_status as enum ('available','reserved','sold','void','refunded');
create type if not exists winner_type as enum ('public_draw','top_buyer','manual');

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists uuid-ossp;

-- Tables
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ip text null,
  user_agent text null,
  email text null,
  phone text null
);

create table if not exists raffles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text null,
  status raffle_status not null default 'draft',
  currency text not null default 'USD',
  ticket_price_cents integer not null default 100,
  image_url text null,
  payment_methods jsonb null default '{}'::jsonb,
  allow_manual boolean null default true,
  total_tickets integer not null,
  is_free boolean not null default false,
  has_top_buyer_prize boolean not null default false,
  starts_at timestamptz null,
  ends_at timestamptz null,
  created_at timestamptz null default now(),
  constraint chk_raffles_total_tickets check (total_tickets > 0),
  constraint chk_raffles_price check (ticket_price_cents >= 0),
  constraint chk_raffles_dates check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references raffles(id) on delete cascade,
  ticket_number integer not null,
  status ticket_status not null default 'available',
  reserved_until timestamptz null,
  reserved_by uuid null,
  created_at timestamptz null default now(),
  unique(raffle_id, ticket_number),
  constraint chk_ticket_number check (ticket_number >= 0)
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid null references raffles(id) on delete set null,
  session_id uuid null references sessions(id) on delete set null,
  email text null,
  phone text null,
  city text null,
  method text null,
  reference text null,
  evidence_url text null,
  amount_ves numeric null,
  rate_used numeric null,
  rate_source text null,
  currency text null default 'VES',
  ci text null,
  is_top_buyer boolean not null default false,
  status payment_status not null default 'pending',
  created_at timestamptz null default now(),
  approved_by text null,
  approved_at timestamptz null
);

create table if not exists payment_tickets (
  payment_id uuid not null references payments(id) on delete cascade,
  ticket_id uuid not null references tickets(id) on delete cascade,
  created_at timestamptz null default now(),
  primary key (payment_id, ticket_id)
);

create table if not exists draws (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references raffles(id) on delete cascade,
  provider text null,
  external_draw_id text null,
  result_number text null,
  rule text null,
  draw_date date null,
  official_link text null,
  started_at timestamptz not null default now()
);

create table if not exists winners (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid null references raffles(id) on delete cascade,
  draw_id uuid null references draws(id) on delete set null,
  ticket_id uuid null references tickets(id) on delete set null,
  position integer not null default 1,
  type winner_type not null default 'public_draw',
  rule_applied text null,
  ticket_number_snapshot integer null,
  winner_name text null,
  instagram_user text null,
  created_at timestamptz not null default now(),
  unique(raffle_id, position)
);

create table if not exists settings (
  key text primary key,
  value text null
);

-- NOTE: Tabla sessions ya existe arriba con más columnas; se elimina duplicado para evitar conflictos

-- Indexes
create index if not exists idx_tickets_raffle_status on tickets(raffle_id, status);
create index if not exists idx_tickets_reserved_until on tickets(reserved_until);
create index if not exists idx_payments_raffle_status on payments(raffle_id, status, created_at desc);
create index if not exists idx_draws_raffle_date on draws(raffle_id, draw_date);

-- View: raffle_ticket_counters
create or replace view raffle_ticket_counters as
select
  r.id as raffle_id,
  r.total_tickets,
  coalesce(sum(case when t.status = 'sold' then 1 else 0 end),0)::bigint as sold,
  coalesce(sum(case when t.status = 'reserved' and t.reserved_until is not null and t.reserved_until > now() then 1 else 0 end),0)::bigint as reserved,
  (r.total_tickets - (coalesce(sum(case when t.status = 'sold' then 1 else 0 end),0) + coalesce(sum(case when t.status = 'reserved' and t.reserved_until is not null and t.reserved_until > now() then 1 else 0 end),0)))::bigint as available
from raffles r
left join tickets t on t.raffle_id = r.id
group by r.id, r.total_tickets;

-- Helper functions
create or replace function ensure_session(p_session_id uuid)
returns void
language sql
security definer
as $$
  insert into sessions (id) values (p_session_id)
  on conflict (id) do nothing;
$$;

create or replace function ensure_tickets_for_raffle(
  p_raffle_id uuid,
  p_total int
) returns int
language plpgsql
security definer
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

-- RPC functions
-- release_expired_reservations
create or replace function release_expired_reservations()
returns void
language sql
as $$
  update tickets
  set status='available', reserved_by=null, reserved_until=null
  where status='reserved' and reserved_until is not null and reserved_until < now();
$$;

-- reserve_tickets: reserva específicos
create or replace function reserve_tickets(p_ticket_ids uuid[], p_session_id uuid, p_minutes int default 10)
returns setof tickets
language plpgsql
security definer
as $$
declare
  v_until timestamptz := now() + make_interval(mins => p_minutes);
  v_raffle_ids uuid[];
begin
  -- Identificar rifas involucradas
  select array_agg(distinct raffle_id) into v_raffle_ids from tickets where id = any(p_ticket_ids);

  -- Si alguna rifa no permite selección manual, bloquear
  if exists (
    select 1 from raffles r
    where r.id = any(coalesce(v_raffle_ids, array[]::uuid[]))
      and coalesce(r.allow_manual, true) = false
  ) then
    raise exception 'manual_selection_disabled';
  end if;

  -- Defensa: liberar cualquier reserva previa de esta sesión dentro de esas rifas que NO esté en la lista solicitada
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

  -- Reservar exactamente los tickets indicados (si están disponibles) con bloqueo optimista
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

-- release_tickets: libera específicos
create or replace function release_tickets(p_ticket_ids uuid[], p_session_id uuid)
returns setof tickets
language plpgsql
security definer
as $$
begin
  return query
  update tickets t
    set status='available', reserved_by=null, reserved_until=null
  where t.id = any(p_ticket_ids)
    and t.reserved_by = p_session_id
  returning t.*;
end;
$$;

-- reserve_random_tickets: ejemplo simple tomando disponibles al azar
create or replace function reserve_random_tickets(
  p_raffle_id uuid,
  p_session_id uuid,
  p_quantity int,
  p_minutes int default 10
) returns setof tickets
language plpgsql
security definer
as $$
declare
  v_until timestamptz := now() + make_interval(mins => p_minutes);
begin
  return query
  with picked as (
    select id from tickets
    where raffle_id = p_raffle_id and status='available'
    order by random()
    limit p_quantity
    for update skip locked
  )
  update tickets t
    set status='reserved', reserved_by=p_session_id, reserved_until=v_until
  from picked
  where t.id = picked.id
  returning t.*;
end;
$$;

-- ensure_and_reserve_random_tickets: asegura cantidad y reserva EXACTA para una sesión
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

  -- Liberar cualquier reserva previa de esta sesión en esta rifa
  update tickets
     set status='available', reserved_by=null, reserved_until=null
   where raffle_id = p_raffle_id and reserved_by = p_session_id
     and not exists (
       select 1 from payment_tickets pt
       join payments p on p.id = pt.payment_id
       where pt.ticket_id = tickets.id and p.status = 'pending'
     );

  -- Intentos en bucle: reservar en tandas hasta alcanzar p_quantity o quedarse sin disponibles
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
      exit; -- no hay más disponibles
    end if;
    v_reserved := v_reserved + v_to_pick;
  end loop;

  -- Devolver exactamente los tickets reservados por esta sesión (hasta p_quantity)
  return query
  select * from tickets
  where raffle_id = p_raffle_id and reserved_by = p_session_id and status = 'reserved'
  order by reserved_until desc
  limit greatest(0, p_quantity);
end;
$$;

-- create_payment_for_session: crea pago y relaciona tickets reservados
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

  -- Congelar: quitar temporizador y desvincular de la sesión (siguen reservados hasta aprobación/rechazo)
  update tickets t
     set reserved_until = null,
         reserved_by = null
   where t.id in (select pt.ticket_id from payment_tickets pt where pt.payment_id = v_payment_id)
     and t.status = 'reserved';

  return v_payment_id;
end;
$$;

-- approve_payment: marcar pago y tickets como vendidos
create or replace function approve_payment(p_payment_id uuid, p_approved_by text)
returns void
language plpgsql
security definer
as $$
begin
  update payments set status='approved', approved_by = p_approved_by, approved_at = now()
  where id = p_payment_id;

  update tickets t
  set status='sold', reserved_by=null, reserved_until=null
  from payment_tickets pt
  where pt.payment_id = p_payment_id and pt.ticket_id = t.id;
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

-- compute_winner_from_public_draw: ejemplo básico (ajusta la lógica de coincidencia)
create or replace function compute_winner_from_public_draw(p_raffle_id uuid, p_draw_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_ticket_id uuid;
  v_winner_id uuid;
  v_result text;
  v_rule text;
  v_number int;
begin
  select result_number, rule into v_result, v_rule from draws where id = p_draw_id and raffle_id = p_raffle_id;
  if v_result is null then
    -- fallback: pick random sold ticket
    select id into v_ticket_id from tickets where raffle_id = p_raffle_id and status='sold' order by random() limit 1;
  else
    -- ejemplo: usar últimos 3 dígitos
    select id into v_ticket_id from tickets
    where raffle_id = p_raffle_id and status='sold' and right(lpad(ticket_number::text, 3, '0'), 3) = right(v_result, 3)
    order by random() limit 1;
  end if;

  insert into winners(raffle_id, draw_id, ticket_id, position, type, rule_applied, ticket_number_snapshot)
  values (p_raffle_id, p_draw_id, v_ticket_id, 1, 'public_draw', coalesce(v_rule,'last_3_digits'), (select ticket_number from tickets where id=v_ticket_id))
  returning id into v_winner_id;
  return v_winner_id;
end;
$$;

-- compute_top_buyer_winner: mayor número de tickets vendidos por email
create or replace function compute_top_buyer_winner(p_raffle_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_email text;
  v_ticket_id uuid;
  v_winner_id uuid;
begin
  select p.email
  into v_email
  from payments p
  where p.raffle_id = p_raffle_id and p.status='approved' and p.email is not null
  group by p.email
  order by count(*) desc, max(p.created_at) desc
  limit 1;

  if v_email is null then
    return null;
  end if;

  -- escoger un ticket vendido de ese email
  select t.id into v_ticket_id
  from tickets t
  join payment_tickets pt on pt.ticket_id = t.id
  join payments p on p.id = pt.payment_id
  where p.raffle_id = p_raffle_id and p.status='approved' and p.email = v_email and t.status='sold'
  order by random() limit 1;

  insert into winners(raffle_id, draw_id, ticket_id, position, type, rule_applied, ticket_number_snapshot, winner_name)
  values (p_raffle_id, null, v_ticket_id, 1, 'top_buyer', 'largest_buyer', (select ticket_number from tickets where id=v_ticket_id), v_email)
  returning id into v_winner_id;
  return v_winner_id;
end;
$$;

-- Grants for RPC from anon/authenticated when frontend calls directly
grant execute on function ensure_session(uuid) to anon, authenticated;
grant execute on function ensure_tickets_for_raffle(uuid,int) to anon, authenticated;
grant execute on function reserve_tickets(uuid[],uuid,int) to anon, authenticated;
grant execute on function release_tickets(uuid[],uuid) to anon, authenticated;
grant execute on function reserve_random_tickets(uuid,uuid,int,int) to anon, authenticated;
grant execute on function ensure_and_reserve_random_tickets(uuid,int,uuid,int,int) to anon, authenticated;
grant execute on function reject_payment(uuid,text) to anon, authenticated;

-- RLS
alter table raffles enable row level security;
alter table tickets enable row level security;
alter table payments enable row level security;
alter table payment_tickets enable row level security;
alter table draws enable row level security;
alter table winners enable row level security;

-- Public read-only policies
create policy if not exists raffles_read on raffles for select using (status in ('published','selling'));
create policy if not exists tickets_read on tickets for select using (true);
create policy if not exists payments_read on payments for select using (false);
create policy if not exists payment_tickets_read on payment_tickets for select using (false);
create policy if not exists draws_read on draws for select using (true);
create policy if not exists winners_read on winners for select using (true);

-- Block direct writes from anon (only via SECURITY DEFINER functions)
create policy if not exists tickets_insert_block on tickets for insert with check (false);
create policy if not exists tickets_update_block on tickets for update using (false) with check (false);
create policy if not exists tickets_delete_block on tickets for delete using (false);

-- Optional: allow admins (if you have auth) to write; otherwise keep via RPC only.
