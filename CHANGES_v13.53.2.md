# SUMUS VOCA v13.53.2: Supabase 백업 업로드 시간 초과 수정

## 원인 (v13.53.1 진단으로 확인)
- `/api/health`에 이렇게 찍혔습니다.
  ```
  supabase_last_error: "voca_v12_state_commit: TimeoutError The operation was aborted due to timeout (2412 KB)"
  ```
- 백업은 매번 전체 상태(약 2.4MB)를 보냅니다. 그런데 업로드 제한 시간이 12초라서, 전송이 끝나기 전에 끊기는 일이 반복됐습니다.
- 학생 데이터는 Durable Object에 먼저 저장되므로 잃지 않았습니다. 백업만 밀렸습니다.

## 무엇이 바뀌나
- `cloudflare/worker.mjs`에서 Supabase RPC마다 제한 시간을 따로 정합니다.
  - `voca_v12_state_commit`(백그라운드 업로드): **45초**. 학생 요청을 기다리게 하지 않는 작업이라 길게 잡았습니다.
  - `voca_v12_state_read`(시작할 때 읽기): 그대로 **12초**. 느리면 이미 동기화된 로컬 사본으로 시작합니다.

## 다음 과제
- 상태가 계속 커지면 업로드도 계속 무거워집니다.
- 오래된 연습 기록의 세부 항목(답안 기록 등)을 줄이거나, 바뀐 부분만 보내는 방식을 검토해야 합니다.

## 검증
- `npm run check`, `npm run check:cloudflare` 통과.
- 배포 후 `/api/health`에서 확인할 항목:
  - `supabase_failures`가 0으로 돌아오는지
  - `supabase_last_sync_ms`에 업로드 시간이 찍히는지
