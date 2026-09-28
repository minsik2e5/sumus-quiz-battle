-- SUMUS VOCA v13.57: incremental ("parts") backup of the VOCA state.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste all -> Run.
-- It only ADDS two tables and four functions. The existing voca_v12_* table and RPCs are
-- not changed, and the app keeps using them until these functions exist.
--
-- Why: the app used to upload the whole state (about 2.7 MB) on every backup. With these
-- functions it uploads only the parts that changed (usually a few KB per student).
--
-- Security: the tables have row level security on and no policies, so they are reachable
-- only through the functions below. Every function checks the same state secret the app
-- already uses (VOCA_STATE_SECRET), compared by its SHA-256 fingerprint (the one the deploy
-- workflow checks), so the secret itself is not written here.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.voca_v13_parts (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.voca_v13_meta (
  id int primary key default 1 check (id = 1),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.voca_v13_meta (id) values (1) on conflict (id) do nothing;

alter table public.voca_v13_parts enable row level security;
alter table public.voca_v13_meta enable row level security;
revoke all on public.voca_v13_parts, public.voca_v13_meta from anon, authenticated;

create or replace function public.voca_v13_check_secret(p_secret text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex')
     <> '81336e5a06fcd1381eb4e828715636773142660f792073648a5fb2e81f410e53' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- Writes changed parts and removes deleted ones in one transaction.
-- p_parts: {"part key": <json>, ...}; p_removed: ["part key", ...].
-- p_revision must equal the current revision (optimistic concurrency, like v12).
create or replace function public.voca_v13_state_patch(p_secret text, p_revision bigint, p_parts jsonb, p_removed jsonb default '[]'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_revision bigint;
begin
  perform public.voca_v13_check_secret(p_secret);
  select revision into current_revision from public.voca_v13_meta where id = 1 for update;
  if current_revision is distinct from p_revision then
    raise exception 'revision_conflict' using errcode = '40001';
  end if;
  if jsonb_typeof(p_parts) = 'object' then
    insert into public.voca_v13_parts (key, data, updated_at)
    select e.key, e.value, now() from jsonb_each(p_parts) as e(key, value)
    on conflict (key) do update set data = excluded.data, updated_at = now();
  end if;
  if jsonb_typeof(p_removed) = 'array' then
    delete from public.voca_v13_parts where key in (select jsonb_array_elements_text(p_removed));
  end if;
  update public.voca_v13_meta set revision = revision + 1, updated_at = now() where id = 1
  returning revision into current_revision;
  return current_revision;
end;
$$;

-- Everything, for a restore: {revision, parts: {"part key": <json>, ...}}.
create or replace function public.voca_v13_state_read(p_secret text)
returns table (revision bigint, parts jsonb)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.voca_v13_check_secret(p_secret);
  return query
    select m.revision, coalesce((select jsonb_object_agg(p.key, p.data) from public.voca_v13_parts p), '{}'::jsonb)
    from public.voca_v13_meta m where m.id = 1;
end;
$$;

-- Only the revision (after a lost response or a conflict).
create or replace function public.voca_v13_state_revision(p_secret text)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_revision bigint;
begin
  perform public.voca_v13_check_secret(p_secret);
  select revision into current_revision from public.voca_v13_meta where id = 1;
  return current_revision;
end;
$$;

revoke all on function public.voca_v13_check_secret(text) from public, anon, authenticated;
revoke all on function public.voca_v13_state_patch(text, bigint, jsonb, jsonb) from public;
revoke all on function public.voca_v13_state_read(text) from public;
revoke all on function public.voca_v13_state_revision(text) from public;
grant execute on function public.voca_v13_state_patch(text, bigint, jsonb, jsonb) to anon, authenticated;
grant execute on function public.voca_v13_state_read(text) to anon, authenticated;
grant execute on function public.voca_v13_state_revision(text) to anon, authenticated;

-- Let the Supabase API see the new functions right away.
notify pgrst, 'reload schema';
