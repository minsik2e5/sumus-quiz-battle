# Codex 작업 지시: 그림 29 (낚시 화면 새 단장 · 1인칭 · 손맛 효과 · 12시트)

## 목표
놀이터 **손맛 낚시**를 1인칭 화면으로 바꾸고, 손맛 연출(점프 · 슬로모션 · 챔질 · 진주)과 어망 수조에 쓸 그림을 만든다. 그다음 잘라서 `public/assets/fishing/`에 넣고 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다**(화면 연결은 Claude가 한다).

| 묶음 | 시트 | 내용 | 넣는 곳 |
|---|---|---|---|
| 29a 배경 | 3 | 1인칭 바다 위(배 앞머리) · 어망 수조 · 물고기 공개(수면 높이) — 세로 | `fishing/bg-pov` · `bg-tank` · `bg-reveal` |
| 29b 1인칭 낚싯대 · 릴 | 2 | 낚싯대 곧음 · 왼쪽 휨 · 오른쪽 휨 · 앞으로 크게 휨 / 릴 몸통 · 손잡이(돌리기용) · 과열 · 필살 | `fishing/pov-*` |
| 29c 손맛 효과 | 4 | 점프 물보라 · 물방울 고리 · 집중선 · 충격 / 후광 · 빛줄기 · 새로 발견 도장 틀 · 신기록 리본 틀 / 진주 더미 · 터짐 · 큰 조개 · 꼬리 / 찌 톡톡 · 찌 쑥 · 챔질 터짐 · 거품 | `fishing/fx-*` 등 |
| 29d 수조 꾸미기 | 1 | 보물 상자 · 산호 · 수초 · 바위 성 | `fishing/tank-*` |
| 29e 위쪽 메뉴 · 게이지 | 2 | 어망 · 교환소 · 도감 아이콘 · 미끼 통 / 남은 거리 · 던지기 반원 게이지 틀 · 필살 버튼 · 터치 안내 손 | `fishing/icon-*` 등 |

시트와 칸마다 넣을 파일은 `slice-map.csv`에서 `list` 열이 `29a-` ~ `29e-`로 시작하는 줄을 본다.

## 꼭 지킬 것
- **그리기 전에 Drive의 기존 그림을 열어 그림체를 맞춘다.**
  - 배경: 펫 폴더 "SUMUS_PET_SPRITES_ALL_20261002/original_1254"(MONG · NABI · PINKY · BAMBOO의 03_final)와 "SUMUS 낚시 27 (Runner용)"의 `27a-1.png` · `27a-2.png`
  - 도구 · 효과 · 아이콘: "SUMUS 낚시 27 (Runner용)"의 `27c-1.png` · `27c-2.png` · `27c-7.png`와 "SUMUS 에셋 05·06 (Runner용)"의 `06-3.png`
  - 29b 낚싯대 · 릴: **`27c-1.png`의 낚싯대 · 릴 디자인을 그대로** 두고 시점과 휨만 바꾼다. 손 · 팔 · 사람은 그리지 않는다.
  - 29b 4자세는 손잡이 위치와 크기가 같아야 한다(게임이 갈아 끼운다). 릴 손잡이는 가운데를 축으로 돌릴 수 있게 허브가 칸 정중앙에 와야 한다.
  - 29c 진주는 `27c-6.png`(오른쪽 위)의 진주, 찌는 `27c-2.png`(왼쪽 위)의 찌와 같게 한다.
  - 도장 · 리본 · 챔질 터짐은 **가운데를 비운다**(글자는 게임이 쓴다).
- **결과는 정해진 Drive 폴더 "SUMUS 낚시 29 (Runner용)"에 정확한 파일 이름(`29a-1.png` ~ `29a-3.png`, `29b-1.png` · `29b-2.png`, `29c-1.png` ~ `29c-4.png`, `29d-1.png`, `29e-1.png` · `29e-2.png`)으로 저장한다.**
  - 채팅에 보여 주는 것만으로는 안 된다.
  - 같은 이름이 있으면 바꿔 넣는다.
  - 폴더가 없으면 만든다.
- 순서: 29b(낚싯대 기준) → 29a → 29c → 29d → 29e.
- **브랜치:**
  - `origin/claude/zen-knuth-m0c31z`에서 새로 만든다. 예: `codex/art-29`.
  - 낚시 화면은 아직 이 브랜치에만 있다.
  - PR 대상도 `claude/zen-knuth-m0c31z`. **`sumus-voca-prod-deploy`로 PR을 만들지 않는다**(운영에 바로 배포된다).
- **PR까지만 만든다. 머지하지 않는다.**
- **운영 Supabase에 연결하지 않는다.**
- Codex 내장 그림 생성 기능으로 만들고, 유료 API를 쓰지 않는다.
- `public/assets/fishing/` 아래 새 그림, `DONE_29.md`, 빌드가 바꾸는 `public/sw.js` 말고는 고치지 않는다.
- 원본 시트 PNG는 커밋하지 않는다(`/tmp/art/`). 미리보기 PNG도 `public/`에 넣지 않는다(PR 코멘트로만).

## 입력
- `docs/asset-requests/runner/split/29a-1 …` ~ `29e-2 …`: 시트 하나에 프롬프트 하나(Drive 참고 그림 · 저장 위치가 이미 들어 있다).

## 1. 그림 만들기
- 29b ~ 29e: 2×2 시트 1024×1024, **투명 배경 PNG**.
- 29a: 세로 배경 1024×1536, 투명 아님.
- 점검. 통과 못하면 다시 만든다(시트마다 최대 4번).
  - 글자 · 숫자가 없다.
  - 한 칸에 하나만 있다.
  - 29b 4자세의 손잡이 위치가 같다.
  - 29a-1은 아래 가운데 · 오른쪽이 비어 있다(낚싯대 · 버튼 자리).
  - 29a-3은 가운데가 비어 있다.
  - 96px로 줄여도 아이콘이 알아보인다.

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
# 29b: 4자세가 같은 크기 · 같은 위치여야 하므로 --fit-each 대신 같은 틀로(칸 그대로 512px → 384px)
node $R/fit-assets.mjs <29b-1> fishing/pov-rod fishing/pov-rod-left fishing/pov-rod-right fishing/pov-rod-deep --preview /tmp/review/29b-1.png
# 29c ~ 29e: 칸 순서대로 slice-map.csv의 app_file
node $R/fit-assets.mjs <29c-1> fishing/fx-jump fishing/fx-drops fishing/fx-speed fishing/fx-impact --fit-each --preview /tmp/review/29c-1.png
# 29a: 세로 배경은 720×1080, webp 200KB 이하
```
- `pov-crank`는 허브가 정중앙에 오도록 자른다(가운데를 기준으로 정사각형).

## 3. 기록 · 점검 · PR
- `docs/asset-requests/runner/DONE_29.md`(한국어): 넣은 그림 표, 넣지 못한 것과 이유, 다시 만든 횟수, "눈으로 확인 필요".
- `npm ci && npm run build:assets && npm run check && npm run check:cloudflare`.
- PR:
  - 대상 `claude/zen-knuth-m0c31z`, 제목 `그림 29: 낚시 화면 새 단장(1인칭 · 손맛 효과)`, 본문 한국어
  - 미리보기를 한 장으로 합쳐 코멘트
  - **머지하지 않는다.**
