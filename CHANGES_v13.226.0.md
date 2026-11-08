# v13.226.0 — 지난 연습 기록 옮기기가 한 번도 돌지 않던 문제

## 왜
운영 `/api/health`에서 학습 기록(sessions)이 **11,042KB**로 예산(10,000KB)을 넘었어요(`fix_data: true`).
- v13.216부터는 일주일 지난 연습 기록의 답 상세(`answer_records` · `wrong_details` · `word_ids`)를 보관 표로 옮기게 되어 있어요. 이 기록은 메인 상태 밖에 두고 지우지 않아요.
- 그런데 운영 숫자는 옮긴 기록 **0개**, 보관 표 **0KB**였어요.

**원인**
서버가 깨어날 때 '방금 옮겼다'고 쳐서, 첫 옮기기를 **1시간 뒤**로 미뤘어요. 운영 서버는 새 버전을 올릴 때(하루 여러 번)와 쉬는 시간마다 다시 시작해요. 그래서 1시간을 채운 적이 없고, 옮기기가 한 번도 돌지 않았어요.

## 바뀐 것
- **`server/session-archive.mjs`:** `ARCHIVE_BOOT_DELAY_MS`(2분)와 `archiveBootAt()`를 더했어요. 깨어나고 **2분 뒤** 첫 옮기기를 해요. 깨어날 때의 요청은 늦추지 않아요.
- **`cloudflare/worker.mjs`:** 깨어날 때 `this.archivedAt = archiveBootAt()`로 시작해요.
- 옮기기 규칙은 그대로예요.
  - 한 번에 300개 · 학생 10명까지예요.
  - 남은 게 있으면 10분 뒤 이어서 해요.
  - 쓰기 한도가 넉넉한 날('ok')에만 해요.
  - 되돌리기는 `VOCA_SESSION_ARCHIVE=restore`로 해요.

## 예상
- 지금 일주일 지난 기록 약 2,500개를 300개씩 옮겨요. 서버가 깨어 있는 동안 10분 간격으로 하니 하루 이틀이면 끝나요.
- sessions 약 11MB → 약 4MB(v13.216 예상과 같아요). 학생이 옛 기록을 열면 보관 표에서 한 줄만 읽어요(v13.216 그대로).

## 검사
- `server/state-slim-check.mjs`: 깨어나고 1분에는 아직 안 하고, 2분이면 옮기기 차례예요. 워커가 `archiveBootAt()`로 시작하는지도 봐요.
- `npm run check` 3718/3718, `npm run check:cloudflare` 통과

## 머지 뒤 확인할 것
- `/api/health`의 `state_breakdown.sessions.archived`가 늘고 `state_budget.archive.sessions`가 늘어나는지 봐요.
- 하루 이틀 뒤 `sessions` KB가 10,000 아래로 내려가고 `fix_data`가 false가 되는지 봐요.
