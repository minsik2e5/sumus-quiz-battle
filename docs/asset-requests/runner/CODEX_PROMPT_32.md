# Codex 작업 지시: 그림 32 (놀이터 짝 맞추기 입구 카드 · 1장)

## 목표
학생 화면 **놀이터**의 **짝 맞추기 타임어택** 카드에 들어갈 큰 가로 그림 1장을 만들어 `public/assets/match/entry.webp`로 넣고, `MATCH_ART`에 이름을 적어 PR을 만든다.
낚시터 카드(`public/assets/fishing/bg-entry.webp`)와 위아래로 나란히 크게 나오므로 **같은 수준의 그림**이어야 한다.

| 시트 | 내용 | 넣는 곳 |
|---|---|---|
| 32-1 | 밤 무대 위로 빈 단어 카드가 날고, 가운데 두 장이 부딪혀 반짝이는 장면 · 금색 초시계(가로 1536×1024) | `match/entry` |

## 꼭 지킬 것
- **그리기 전에 Drive의 기존 그림을 열어 그림체를 맞춘다.**
  - 펫: Google Drive 폴더 "SUMUS_PET_SPRITES_ALL_20261002/original_1254"(MONG · NABI · PINKY · BAMBOO의 03_final).
  - 낚시터 입구 그림: "SUMUS 낚시 27 (Runner용)"의 `27a-3.png`(이 카드 바로 위에 나온다. 디테일 · 빛 · 채도를 맞춘다).
  - 짝 맞추기 그림이 있으면: "SUMUS 짝 맞추기 30 (Runner용)"의 `30a-1.png`(배경) · `30b-1.png`(카드). 카드 모양 · 색을 맞춘다.
  - 더 흐리거나 뿌옇거나 수채화처럼 만들지 않는다.
- **결과는 정해진 Drive 폴더 "SUMUS 짝 맞추기 32 (Runner용)"에 정확한 파일 이름 `32-1.png`로 저장한다.**
  - 채팅에 보여 주는 것만으로는 안 된다.
  - 같은 이름이 있으면 바꿔 넣는다.
  - 폴더가 없으면 만든다.
- 카드에 **글자 · 숫자가 없다**(게임이 위에 제목 · 기록을 쓴다).
- **브랜치:**
  - `origin/claude/arcade-game-cards`에서 새로 만든다. 예: `codex/art-32`.
  - PR 대상도 `claude/arcade-game-cards`. **`sumus-voca-prod-deploy`로 PR을 만들지 않는다**(운영에 바로 배포된다).
  - 그 브랜치가 이미 머지되어 없으면 `sumus-voca-prod-deploy`에서 새로 만들되, PR 대상은 선생님께 물어본다.
- **PR까지만 만든다. 머지하지 않는다.**
- **운영 Supabase에 연결하지 않는다.**
- Codex 내장 그림 생성 기능으로 만들고, 유료 API를 쓰지 않는다.
- 고치는 파일: `public/assets/match/entry.webp`, `public/modules/match-game.js`의 `MATCH_ART` 한 줄, `DONE_32.md`, 빌드가 바꾸는 `public/sw.js`. 그 밖의 앱 코드는 고치지 않는다.
- 원본 PNG는 커밋하지 않는다(`/tmp/art/`). 미리보기 PNG도 `public/`에 넣지 않는다(PR 코멘트로만).

## 입력
- `docs/asset-requests/runner/split/32-1 놀이터 짝 맞추기 입구 그림.txt`: 프롬프트 하나(Drive 참고 그림 · 저장 위치가 이미 들어 있다).

## 1. 그림 만들기
- 가로 1536×1024, 투명 아님(끝까지 칠한다).
- 점검. 통과 못하면 다시 만든다(최대 4번).
  - 글자 · 숫자 · 로고가 없다(카드도 비어 있다).
  - 왼쪽 45%와 아래 25%가 어둡고 조용하다(흰 글자가 잘 읽힌다).
  - 카드 · 반짝임 · 초시계가 오른쪽 위에 모여 있다.
  - 360px 폭으로 줄여도, 가운데를 2:1로 잘라도 장면이 알아보인다.
  - 펫을 넣었다면 몽이 모습(크림 · 황금빛 털, 큰 눈)이 참고 그림과 같다. 다르면 펫 없이 다시 만든다.

## 2. 넣기
```
# 1280×853 webp, 200KB 이하 → public/assets/match/entry.webp (bg-entry.webp와 같은 크기)
mkdir -p public/assets/match
# public/modules/match-game.js
#   export const MATCH_ART = new Set([]);  →  export const MATCH_ART = new Set(['entry']);
#   (이미 다른 이름이 있으면 'entry'만 더한다)
```
놀이터 카드는 `MATCH_ART.has('entry')`이면 이 그림을 배경으로 쓰고, 없으면 지금 코드 카드(brave · 용감한)를 쓴다(`public/modules/arcade-games.js`).

## 3. 기록 · 점검 · PR
- `docs/asset-requests/runner/DONE_32.md`(한국어): 넣은 그림, 다시 만든 횟수, 펫을 넣었는지, "눈으로 확인 필요".
- `npm ci && npm run build:assets && npm run check && npm run check:cloudflare`.
- PR:
  - 대상 `claude/arcade-game-cards`, 제목 `그림 32: 놀이터 짝 맞추기 입구 카드`, 본문 한국어
  - 놀이터 화면(폭 390px)에서 낚시터 · 짝 맞추기 카드가 함께 보이는 스크린샷 1장을 작게 코멘트
  - **머지하지 않는다.**
