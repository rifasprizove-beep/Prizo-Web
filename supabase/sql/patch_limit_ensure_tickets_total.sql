-- Patch: Limitar creación de tickets en ensure_tickets_for_raffle
-- Previene que un p_total mal formado cree más tickets que los definidos
-- Conserva el comportamiento para rifas gratuitas (total_tickets = 0)
BEGIN;

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
  v_total int;
  v_allowed int;
BEGIN
  -- Obtener total declarado en la rifa
  SELECT total_tickets INTO v_total FROM raffles WHERE id = p_raffle_id;

  -- Si la rifa es gratuita y tiene total_tickets = 0, permitimos creación dinámica
  IF v_total IS NULL OR v_total = 0 THEN
    v_allowed := p_total;
  ELSE
    v_allowed := v_total;
  END IF;

  -- Asegurar que no intentamos crear más que lo permitido
  IF p_total > v_allowed THEN
    p_total := v_allowed;
  END IF;

  INSERT INTO tickets (raffle_id, ticket_number, status)
  SELECT p_raffle_id, gs::text, 'available'
  FROM generate_series(1, p_total) AS gs
  ON CONFLICT (raffle_id, ticket_number) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;$$;

COMMIT;

-- Nota: ejecutar este patch en Supabase SQL editor para actualizar la función.
