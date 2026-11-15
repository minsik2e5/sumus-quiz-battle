# Codex 작업 지시: 그림 74 (펫 대행진 그림 44장 · 14시트)

## 목표
새 미니게임 **펫 대행진**(크라우드 러너, 구성안 `docs/pet-runner-plan.md` 10장)에 쓸 그림 44장을 만들어 넣고 PR을 만든다.
선생님 주문: 진짜 재밌고 박진감 있고 **퀄리티가 높게**. 아이들이 좋아할 **귀엽고 고급스러운 3D 느낌 모바일 게임 그림**.
시점은 시험 페이지(`/proto/runner-fx.html`)와 같다: **정령 무리 뒤에서 비스듬히 내려다보는 카메라**, 길은 화면 아래 가운데에서 위쪽 지평선(위에서 약 26%)으로 좁아진다. 크기 · 시점은 `docs/screenshots/runner-fx-run.jpg` · `runner-fx-rescue.jpg` · `runner-fx-siege.jpg`를 본다.

| 시트 | 내용(칸: 왼쪽 위 · 오른쪽 위 · 왼쪽 아래 · 오른쪽 아래) | 배경 | 넣는 곳(`public/assets/runner/`) |
|---|---|---|---|
| 74-1 | 정령: 달리기(뒤에서) · 날아감 · 만세 · 튕김 | 투명(못 하면 흰색) | `spirit-run` · `spirit-fly` · `spirit-cheer` · `spirit-hurt` |
| 74-2 | 정령 스킨: 금 · 새싹 · 얼음 · 불꽃(74-1 달리기 자세 그대로) | 투명(흰색) | `skin-gold` · `skin-leaf` · `skin-ice` · `skin-flame` |
| 74-3 | 좋은 문 판(파랑 빛) · 나쁜 문 판(빨강 빛) · 가운데 기둥 · 통과 빛 | **검정** | `gate-good` · `gate-bad` · `gate-frame` · `gate-burst` |
| 74-4 | 숫자 바위(가운데 빈 면) · 톱날 · 망치 · 빈 수정 감옥(가운데 비움) | 투명(흰색) | `rock-num` · `saw` · `hammer` · `crystal` |
| 74-5 | 대포(뒤에서) · 발사 빛 · 성 파편 A · B | **검정** | `cannon` · `cannon-fire` · `castle-chunk-a` · `castle-chunk-b` |
| 74-6 | 하늘 다리 배경 **세로 한 장 1024×1536** | 투명 아님 | `bg-sky` |
| 74-7 | 판자 길 타일 · 난간 기둥 · 구름 섬 · 하늘 성 | 투명(흰색) | `road-sky` · `post-sky` · `cloud-isle` · `castle-sky` |
| 74-8 | 사막 배경 한 장 | 투명 아님 | `bg-desert` |
| 74-9 | 사막 길 타일 · 기둥 · 모래 소용돌이 · 사막 성 | 투명(흰색) | `road-desert` · `post-desert` · `sand-whirl` · `castle-desert` |
| 74-10 | 얼음 협곡 배경 한 장 | 투명 아님 | `bg-ice` |
| 74-11 | 얼음 길 타일 · 기둥 · 미끄럼 판 · 얼음 성 | 투명(흰색) | `road-ice` · `post-ice` · `ice-slide` · `castle-ice` |
| 74-12 | 화산 배경 한 장 | 투명 아님 | `bg-volcano` |
| 74-13 | 화산 길 타일 · 기둥 · 불기둥 · 화산 성 | 투명(흰색) | `road-volcano` · `post-volcano` · `fire-pillar` · `castle-volcano` |
| 74-14 | 지도 칸 · 주간 반 보스 성 아이콘 · 첫 판 상자 · 카드 테두리 | 투명(흰색) | `map-node` · `raid-boss` · `daily-chest` · `card-frame` |

