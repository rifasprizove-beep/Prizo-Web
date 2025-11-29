-- Patch: limpieza exhaustiva de variantes antiguas de create_payment_for_session
-- Objetivo: dejar UNA sola versión (14 argumentos con instagram) con SECURITY DEFINER y search_path fijo
BEGIN;

-- 1) Drop de posibles firmas obsoletas (algunas pueden no existir; se ignoran sin error)
-- Firmas sin argumentos (probables pruebas)
DROP FUNCTION IF EXISTS public.create_payment_for_session();
-- Solo session_id (uuid) retornando uuid / void / jsonb / TABLE
DROP FUNCTION IF EXISTS public.create_payment_for_session(p_session_id uuid);
DROP FUNCTION IF EXISTS public.create_payment_for_session(session_id uuid);
-- Dos uuid (raffle + session) sin campos extra
DROP FUNCTION IF EXISTS public.create_payment_for_session(uuid,uuid);
-- Variantes que retornan TABLE(...) o jsonb (firmas típicas de prototipo)
DROP FUNCTION IF EXISTS public.create_payment_for_session(p_session_id uuid, OUT payment_id uuid);
DROP FUNCTION IF EXISTS public.create_payment_for_session(p_raffle_id uuid, p_session_id uuid, OUT payment_id uuid);
DROP FUNCTION IF EXISTS public.create_payment_for_session(p_session_id uuid, OUT result jsonb);
DROP FUNCTION IF EXISTS public.create_payment_for_session(p_raffle_id uuid, p_session_id uuid, OUT result jsonb);
-- Firma 8 args (hasta evidence_url)
DROP FUNCTION IF EXISTS public.create_payment_for_session(uuid,uuid,text,text,text,text,text,text);
-- Firma 13 args sin instagram
DROP FUNCTION IF EXISTS public.create_payment_for_session(uuid,uuid,text,text,text,text,text,text,numeric,numeric,text,text,text);
-- Posible firma con jsonb de salida
DROP FUNCTION IF EXISTS public.create_payment_for_session(uuid,uuid,text,text,text,text,text,text,numeric,numeric,text,text,text, OUT result jsonb);
-- Cualquier firma que retorne void
DROP FUNCTION IF EXISTS public.create_payment_for_session(p_raffle_id uuid, p_session_id uuid, p_email text, p_phone text, p_city text, p_method text, p_reference text, p_evidence_url text, p_amount_ves numeric, p_rate_used numeric, p_rate_source text, p_currency text);

-- 2) Re-creación única (14 args) si no existe ya con search_path
-- Comprobación rápida: solo recrear si NO existe una firma con 14 argumentos
DO $do$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public'
      AND p.proname='create_payment_for_session'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, text, text, text, text, text, numeric, numeric, text, text, text, text'
  ) INTO v_exists;
  IF NOT v_exists THEN
    EXECUTE $fn$
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
        p_ci text DEFAULT NULL,
        p_instagram text DEFAULT NULL
      ) RETURNS uuid
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        v_payment_id uuid;
      BEGIN
        INSERT INTO payments(raffle_id, session_id, email, phone, city, method, reference, evidence_url, amount_ves, rate_used, rate_source, currency, status, ci, instagram)
        VALUES (p_raffle_id, p_session_id, p_email, p_phone, p_city, p_method, p_reference, p_evidence_url, p_amount_ves, p_rate_used, p_rate_source, p_currency, 'pending', p_ci, p_instagram)
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
      END;
      $body$;
    $fn$;
  END IF;
END;
$do$;

-- 3) Grant explícito (idempotente)
GRANT EXECUTE ON FUNCTION public.create_payment_for_session(uuid,uuid,text,text,text,text,text,text,numeric,numeric,text,text,text,text) TO anon, authenticated;

COMMIT;

-- 4) Verificación (ejecutar manualmente):
-- SELECT pg_get_function_identity_arguments(p.oid) AS args, array_to_string(p.proconfig,';') AS config
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname='public' AND p.proname='create_payment_for_session';
