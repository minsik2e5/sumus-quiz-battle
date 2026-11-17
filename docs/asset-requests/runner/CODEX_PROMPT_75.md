# Codex 작업 지시: 그림 75 (펫 대행진 ②단계 새 그림 24장 · 6시트)

## 목표
펫 대행진(크라우드 러너, 구성안 `docs/pet-runner-plan.md`) ②단계 "박진감 업"에 쓸 새 그림 24장을 만들어 넣고 PR을 만든다.
선생님 주문: **퀄리티 높게**. 그림 74와 **똑같은 그림체 · 시점**(정령 무리 뒤에서 비스듬히 내려다보는 카메라, 귀엽고 고급스러운 3D 모바일 게임 그림).
그림이 들어오기 전에는 게임이 코드 그림으로 돌고, 파일이 들어오면 저절로 바뀐다(앱 코드는 고치지 않는다).

| 시트 | 내용(칸: 왼쪽 위 · 오른쪽 위 · 왼쪽 아래 · 오른쪽 아래) | 배경 | 넣는 곳(`public/assets/runner/`) |
|---|---|---|---|
| 75-1 | 적 정령(빨강): 달려옴(앞에서) · 맞음 · 쓰러짐 · 적 대장(크게) | 투명(못 하면 흰색) | `enemy-run` · `enemy-hit` · `enemy-down` · `enemy-boss` |
| 75-2 | 숫자 벽: 하늘 수정 · 사막 사암 · 얼음 · 용암 바위(가운데 빈 숫자 판) | 투명(흰색) | `wall-sky` · `wall-desert` · `wall-ice` · `wall-volcano` |
| 75-3 | 벽 깨진 조각: 하늘 · 사막 · 얼음 · 용암 | 투명(흰색) | `wall-chunk-sky` · `wall-chunk-desert` · `wall-chunk-ice` · `wall-chunk-volcano` |
| 75-4 | 좁은 다리 길 타일 · 부서진 판자 · 낭떠러지 가장자리 · 밧줄 기둥 | 투명(흰색) | `bridge-narrow` · `plank-broken` · `cliff-edge` · `bridge-post` |
| 75-5 | 성 탑 대포 · 방패 정령 · 성 깃발 · 적 대포알 | 투명(흰색) | `tower-cannon` · `shield-guard` · `castle-flag` · `cannon-ball` |
| 75-6 | 피버 큰 글자 판(빈 판) · 빛 띠 · 피버 무리 빛 · 충돌 빛 | **검정** | `fever-plate` · `light-band` · `fever-aura` · `clash-burst` |

거대 몬스터는 기존 던전 몬스터 그림을 쓰므로 그리지 않는다.

### 처리 방법(자를 때 `slice-74.mjs`가 알아서 한다 — 75-N도 받는다)
| 처리 | 칸 | 그림 | 게임에서 |
|---|---|---|---|
| `cut` | 정령 · 벽 · 조각 · 판자 · 낭떠러지 · 기둥 · 대포 · 깃발 · 피버 판 | 투명 배경. 못 만들면 **순수 흰색**(75-6은 **순수 검정**) | 가장자리에서 이어진 배경만 투명으로 |
| `add` | 빛 띠 · 피버 무리 빛 · 충돌 빛 | **검은 배경** 위 빛 | 더하기 섞기 → 검정은 안 보임 |
| `tile` | 좁은 다리 | 위에서 똑바로 내려다본 정사각형 판(약 440×440) | 위 · 아래 이음매를 섞어 세로로 이어 붙인다 |

## 꼭 지킬 것
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로만 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 기존 그림을 참고 그림으로 붙인다.
- 브랜치는 이 작업 브랜치 **`claude/pet-runner-1`**에서 새로 만든다(예: `codex/art-75-pet-runner-2`). 자르기 스크립트(`slice-74.mjs`가 75를 받는 판) · `build-75.mjs`가 이 브랜치에 있다. 그 브랜치가 이미 `sumus-voca-prod-deploy`에 머지됐으면 `sumus-voca-prod-deploy`에서 만든다. PR의 받는 쪽도 같은 브랜치로 한다.
- 고치는 파일: 위 표의 그림 24장, `docs/asset-requests/runner/DONE_75.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/runner-art.js`. 그 밖의 앱 코드, 게임 규칙, 코인, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 원본 PNG는 커밋하지 않는다(`/tmp/art/`). 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.
- 그림에 **글자 · 숫자 · 로고가 없다**(숫자 · "피버" 글자는 게임이 벽 · 판 위에 찍는다).
- **다른 게임(Last War · Count Masters · Mob Control 등 크라우드 러너 게임)이나 만화 · 영화의 그림 · 캐릭터 · 건물 · 생김새를 따라 하지 않는다.** SUMUS 펫 세계로 새로 만든다. 적 정령도 무섭지 않고 장난꾸러기처럼 귀엽게.
- **그림과 상관없는 기존 검사가 실패하면** 점검 파일을 고치지 말고 실패 메시지를 PR에 그대로 적은 뒤 **계속 진행한다**(멈추지 않는다).

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/75-1 …` ~ `75-6 …`: 시트 하나 = 프롬프트 하나. 묶음 전체는 `75-pet-runner-2.txt`, 파일 자리는 `slice-map.csv`(`list` 열이 `75-pet-runner-2.txt`). 프롬프트는 `build-75.mjs`가 만든다(손으로 고치지 말고 그 파일을 고쳐 다시 돌린다).
- 순서: **75-1(적 정령)을 먼저**, 75-5(방패 정령)는 75-1을 참고 그림으로 붙여 같은 정령으로. **75-2(벽) → 75-3(조각)** 순서로, 조각은 벽과 같은 돌 · 색.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 그림 — 폴더 "SUMUS 펫 대행진 74 (Runner용)"의 "74-1.png" 같은 74 시트, "SUMUS 전설 펫 07 (Runner용)"의 "07a-1.png", "SUMUS 펫 아레나 65 (Runner용)"의 "65-2.png" 등 — 을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 펫 대행진 75 (Runner용)"에 정확한 파일 이름 "75-1.png" … "75-6.png"로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `WHEN DONE`
2. 아래 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean outlines, lighting and colors exactly, and match the camera angle and scale of the game screenshot. Keep the background of this sheet exactly as instructed (transparent or pure white, pure black for 75-6), NOT like the references. Do NOT copy or resemble any character, building, logo or art from any other game (Last War, Count Masters, Mob Control or any crowd-runner game), cartoon or movie.`
3. 프롬프트 안의 "74-1.png" 같은 74 시트 이름은 아래 표의 저장소 그림(`runner/…webp`)을 가리킨다.

