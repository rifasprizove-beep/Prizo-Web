-- Patch: Hardening de seguridad (search_path fijo + RLS en tables internas)
-- Ejecutar después de tener el schema base y migración ticket_number aplicada.
BEGIN;

-- 1) Habilitar RLS en tablas internas
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 2) Políticas (idempotentes vía DROP/CREATE)
-- Sessions: bloquear todo acceso directo
DROP POLICY IF EXISTS sessions_block_select ON sessions;
CREATE POLICY sessions_block_select ON sessions FOR SELECT USING (false);
DROP POLICY IF EXISTS sessions_block_insert ON sessions;
CREATE POLICY sessions_block_insert ON sessions FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS sessions_block_update ON sessions;
CREATE POLICY sessions_block_update ON sessions FOR UPDATE USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS sessions_block_delete ON sessions;
CREATE POLICY sessions_block_delete ON sessions FOR DELETE USING (false);

-- Settings: permitir solo lectura pública, bloquear escritura
DROP POLICY IF EXISTS settings_read ON settings;
CREATE POLICY settings_read ON settings FOR SELECT USING (true);
DROP POLICY IF EXISTS settings_block_insert ON settings;
CREATE POLICY settings_block_insert ON settings FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS settings_block_update ON settings;
CREATE POLICY settings_block_update ON settings FOR UPDATE USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS settings_block_delete ON settings;
CREATE POLICY settings_block_delete ON settings FOR DELETE USING (false);

-- 3) Re-crear funciones SECURITY DEFINER con search_path controlado
-- Nota: Algunas ya fueron recreadas en otros patches; las redefinimos para asegurar configuración.

CREATE OR REPLACE FUNCTION public.ensure_session(p_session_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO sessions (id) VALUES (p_session_id)
  ON CONFLICT (id) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION public.ensure_tickets_for_raffle(
  p_raffle_id uuid,
  p_total int
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted int := 0;
BEGIN
  INSERT INTO tickets (raffle_id, ticket_number, status)
  SELECT p_raffle_id, gs::text, 'available'
  FROM generate_series(1, p_total) AS gs
  ON CONFLICT (raffle_id, ticket_number) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;$$;

CREATE OR REPLACE FUNCTION public.reserve_tickets(p_ticket_ids uuid[], p_session_id uuid, p_minutes int DEFAULT 10)
RETURNS SETOF public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_until timestamptz := now() + make_interval(mins => p_minutes);
  v_raffle_ids uuid[];
BEGIN
  SELECT array_agg(distinct raffle_id) INTO v_raffle_ids FROM tickets WHERE id = ANY(p_ticket_ids);
  IF EXISTS (
    SELECT 1 FROM raffles r
    WHERE r.id = ANY(coalesce(v_raffle_ids, ARRAY[]::uuid[]))
      AND coalesce(r.allow_manual, true) = false
  ) THEN
    RAISE EXCEPTION 'manual_selection_disabled';
  END IF;
  UPDATE tickets
     SET status='available', reserved_by=NULL, reserved_until=NULL
   WHERE reserved_by = p_session_id
     AND raffle_id = ANY(coalesce(v_raffle_ids, ARRAY[]::uuid[]))
     AND NOT (id = ANY(p_ticket_ids))
     AND NOT EXISTS (
       SELECT 1 FROM payment_tickets pt
       JOIN payments p ON p.id = pt.payment_id
       WHERE pt.ticket_id = tickets.id AND p.status = 'pending'
     );
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM tickets
    WHERE id = ANY(p_ticket_ids) AND status='available'
    FOR UPDATE SKIP LOCKED
  )
  UPDATE tickets t
     SET status='reserved', reserved_by=p_session_id, reserved_until=v_until
  FROM picked
  WHERE t.id = picked.id
  RETURNING t.*;
END;$$;

CREATE OR REPLACE FUNCTION public.release_tickets(p_ticket_ids uuid[], p_session_id uuid)
RETURNS SETOF public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE tickets t
    SET status='available', reserved_by=NULL, reserved_until=NULL
  WHERE t.id = ANY(p_ticket_ids)
    AND t.reserved_by = p_session_id
  RETURNING t.*;
END;$$;

CREATE OR REPLACE FUNCTION public.reserve_random_tickets(
  p_raffle_id uuid,
  p_session_id uuid,
  p_quantity int,
  p_minutes int DEFAULT 10
) RETURNS SETOF public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_until timestamptz := now() + make_interval(mins => p_minutes);
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM tickets
    WHERE raffle_id = p_raffle_id AND status='available'
    ORDER BY random()
    LIMIT p_quantity
    FOR UPDATE SKIP LOCKED
  )
  UPDATE tickets t
    SET status='reserved', reserved_by=p_session_id, reserved_until=v_until
  FROM picked
  WHERE t.id = picked.id
  RETURNING t.*;
