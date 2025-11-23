-- Trigger para marcar la rifa como 'closed' inmediatamente al insertar un winner de tipo public_draw
-- Ejecutar después de aplicar schema y antes / después del cron (indiferente).

create or replace function public.trg_winner_close_raffle() returns trigger language plpgsql as $$
begin
  -- Solo ganador público y rifa actualmente en estado drawn
  if (NEW.type = 'public_draw') then
    update raffles set status = 'closed'
    where id = NEW.raffle_id and status = 'drawn';
  end if;
  return NEW;
end;$$;

drop trigger if exists trg_winner_close_raffle on winners;
create trigger trg_winner_close_raffle
  after insert on winners
  for each row
  execute procedure public.trg_winner_close_raffle();