### 배경과 처리 방법(자를 때 `slice-74.mjs`가 알아서 한다)
| 처리 | 칸 | 그림 | 게임에서 |
|---|---|---|---|
| `cut` | 정령 · 스킨 · 기둥 · 장애물 · 대포 · 파편 · 소품 · 성 · UI | 투명 배경. 투명을 못 만들면 **순수 흰색**(74-3 · 74-5는 **순수 검정**) | 자를 때 가장자리에서 이어진 배경만 투명으로(물체 안의 흰 빛은 남음). 수정 감옥은 가운데 구멍도 뺌 |
| `add` | 문 판 2 · 통과 빛 · 발사 빛 | **검은 배경** 위 빛 | 더하기 섞기 → 검정은 안 보임. 오려 내지 않는다 |
| `tile` | 길 타일 4 | 위에서 똑바로 내려다본 정사각형 판(약 440×440) | 안쪽을 잘라 위 · 아래 이음매를 섞어 세로로 이어 붙인다 |
| `bg` | 배경 4 | 세로 한 장, 길 · 성 · 캐릭터 없음 | 720×1080 |

**그림 파일만 넣으면 된다.** `npm run build:assets`가 `public/modules/runner-art.js`(`RUNNER_ART`)에 이름을 적고, 게임은 목록에 있는 그림만 불러와 같은 이름 칸의 코드 그림을 바꾼다. 앱 코드는 고치지 않는다.

## 꼭 지킬 것
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 기존 그림을 참고 그림으로 붙인다.
- 브랜치는 `claude/runner-art-74`에서 새로 만든다(예: `codex/art-74-pet-runner`). 자르기 스크립트(`slice-74.mjs`) · `build-74.mjs` · `runner-art.js` 목록이 아직 이 브랜치에만 있다. 그 브랜치가 이미 `sumus-voca-prod-deploy`에 머지됐으면 `sumus-voca-prod-deploy`에서 만든다. PR의 받는 쪽도 같은 브랜치로 한다.
- 고치는 파일: 위 표의 그림 44장, `docs/asset-requests/runner/DONE_74.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/runner-art.js`. 그 밖의 앱 코드, 게임 규칙, 코인, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 원본 PNG는 커밋하지 않는다(`/tmp/art/`). 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.
- 그림에 **글자 · 숫자 · 로고가 없다**(숫자는 게임이 바위 · 문 · 지도 칸 위에 찍는다).
- **다른 게임(Last War · Count Masters · Mob Control 등 크라우드 러너 게임)이나 만화 · 영화의 그림 · 캐릭터 · 건물 · 생김새를 따라 하지 않는다.** SUMUS 펫 세계(하늘 다리 · 정령 · 수정 · 성)로 새로 만든다. 무섭거나 징그럽지 않게, 장애물은 장난감처럼.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/74-1 …` ~ `74-14 …`: 시트 하나 = 프롬프트 하나. 묶음 전체는 `74-pet-runner.txt`, 파일 자리는 `slice-map.csv`(`list` 열이 `74-pet-runner.txt`). 프롬프트는 `build-74.mjs`가 만든다(손으로 고치지 말고 그 파일을 고쳐 다시 돌린다).
- 순서: **74-1(정령)을 먼저** 그리고, 74-2는 74-1을 참고 그림으로 붙여 같은 자세 · 크기로. **74-6(하늘 배경) → 74-7(하늘 소품)**을 먼저 맞춘 뒤 사막 · 얼음 · 화산은 74-6 · 74-7을 참고 그림으로 붙여 같은 카메라 · 크기로.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 그림 — 폴더 "SUMUS 전설 펫 07 (Runner용)"의 "07a-1.png", "SUMUS 펫 아레나 65 (Runner용)"의 "65-2.png", "SUMUS 펫 아레나 66 (Runner용)"의 "66-1.png", "SUMUS 펫 아레나 71 (Runner용)"의 "71-1.png" · "71-4.png" — 을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 펫 대행진 74 (Runner용)"에 정확한 파일 이름 "74-1.png" … "74-14.png"로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `WHEN DONE`
2. 아래 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean outlines, lighting and colors exactly, and match the camera angle and scale of the game screenshot. Keep the background of this sheet exactly as instructed (transparent or pure white, pure black for 74-3 and 74-5, a full opaque scene for the backgrounds), NOT like the references. Do NOT copy or resemble any character, building, logo or art from any other game (Last War, Count Masters, Mob Control or any crowd-runner game), cartoon or movie.`

