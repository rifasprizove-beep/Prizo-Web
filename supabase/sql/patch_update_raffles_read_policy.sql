-- Ampliar política de lectura para incluir 'closed' y 'drawn' (y opcional 'archived')
-- Ejecutar luego de crear la política original si ya existe.
-- Si la política existe la reemplazamos.

-- Elimina política previa si su definición restringe a sólo published/selling
drop policy if exists raffles_read on raffles;

create policy raffles_read on raffles for select using (status in ('published','selling','closed','drawn'));
-- Si deseas incluir 'archived' en lecturas públicas agrega:
-- alter policy raffles_read on raffles using (status in ('published','selling','closed','drawn','archived'));
