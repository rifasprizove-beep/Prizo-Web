-- Patch: Remove any internal cap (e.g., 1000) from payment creation
-- Goal: Ensure create_payment_for_session records the full amount for large reservations
-- Date: 2025-11-26

-- Notes:
-- - The client already sends `p_amount_ves` computed with the exact reserved quantity.
-- - This patch updates the procedure to trust the client-provided amount and avoids
--   any LIMIT or truncation on counting tickets that could cap at 1000.
-- - If the server needs to recompute, it should do it without LIMIT and based on the
--   actual reserved tickets for the session.

-- SAFETY: Wrap changes in a transaction.
BEGIN;

-- Recreate or alter the function to avoid internal caps.
-- Adjust schema names if needed (public vs. custom schema).
-- This implementation trusts `p_amount_ves` when provided; otherwise it computes
-- from all reserved tickets for the session WITHOUT any LIMIT.

CREATE OR REPLACE FUNCTION public.create_payment_for_session(
  p_raffle_id uuid,
  p_session_id uuid,
  p_email text,
  p_phone text,
  p_city text,
  p_method text,
  p_reference text,
  p_evidence_url text,
  p_amount_ves text,
  p_rate_used text,
  p_rate_source text,
  p_currency text DEFAULT 'VES',
  p_ci text DEFAULT NULL,
  p_instagram text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_id uuid;
  v_amount_ves numeric;
  v_rate_used numeric;
  v_unit_price_ves numeric;
  v_count_reserved int;
BEGIN
  -- If client provided amount, use it; else compute from reserved tickets without LIMIT.
  IF p_amount_ves IS NOT NULL AND trim(p_amount_ves) <> '' THEN
    v_amount_ves := (p_amount_ves)::numeric;
  ELSE
    -- Compute count of reserved tickets for this raffle and session (no LIMIT):
    SELECT count(*) INTO v_count_reserved
    FROM public.tickets t
    WHERE t.raffle_id = p_raffle_id
      AND t.reserved_by = p_session_id
      AND t.status = 'reserved';

    -- Get unit price (VES) from raffles table if needed
    SELECT (r.unit_price_cents / 100.0) * COALESCE((p_rate_used)::numeric, 0)
    INTO v_unit_price_ves
    FROM public.raffles r
    WHERE r.id = p_raffle_id;

    v_amount_ves := COALESCE(v_unit_price_ves, 0) * COALESCE(v_count_reserved, 0);
  END IF;

  v_rate_used := NULLIF(p_rate_used, '')::numeric;

  INSERT INTO public.payments(
    raffle_id,
    session_id,
    email,
    phone,
    city,
    method_label,
    reference,
    evidence_url,
    amount_ves,
    rate_used,
    rate_source,
    currency,
    ci,
    instagram_user,
    status
  ) VALUES (
    p_raffle_id,
    p_session_id,
    NULLIF(p_email, ''),
    NULLIF(p_phone, ''),
    NULLIF(p_city, ''),
    NULLIF(p_method, ''),
    NULLIF(p_reference, ''),
    NULLIF(p_evidence_url, ''),
    v_amount_ves,
    v_rate_used,
    NULLIF(p_rate_source, ''),
    COALESCE(p_currency, 'VES'),
    NULLIF(p_ci, ''),
    NULLIF(p_instagram, ''),
    'pending'
  ) RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

COMMIT;

-- After applying, payments will reflect the full reserved quantity amount.
-- If your schema/table names differ, adapt the qualified names accordingly.