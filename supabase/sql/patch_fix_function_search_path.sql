-- Patch: Fix linter 0011 - function_search_path_mutable
-- Makes search_path immutable at function level for all RPC/trigger helpers.
-- Safe to run multiple times.

-- Prefer a deterministic path: public first, temp last. pg_catalog is implicit.
-- You can adjust to 'pg_catalog, public' if desired.

-- Trigger helper
alter function if exists public.set_has_top_buyer_prize() 
  set search_path to public, pg_temp;

-- Session helpers
alter function if exists public.ensure_session(uuid)
  set search_path to public, pg_temp;

alter function if exists public.ensure_tickets_for_raffle(uuid, integer)
  set search_path to public, pg_temp;

-- Reservations API
alter function if exists public.release_expired_reservations()
  set search_path to public, pg_temp;

alter function if exists public.reserve_tickets(uuid[], uuid, integer)
  set search_path to public, pg_temp;

alter function if exists public.release_tickets(uuid[], uuid)
  set search_path to public, pg_temp;

alter function if exists public.reserve_random_tickets(uuid, uuid, integer, integer)
  set search_path to public, pg_temp;

alter function if exists public.ensure_and_reserve_random_tickets(uuid, integer, uuid, integer, integer)
  set search_path to public, pg_temp;

-- Payments
-- 13-arg signature
alter function if exists public.create_payment_for_session(
  uuid, uuid, text, text, text, text, text, text, numeric, numeric, text, text, text
) set search_path to public, pg_temp;

-- 14-arg signature (with instagram)
alter function if exists public.create_payment_for_session(
  uuid, uuid, text, text, text, text, text, text, numeric, numeric, text, text, text, text
) set search_path to public, pg_temp;

alter function if exists public.approve_payment(uuid, text)
  set search_path to public, pg_temp;

alter function if exists public.reject_payment(uuid, text)
  set search_path to public, pg_temp;

-- Winners
alter function if exists public.compute_winner_from_public_draw(uuid, uuid)
  set search_path to public, pg_temp;

alter function if exists public.compute_top_buyer_winner(uuid)
  set search_path to public, pg_temp;

-- Verify tickets (RPC)
alter function if exists public.verify_tickets(text, boolean)
  set search_path to public, pg_temp;
