# SUMUS VOCA v13.53.1: Supabase 백업 실패 원인 보이기

## 왜 바꿨나
- v13.53.0 배포 후 `/api/health`에서 `supabase_failures`가 계속 늘고 `supabase_lag_sec`가 커졌습니다.
- 학생 데이터는 Durable Object 저장소에 먼저 저장되므로 잃지 않았습니다. 하지만 Supabase 백업은 멈춘 상태입니다.
- 원인을 알 수 없었습니다. 업로드 오류를 "영구 저장 서버에 연결하지 못했습니다"라는 문구 하나로 바꿔 버려서, 로그에도 Supabase의 실제 이유가 남지 않았습니다.

## 무엇이 바뀌나 (학생 기능 변화 없음)
- `cloudflare/worker.mjs`: Supabase RPC가 실패하면 오류에 `detail`을 붙입니다.
  - 응답 오류일 때: HTTP 상태, Supabase 오류 코드, 메시지 앞 160자, 보낸 데이터 크기(KB)
  - 시간 초과·네트워크 오류일 때: 오류 이름과 메시지
  - 요청 본문과 비밀키는 넣지 않습니다.
  - 학생에게 보이는 문구는 그대로입니다.
- `cloudflare/local-first.mjs`: 백업 재시도 기록(`last_error`)에 이 `detail`을 남깁니다.
- `/api/health`의 `storage`에 세 항목을 추가했습니다.
  - `supabase_last_error`: 마지막 실패 이유
  - `supabase_last_sync_ms`: 마지막 성공 업로드에 걸린 시간
  - `state_kb`: 현재 상태 데이터 크기

## 검증
- `npm run check`, `npm run check:cloudflare`, `npm run check:load` 통과.
- 배포 후 `/api/health`에서 실패 이유를 확인하고, 그 결과에 맞춰 다음 수정을 합니다.
