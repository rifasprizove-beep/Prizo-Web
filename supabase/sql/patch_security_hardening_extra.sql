-- Patch extra: completar hardening para funciones restantes y vista
-- Objetivo: añadir search_path fijo y reemplazar vista por función para reducir alertas Advisor.
BEGIN;

-- 1) Re-crear release_expired_reservations con search_path
DROP FUNCTION IF EXISTS public.release_expired_reservations();
CREATE OR REPLACE FUNCTION public.release_expired_reservations()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE tickets
     SET status='available', reserved_by=NULL, reserved_until=NULL
   WHERE status='reserved' AND reserved_until IS NOT NULL AND reserved_until < now();
$$;

-- 2) Re-crear create_payment_for_session para asegurar versión con search_path (por si otra definición quedó activa)
DROP FUNCTION IF EXISTS public.create_payment_for_session(uuid,uuid,text,text,text,text,text,text,numeric,numeric,text,text,text);
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

-- 3) (Opcional) Reemplazar vista raffle_ticket_counters por función para mitigar alerta "Security Definer View"
-- La función no se marca como SECURITY DEFINER; usa RLS subyacente.
DROP VIEW IF EXISTS raffle_ticket_counters;
CREATE OR REPLACE FUNCTION public.raffle_ticket_counters()
RETURNS TABLE (
  raffle_id uuid,
  total_tickets int,
  sold bigint,
  reserved bigint,
  available bigint
)
LANGUAGE sql
SET search_path = public
AS $$
  SELECT
    r.id AS raffle_id,
    r.total_tickets,
    COALESCE(SUM(CASE WHEN t.status = 'sold' THEN 1 ELSE 0 END),0)::bigint AS sold,
    COALESCE(SUM(CASE WHEN t.status = 'reserved' AND t.reserved_until IS NOT NULL AND t.reserved_until > now() THEN 1 ELSE 0 END),0)::bigint AS reserved,
    GREATEST(0, (r.total_tickets - (
      COALESCE(SUM(CASE WHEN t.status = 'sold' THEN 1 ELSE 0 END),0) +
      COALESCE(SUM(CASE WHEN t.status = 'reserved' AND t.reserved_until IS NOT NULL AND t.reserved_until > now() THEN 1 ELSE 0 END),0)
    )))::bigint AS available
  FROM raffles r
  LEFT JOIN tickets t ON t.raffle_id = r.id
  GROUP BY r.id, r.total_tickets;
$$;

-- 4) Índice funcional para orden numérico rápido de ticket_number si es necesario
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_number_int ON tickets ((ticket_number::int));

COMMIT;

-- Post: ejecutar SELECT * FROM raffle_ticket_counters(); para verificar.