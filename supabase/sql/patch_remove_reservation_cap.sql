-- Patch: Remove reservation cap (e.g., 1000) in random reservation RPCs
-- Goal: Allow reserving more than 1000 tickets in a single request
-- Date: 2025-11-26

BEGIN;

-- Ensure functions do not LIMIT to 1000 when selecting random available tickets.
-- Replace any SELECT ... LIMIT 1000 with a LIMIT based on p_quantity.

-- Example for public.reserve_random_tickets (adjust schema/name if different):
CREATE OR REPLACE FUNCTION public.reserve_random_tickets(
  p_raffle_id uuid,
  p_session_id uuid,
  p_quantity int,
  p_minutes int DEFAULT 10
)
RETURNS SETOF public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_until timestamptz := now() + make_interval(mins => GREATEST(1, p_minutes));
BEGIN
  -- Reserve up to p_quantity available tickets at random — NO hard-coded 1000 cap.
  RETURN QUERY
  WITH picked AS (
    SELECT t.id
    FROM public.tickets t
    WHERE t.raffle_id = p_raffle_id
      AND t.status = 'available'
    ORDER BY random()
    LIMIT GREATEST(0, p_quantity)
  ),
  updated AS (
    UPDATE public.tickets tt
    SET status = 'reserved', reserved_by = p_session_id, reserved_until = v_until
    WHERE tt.id IN (SELECT id FROM picked)
    RETURNING tt.*
  )
  SELECT * FROM updated;
END;
$$;

-- Example for public.ensure_and_reserve_random_tickets
CREATE OR REPLACE FUNCTION public.ensure_and_reserve_random_tickets(
  p_raffle_id uuid,
  p_total int,
  p_session_id uuid,
  p_quantity int,
  p_minutes int DEFAULT 10
)
RETURNS SETOF public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_until timestamptz := now() + make_interval(mins => GREATEST(1, p_minutes));
BEGIN
  -- Ensure there are tickets up to p_total
  RETURN QUERY
  WITH existing AS (
    SELECT count(*) AS c FROM public.tickets WHERE raffle_id = p_raffle_id
  ),
  create_missing AS (
    INSERT INTO public.tickets(raffle_id, status)
    SELECT p_raffle_id, 'available'
    FROM generate_series(1, GREATEST(0, p_total - (SELECT c FROM existing)))
    RETURNING id
  ),
  pool AS (
    SELECT t.id
    FROM public.tickets t
    WHERE t.raffle_id = p_raffle_id
      AND t.status = 'available'
    ORDER BY random()
    LIMIT GREATEST(0, p_quantity)
  ),
  updated AS (
    UPDATE public.tickets tt
    SET status = 'reserved', reserved_by = p_session_id, reserved_until = v_until
    WHERE tt.id IN (SELECT id FROM pool)
    RETURNING tt.*
  )
  SELECT * FROM updated;
END;
$$;

COMMIT;

-- Apply this patch to remove any hard cap at 1000 and reserve as many as requested.