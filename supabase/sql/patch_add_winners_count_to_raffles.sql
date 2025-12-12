-- Patch: Add winners_count column to raffles
-- Purpose: Store the number of winners for each raffle
-- Safe default: 1 winner

BEGIN;

ALTER TABLE public.raffles
  ADD COLUMN IF NOT EXISTS winners_count integer NOT NULL DEFAULT 1;

-- Optional: Comment for documentation
COMMENT ON COLUMN public.raffles.winners_count IS 'Número de ganadores para la rifa (por defecto 1)';

COMMIT;