### 참고 그림 (`public/assets/` 아래 경로, 스크린샷은 `docs/screenshots/`)
| 시트 | 참고 그림 |
|---|---|
| 모든 시트 | `runner/spirit-run.webp` · `runner/spirit-cheer.webp`(74 정령 그림체) · `pets/dragon-3.webp`(펫 그림체) · `docs/screenshots/runner-v13241-wide-phone.jpg`(시점 · 크기) |
| 75-1 · 75-5 | + `runner/spirit-hurt.webp` · `runner/cannon.webp` · `runner/castle-sky.webp`(성 크기) · 앞서 만든 `75-1` |
| 75-2 · 75-3 | + `runner/rock-num.webp`(숫자 판 비우는 법) · `runner/road-sky.webp` · `runner/road-desert.webp` · `runner/road-ice.webp` · `runner/road-volcano.webp`(테마 색) · `runner/castle-chunk-a.webp`(조각 크기) |
| 75-4 | + `runner/road-sky.webp` · `runner/post-sky.webp` · `runner/bg-sky.webp` |
| 75-6 | + `runner/gate-burst.webp` · `runner/cannon-fire.webp` · `arena/fx-crit.webp` · `arena/mat-glow.webp`(빛 그림체) · `runner/card-frame.webp`(판 그림체) |

### 후보 점검 (모두 통과해야 쓴다)
1. 크기 1024×1024, 칸마다 그림이 **하나씩** 떨어져 있다. 글자 · 숫자 · 로고가 없다. 체크무늬 배경이 아니다.
2. `node docs/asset-requests/runner/slice-74.mjs /tmp/art/75-N.png --preview /tmp/art/75-N-check.png`가 ⚠️ 없이 끝난다.
3. 미리보기(길 색 바닥 위)에서: 흰 · 검은 테두리 찌꺼기가 없고, 빛은 검은 테 없이 빛나고, 좁은 다리 타일은 위아래 이음매가 티 나지 않는다.
4. 적 정령은 74 정령과 크기 · 몸 모양이 같고 색만 빨강 계열이라 32px로 줄여도 "적"으로 바로 알아본다. 벽 4개는 모양 · 크기가 같고 가운데 숫자 판이 비어 있다.
5. 귀엽고 고급스럽다. 무섭거나 징그럽지 않다. 다른 게임 그림을 닮지 않았다.

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1 · 2번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 넣기
```
npm i --no-save sharp   # 없으면
for n in 1 2 3 4 5 6; do node docs/asset-requests/runner/slice-74.mjs /tmp/art/75-$n.png --preview /tmp/art/75-$n-check.png; done
```
한 장 40KB 이하, 24장 합계 0.6MB 이하(넘으면 그 시트만 `--quality 70`으로 다시).

## 점검
```
npm ci
npm run build:assets      # public/modules/runner-art.js의 RUNNER_ART에 enemy-run … 이 적힌다
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다. 그림과 상관없는 검사 실패는 적고 계속한다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/claude/pet-runner-1 -- public/assets`
- `docs/asset-requests/runner/DONE_75.md`(한국어, DONE_74.md와 같은 형식): 넣은 그림 24장(경로 · 크기 · 처리 방법 · 용량), 다시 만든 횟수, "눈으로 확인 필요"(테스트 앱 펫 대행진 26스테이지 이후에서 적 정령 · 숫자 벽 · 피버 판이 그림으로 바뀌었는지).
- PR 제목 `그림 75: 펫 대행진 ②단계 그림 24장`, 본문 한국어. 미리보기를 한 장에 모아 작게 PR 코멘트로 올린다. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.`