END;$$;

CREATE OR REPLACE FUNCTION public.ensure_and_reserve_random_tickets(
  p_raffle_id uuid,
  p_total int,
  p_session_id uuid,
  p_quantity int,
  p_minutes int DEFAULT 10
) RETURNS SETOF public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_until timestamptz := now() + make_interval(mins => p_minutes);
  v_reserved int := 0;
  v_to_pick int := 0;
  v_is_free boolean := false;
  v_total_tickets int := 0;
BEGIN
  PERFORM public.ensure_session(p_session_id);
  PERFORM public.ensure_tickets_for_raffle(p_raffle_id, p_total);
  SELECT r.is_free, COALESCE(r.total_tickets,0) INTO v_is_free, v_total_tickets FROM raffles r WHERE r.id = p_raffle_id;
  IF v_is_free = true AND v_total_tickets = 0 THEN
    PERFORM 1 FROM raffles WHERE id = p_raffle_id FOR UPDATE;
    WITH base AS (
      SELECT COALESCE(MAX(ticket_number::int), 0) AS maxn FROM tickets WHERE raffle_id = p_raffle_id
    ), nums AS (
      SELECT generate_series((SELECT maxn FROM base) + 1, (SELECT maxn FROM base) + GREATEST(0, p_quantity)) AS n
    ), ins AS (
      INSERT INTO tickets (raffle_id, ticket_number, status, reserved_by, reserved_until)
      SELECT p_raffle_id, n::text, 'reserved', p_session_id, v_until
      FROM nums
      ON CONFLICT (raffle_id, ticket_number) DO NOTHING
      RETURNING id
    )
    SELECT COUNT(*) INTO v_reserved FROM ins;
    RETURN QUERY
    SELECT * FROM tickets
    WHERE raffle_id = p_raffle_id AND reserved_by = p_session_id AND status = 'reserved'
    ORDER BY reserved_until DESC
    LIMIT GREATEST(0, p_quantity);
    RETURN;
  END IF;
  UPDATE tickets
     SET status='available', reserved_by=NULL, reserved_until=NULL
   WHERE raffle_id = p_raffle_id AND reserved_by = p_session_id;
  LOOP
    EXIT WHEN v_reserved >= GREATEST(0, p_quantity);
    v_to_pick := GREATEST(0, p_quantity - v_reserved);
    WITH picked AS (
      SELECT id FROM tickets
      WHERE raffle_id = p_raffle_id AND status = 'available'
      ORDER BY random() LIMIT v_to_pick FOR UPDATE SKIP LOCKED
    ), upd AS (
      UPDATE tickets t SET status='reserved', reserved_by=p_session_id, reserved_until=v_until
      FROM picked WHERE t.id = picked.id RETURNING t.id
    )
    SELECT COUNT(*) INTO v_to_pick FROM upd;
    IF v_to_pick = 0 THEN EXIT; END IF;
    v_reserved := v_reserved + v_to_pick;
  END LOOP;
  RETURN QUERY
  SELECT * FROM tickets
  WHERE raffle_id = p_raffle_id AND reserved_by = p_session_id AND status='reserved'
  ORDER BY reserved_until DESC
  LIMIT GREATEST(0, p_quantity);
END;$$;

