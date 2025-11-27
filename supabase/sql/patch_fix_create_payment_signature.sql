-- Patch: Fix create_payment_for_session signature to match frontend payload
-- Ensures PostgREST schema cache finds a single matching function
-- Date: 2025-11-26

BEGIN;

-- Drop ambiguous legacy overloads if present
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = 'public' AND p.proname = 'create_payment_for_session'
			AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, text, text'
	) THEN
		EXECUTE 'DROP FUNCTION public.create_payment_for_session(uuid, uuid, text, text, text)';
	END IF;

	IF EXISTS (
		SELECT 1 FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = 'public' AND p.proname = 'create_payment_for_session'
			AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, numeric, numeric, text, text, text, text, text, text, text, text, text'
	) THEN
		EXECUTE 'DROP FUNCTION public.create_payment_for_session(uuid, uuid, numeric, numeric, text, text, text, text, text, text, text, text, text)';
	END IF;

	-- Si existe la versión previa con 14 parámetros (mismos tipos) donde los nombres difieren
	-- (p_instagram al final y p_currency antes), hay que dropearla para poder cambiar
	-- los nombres/orden de parámetros (CREATE OR REPLACE no permite renombrarlos).
	IF EXISTS (
		SELECT 1 FROM pg_proc p
		JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = 'public' AND p.proname = 'create_payment_for_session'
			AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, text, text, text, text, text, numeric, numeric, text, text, text, text'
	) THEN
		EXECUTE 'DROP FUNCTION public.create_payment_for_session(uuid, uuid, text, text, text, text, text, text, numeric, numeric, text, text, text, text)';
	END IF;
END$$;

-- Create authoritative function aligned with frontend args
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
	p_instagram text,
	p_currency text default 'VES',
	p_ci text default null
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	v_payment_id uuid;
BEGIN
	-- instagram obligatorio (no nulo ni vacío)
	IF p_instagram IS NULL OR length(btrim(p_instagram)) = 0 THEN
		RAISE EXCEPTION 'instagram_required';
	END IF;

	INSERT INTO public.payments(
		raffle_id, session_id, email, phone, city, method, reference, evidence_url,
		amount_ves, rate_used, rate_source, currency, status, ci
	) VALUES (
		p_raffle_id, p_session_id, p_email, p_phone, p_city, p_method, p_reference, p_evidence_url,
		p_amount_ves, p_rate_used, p_rate_source, p_currency, 'pending', p_ci
	) RETURNING id INTO v_payment_id;

	INSERT INTO public.payment_tickets(payment_id, ticket_id)
	SELECT v_payment_id, t.id
	FROM public.tickets t
	WHERE t.raffle_id = p_raffle_id AND t.reserved_by = p_session_id AND t.status='reserved'
				AND (t.reserved_until IS NULL OR t.reserved_until > now());

	UPDATE public.tickets t
		 SET reserved_until = NULL,
				 reserved_by = NULL
	 WHERE t.id IN (SELECT pt.ticket_id FROM public.payment_tickets pt WHERE pt.payment_id = v_payment_id)
		 AND t.status = 'reserved';

	RETURN v_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_payment_for_session(
	uuid, uuid, text, text, text, text, text, text, numeric, numeric, text, text, text, text
) TO authenticated, anon;

COMMIT;

