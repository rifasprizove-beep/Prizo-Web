-- Patch: Add prize_amount column to winners
-- Purpose: Store the prize amount won per winner
-- Type: numeric for currency (use double precision if you prefer non-decimal exactness)

BEGIN;

ALTER TABLE public.winners
  ADD COLUMN IF NOT EXISTS prize_amount numeric NULL;

COMMENT ON COLUMN public.winners.prize_amount IS 'Monto del premio ganado por el ganador (moneda base, ej. USD)';

COMMIT;
