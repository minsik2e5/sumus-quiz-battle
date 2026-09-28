# SUMUS VOCA v13.54.2: 상태 크기 측정 + 학습 기록의 단어 목록 줄이기 (#45)

## 배경
- Supabase 백업(`voca_v12_state_commit`)이 45초 제한에도 계속 실패하고 있습니다. 매번 올리는 전체 상태가 약 2.4MB입니다.
- 학생 데이터는 Cloudflare Durable Object에 먼저 저장되므로 잃지 않았습니다. Supabase 백업만 밀려 있습니다.
- #45는 "추측으로 지우지 말고 먼저 무엇이 큰지 확인한다"를 1단계로 정했습니다.

## 코드 확인 결과
- **끝난 연습 문서(`state.practices`)는 이미 지워지고 있습니다.** 학습 기록(`sessions`)이 생기고 10분이 지나면, 저장할 때마다 `compactState`/`migrateState`가 정리합니다. 그래서 #45에 적힌 "끝난 연습 문서가 쌓인다"는 원인이 아닙니다.
- 계속 커지는 것은 **학습 기록(`sessions`)** 입니다. 기록마다 아래 항목이 들어 있습니다.
  - `answer_records`: 답안 하나에 약 250자
  - `wrong_details`: 틀린 답안을 한 번 더 저장
  - `word_ids`: 고른 범위 전체의 단어 id. id가 `high:ybm-kim:common2:lesson1:001`처럼 길어서 단어 하나에 약 35자입니다. 단원고 전체 범위(542개)를 고르면 기록 하나에 약 19KB입니다.
- `mastery`(학생×단어 숙련도)도 학생과 단어 수에 비례해 커집니다. 실제 비율은 아래 측정으로 확인합니다.

## 무엇이 바뀌나
1. **측정: `/api/health`에 `storage.state_breakdown` 추가**
   - 최상위 항목별 크기(KB): `sessions`, `mastery`, `practices`, `tokens`, `examAttempts`, `battles` 등
   - `sessions` 안의 `answer_records` / `wrong_details` / `word_ids` / `reward_breakdown` 크기
   - `practices`: 진행 중·끝난 문서 수와 크기, 하루 넘게 진행 중인 문서 수, `responses`·`words` 크기
   - 크기와 개수만 보여 주고, 학생 이름이나 답안 같은 내용은 넣지 않습니다.
   - 계산할 때 전체 상태를 한 번 직렬화하므로, 결과를 1분 동안 재사용합니다.
2. **학습 기록의 `word_ids` 줄이기**
   - 기록 화면은 `word_ids`를 "못 푼 단어 다시 풀기" 목록을 만들 때만 씁니다. 방법은 `answer_records`에 없는 id를 앞에서부터 못 푼 개수만큼 고르는 것입니다.
   - 그래서 **답하지 않은 단어 중 앞의 `unanswered_count`개만** 남깁니다. 화면이 고르는 목록과 정확히 같습니다.
   - 새 기록은 끝날 때 줄여서 저장합니다. 기존 기록은 배포 후 첫 부팅 때 `migrateState`가 한 번 줄입니다.
   - `answer_records`나 `unanswered_count`가 없는 옛 형식 기록은 그대로 둡니다.

## 바뀌지 않는 것
- 점수, 오답, 포인트, XP, 펫 성장(`pet_key`, `xp`, `reward_points`), 답안 기록(`answer_records`), 이의제기와 재채점
- `wrong_details`: 예전 앱 호환용으로 release-check가 지키는 항목이라 이번에는 건드리지 않았습니다. 측정 결과를 보고 따로 판단합니다.
- 진행 중인 연습 화면의 `word_ids`: 연습 문서의 `words`에서 오므로 그대로입니다.
- 앱(폰) 화면 코드는 바뀌지 않았습니다.

## 검증
- `npm run check` 482/482. 추가한 확인 항목:
  - 옛 기록을 줄여도 "다시 풀기" 목록, 점수, 포인트, 펫 정보가 같음
  - 두 번 실행해도 결과가 같음
  - 옛 형식 기록은 그대로 둠
  - 부팅 migration이 기존 기록을 줄임
  - 상태 크기 보고에 내용이 들어가지 않음
- `npm run check:cloudflare`: `/api/health`에 `state_breakdown`이 나오는지 확인합니다.
- `npm run check:load`: 통과
- 로컬 `wrangler dev`와 가짜 Supabase(dev-tools)로 확인했습니다. 운영 Supabase에는 연결하지 않았습니다.
  - 범위 전체(542개)를 담은 옛 기록이 부팅 후 못 푼 5개로 줄었습니다(10.5KB → 0.1KB). 점수, XP, 포인트는 그대로였습니다.
  - 112개 범위에서 10문제 연습을 1문제만 풀고 끝냈을 때, 기록에 못 푼 9개만 저장됐습니다.

## 배포 후 확인
1. `/api/health`의 `storage.state_breakdown`에서 어느 항목이 큰지 확인합니다.
2. `state_kb`가 줄었는지 확인합니다.
3. `supabase_failures`가 0이 되고 `supabase_last_sync_ms`에 값이 찍히는지 확인합니다.
