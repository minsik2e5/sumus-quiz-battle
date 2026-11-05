-- SUMUS VOCA v13.220: 새 Supabase 프로젝트에 "통째 사본"(v12) 표와 함수를 만든다.
--
-- 새 프로젝트에서 한 번: 먼저 supabase/voca_v13_parts.sql을 Run 하고(비밀값 확인 함수가 거기 있다),
-- 그다음 SQL Editor -> New query -> 이 파일 전체 붙여 넣기 -> Run.
-- 두 번 실행해도 안전하고, 이미 있는 데이터를 지우지 않는다.
--
-- 왜: 2026-11 백업 프로젝트 계정을 잃어 새 프로젝트로 옮겼다. 원래 프로젝트의 v12 SQL은 저장소에
-- 없었으므로, 워커(cloudflare/worker.mjs)가 부르는 모양 그대로 여기서 다시 만든다.
--   voca_v12_state_read(p_secret)                       -> {revision, data}
--   voca_v12_state_commit(p_secret, p_revision, p_data) -> 새 revision (어긋나면 40001)
--
-- 안전: 처음에는 줄을 넣지 않는다. 빈 사본을 "백업"으로 읽어 학생 기록을 덮지 않도록,
-- 아직 한 번도 올리지 않았으면 read가 아무것도 돌려주지 않는다(워커는 로컬 사본으로 시작한다).
-- 첫 commit은 번호가 무엇이든 받아서 revision 1로 넣는다(옛 프로젝트의 번호를 들고 와도 된다).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.voca_v12_state (
  id int primary key default 1 check (id = 1),
  revision bigint not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.voca_v12_state enable row level security;
revoke all on public.voca_v12_state from anon, authenticated;

create or replace function public.voca_v12_state_read(p_secret text)
returns table (revision bigint, data jsonb)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.voca_v13_check_secret(p_secret);
  return query select s.revision, s.data from public.voca_v12_state s where s.id = 1;
end;
$$;

create or replace function public.voca_v12_state_commit(p_secret text, p_revision bigint, p_data jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_revision bigint;
begin
  perform public.voca_v13_check_secret(p_secret);
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'bad_state' using errcode = '22023';
  end if;
  select s.revision into current_revision from public.voca_v12_state s where s.id = 1 for update;
  if not found then
    insert into public.voca_v12_state (id, revision, data) values (1, 1, p_data);
    return 1;
  end if;
  if current_revision is distinct from p_revision then
    raise exception 'revision_conflict' using errcode = '40001';
  end if;
  update public.voca_v12_state set revision = revision + 1, data = p_data, updated_at = now() where id = 1
  returning revision into current_revision;
  return current_revision;
end;
$$;

revoke all on function public.voca_v12_state_read(text) from public;
revoke all on function public.voca_v12_state_commit(text, bigint, jsonb) from public;
grant execute on function public.voca_v12_state_read(text) to anon, authenticated;
grant execute on function public.voca_v12_state_commit(text, bigint, jsonb) to anon, authenticated;

-- 통째 사본은 13MB가 넘는다. API(anon)의 기본 시간 제한(약 8초)으로는 저장 도중 취소돼서
-- (57014 statement timeout) 2026-11에 백업이 멈췄다. 2분까지 기다리게 한다.
alter role anon set statement_timeout = '120s';
alter role authenticated set statement_timeout = '120s';

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
