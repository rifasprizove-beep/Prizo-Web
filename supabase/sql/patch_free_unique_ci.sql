-- Patch: unique per raffle on CI for free method (idempotent)
set search_path = public;

-- Functional unique index to avoid duplicates like "V-12.345.678" vs "v12345678"
create unique index if not exists ux_payments_free_ci
  on payments (raffle_id, upper(regexp_replace(coalesce(ci,''),'[^0-9A-Za-z]','','g')))
  where (method = 'free' and ci is not null);
