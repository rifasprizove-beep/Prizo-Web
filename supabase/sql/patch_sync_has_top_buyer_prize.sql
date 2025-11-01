-- Sincroniza has_top_buyer_prize con top_buyer_prize_cents
-- Útil como parche incremental si ya tienes la BD creada

create or replace function set_has_top_buyer_prize()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' or TG_OP = 'UPDATE' then
    NEW.has_top_buyer_prize := coalesce(NEW.top_buyer_prize_cents, 0) > 0;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_has_top_buyer_prize on raffles;
create trigger trg_sync_has_top_buyer_prize
before insert or update of top_buyer_prize_cents, has_top_buyer_prize
on raffles
for each row
execute function set_has_top_buyer_prize();

-- Ajuste inicial de datos
update raffles set has_top_buyer_prize = (coalesce(top_buyer_prize_cents,0) > 0);
