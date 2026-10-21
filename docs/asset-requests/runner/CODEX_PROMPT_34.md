# Codex 작업 지시: 그림 34 (펫 사냥 · 13시트)

## 목표
학생 화면 **놀이터**의 새 게임 **펫 사냥**(그림 지도 위 야생 펫을 눌러 만나고, 공을 위로 밀어 던져 잡기)에 쓸 그림을 만들고, 잘라서 `public/assets/hunt/`에 넣은 뒤 `HUNT_ART`에 이름을 적어 PR을 만든다.
지금은 코드 그림 · 이모지로 이미 동작한다. 그림이 들어와 `HUNT_ART`에 이름이 있으면 자동으로 그림을 쓴다. **펫 그림은 새로 그리지 않는다**(기존 `public/assets/pets/{key}-{form}.webp`를 그대로 쓴다).

| 묶음 | 시트 | 내용 | 넣는 곳 |
|---|---|---|---|
| 34a 배경 | 8 | 사냥터 지도 6(숲 · 들판 · 바닷가 × 낮 · 밤, 세로 1024×1536) · 잡기 화면 배경(세로) · 놀이터 입구 카드(가로 1536×1024) | `hunt/bg-forest-day` … `bg-beach-night` · `bg-catch` · `entry` |
| 34b-1 공 | 1 | 기본 · 좋은 · 황금 공 + 열린 공 | `hunt/ball-basic` · `ball-good` · `ball-gold` · `ball-open` |
| 34b-2 공 프레임 | 1 | 던질 때(회전) · 흔들림 왼쪽 · 흔들림 오른쪽 · 딸깍(잡힘) | `hunt/ball-spin` · `ball-tilt-l` · `ball-tilt-r` · `ball-lock` |
| 34b-3 효과 | 1 | 잡힘 반짝이 · 별 · 빠져나옴 · 도망 연기 | `hunt/fx-sparkle` · `fx-star` · `fx-burst` · `fx-smoke` |
| 34b-4 원 | 1 | 원 테두리 초록 · 노랑 · 빨강 + 새 친구 '?' 실루엣 반짝이 | `hunt/ring-green` · `ring-yellow` · `ring-red` · `fx-mystery` |
| 34b-5 열매 | 1 | 🍓 딸기 · 🍍 파인애플 · 🍌 바나나 열매 + 가방 | `hunt/berry-razz` · `berry-pinap` · `berry-nanab` · `bag` |

시트와 칸마다 넣을 파일은 `slice-map.csv`에서 `list` 열이 `34a-` · `34b-`로 시작하는 줄을 본다.

## 꼭 지킬 것
- **그리기 전에 Drive의 기존 그림을 열어 그림체를 맞춘다.**
  - 배경(34a): 펫 폴더 "SUMUS_PET_SPRITES_ALL_20261002/original_1254"(MONG · NABI · PINKY · BAMBOO의 02_grown · 03_final — 펫이 이 배경 위를 걸어 다닌다), "SUMUS 낚시 29 (Runner용)"의 `29a-1.png`, "SUMUS 낚시 27 (Runner용)"의 `27a-3.png`. 입구 카드는 "SUMUS 짝 맞추기 32 (Runner용)"의 `32-1.png`도(바로 위에 나온다).
  - 밤 배경은 같은 곳의 낮 배경(`34a-1` · `34a-3` · `34a-5`)을 열어 배치를 똑같이 맞춘다. 둘째 지도부터는 `34a-1.png`를 열어 각도 · 크기를 맞춘다.
  - UI(34b): "SUMUS 에셋 05·06 (Runner용)"의 `06-3.png` · `06-4.png`, "SUMUS 낚시 27 (Runner용)"의 `27c-1.png`. 34b-2 ~ 34b-5는 같은 폴더의 `34b-1.png`를 열어 공 모양 · 마감 · 색을 맞춘다.
  - 더 흐리거나 뿌옇거나 수채화처럼 만들지 않는다.
- **결과는 정해진 Drive 폴더 "SUMUS 펫 사냥 34 (Runner용)"에 정확한 파일 이름(`34a-1.png` ~ `34a-8.png`, `34b-1.png` ~ `34b-5.png`)으로 저장한다.**
  - 채팅에 보여 주는 것만으로는 안 된다.
  - 같은 이름이 있으면 바꿔 넣는다. 폴더가 없으면 만든다.
