# v13.212.0 야차 대회 렉 고침(메인 상태 객체 가볍게)

## 원인
메인 상태 객체가 POST 하나마다 상태를 깊게 복사했다(운영 13.5MB 중 숙련도 2.35MB 포함, POST 하나에 CPU 약 85ms). 놀이터 '보기'
(인형뽑기 · 사냥 첫 화면, 낚시 안내, 10초 맞추기 ping)도 POST라서 누를 때마다 복사하고 저장을 기다렸다. 대회를 기다리는 학생들이
놀이터를 같이 하면 줄이 밀려 대회 판 시작 · 결과 · 놀이터가 1초 넘게 걸렸다. 자세한 것은 `docs/yacha-lag-report.md`.

## 바뀐 것
- **숙련도 복사 빼기**: 숙련도를 학생 묶음마다 얼려 같이 쓰고, 요청한 학생 묶음만 복사한다(`server/mutation-coordinator.mjs`).
  다른 학생 숙련도를 고치는 변경은 예전 복사로 처음부터 다시 해서 결과가 같다. 저장 조각도 얼린 묶음은 지난번 글을 쓴다(`cloudflare/state-parts.mjs`).
- **10초 맞추기 ping은 읽기 경로**(복사 · 저장 없음, 잰 왕복 시간도 정확해진다).
- **놀이터 보기 POST**(인형뽑기 · 사냥 첫 화면, 낚시 · 사냥 안내): 그 학생 프로필 사본에서 해 보고 그대로면 저장 없이 답, 바뀌면 예전처럼 저장.
- **Supabase 백업**: 학생 요청을 처리하는 중이면 2초씩, 최대 20초 미룬다. `/api/health`에 `supabase_deferred_busy`, `mastery_retries`, `views_kept`.
- 규칙 · 보상 · 판정은 그대로.

## 렉 방지 규칙(앞으로 기능이 늘어도)
- `docs/performance-rules.md`: 기능 만들 때 지킬 것 8가지, 운영에서 볼 숫자, 업그레이드 시점, 동시 접속 측정표(40 · 80 · 120 · 180명).
- `CLAUDE.md`에 규칙 요약을 넣었다.
- 계속 지키기: `CLAUDE.md`에 "렉 방지 · 업그레이드 점검" 규칙. 새 기능 PR마다 "렉 방지 점검" 칸(지킨 규칙 · 새 데이터 묶음 예산 · check:load 숫자),
  운영 숫자가 나오면 유료 업그레이드 · 데이터 정리가 필요한지 먼저 말한다.
- `/api/health`의 `storage.upgrade`: `paid_upgrade`(오늘 저장량 70% 이상) · `fix_data`(데이터 예산 초과) · `reasons`(할 일, 한국어).
- 선생님 화면의 '오늘 서버 저장량이 많아요' 안내에 "일주일에 한 번 넘게 뜨면 유료 업그레이드(월 5달러~)"를 덧붙였다.
- `server/perf-budget.mjs`: 상태 묶음마다 크기 예산. `/api/health`의 `storage.state_budget`가 넘은 묶음과 예산표에 없는 묶음을 알려 준다.
- `server/perf-rules-check.mjs`(npm run check): 묶음이 모두 예산표에 있는지, 보기 같은 이름의 POST가 읽기 · 보기 경로에 등록됐는지,
  화면 자동 새로고침 간격이 3초 이상인지 본다.

## 측정(운영 구성 약 12MB, 대회 32명 + 놀이터 + 연습 8명, p95)
- 대회 판 열기 1655 → 251ms, 결과 보고 1181 → 260ms, 인형뽑기 첫 화면 1362 → 1ms, ping 1127 → 0ms, 사냥 첫 화면 1142 → 248ms.
- POST 하나의 CPU 85 → 29ms.

## 검사
- `server/yacha-lag-check.mjs`(npm run check): 복사 범위(연습 기록 · 다른 학생 숙련도 없음), 다시 하기 결과 같음, 보기 요청 경로,
  보기 POST가 그 학생 프로필 말고 고치지 않음(나머지 얼려서 실제 서비스로), 백업 미루기, 운영 크기 복사 비용.
- `server/save-equivalence-check.mjs`(npm run check, yacha-lag-check 8번): 출석 · 연습 · 이의 신청 · 선생님 재채점(다른 학생 숙련도) ·
  놀이터 · 대회 · 홈 요청 157개를 v13.210 저장 줄(`server/reference/mutation-coordinator-v13.210.mjs`)과 새 저장 줄로 똑같이 돌려
  모든 답 · 저장된 상태 · 마지막 상태가 한 글자도 같은지 본다(난수 · 시계 고정).
- `server/tournament-load.mjs`(npm run check:load): 대회 + 놀이터 시뮬레이션 경로별 p95 상한.
- 바뀐 동작에 맞춰 `practice-speed-check.mjs` · `stability-168-check.mjs` 검사 문구를 고쳤다.
