-- Automatizar transición de estados de rifas según starts_at / ends_at
-- Script profesional y robusto.
-- Requisitos opcionales: extensión pg_cron activa. Si no está, se crea la función igualmente y puedes usar un cron externo.
-- Comprobar pg_cron:
--   SELECT extname, nspname FROM pg_extension JOIN pg_namespace ON pg_namespace.oid = extnamespace WHERE extname='pg_cron';
-- Habilitar (Supabase Dashboard > Extensions > activar pg_cron). Crear extensión aquí no siempre es necesario.

CREATE EXTENSION IF NOT EXISTS pg_cron;  -- no falla si falta permiso, simplemente no instala

-- Función idempotente de transición. SECURITY DEFINER permite ejecución por el job aunque cambien privilegios.
-- search_path a public para evitar efectos de otros schemas.
CREATE OR REPLACE FUNCTION public.apply_raffle_status_transitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- published -> selling
  UPDATE raffles
     SET status = 'selling'
   WHERE status = 'published'
     AND starts_at IS NOT NULL
     AND starts_at <= now()
     AND (ends_at IS NULL OR ends_at > now());

  -- selling|published -> drawn (terminó la ventana de venta)
  UPDATE raffles
     SET status = 'drawn'
   WHERE status IN ('selling','published')
     AND ends_at IS NOT NULL
     AND ends_at <= now();

  -- selling|published -> drawn (agotado: todos los tickets vendidos)
  -- Usamos la vista raffle_ticket_counters para comparar sold vs total_tickets
  UPDATE raffles r
     SET status = 'drawn'
   WHERE r.status IN ('selling','published')
     AND EXISTS (
       SELECT 1
       FROM raffle_ticket_counters c
       WHERE c.raffle_id = r.id
         AND c.sold >= c.total_tickets
         AND c.total_tickets > 0
     );

  -- drawn -> closed (existe winner público)
  UPDATE raffles r
     SET status = 'closed'
   WHERE r.status = 'drawn'
     AND EXISTS (
       SELECT 1 FROM winners w
        WHERE w.raffle_id = r.id AND w.type = 'public_draw'
     );

  -- closed -> archived (hace >30 días de cierre)
  UPDATE raffles
     SET status = 'archived'
   WHERE status = 'closed'
     AND ends_at IS NOT NULL
     AND ends_at < now() - interval '30 days';
END;$$;

-- Programar job cada minuto sólo si pg_cron existe y el job no está creado.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='raffle_status_transitions') THEN
      PERFORM cron.schedule(
        'raffle_status_transitions',
        '* * * * *',
        'SELECT public.apply_raffle_status_transitions();'
      );
    END IF;
  END IF;
END;$$;

-- Verificación manual:
--   SELECT public.apply_raffle_status_transitions();
--   SELECT id, status, starts_at, ends_at FROM raffles ORDER BY created_at DESC LIMIT 20;
-- Ver job si extensión activa:
--   SELECT jobid, jobname, schedule, command, active FROM cron.job WHERE jobname='raffle_status_transitions';
-- Fallback sin pg_cron: usar cron externo que llame la función cada minuto.