- 배경 · 공 · 효과 · 열매에는 **글자 · 숫자를 넣지 않는다**(앱이 이름 · 개수를 위에 쓴다). 지도 배경에는 **펫 · 동물을 그리지 않는다**(앱이 펫을 그린다).
- **브랜치:**
  - `origin/claude/pet-hunt`에서 새로 만든다. 예: `codex/art-34`. PR 대상도 `claude/pet-hunt`.
  - 그 브랜치가 이미 머지되어 없으면 `sumus-voca-prod-deploy`에서 새로 만들되, PR 대상은 선생님께 물어본다(`sumus-voca-prod-deploy`는 운영에 바로 배포된다).
- **PR까지만 만든다. 머지하지 않는다.** **운영 Supabase에 연결하지 않는다.** Codex 내장 그림 생성 기능으로 만들고 유료 API를 쓰지 않는다.
- 고치는 파일: `public/assets/hunt/` 아래 새 그림, `public/modules/hunt.js`의 `HUNT_ART` 한 줄, `DONE_34.md`, 빌드가 바꾸는 `public/sw.js`. 그 밖의 앱 코드는 고치지 않는다. 원본 시트 PNG는 커밋하지 않는다(`/tmp/art/`).

## 입력
- `docs/asset-requests/runner/split/34a-1 …` ~ `34b-5 …`: 시트 하나 = 프롬프트 하나(Drive 참고 그림 · 저장 위치가 이미 들어 있다).
- 보내는 순서: `34a-1`(숲 낮) → `34a-2` ~ `34a-8` → `34b-1`(공) → `34b-2` ~ `34b-5`.

## 1. 그림 만들기
- 34a-1 ~ 34a-7: 세로 1024×1536, 34a-8: 가로 1536×1024, 모두 투명 아님(끝까지 칠한다).
- 34b: 2×2 시트 1024×1024, **투명 배경 PNG**.
- 점검. 통과 못하면 다시 만든다(시트마다 최대 4번).
  - 글자 · 숫자 · 로고가 없다. 지도에 펫 · 동물이 없다.
  - 지도 가운데 80%가 넓고 조용하다(작은 펫 3~5마리가 잘 보인다). 밤 지도도 땅이 보인다.
  - 잡기 화면 배경은 가운데 아래(아래에서 40%) 펫이 설 자리가 비어 있다.
  - 공 네 칸 · 원 세 칸은 같은 크기 · 같은 모양. 원은 정원이고 가운데가 투명하다.
  - 공 · 열매는 64px로 줄여도 알아볼 수 있다.

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
node $R/fit-assets.mjs <34b-1> hunt/ball-basic hunt/ball-good hunt/ball-gold hunt/ball-open --preview /tmp/review/34b-1.png
node $R/fit-assets.mjs <34b-2> hunt/ball-spin hunt/ball-tilt-l hunt/ball-tilt-r hunt/ball-lock --preview /tmp/review/34b-2.png
node $R/fit-assets.mjs <34b-3> hunt/fx-sparkle hunt/fx-star hunt/fx-burst hunt/fx-smoke --fit-each --preview /tmp/review/34b-3.png
node $R/fit-assets.mjs <34b-4> hunt/ring-green hunt/ring-yellow hunt/ring-red hunt/fx-mystery --size 384 --preview /tmp/review/34b-4.png
node $R/fit-assets.mjs <34b-5> hunt/berry-razz hunt/berry-pinap hunt/berry-nanab hunt/bag --fit-each --preview /tmp/review/34b-5.png
# 34a: 지도 · 잡기 배경 720×1080, 입구 카드 1280×853, 모두 webp 200KB 이하
#   → public/assets/hunt/bg-forest-day.webp … bg-beach-night.webp · bg-catch.webp · entry.webp
```
- 공(34b-1 · 34b-2)은 `--fit-each`를 쓰지 않는다(같은 배율로 잘라야 바꿔 끼워도 크기가 튀지 않는다).
- 칸 이름은 `slice-map.csv`의 `app_file`과 같아야 한다.
- `public/modules/hunt.js`의 `export const HUNT_ART = new Set([]);`에 넣은 그림 이름(`bg-forest-day`, `ball-basic` …)을 적는다. 넣지 못한 그림은 적지 않는다(코드 그림이 그대로 나온다).

## 3. 마무리
- `docs/asset-requests/runner/DONE_34.md`(한국어): 넣은 그림 표, 넣지 못한 것과 이유, 다시 만든 횟수, "눈으로 확인 필요".
- `npm ci && npm run build:assets && npm run check && npm run check:cloudflare`.
- PR 대상 `claude/pet-hunt`, 제목 `그림 34: 펫 사냥`, 본문 한국어. 지도 · 잡기 화면(폭 390px) 스크린샷을 한 장으로 작게 합쳐 코멘트. **머지하지 않는다.**
