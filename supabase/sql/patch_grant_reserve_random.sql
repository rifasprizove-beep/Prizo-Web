-- Patch: grant execute on reserve_random_tickets to anon/authenticated
-- Safe to run multiple times

grant execute on function public.reserve_random_tickets(uuid, uuid, int, int) to anon, authenticated;
