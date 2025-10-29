-- Habilitar pg_cron y programar liberación de reservas (ajusta permisos en tu instancia)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Ejecuta cada minuto
SELECT cron.schedule(
  'release-expired-reservations',
  '*/1 * * * *',
  $$ SELECT release_expired_reservations(); $$
);
