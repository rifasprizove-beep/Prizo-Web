-- Agrega el campo prize_amount_cents a la tabla raffles
-- Representa el monto del premio en centavos de la moneda definida en raffles.currency
-- Default 0 para compatibilidad con datos existentes

alter table public.raffles
  add column if not exists prize_amount_cents integer not null default 0;

comment on column public.raffles.prize_amount_cents is 'Monto del premio principal en centavos (según raffles.currency)';