CREATE OR REPLACE FUNCTION public.create_payment_for_session(
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
  p_currency text DEFAULT 'VES',
  p_ci text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id uuid;
BEGIN
  INSERT INTO payments(raffle_id, session_id, email, phone, city, method, reference, evidence_url, amount_ves, rate_used, rate_source, currency, status, ci)
  VALUES (p_raffle_id, p_session_id, p_email, p_phone, p_city, p_method, p_reference, p_evidence_url, p_amount_ves, p_rate_used, p_rate_source, p_currency, 'pending', p_ci)
  RETURNING id INTO v_payment_id;
  INSERT INTO payment_tickets(payment_id, ticket_id)
  SELECT v_payment_id, t.id
  FROM tickets t
  WHERE t.raffle_id = p_raffle_id AND t.reserved_by = p_session_id AND t.status='reserved' AND (t.reserved_until IS NULL OR t.reserved_until > now());
  UPDATE tickets t
     SET reserved_until = NULL,
         reserved_by = NULL
   WHERE t.id IN (SELECT pt.ticket_id FROM payment_tickets pt WHERE pt.payment_id = v_payment_id)
     AND t.status = 'reserved';
  RETURN v_payment_id;
END;$$;

CREATE OR REPLACE FUNCTION public.approve_payment(p_payment_id uuid, p_approved_by text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE payments SET status='approved', approved_by = p_approved_by, approved_at = now()
  WHERE id = p_payment_id;
  UPDATE tickets t
  SET status='sold', reserved_by=NULL, reserved_until=NULL
  FROM payment_tickets pt
  WHERE pt.payment_id = p_payment_id AND pt.ticket_id = t.id;
END;$$;

CREATE OR REPLACE FUNCTION public.reject_payment(p_payment_id uuid, p_rejected_by text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE payments SET status='rejected', approved_by = p_rejected_by, approved_at = now()
  WHERE id = p_payment_id;
  UPDATE tickets t
     SET status='available', reserved_by=NULL, reserved_until=NULL
  FROM payment_tickets pt
  WHERE pt.payment_id = p_payment_id AND pt.ticket_id = t.id;
END;$$;

CREATE OR REPLACE FUNCTION public.compute_winner_from_public_draw(p_raffle_id uuid, p_draw_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id uuid;
  v_winner_id uuid;
  v_result text;
  v_rule text;
BEGIN
  SELECT result_number, rule INTO v_result, v_rule FROM draws WHERE id = p_draw_id AND raffle_id = p_raffle_id;
  IF v_result IS NULL THEN
    SELECT id INTO v_ticket_id FROM tickets WHERE raffle_id = p_raffle_id AND status='sold' ORDER BY random() LIMIT 1;
  ELSE
    SELECT id INTO v_ticket_id FROM tickets
    WHERE raffle_id = p_raffle_id AND status='sold' AND right(lpad(ticket_number::text, 3, '0'), 3) = right(v_result, 3)
    ORDER BY random() LIMIT 1;
  END IF;
  INSERT INTO winners(raffle_id, draw_id, ticket_id, position, type, rule_applied, ticket_number_snapshot)
  VALUES (p_raffle_id, p_draw_id, v_ticket_id, 1, 'public_draw', coalesce(v_rule,'last_3_digits'), (SELECT ticket_number FROM tickets WHERE id=v_ticket_id))
  RETURNING id INTO v_winner_id;
  RETURN v_winner_id;
END;$$;

CREATE OR REPLACE FUNCTION public.compute_top_buyer_winner(p_raffle_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_ticket_id uuid;
  v_winner_id uuid;
BEGIN
  SELECT p.email
  INTO v_email
  FROM payments p
  WHERE p.raffle_id = p_raffle_id AND p.status='approved' AND p.email IS NOT NULL
  GROUP BY p.email
  ORDER BY count(*) DESC, max(p.created_at) DESC
  LIMIT 1;
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT t.id INTO v_ticket_id
  FROM tickets t
  JOIN payment_tickets pt ON pt.ticket_id = t.id
  JOIN payments p ON p.id = pt.payment_id
  WHERE p.raffle_id = p_raffle_id AND p.status='approved' AND p.email = v_email AND t.status='sold'
  ORDER BY random() LIMIT 1;
  INSERT INTO winners(raffle_id, draw_id, ticket_id, position, type, rule_applied, ticket_number_snapshot, winner_name)
  VALUES (p_raffle_id, NULL, v_ticket_id, 1, 'top_buyer', 'largest_buyer', (SELECT ticket_number FROM tickets WHERE id=v_ticket_id), v_email)
  RETURNING id INTO v_winner_id;
  RETURN v_winner_id;
END;$$;

-- (Opcional) Re-crear trigger function con search_path fijo aunque no sea SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.set_has_top_buyer_prize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    NEW.has_top_buyer_prize := (COALESCE(NEW.top_buyer_prize_cents,0) > 0);
  END IF;
  RETURN NEW;
END;$$;

COMMIT;

-- Post-ejecución: refrescar Security Advisor para confirmar mitigaciones.
