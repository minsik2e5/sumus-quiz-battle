# v13.214.0 Supabase 백업이 멈췄을 때 알아보기 쉽게 · 선생님 화면 경고 · 안내서

## 왜
2026-11-03 대회 중 `/api/health`: `supabase_backup_mode: "checking"`, `supabase_failures: 6`, `supabase_last_ok_at: null`,
`supabase_last_error: "voca_v13_state_revision: TimeoutError … (0 KB)"`. 학생 기록은 Cloudflare 안에 먼저 저장돼서 잃은 것은 없지만,
**바깥 백업 사본(Supabase)이 쌓이지 않고 있었고** 선생님이 알 방법이 없었다. 백업 번호 확인(0KB)부터 12초 안에 답이 없어서
조각 백업 방식을 정하지도 못하고 같은 자리에서 계속 실패했다(프로젝트 일시정지 · 점검 · 네트워크 의심).

## 바뀐 것
- **선생님 첫 화면 경고**(학생 화면 아님): 백업이 **6시간 넘게** 안 되면 "데이터 백업이 n시간째 안 되고 있어요 — 안내서 보기" 한 줄.
  기존 서버 저장량 경고와 같은 자리 · 같은 모양(`server_backup_warning`). 복구되면 저절로 사라진다.
- **`/api/health`에 사람이 읽는 백업 상태**: `supabase_status`(`ok` / `delayed` / `failing` / `paused_suspected`),
  `supabase_status_text`(한국어 한 줄), `supabase_last_ok_text`(마지막 성공, 한국 시간), `supabase_failing_since` · `supabase_failing_hours`,
  `supabase_fail_kind`(`timeout` · `network` · `paused` · `server` · `missing` · `auth`), `supabase_guide_url`,
  `supabase_last_batches` · `supabase_last_max_batch_kb`(복구 때 몇 묶음으로 올렸나), `supabase_yielded_busy`.
  - 일시정지 응답(HTTP 540 · "paused")은 바로 `paused_suspected`, 답 없음(타임아웃 · 네트워크)이 30분 넘으면 `paused_suspected`, 다른 오류가 30분 넘으면 `failing`.
- **실패 시작 시각을 로컬 meta에 저장**: 다시 시작해도 "몇 시간째"가 이어진다. 실패가 새로 시작될 때 한 줄, 복구될 때 한 줄만 쓴다.
- **복구 때 밀린 조각 올리기**: 지금처럼 바뀐 조각만 약 250KB 묶음으로 올리되, **묶음 사이에 학생 요청이 오면 잠깐 쉬었다가**(최대 20초, #262 미루기와 같은 결) 이어 간다.
  6시간마다 하는 통째 사본(조각을 합쳐 13MB 글을 만드는 일)도 요청이 몰리는 중이면 잠잠해질 때까지 기다린다.
- **오래 실패할 때 다시 하기 간격**: 처음 30분은 그대로(2초부터 두 배씩 최대 1분), 30분이 넘으면 **5분마다**. 다시 하기 한 번은 답을 기다리는 시간뿐이라
  CPU는 거의 안 쓰지만(검사 기준 한 번 0.1ms 아래), 알람 한 줄씩을 쓰므로 하루 1,440줄 → 약 290줄로 준다.
- 워커 Supabase 요청 오류에 HTTP 상태(`http`, 답이 없으면 0)를 붙여 원인을 나눈다.
- 새 안내서 `docs/supabase-backup-runbook.md`: 대시보드 확인 → Restore → health 확인 → 그래도 안 되면(함수 · 키 · 요금제).
- `docs/performance-rules.md` 운영 숫자 표에 `supabase_status` 줄 추가.

## 그대로인 것
- 학생 기록 저장(로컬 먼저), 백업 방식(조각 · 통째), 조각 묶음 크기(250KB), 시작할 때 읽는 순서 · 시간 제한, 규칙 · 보상 · 판정.

## 검사
- 새 `server/supabase-backup-check.mjs`(npm run check): 가짜 Supabase로 타임아웃 · 503 · 401 · 404(조각 함수만 / 전부) · 일시정지(540) 각각의 health 값,
  6시간 경고가 선생님에게만(5시간에는 없음), 다시 시작해도 실패 시작 시각 유지, 복구 뒤 밀린 조각 업로드 · 합치면 지금 상태와 같음 · ok 복귀 · 경고 사라짐,
  큰 밀린 조각(약 3.4MB, 15묶음)에서 묶음 사이 쉬기, 실패한 다시 하기의 CPU, 30분 넘으면 5분 간격.
- `server/yacha-lag-check.mjs`의 다시 하기 간격 문구 기대값을 새 줄에 맞췄다(30분 전까지는 V13.212 그대로).
