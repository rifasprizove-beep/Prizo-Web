-- Compat patch: crea/actualiza enums de forma idempotente sin usar "CREATE TYPE IF NOT EXISTS"
-- Úsalo cuando el editor no acepte IF NOT EXISTS en CREATE TYPE.

-- payment_status
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where t.typname='payment_status' and n.nspname='public') then
    create type public.payment_status as enum ('pending','approved','rejected','cancelled');
  end if;
  -- aseguramos todos los valores
  begin execute 'alter type public.payment_status add value if not exists '||quote_literal('pending'); exception when others then end;
  begin execute 'alter type public.payment_status add value if not exists '||quote_literal('approved'); exception when others then end;
  begin execute 'alter type public.payment_status add value if not exists '||quote_literal('rejected'); exception when others then end;
  begin execute 'alter type public.payment_status add value if not exists '||quote_literal('cancelled'); exception when others then end;
end$$;

-- raffle_status
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where t.typname='raffle_status' and n.nspname='public') then
    create type public.raffle_status as enum ('draft','published','selling','closed','drawn','archived');
  end if;
  begin execute 'alter type public.raffle_status add value if not exists '||quote_literal('draft'); exception when others then end;
  begin execute 'alter type public.raffle_status add value if not exists '||quote_literal('published'); exception when others then end;
  begin execute 'alter type public.raffle_status add value if not exists '||quote_literal('selling'); exception when others then end;
  begin execute 'alter type public.raffle_status add value if not exists '||quote_literal('closed'); exception when others then end;
  begin execute 'alter type public.raffle_status add value if not exists '||quote_literal('drawn'); exception when others then end;
  begin execute 'alter type public.raffle_status add value if not exists '||quote_literal('archived'); exception when others then end;
end$$;

-- ticket_status
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where t.typname='ticket_status' and n.nspname='public') then
    create type public.ticket_status as enum ('available','reserved','sold','void','refunded');
  end if;
  begin execute 'alter type public.ticket_status add value if not exists '||quote_literal('available'); exception when others then end;
  begin execute 'alter type public.ticket_status add value if not exists '||quote_literal('reserved'); exception when others then end;
  begin execute 'alter type public.ticket_status add value if not exists '||quote_literal('sold'); exception when others then end;
  begin execute 'alter type public.ticket_status add value if not exists '||quote_literal('void'); exception when others then end;
  begin execute 'alter type public.ticket_status add value if not exists '||quote_literal('refunded'); exception when others then end;
end$$;

-- winner_type
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where t.typname='winner_type' and n.nspname='public') then
    create type public.winner_type as enum ('public_draw','top_buyer','manual');
  end if;
  begin execute 'alter type public.winner_type add value if not exists '||quote_literal('public_draw'); exception when others then end;
  begin execute 'alter type public.winner_type add value if not exists '||quote_literal('top_buyer'); exception when others then end;
  begin execute 'alter type public.winner_type add value if not exists '||quote_literal('manual'); exception when others then end;
end$$;
