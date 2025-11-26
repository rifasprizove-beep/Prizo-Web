-- Creates the public Storage bucket "evidence" and minimal RLS policies
-- Run this in Supabase SQL Editor (or via migrations). Idempotent.

do $$
begin
  -- Create bucket only if it doesn't exist
  if not exists (
    select 1 from storage.buckets where id = 'evidence'
  ) then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('evidence', 'evidence', true, (5 * 1024 * 1024)::bigint);
  end if;
end$$;

-- Policies: allow public read and public insert into the evidence bucket
-- Note: We scope by bucket_id = 'evidence'. Adjust if you want stricter rules.

do $$
begin
  -- Read policy (idempotente)
  begin
    create policy "evidence_read_public"
    on storage.objects for select
    to anon, authenticated
    using (bucket_id = 'evidence');
  exception when duplicate_object then
    null;
  end;

  -- Insert policy (idempotente)
  begin
    create policy "evidence_insert_public"
    on storage.objects for insert
    to anon, authenticated
    with check (bucket_id = 'evidence');
  exception when duplicate_object then
    null;
  end;
end$$;

-- Optional: uncomment to allow updates/deletes if ever needed
-- create policy "evidence_update_public" on storage.objects for update to anon, authenticated using (bucket_id = 'evidence') with check (bucket_id = 'evidence');
-- create policy "evidence_delete_public" on storage.objects for delete to anon, authenticated using (bucket_id = 'evidence');
