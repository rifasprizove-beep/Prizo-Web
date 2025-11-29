-- Patch: remover columna redundante ci_number en payments (idempotente)
-- Motivo: ya almacenamos la cédula completa en `ci` (ej. V-12345678).
-- Efecto: simplifica el esquema; no afecta la función create_payment_for_session.

set search_path = public;

-- Quitar dependencias si existieran (índices/constraints) de forma segura
do $$
begin
  -- ÍNDICES con ese nombre; ignora errores si no existen
  begin
    execute 'drop index if exists idx_payments_ci_number';
  exception when others then null; end;
end;$$;

-- Eliminar columna si existe
alter table if exists public.payments
  drop column if exists ci_number;

-- Refrescar cache de PostgREST por si hay clients que consultan columnas
select pg_notify('pgrst','reload schema');
