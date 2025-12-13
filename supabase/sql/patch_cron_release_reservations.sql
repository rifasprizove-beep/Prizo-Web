-- Asegurar cron de liberación automática de reservas cada 1 minuto (idempotente)
-- Requiere pg_cron habilitado en tu instancia. Si no lo está, actívalo en Supabase > Extensions.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Función ya definida en patch_security_hardening_extra.sql; aquí se asegura su existencia mínima
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

-- Programar job cada minuto si no existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='release-expired-reservations') THEN
      PERFORM cron.schedule(
        'release-expired-reservations',
        '* * * * *',
        'SELECT public.release_expired_reservations();'
      );
    END IF;
  END IF;
END;$$;

-- Comprobaciones sugeridas:
--   SELECT extname FROM pg_extension WHERE extname='pg_cron';
--   SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname='release-expired-reservations';
--   SELECT public.release_expired_reservations();
