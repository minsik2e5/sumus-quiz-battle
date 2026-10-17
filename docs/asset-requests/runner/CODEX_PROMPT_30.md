# Codex 작업 지시: 그림 30 (보물 사냥 2.0 · 6시트)

## 목표
교실 게임 보물 사냥 2.0(금고 털이 · 도난 경보 · 엿보기 · 아이템 · 이벤트 라운드 · 팀전)에 쓸 그림을 만들고, 잘라서 `public/assets/treasure/`에 넣은 뒤 PR을 만든다. **그림 파일만 넣는다. 앱 코드는 고치지 않는다**(화면 연결은 Claude가 한다: 지금은 코드 그림으로 이미 동작한다).

| 묶음 | 시트 | 내용 | 넣는 곳 |
|---|---|---|---|
| 30a 배경 | 2 | 폰 세로 배경(1024×1536) · TV 가로 배경(1536×1024), 해 질 녘 해적 만 | `treasure/bg-phone` · `bg-tv` |
| 30b-1 상자 | 1 | 닫힌 상자 3색 + 열린 상자 | `treasure/chest-gold` · `chest-violet` · `chest-green` · `chest-open` |
| 30b-2 아이템 | 1 | 50:50 · 시간 정지 · 콤보 보호 · 엿보기 | `treasure/item-fifty` · `item-freeze` · `item-saver` · `item-peek` |
| 30b-3 소품 | 1 | 금고 · 경보 사이렌 · 현상금 포스터 · 해적선 | `treasure/vault` · `siren` · `bounty` · `ship` |
| 30b-4 이벤트 | 1 | 황금 시간 · 해적선 습격 · 보물 폭풍 배지, 팀 깃발 | `treasure/ev-golden` · `ev-raid` · `ev-storm` · `flags` |

시트와 칸마다 넣을 파일은 `slice-map.csv`에서 `list` 열이 `30a-` · `30b-`로 시작하는 줄을 본다.

## 꼭 지킬 것
- **그리기 전에 Drive의 기존 그림을 열어 그림체를 맞춘다.**
  - UI(30b): Google Drive 폴더 "SUMUS 에셋 05·06 (Runner용)"의 `06-3.png` · `06-4.png`, "SUMUS 낚시 27 (Runner용)"의 `27c-1.png`, "SUMUS 짝 맞추기 29 (Runner용)"의 `29b-1.png`
  - 배경(30a): 펫 폴더 "SUMUS_PET_SPRITES_ALL_20261002/original_1254"(MONG · NABI · PINKY · BAMBOO의 03_final)와 "SUMUS 전투 배경 15 (Runner용)"의 `15-1.png`
  - 30b-2 ~ 30b-4는 같은 폴더의 `30b-1.png`를 열어 마감 · 외곽선 · 색을 맞춘다.
- **결과는 정해진 Drive 폴더 "SUMUS 보물 사냥 30 (Runner용)"에 정확한 파일 이름(`30a-1.png` · `30a-2.png`, `30b-1.png` ~ `30b-4.png`)으로 저장한다.** 채팅에 보여 주는 것만으로는 안 된다(같은 이름이 있으면 바꿔 넣는다).
- 상자 · 아이콘 · 배지 · 포스터에는 **글자를 넣지 않는다**(앱이 글자를 위에 쓴다).
- 브랜치는 `claude/zen-knuth-m0c31z`에서 새로 만든다. 예: `codex/art-30`. 보물 사냥 2.0은 아직 운영에 없으니 **PR 대상도 `claude/zen-knuth-m0c31z`**로 한다(`sumus-voca-prod-deploy`로 PR을 만들지 않는다).
- **PR까지만 만든다. 머지하지 않는다.** **운영 Supabase에 연결하지 않는다.** Codex 내장 그림 생성 기능으로 만들고 유료 API를 쓰지 않는다.
- `public/assets/treasure/` 아래 새 그림, `DONE_30.md`, 빌드가 바꾸는 `public/sw.js` 말고는 고치지 않는다. 원본 시트 PNG는 커밋하지 않는다(`/tmp/art/`).

## 입력
- `docs/asset-requests/runner/split/30a-1 …` ~ `30b-4 …`: 시트 하나 = 프롬프트 하나(Drive 참고 그림 · 저장 위치가 이미 들어 있다).

## 1. 그림 만들기
- 30b: 2×2 시트 1024×1024, **투명 배경 PNG**. 30a-1: 세로 1024×1536, 30a-2: 가로 1536×1024, 둘 다 투명 아님.
- 점검: 글자 · 숫자 없음, 칸마다 하나, 상자 네 칸은 같은 모양 · 같은 크기, 아이콘은 96px로 줄여도 알아볼 수 있음, 배경 가운데는 어둡고 조용함. 통과 못하면 다시(시트마다 최대 4번).

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
node $R/fit-assets.mjs <30b-1> treasure/chest-gold treasure/chest-violet treasure/chest-green treasure/chest-open --fit-each --preview /tmp/review/30b-1.png
node $R/fit-assets.mjs <30b-2> treasure/item-fifty treasure/item-freeze treasure/item-saver treasure/item-peek --fit-each --preview /tmp/review/30b-2.png
node $R/fit-assets.mjs <30b-3> treasure/vault treasure/siren treasure/bounty treasure/ship --fit-each --preview /tmp/review/30b-3.png
node $R/fit-assets.mjs <30b-4> treasure/ev-golden treasure/ev-raid treasure/ev-storm treasure/flags --fit-each --preview /tmp/review/30b-4.png
# 30a: 폰 배경 720×1080, TV 배경 1280px 가로, 모두 webp 200KB 이하 → public/assets/treasure/bg-phone.webp · bg-tv.webp
```
- 칸 이름은 `slice-map.csv`의 `app_file`과 같아야 한다. 아이콘 · 상자 · 배지는 256px, 폰 · TV 배경은 위 크기.

## 3. 마무리
- `docs/asset-requests/runner/DONE_30.md`(한국어): 넣은 그림 표, 넣지 못한 것과 이유, 다시 만든 횟수, "눈으로 확인 필요".
- `npm ci && npm run build:assets && npm run check && npm run check:cloudflare`.
- PR 대상 `claude/zen-knuth-m0c31z`, 제목 `그림 30: 보물 사냥 2.0`, 본문 한국어, 미리보기를 한 장으로 합쳐 코멘트. **머지하지 않는다.**
