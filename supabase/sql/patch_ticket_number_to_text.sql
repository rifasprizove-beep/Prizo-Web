-- Patch: cambiar ticket_number de integer a text preservando valores
-- Ejecutar dentro de una transacción para seguridad
BEGIN;

-- 1) Eliminar primero el constraint antiguo que asume integer para evitar error (text >= integer)
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS chk_ticket_number; -- contenía "ticket_number >= 0"

-- 2) Cambiar tipo de dato a text preservando valores
ALTER TABLE tickets
  ALTER COLUMN ticket_number TYPE text USING ticket_number::text;

-- 3) Crear nuevo constraint de validación (solo dígitos)
ALTER TABLE tickets ADD CONSTRAINT chk_ticket_number_digits CHECK (ticket_number ~ '^[0-9]+$');

-- Re-crear función ensure_tickets_for_raffle para insertar ticket_number como texto
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

-- Re-crear función ensure_and_reserve_random_tickets para rifas gratuitas ilimitadas
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

  -- liberación previa de reservas de esta sesión
  UPDATE tickets
     SET status='available', reserved_by=null, reserved_until=null
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

COMMIT;

-- Verificación rápida:
-- SELECT data_type FROM information_schema.columns WHERE table_name='tickets' AND column_name='ticket_number'; -- debe ser text
-- SELECT ticket_number FROM tickets LIMIT 10; -- valores como texto
-- Asegúrate de re-crear cualquier vista que CASTEE ticket_number si dependía de integer.