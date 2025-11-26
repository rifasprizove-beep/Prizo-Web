-- Patch: usar instagram del pago para el Top Comprador
-- Idempotente: re-crea la función compute_top_buyer_winner guardando instagram_user
SET search_path = public;

CREATE OR REPLACE FUNCTION public.compute_top_buyer_winner(p_raffle_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_instagram text;
  v_ticket_id uuid;
  v_winner_id uuid;
BEGIN
  -- Determinar el comprador por mayor cantidad de tickets (por email)
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

  -- Recuperar el último instagram suministrado por ese email en la misma rifa
  SELECT p2.instagram
  INTO v_instagram
  FROM payments p2
  WHERE p2.raffle_id = p_raffle_id AND p2.email = v_email AND p2.instagram IS NOT NULL
  ORDER BY p2.created_at DESC
  LIMIT 1;

  -- Escoger un ticket vendido de ese comprador
  SELECT t.id INTO v_ticket_id
  FROM tickets t
  JOIN payment_tickets pt ON pt.ticket_id = t.id
  JOIN payments p ON p.id = pt.payment_id
  WHERE p.raffle_id = p_raffle_id AND p.status='approved' AND p.email = v_email AND t.status='sold'
  ORDER BY random() LIMIT 1;

  INSERT INTO winners(raffle_id, draw_id, ticket_id, position, type, rule_applied, ticket_number_snapshot, winner_name, instagram_user)
  VALUES (
    p_raffle_id,
    NULL,
    v_ticket_id,
    1,
    'top_buyer',
    'largest_buyer',
    (SELECT ticket_number FROM tickets WHERE id=v_ticket_id),
    COALESCE(v_instagram, v_email),
    v_instagram
  )
  RETURNING id INTO v_winner_id;

  RETURN v_winner_id;
END;$$;
