-- V5 isolated tables. Existing Deal Hunter and academy tables are untouched.
begin;
create table if not exists public.deal_hunter_v5_state (
  workspace_id text primary key,
  revision bigint not null check (revision > 0),
  state_json jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.deal_hunter_v5_state_versions (
  id bigint generated always as identity primary key,
  workspace_id text not null,
  revision bigint not null,
  state_json jsonb not null,
  created_at timestamptz not null default now(),
  unique(workspace_id,revision)
);
create index if not exists dh_v5_versions_workspace on public.deal_hunter_v5_state_versions(workspace_id,id desc);
alter table public.deal_hunter_v5_state enable row level security;
alter table public.deal_hunter_v5_state_versions enable row level security;
revoke all on public.deal_hunter_v5_state, public.deal_hunter_v5_state_versions from anon, authenticated;
grant all on public.deal_hunter_v5_state, public.deal_hunter_v5_state_versions to service_role;
grant usage,select on sequence public.deal_hunter_v5_state_versions_id_seq to service_role;
-- Lock, revision comparison, previous snapshot and new state commit in one transaction.
create or replace function public.deal_hunter_v5_commit(p_workspace text,p_expected bigint,p_state jsonb default null,p_version bigint default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare current_row public.deal_hunter_v5_state%rowtype; target_row public.deal_hunter_v5_state_versions%rowtype; next_state jsonb; next_revision bigint; stamp timestamptz;
begin
  if p_workspace is null or p_workspace <> 'main' or p_expected is null or p_expected < 0 or (p_state is null) = (p_version is null) then raise exception 'Invalid request';end if;
  perform pg_advisory_xact_lock(hashtextextended('deal-hunter-v5:' || p_workspace,0));
  select * into current_row from public.deal_hunter_v5_state where workspace_id=p_workspace for update;
  if coalesce(current_row.revision,0) <> p_expected then return jsonb_build_object('conflict',true,'revision',coalesce(current_row.revision,0),'updatedAt',current_row.updated_at);end if;
  if p_version is not null then
    select * into target_row from public.deal_hunter_v5_state_versions where workspace_id=p_workspace and id=p_version;
    if not found then return jsonb_build_object('missing',true);end if;
    next_state=target_row.state_json;
  else next_state=p_state;end if;
  if coalesce(jsonb_typeof(next_state),'') <> 'object' or coalesce(jsonb_typeof(next_state->'items'),'') <> 'array' or coalesce(next_state->>'schemaVersion','') not in ('4','5','6') or jsonb_array_length(next_state->'items')>10000 then raise exception 'Invalid ledger';end if;
  if exists(select 1 from jsonb_array_elements(next_state->'items') i where coalesce(i->>'id','')='') or
    (select count(*) from jsonb_array_elements(next_state->'items')) <> (select count(distinct i->>'id') from jsonb_array_elements(next_state->'items') i) then raise exception 'Missing or duplicate IDs';end if;
  stamp=clock_timestamp();next_revision=coalesce(current_row.revision,0)+1;
  if current_row.revision is not null then
    insert into public.deal_hunter_v5_state_versions(workspace_id,revision,state_json) values(p_workspace,current_row.revision,current_row.state_json);
  end if;
  insert into public.deal_hunter_v5_state(workspace_id,revision,state_json,updated_at) values(p_workspace,next_revision,next_state,stamp)
    on conflict(workspace_id) do update set revision=excluded.revision,state_json=excluded.state_json,updated_at=excluded.updated_at;
  -- Retain all versions during stabilization. Retention cleanup is a separate reviewed action.
  return jsonb_build_object('conflict',false,'revision',next_revision,'updatedAt',stamp,'restoredFromRevision',target_row.revision,'state',case when p_version is not null then next_state else null end);
end $$;
revoke all on function public.deal_hunter_v5_commit(text,bigint,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.deal_hunter_v5_commit(text,bigint,jsonb,bigint) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('deal-hunter-v5-files','deal-hunter-v5-files',false,8000000,array['image/jpeg','image/png','image/webp','image/gif','application/pdf'])
on conflict(id) do nothing;
commit;
