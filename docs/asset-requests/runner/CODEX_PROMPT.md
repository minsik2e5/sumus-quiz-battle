# Codex 작업 지시: 펫 표정 다시 만들기 · 토리/호야 표정 만들기 · 앱 연결

## 목표
SUMUS VOCA(저장소 `minsik2e5/sumus-quiz-battle`)의 펫 표정 그림 중 빠진 것을 만들어 앱에 연결하고, PR을 하나 만든다.
- 다시 만들 것:
  - 나비(cat) 성장·최종
  - 용이(dragon) 성장·최종
  - 밤부(panda) 성장·최종
  - 초롱(snake) 최종
  - 핑키(pig) 시무룩 3단계
- 새로 만들 것: 토리(rabbit), 호야(fox)의 아기·성장·최종
- 표정은 4가지: 기뻐함 happy · 냠냠 eat · 시무룩 sad · 응원 cheer
- 결과물: 그림 최대 55장
  - 2×2 시트 14장 = 4칸 시트 13장 + 3칸 시트 1장(핑키 시무룩, 한 칸은 비움)

## 꼭 지킬 것
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/pet-expressions-redo`).
  - 그 브랜치에 `docs/asset-requests/runner/04-redo-and-missing.txt`가 없으면, PR #79가 아직 머지되지 않은 것이다. 그때는 `claude/sumus-voca-supabase-backup-257jdg`에서 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** 머지하면 운영에 바로 배포된다.
- **운영 Supabase에 연결하지 않는다.** 이 작업은 그림·프론트 코드·점검만 다룬다.
- 그림을 만드는 데 필요한 OpenAI API 키는 Codex 환경 변수 `OPENAI_API_KEY`에 있는 것만 쓴다. 키를 코드, 커밋, PR에 남기지 않는다.
- 아래에 적은 파일 말고는 고치지 않는다. 게임 규칙, 코인, 서버 로직은 건드리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다. 임시 폴더에 둔다.

## 입력 (저장소 안)
- `docs/asset-requests/runner/04-redo-and-missing.txt`
  - 프롬프트 14개가 `---`만 있는 줄로 나뉘어 있다.
  - 순서: cat-2, cat-3, dragon-2, dragon-3, panda-2, panda-3, snake-3, 핑키 시무룩, rabbit-1, rabbit-2, rabbit-3, fox-1, fox-2, fox-3
- `docs/asset-requests/runner/slice-map.csv`
  - `list`가 `04-redo-and-missing.txt`인 행이 각 칸(왼쪽 위 · 오른쪽 위 · 왼쪽 아래 · 오른쪽 아래)의 이름(`key`)이다.
  - `key`가 `-`인 칸은 비우는 칸이다.
- 참고 그림 `docs/asset-requests/runner/refs/`
  - 보통 시트: 첫 칸 이름이 `<펫>-<단계>-...`이면 `ref-<펫>-<단계>.png` **한 장만** 참고로 쓴다.
    - 아기·성장·최종이 한 장에 모인 그림을 함께 넣으면 성장·최종이 아기 몸으로 그려진다. 지난번에 실제로 이 문제가 있었다.
  - 핑키 시무룩 시트: `ref-pig.png`(3단계가 한 장에 모인 그림)를 쓴다.
- 자르기 도구: `docs/asset-requests/runner/fit-sheets.mjs` (`sharp`가 필요하다. 없으면 `npm i --no-save sharp`)

## 1. 그림 만들기
프롬프트마다 OpenAI Images **edit** API를 부른다. 참고 그림을 넣어야 하므로 generate가 아니라 edit이다.
- `model: "gpt-image-1"`, `image: <참고 그림>`, `prompt: <프롬프트 원문 그대로>`
- `size: "1024x1024"`, `quality: "high"`, `background: "transparent"`, `output_format: "png"`
- `n: 2`로 후보 2장을 받아 아래 점검을 통과한 것 중 더 나은 것을 고른다.

후보마다 점검한다. 모두 통과해야 쓴다. 실패하면 같은 프롬프트로 다시 만든다(프롬프트마다 최대 4번).
1. 배경이 진짜 투명이다. 네 모서리 alpha가 0이고, 체크무늬나 흰 상자를 그려 넣지 않았다.
2. 캐릭터가 4마리 따로 있다(핑키 시무룩 시트는 3마리, 오른쪽 아래는 비어 있다). 서로 겹치지 않고, 그림 밖으로 잘리지 않았다.
3. **단계가 맞다.** 참고 그림과 비교했을 때 몸 크기·비율·장식이 같다.
   - 성장·최종을 아기처럼 작고 동그랗게 그렸으면 실패다.
   - 예: 용이 성장·최종에는 큰 반투명 날개가 있다. 밤부 최종에는 잎 왕관과 다리의 금빛 잎 무늬가 있다. 나비 최종은 길고 날씬한 몸에 금빛 털이 있다.
4. 얼굴·색·무늬가 참고 그림의 캐릭터와 같다. 핑키는 모든 칸에서 **큰 분홍 돼지 코**가 있다(강아지 코 금지).
5. 칸의 표정이 맞다. 왼쪽 위 기뻐함(하트), 오른쪽 위 냠냠(민트색 밥그릇), 왼쪽 아래 시무룩(눈물 글썽), 오른쪽 아래 응원(앞발 번쩍).
6. 글자, 숫자, 테두리, 바닥 그림자가 없다.

이미지를 직접 볼 수 있으면 3~5번은 눈으로 확인한다. 볼 수 없으면 1·2번만 자동으로 확인한다. 이때 3~5번은 PR에 "눈으로 확인 필요"라고 적는다.
4번을 시도해도 통과하지 못한 시트는 앱에 넣지 않는다. PR에 이유를 적는다.

## 2. 자르고 앱 자리에 넣기
```
node docs/asset-requests/runner/fit-sheets.mjs <시트.png> <왼쪽위> <오른쪽위> <왼쪽아래> <오른쪽아래> --preview /tmp/review/<이름>.png
```
- 칸 이름은 `slice-map.csv`의 `key`를 그대로 쓴다. 비우는 칸은 `-`이다.
- 도구가 하는 일:
  - 붙어 있는 그림 덩어리 단위로 칸을 나눈다.
  - 지금 앱의 펫 그림(`public/assets/pets/<펫>-<단계>.webp`)과 키·발 위치를 맞춘다.
  - `public/assets/pets/<펫>-<단계>-<표정>.webp`로 저장한다(512px, 투명).
- 미리보기(`--preview`)에서 맨 왼쪽은 지금 앱 그림, 나머지는 새 표정이다. 크기와 단계가 비슷해 보여야 한다.
- 도구가 "배경이 투명하지 않아요"나 "칸이 비어 있어요"로 멈추면 그 시트는 1단계로 돌아가 다시 만든다.
- 기존 그림 파일(`<펫>-<단계>.webp`, `-s.webp`, `-0.webp`, `-run.webp`)은 절대 지우거나 덮어쓰지 않는다. 지울 때 `cat-2-*` 같은 패턴을 쓰지 않는다. 지난번에 이렇게 해서 `-s.webp`가 같이 지워졌다.

## 3. 코드 연결
**`public/modules/character.js`의 `EXPRESSIONS`**
- 실제로 넣은 그림만 등록한다.
- 4개 표정이 다 있는 단계는 `ALL`을 쓴다.
- 일부만 있으면 그 표정만 배열로 적는다. 예: `['happy', 'eat', 'cheer']`
- 등록 예:
  - 나비 성장·최종을 넣었으면 `cat: { 1: ALL, 2: ALL, 3: ALL }`
  - 핑키 시무룩을 넣었으면 `pig: { 1: ALL, 2: ALL, 3: ALL }`
  - `rabbit`, `fox` 항목을 새로 추가한다.
- 위 주석(나비·용이·밤부는 아기만 쓴다는 내용)도 실제 상태에 맞게 고친다.

**`server/rewards-check.mjs`의 `V13.83` 점검 블록**
- `exprFiles.length === 41`을 실제 표정 그림 수로 바꾼다.
- 이제 그림이 생겨서 틀리게 되는 `=== null` 단정을 고친다.
  - 대상: `expressionSrc('pig', 1, 'sad')`, `expressionSrc('fox', 2, 'happy')`, `expressionSrc('cat', 2, 'happy')`, `expressionSrc('panda', 3, 'eat')`
  - 그림이 있는 것은 경로를 기대하도록 바꾼다.
  - 계속 없는 조합으로 "그림이 없으면 null" 점검을 하나 남긴다. 예: `expressionSrc('dog', 0, 'happy') === null`

**버전 13.84.0** (아래 4곳)
- `package.json`
- `package-lock.json`의 최상위 `version` 두 곳
- `public/index.html`의 `?v=` 두 곳
- `server/release-check.mjs`의 `13.83.0` 문자열

**`CHANGES_v13.84.0.md`**: 한국어로 쓴다. 넣은 그림 표와 넣지 못한 그림(이유 포함)을 적는다.

## 4. 점검
아래가 모두 통과해야 한다.
```
npm ci
npm run build:assets
npm run check            # release-check 전부 PASS
npm run check:cloudflare
```
그다음 `git status`로 확인한다.
- 바뀐 파일은 `public/assets/pets/*-{happy,eat,sad,cheer}.webp`, `public/modules/character.js`, `server/rewards-check.mjs`, 버전 파일, `public/sw.js`(build가 바꿈), `CHANGES_v13.84.0.md`뿐이어야 한다.
- 기존 펫 그림이 하나도 바뀌거나 지워지지 않았는지 `git diff --stat origin/sumus-voca-prod-deploy -- public/assets/pets`로 확인한다.

## 5. PR
- 대상: `sumus-voca-prod-deploy`
- 제목: `펫 표정 다시 만들기 · 토리/호야 표정 (v13.84.0)`
- 본문은 한국어로 쓴다.
  - 넣은 그림 표: 펫 × 단계 × 표정
  - 넣지 못한 그림과 이유
  - 시트마다 몇 번 다시 만들었는지
  - 점검 결과
  - 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다.`
- 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 합쳐 PR 코멘트에 올린다. 원장님이 한눈에 확인할 수 있게 한다.
- **머지하지 않는다.**
