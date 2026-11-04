# Supabase 백업이 멈췄을 때 (선생님용 안내서)

학생 기록은 **Cloudflare 서버 안에 먼저 저장**돼요. Supabase는 바깥에 두는 **백업 사본**이에요.
그래서 백업이 멈춰도 지금 학생 기록은 사라지지 않아요. 다만 오래 멈춰 있으면 서버에 큰일이 났을 때 되살릴 사본이 낡아요.
선생님 첫 화면에 **"데이터 백업이 n시간째 안 되고 있어요 — 안내서 보기"**가 뜨면(6시간부터) 아래 순서대로 해 주세요.

## 1. 지금 상태 보기 (1분)
브라우저에서 `https://<우리 사이트 주소>/api/health`를 열고 `storage` 안을 봐요.

| 항목 | 뜻 |
|---|---|
| `supabase_status` | `ok` 정상 · `delayed` 잠깐 밀림(30분 안) · `failing` 계속 실패 · `paused_suspected` **프로젝트 일시정지가 의심돼요** |
| `supabase_status_text` | 위 상태를 한국어 한 줄로(예: "백업이 7시간째 안 돼요: Supabase가 답하지 않아요…") |
| `supabase_last_ok_text` | 마지막으로 백업이 된 시각(한국 시간). "아직 없음"이면 이 서버가 켜진 뒤 한 번도 못 했어요 |
| `supabase_fail_kind` | 원인 종류: `timeout`/`network` 답 없음 · `paused` 일시정지 · `server` Supabase 오류 · `missing` 함수 없음 · `auth` 키 오류 |

## 2. Supabase 대시보드에서 프로젝트 상태 보기
1. <https://supabase.com/dashboard> 에 로그인해요.
2. 프로젝트 목록에서 SUMUS VOCA 프로젝트 카드를 봐요.
   - 카드에 **Paused**(일시정지)가 보이면 → 3번으로.
   - **Active / Healthy**면 → 5번으로.
3. 무료 요금제는 한동안 쓰지 않으면(약 1주) 프로젝트를 저절로 멈춰요. 멈추면 API가 답하지 않거나 "paused" 오류를 줘요.

## 3. 정지 상태면 Restore(되살리기)
1. 프로젝트를 열면 위쪽에 "This project is paused" 안내와 **Restore project** 버튼이 있어요. 눌러요.
2. 되살아나는 데 보통 **몇 분**(길면 10분 넘게) 걸려요. 화면이 Active가 될 때까지 기다려요.
3. 학생 앱은 그동안에도 그대로 써도 돼요(백업만 기다려요).
   - 참고: 무료 요금제에서 아주 오래(90일 넘게) 멈춰 있던 프로젝트는 Restore가 안 되고 내려받기만 될 수 있어요. 그러면 개발 담당에게 알려 주세요.

## 4. 복구 뒤 health에서 바뀌어야 할 것 (5~10분 안)
서버는 실패하면 처음엔 몇 초~1분마다, 30분이 넘으면 **5분마다** 다시 해 봐요. Restore 뒤 길어도 5분쯤 지나 `/api/health`를 새로 고침해요.

| 항목 | 정상이 되면 |
|---|---|
| `supabase_status` | `ok` |
| `supabase_failures` | `0` |
| `supabase_last_ok_at` · `supabase_last_ok_text` | 방금 시각 |
| `supabase_lag_sec` | `0` (`supabase_pending`이 `false`) |
| `supabase_backup_mode` | `checking` → `parts` |
| `supabase_full_copy_at` | 첫 성공 뒤 곧 채워져요(통째 사본, 6시간마다) |
| `supabase_last_batches` · `supabase_last_max_batch_kb` | 밀린 조각을 몇 묶음으로 올렸는지(묶음 하나 약 250KB) |

선생님 첫 화면의 경고도 저절로 사라져요. 밀린 기록은 따로 할 일 없이 한꺼번에 올라가요(학생 요청이 오면 사이사이 쉬면서).

## 5. 그래도 안 되면 확인할 것
- **함수가 있나** (`supabase_fail_kind`가 `missing`, 오류에 `HTTP 404 PGRST202`):
  대시보드 → SQL Editor → New query에 아래를 붙여 Run.
  ```sql
  select proname from pg_proc where proname like 'voca_v1%' order by 1;
  ```
  `voca_v12_state_commit`, `voca_v12_state_read`, `voca_v13_check_secret`, `voca_v13_state_patch`, `voca_v13_state_read`, `voca_v13_state_revision`이 있어야 해요.
  `voca_v13_…`이 없으면 저장소의 `supabase/voca_v13_parts.sql` 전체를 붙여 한 번 Run 해요(표와 함수를 **더하기만** 해요).
  - 이것만 없으면 서버는 통째(약 13MB)로 올리는 옛 방식으로 버텨요(`supabase_backup_mode: full`). 느리니 SQL을 꼭 다시 실행해요.
- **키가 맞나** (`supabase_fail_kind`가 `auth`, 오류에 `HTTP 401` · `Invalid API key` · `forbidden`):
  대시보드 → Project Settings → API의 Project URL · anon key가 Cloudflare 워커 비밀값 `SUPABASE_URL` · `SUPABASE_ANON_KEY`와 같은지 개발 담당에게 확인을 부탁해요.
  `VOCA_STATE_SECRET`을 바꿨다면 SQL의 지문도 맞춰야 해요.
- **요금제 · 사용량** (`supabase_fail_kind`가 `server`, 계속 `HTTP 5xx`):
  대시보드 → Usage에서 데이터베이스 크기 · 전송량이 무료 한도를 넘었는지 봐요. 넘었으면 정리하거나 유료(Pro)를 검토해요.
  <https://status.supabase.com> 에서 Supabase 전체 점검 · 장애도 확인해요.
- 그래도 모르겠으면 `/api/health`의 `storage` 부분을 통째로 복사해서 개발 담당(또는 AI 작업 세션)에 보내 주세요.
