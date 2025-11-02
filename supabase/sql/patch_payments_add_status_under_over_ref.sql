-- Agrega nuevos estados al enum payment_status: underpaid, overpaid, ref_mismatch
-- Idempotente para entornos donde el valor ya exista

DO $$
BEGIN
  BEGIN
    ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'underpaid';
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'overpaid';
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'ref_mismatch';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