### 참고 그림 (`public/assets/` 아래 경로, 스크린샷은 `docs/screenshots/`)
| 시트 | 참고 그림 |
|---|---|
| 모든 시트 | `pets/dragon-3.webp` · `pets/tiger-3.webp`(펫 그림체) · `arena/bg-plaza.webp`(65번 바닥 그림체) · `docs/screenshots/runner-fx-run.jpg`(시점 · 크기) |
| 74-3 · 74-5 | + `arena/fx-crit.webp` · `arena/fx-meteor.webp` · `arena/mat-glow.webp` · `arena/mat-burst.webp`(빛 그림체) · `docs/screenshots/runner-fx-siege.jpg` |
| 74-4 | + `arena/mat-rock-a.webp`(돌 색) · `docs/screenshots/runner-fx-rescue.jpg`(수정 감옥 크기) |
| 74-6 · 74-8 · 74-10 · 74-12 | + `hunt/bg-field-day.webp` · `dungeon/bg-gate.webp`(배경 그림체) · 앞서 만든 `74-6`(사막 · 얼음 · 화산은 같은 지평선) |
| 74-7 · 74-9 · 74-11 · 74-13 | + 같은 테마 배경(`74-6` · `74-8` · `74-10` · `74-12`) · `docs/screenshots/runner-fx-siege.jpg`(성 크기) · 앞서 만든 `74-7` |
| 74-2 | + 앞서 만든 `74-1` |
| 74-14 | + `ui/dungeon-chest.webp` · `arena/rank-chest.webp` · `ui/coin.webp`(UI 그림체) |

### 후보 점검 (모두 통과해야 쓴다)
1. 크기: 2×2 시트는 1024×1024, 배경 시트(74-6 · 8 · 10 · 12)는 1024×1536. 칸마다 그림이 **하나씩** 떨어져 있다. 글자 · 숫자 · 로고가 없다. 체크무늬 배경이 아니다.
2. `node docs/asset-requests/runner/slice-74.mjs /tmp/art/74-N.png --preview /tmp/art/74-N-check.png`가 ⚠️ 없이 끝난다(⚠️ "가장자리에 닿아요" = 잘렸거나 이웃 칸이 묻음, "배경이 … 아니에요" = 배경이 순수하지 않음 → 다시 그린다).
3. 미리보기(길 색 바닥 위)에서: 물체에 흰 · 검은 테두리 찌꺼기가 없고, 빛은 검은 테 없이 빛나고, 길 타일은 위아래로 이어 붙여도 이음매가 티 나지 않는다.
4. 정령은 32px로 줄여도 귀엽고 알아본다. 74-1 · 74-2의 정령 크기 · 자세가 같다. 성 4개는 크기 · 카메라가 같다. 배경에는 길 · 성 · 캐릭터가 없다.
5. 귀엽고 고급스럽다. 무섭거나 징그럽지 않다. 다른 게임 그림을 닮지 않았다.

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1 · 2번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 넣기
```
npm i --no-save sharp   # 없으면
for n in 1 2 3 4 5 6 7 8 9 10 11 12 13 14; do node docs/asset-requests/runner/slice-74.mjs /tmp/art/74-$n.png --preview /tmp/art/74-$n-check.png; done
```
배경 150KB · 성 80KB · 나머지 40KB 이하, 44장 합계 1.8MB 이하(넘으면 그 시트만 `--quality 70`으로 다시).

## 점검
```
npm ci
npm run build:assets      # public/modules/runner-art.js의 RUNNER_ART에 spirit-run … 이 적힌다
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `docs/asset-requests/runner/DONE_74.md`(한국어): 넣은 그림 44장(경로 · 크기 · 처리 방법 · 용량), 다시 만든 횟수, "눈으로 확인 필요"(테스트 앱 `/proto/runner-fx.html`에서 정령 · 문 · 바위 · 성이 그림으로 바뀌었는지).
- PR 제목 `그림 74: 펫 대행진 그림 44장`, 본문 한국어. 미리보기를 한 장에 모아 작게 PR 코멘트로 올린다. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.`
