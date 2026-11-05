# v13.219.0 Supabase 백업을 새 프로젝트로 옮기기

## 무엇이 있었나
- 2026-11-05 선생님 화면: "데이터 백업이 9시간째 안 되고 있어요 — Supabase가 답하지 않아요(일시정지 · 점검일 수 있어요)".
- 운영 `/api/health`의 실제 오류: `voca_v12_state_commit: HTTP 500 57014 canceling statement due to statement timeout (13867 KB)`, `supabase_backup_mode: full`.
  - Supabase는 답했다. 조각 백업 함수(`voca_v13_…`)가 404여서 통째(13.9MB) 업로드로 버텼고, 그것이 API 시간 제한에 걸려 취소됐다.
  - 백업 프로젝트를 만든 계정을 찾지 못해 함수를 다시 만들 수 없었다 → 새 프로젝트로 옮긴다.

## 바뀐 것
- `supabase/voca_v12_state.sql` (새 파일): 원래 프로젝트에만 있던 통째 사본 표 · 함수를 워커가 부르는 모양 그대로 다시 만든다.
  - 처음엔 줄이 없다: 빈 사본을 백업으로 읽어 학생 기록을 덮지 않는다(워커는 로컬 사본으로 시작).
  - 첫 commit은 옛 프로젝트 번호를 들고 와도 받아 1이 된다. 그다음부터는 번호가 어긋나면 40001.
  - 비밀값은 v13의 `voca_v13_check_secret`으로 확인(지문을 두 곳에 적지 않음).
  - anon · authenticated 시간 제한 2분: 13MB 통째 사본이 57014로 끊기지 않게.
- 백업 실패 분류: `57014` · `statement timeout`은 `timeout`(답 없음 → "일시정지 의심")이 아니라 새 종류 `too_big`.
  선생님 경고 문구도 "백업이 커서 Supabase가 저장 도중 끊어요(시간 제한 · 조각 백업 함수가 있는지 확인)"로.
- `wrangler.jsonc`: `SUPABASE_URL` · `SUPABASE_ANON_KEY`를 새 프로젝트로.
- 안내서 `docs/supabase-backup-runbook.md` 6번: 새 프로젝트로 옮기는 순서.

## 검사
- `server/sql-check.mjs`: v12 SQL을 PGlite(진짜 Postgres)에서 두 번 실행, 빈 read는 0줄, 비밀값 거절, 첫 commit 번호 무관, 충돌 40001, anon은 함수로만, 시간 제한 2분.
- `server/supabase-backup-check.mjs` 6번: 옛 프로젝트에서 조각 백업 → 밀린 기록이 있는 채로 빈 새 프로젝트로 바꿔 다시 시작
  → 로컬 기록 그대로 시작 → 번호 한 번 어긋남 → 조각 전부 다시 올림 → 새 프로젝트 조각을 합치면 지금 상태와 같음 → 다시 시작해도 같음.
  밀린 것 없이 바꿔도 빈 새 프로젝트를 받아들이지 않는다.
- 0번: 운영 오류 문구가 `too_big`으로, "일시정지"라고 하지 않는다.
