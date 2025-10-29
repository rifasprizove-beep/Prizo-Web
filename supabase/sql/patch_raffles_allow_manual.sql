-- Patch: add allow_manual flag to raffles
-- Safe to run multiple times

alter table if exists public.raffles
  add column if not exists allow_manual boolean default true;
