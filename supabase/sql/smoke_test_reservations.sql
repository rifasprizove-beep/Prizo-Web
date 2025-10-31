-- Smoke test para verificar reservas sin depender del frontend
-- 1) Cambia los valores entre comillas por tu raffle_id y un session_id (puede ser nuevo UUID)
-- 2) Ejecuta esto en el editor SQL de Supabase.

-- Param:
--   :raffle_id  -> UUID de la rifa (puedes copiarlo de cualquier fila de tickets.raffle_id)
--   :session_id -> Cualquier UUID (o el que usa tu navegador). La función ensure_session lo creará.
--   :total      -> Total de tickets de esa rifa (por ejemplo 1000)

-- Asegurar sesión
select public.ensure_session('00000000-0000-0000-0000-000000000000'); -- reemplaza por :session_id

-- Opcional: ver disponibles antes
select count(*) as available_before
from public.tickets
where raffle_id = '11111111-1111-1111-1111-111111111111' and status = 'available'; -- reemplaza por :raffle_id

-- Intentar reservar 3
select id, ticket_number, status, reserved_by, reserved_until
from public.ensure_and_reserve_random_tickets(
  '11111111-1111-1111-1111-111111111111', -- :raffle_id
  1000,                                     -- :total
  '00000000-0000-0000-0000-000000000000',   -- :session_id
  3,                                        -- cantidad
  10                                        -- minutos
);

-- Verificar que quedaron reservados
select id, ticket_number, status, reserved_by, reserved_until
from public.tickets
where raffle_id = '11111111-1111-1111-1111-111111111111'
  and reserved_by = '00000000-0000-0000-0000-000000000000';
