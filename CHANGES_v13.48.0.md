# SUMUS VOCA v13.48.0 — 저장 방식 변경 (local-first)

## 왜 바꿨나
2026-09-27 운영 측정 결과(v13.47.0 `Server-Timing`):
- 전체 상태 크기 2.25MB (학생 11명, 연습 기록 256개)
- 답 하나 저장 = Supabase 커밋 **1.0~2.1초**. 학생은 이 시간 동안 다음 답을 누를 수 없었음

## 무엇이 바뀌나
| | 이전 | 이후 |
| --- | --- | --- |
| 답 저장 | Supabase RPC 완료까지 대기 | Durable Object 자체 SQLite에 저장 후 바로 응답 (같은 크기 기준 약 14ms) |
| Supabase | 요청마다 동기 커밋 | 약 1초 뒤 백그라운드 업로드. 같은 `voca_v12_state_commit` RPC와 같은 JSON 형식 |
| Supabase 장애 | 모든 저장 요청 실패 | 학생은 계속 사용 가능. 복구되면 자동으로 따라잡음 (최대 60초 간격 재시도 + 알람) |
| 서버 시작 | 항상 Supabase에서 읽음 | 아래 "시작 규칙" 참고 |

Supabase의 테이블, RPC, 데이터 형식은 **바뀌지 않습니다**. 기존 기록도 건드리지 않습니다.

## 시작 규칙 (`VocaStateObject.loadInitialState`)
1. 로컬에 Supabase가 아직 받지 못한 변경이 있으면 → **로컬 사용** (학생 답안 보존)
2. 그렇지 않으면 Supabase를 읽음
   - Supabase revision이 로컬이 마지막으로 동기화한 값과 다르면(첫 시작, 백업 복원 등) → **Supabase 채택**
   - 같으면 → 로컬 사용 (내용 동일)
3. Supabase를 읽을 수 없는데 동기화된 로컬 사본이 있으면 → 로컬로 시작

## 운영 확인 방법
- `GET /api/health` → `storage: { mode: 'local-first', supabase_pending, supabase_lag_sec, supabase_failures }`
- 저장 응답의 `Server-Timing`: `commit`(로컬 저장), `supabase`(마지막 백그라운드 업로드 시간)
- Cloudflare 로그: `[supabase-sync]` 동기화 실패/재시도, `[boot]` 시작 시 선택 경로

## 되돌릴 때 주의
v13.47 이하로 되돌리기 전에 `/api/health`에서 **`supabase_pending: false`**를 먼저 확인하세요. 옛 버전은 Supabase에서만 읽으므로, 업로드 대기 중인 마지막 몇 초의 답안이 빠질 수 있습니다.

## 검증
- `npm run check:cloudflare`: 새 시나리오 7개
  1. Supabase가 멈춰 있어도 답안이 즉시 응답
  2. 응답 전에 로컬 디스크에 저장됨
  3. 업로드 응답이 유실돼도 답안이 중복되지 않음 (409 → 최신 revision으로 재업로드)
  4. Supabase 장애 중에도 사용 가능, 이후 따라잡음
  5. 미동기화 상태로 재시작하면 Supabase를 읽지 않고 로컬 사용
  6. 로컬 디스크 쓰기 실패는 503을 반환하고, 반쯤 적용된 상태가 남지 않음
  7. 외부에서 복원된 Supabase를 받아들임
- `npm run check` 351/351, `npm run check:load` 통과, `wrangler deploy --dry-run` 번들 확인
- 같은 크기(2.26MB) 상태 벤치마크: 로컬 커밋 평균 14ms, 전체 복제 평균 18ms
