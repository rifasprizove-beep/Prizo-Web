-- Agrega el campo top_buyer_prize_cents a la tabla raffles
-- Representa el premio destinado al Top Comprador en centavos
-- Default 0 para compatibilidad

alter table public.raffles
  add column if not exists top_buyer_prize_cents integer not null default 0;

comment on column public.raffles.top_buyer_prize_cents is 'Premio para el Top Comprador en centavos (según raffles.currency)';
