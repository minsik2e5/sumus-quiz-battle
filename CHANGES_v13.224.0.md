# v13.224.0 — Supabase 백업이 끝없이 다시 시도하며 CPU를 100%로 만들던 문제

## 왜
v13.223과 프로젝트 다시 시작 뒤에도 Supabase(`sumus-voca-backup`) CPU가 94~99%였어요. 살펴보니 이랬어요.
- **Postgres 로그:** `voca_v13_state_patch`가 **1초마다** `revision_conflict`로 실패했어요(1시간에 약 3,400번).
- **Supabase 입구(API Gateway) 로그:** 그 사이 우리 서버가 보낸 백업 요청은 2건뿐이었어요.

백업 함수는 번호가 어긋나면 오류 코드 `40001`(serialization_failure)을 냈어요. PostgREST는 이 코드를 "잠깐 겹친 것"으로 보고 **스스로 다시 시도**해요. 그런데 번호는 다시 해도 계속 어긋나서, 요청 하나가 Supabase 안에서 1초마다 끝없이 돌았어요.
- 그동안 우리 서버는 답을 못 받고(504 · 시간 초과), 번호를 고칠 기회도 없었어요.
- 요청이 하나 갈 때마다 끝없는 반복이 하나씩 늘어서, 무료 Nano 서버의 CPU가 꽉 찼어요.

## 바뀐 것
- **`supabase/voca_v13_parts.sql` · `supabase/voca_v12_state.sql`:** 번호 어긋남을 `PT409`로 알려요. PostgREST는 이 코드를 다시 시도하지 않고 바로 HTTP 409로 돌려줘요. 그러면 우리 서버가 번호를 다시 읽고 맞춰서 올려요(원래 있던 동작).
- **`cloudflare/worker.mjs` · `server/repository.mjs`:** `PT409`도 409로 알아들어요. 오류 글의 `revision_conflict`로도 이미 알아듣고 있어서, SQL만 먼저 바꿔도 안전해요.

## Supabase에서 할 일 (한 번)
- 대시보드 → SQL Editor → New query에서 `supabase/voca_v13_parts.sql`, 이어서 `supabase/voca_v12_state.sql` 전체를 붙여 Run 해요.
  - 두 파일 모두 함수를 새로 쓰기만 하고, 표 · 데이터는 그대로예요(`create or replace` · `if not exists`).
  - 돌고 있던 끝없는 다시 시도도 다음 차례에 새 함수를 불러 409로 끝나요.

## 검사
- `server/sql-check.mjs`(`npm run check:sql`, PGlite):
  - 어긋난 번호는 `PT409`
  - 두 SQL에 `40001`이 다시 들어가지 않음
- `server/supabase-backup-check.mjs` 7번: SQL은 `PT409`, 워커는 `PT409`를 409로 알아들음
- `npm run check`, `npm run check:cloudflare` 통과
