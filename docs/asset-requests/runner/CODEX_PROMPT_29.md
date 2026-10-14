# Codex 작업 지시: 그림 29 (짝 맞추기 고퀄 · 3시트)

## 목표
짝 맞추기 타임어택(V13.149 고퀄 업그레이드)에 쓸 그림을 만들고, 잘라서 `public/assets/match/`에 넣은 뒤 PR을 만든다. **그림 파일과 아래 한 줄만 고친다.** 화면은 그림이 없어도 코드 그림(CSS)으로 이미 완성돼 있고, 그림이 오면 갈아 끼운다.

| 묶음 | 시트 | 내용 | 넣는 곳 |
|---|---|---|---|
| 29a 배경 | 1 | 짝 맞추기 화면 세로 배경(밤하늘 무대, 가운데는 어둡고 조용하게) | `match/bg` |
| 29b UI | 2 | 영어 카드 앞면 · 뜻 카드 앞면 · 카드 뒷면 · 결과 별 / 결과 리본 · 신기록 도장 · 시상대 · 피버 불꽃 배지 | `match/<이름>` |

시트와 칸마다 넣을 파일은 `slice-map.csv`에서 `list` 열이 `29a-` · `29b-`로 시작하는 줄을 본다.

## 꼭 지킬 것
- **그리기 전에 Drive의 기존 그림을 열어 그림체를 맞춘다.**
  - UI(29b): Google Drive 폴더 "SUMUS 에셋 05·06 (Runner용)"의 `06-3.png` · `06-4.png`, "SUMUS 낚시 27 (Runner용)"의 `27c-1.png`
  - 배경(29a): 펫 폴더 "SUMUS_PET_SPRITES_ALL_20261002/original_1254"(MONG · NABI · PINKY · BAMBOO의 03_final)와 "SUMUS 전투 배경 15 (Runner용)"의 `15-1.png`
  - 29b-2는 같은 폴더의 `29b-1.png`를 열어 마감 · 외곽선 · 색을 맞춘다.
- **결과는 정해진 Drive 폴더 "SUMUS 짝 맞추기 29 (Runner용)"에 정확한 파일 이름(`29a-1.png`, `29b-1.png`, `29b-2.png`)으로 저장한다.** 채팅에 보여 주는 것만으로는 안 된다(같은 이름이 있으면 바꿔 넣는다).
- 카드 · 리본 · 도장 · 배지에는 **글자를 넣지 않는다**(앱이 단어와 글자를 위에 쓴다).
- 브랜치는 `claude/zen-knuth-m0c31z`에서 새로 만든다. 예: `codex/art-29`. 짝 맞추기는 아직 운영에 없으니 **PR 대상도 `claude/zen-knuth-m0c31z`**로 한다(`sumus-voca-prod-deploy`로 PR을 만들지 않는다).
- **PR까지만 만든다. 머지하지 않는다.** **운영 Supabase에 연결하지 않는다.** Codex 내장 그림 생성 기능으로 만들고 유료 API를 쓰지 않는다.
- `public/assets/match/` 아래 새 그림, `public/modules/match-game.js`의 `MATCH_ART` 한 줄, `DONE_29.md`, 빌드가 바꾸는 `public/sw.js` 말고는 고치지 않는다. 원본 시트 PNG는 커밋하지 않는다(`/tmp/art/`).

## 입력
- `docs/asset-requests/runner/split/29a-1 …`, `29b-1 …`, `29b-2 …`: 시트 하나 = 프롬프트 하나(Drive 참고 그림 · 저장 위치가 이미 들어 있다).

## 1. 그림 만들기
- 29b: 2×2 시트 1024×1024, **투명 배경 PNG**. 29a: 세로 배경 한 장 1024×1536, 투명 아님.
- 점검: 글자 · 숫자 없음, 칸마다 하나, 카드 세 장은 같은 모양 · 같은 크기, 카드 가운데는 넓게 비어 있음, 배경 가운데(높이 12%~88%)는 어둡고 조용함, 시상대 세 칸은 폭이 같음(왼쪽 은 · 가운데 금 · 오른쪽 동). 통과 못하면 다시(시트마다 최대 4번).

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
node $R/fit-assets.mjs <29b-1> match/card-en match/card-ko match/card-back match/star --fit-each --preview /tmp/review/29b-1.png
node $R/fit-assets.mjs <29b-2> match/ribbon match/stamp match/podium match/fever --fit-each --preview /tmp/review/29b-2.png
# 29a: 세로 배경은 720×1080 webp, 200KB 이하 → public/assets/match/bg.webp
```
- 카드 · 별 · 도장 · 배지는 256px, 리본 · 시상대는 가로 512px, 모두 webp.
- 다 넣었으면 `public/modules/match-game.js`의 `export const MATCH_ART = new Set([]);`에 넣은 그림 이름을 적는다. 예: `new Set(['bg', 'card-en', 'card-ko', 'card-back', 'star', 'ribbon', 'stamp', 'podium', 'fever'])`. 이름이 들어간 그림만 화면에 나온다.

## 3. 마무리
- `docs/asset-requests/runner/DONE_29.md`(한국어): 넣은 그림 표, 넣지 못한 것과 이유, 다시 만든 횟수, "눈으로 확인 필요".
- `npm ci && npm run build:assets && npm run check && npm run check:cloudflare`.
- PR 대상 `claude/zen-knuth-m0c31z`, 제목 `그림 29: 짝 맞추기 고퀄`, 본문 한국어, 미리보기를 한 장으로 합쳐 코멘트. **머지하지 않는다.**
