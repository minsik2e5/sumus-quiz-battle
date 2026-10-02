# Codex 작업 지시: 로보 쉬움·보통 동작 · 코인 뽑기 머신과 캡슐 · 알 반응

## 목표
SUMUS VOCA(저장소 `minsik2e5/sumus-quiz-battle`)에 그림 32장을 만들어 넣고 앱에 연결한 뒤, PR을 하나 만든다.

| 묶음 | 시트 | 그림 | 앱에서 |
|---|---|---|---|
| 로보 쉬움·보통 동작 | 2 | 8 | 야차전 로보 연습 대결 '쉬움'(아기 로보)·'보통'(성장 로보)이 공격하고 맞고 기뻐하고 시무룩해함 |
| 코인 뽑기 머신·캡슐 | 2 | 8 | 놀이터 코인 뽑기 머신, 떨어지는 캡슐, 열리는 캡슐, 뽑기권, 꽝·잭팟 그림 |
| 알 반응 | 4 | 16 | 알 단계 펫을 쓰다듬으면 기뻐함, 데워주면 따뜻해짐 |

## 꼭 지킬 것
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다. 예: `codex/robot-lucky-eggs`
  - 그 브랜치에 `docs/asset-requests/runner/06-robot-lucky-eggs.txt`가 없으면 이 지시서가 담긴 PR이 아직 머지되지 않은 것이다. 그때는 `claude/sumus-voca-supabase-backup-257jdg`에서 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** 머지하면 운영에 바로 배포된다.
- **운영 Supabase에 연결하지 않는다.** 이 작업은 그림, 프론트 코드, 점검만 다룬다.
- 그림 생성 키는 Codex 환경 변수 `OPENAI_API_KEY`만 쓴다. 키를 코드, 커밋, PR에 남기지 않는다.
- 아래에 적은 파일 말고는 고치지 않는다. 게임 규칙, 코인, 확률, 서버 로직은 건드리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다. 임시 폴더에 둔다.
- 기존 그림 파일(`<펫>-<단계>.webp`, `-s.webp`, `-run.webp` 등)은 지우거나 덮어쓰지 않는다.
  - `robot-1-*` 같은 패턴으로 지우지 않는다. 예전에 이렇게 해서 `-s.webp`가 같이 지워졌다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `06-robot-lucky-eggs.txt`: 프롬프트 8개가 `---`만 있는 줄로 나뉘어 있다.
- `slice-map.csv`: `list`가 `06-robot-lucky-eggs.txt`인 행이 각 칸의 이름(`key`)과 앱 파일(`app_file`)이다.
  - 칸 순서: 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래

프롬프트별 참고 그림(`refs/`):

| 번호 | 시트 | 참고 그림 |
|---|---|---|
| 1 | 로보 쉬움(아기) | `ref-robot-1.png` |
| 2 | 로보 보통(성장) | `ref-robot-2.png` |
| 3 | 코인 뽑기 머신 | 없음 (generate API) |
| 4 | 코인 뽑기 캡슐 | 없음 (generate API) |
| 5 | 몽이·핑키 알 | `ref-eggs-dog-pig.png` (왼쪽이 첫 번째 알) |
| 6 | 나비·용이 알 | `ref-eggs-cat-dragon.png` |
| 7 | 밤부·초롱 알 | `ref-eggs-panda-snake.png` |
| 8 | 토리·호야 알 | `ref-eggs-rabbit-fox.png` |

- 자르기 도구
  - 펫·로보: `fit-sheets.mjs`
  - 뽑기: `fit-assets.mjs`
  - `sharp`가 필요하다. 없으면 `npm i --no-save sharp`

## 1. 그림 만들기
- 참고 그림이 있는 시트는 OpenAI Images **edit** API를 쓴다.
  - `model: "gpt-image-1"`, `image: <참고 그림>`, `prompt: <프롬프트 원문 그대로>`
- 참고 그림이 없는 시트(3, 4)는 **generate** API를 쓴다. 같은 모델과 같은 옵션이다.
- 공통 옵션
  - `size: "1024x1024"`, `quality: "high"`, `background: "transparent"`, `output_format: "png"`
  - `n: 2`로 후보를 받아 점검을 통과한 것 중 나은 것을 고른다.
- 실패하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.

후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다.
   - 네 모서리의 alpha가 0이다.
   - 체크무늬나 흰 상자를 그려 넣지 않았다.
2. 칸마다 그림이 하나씩 따로 있다. 서로 겹치지 않고 그림 밖으로 잘리지 않았다.
3. 글자, 숫자, 테두리, 바닥 그림자가 없다.
4. 시트별 점검
   - **로보**: 참고 그림과 같은 단계다.
     - 쉬움은 작고 동그란 아기 로보다.
     - 보통은 조금 크고 민트 무늬가 많다.
     - 둘 다 어깨 가시나 큰 갑옷이 **없다**. 그건 최종(어려움) 모습이다.
     - 칸마다 동작이 맞다: 공격(주먹 + 민트 궤적) · 맞음(움찔, > < 눈) · 기쁨(점프, 하트) · 시무룩(주저앉음, 눈물).
   - **알**: 무늬, 색, 둥지가 참고 그림의 알과 같다.
     - 금이 가거나 얼굴이 생기면 실패다.
     - 왼쪽 칸은 기뻐함(기울어짐, 하트), 오른쪽 칸은 따뜻해짐(주황 빛, 김)이다.
     - 위 줄은 첫 번째 알, 아래 줄은 두 번째 알이다.
   - **머신**
     - 정면 그림이다.
     - 동전 구멍은 받침대 앞 **오른쪽**, 손잡이는 앞 **가운데**, 캡슐 나오는 구멍은 **아래 가운데**에 있다.
     - 번쩍 그림은 기본 그림과 같은 크기, 같은 위치다.
   - **캡슐**
     - 위 반쪽과 아래 반쪽은 같은 크기의 한 캡슐에서 나온 모양이다.
     - 위 반쪽은 열린 면이 아래를, 아래 반쪽은 열린 면이 위를 향한다.

이미지를 볼 수 있으면 4번은 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고, PR에 "눈으로 확인 필요"라고 적는다.

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
# 로보 (지금 로보 그림 robot-1.webp / robot-2.webp에 키·발 위치를 맞춰요)
node $R/fit-sheets.mjs <1번 시트> robot-1-attack robot-1-hurt robot-1-happy robot-1-sad --preview /tmp/review/robot-1.png
node $R/fit-sheets.mjs <2번 시트> robot-2-attack robot-2-hurt robot-2-happy robot-2-sad --preview /tmp/review/robot-2.png
# 뽑기 머신 (512px 정사각형)
node $R/fit-assets.mjs <3번 시트> lucky/machine lucky/machine-lit lucky/ticket lucky/jackpot --size 512 --preview /tmp/review/lucky-1.png
# 캡슐: 닫힌 캡슐과 꽝은 256px 정사각형, 위·아래 반쪽은 테두리에 딱 맞게(같은 폭)
node $R/fit-assets.mjs <4번 시트> lucky/capsule - - lucky/miss --size 256 --preview /tmp/review/lucky-2.png
node $R/fit-assets.mjs <4번 시트> - lucky/capsule-top lucky/capsule-bottom - --trim --size 240 --preview /tmp/review/lucky-3.png
# 알 (지금 알 그림 <펫>-0.webp에 맞춰요). eat 칸이 '따뜻해짐'이에요(앱의 알 데워주기 = 밥 주기 자리)
node $R/fit-sheets.mjs <5번 시트> dog-0-happy dog-0-eat pig-0-happy pig-0-eat --preview /tmp/review/eggs-1.png
node $R/fit-sheets.mjs <6번 시트> cat-0-happy cat-0-eat dragon-0-happy dragon-0-eat --preview /tmp/review/eggs-2.png
node $R/fit-sheets.mjs <7번 시트> panda-0-happy panda-0-eat snake-0-happy snake-0-eat --preview /tmp/review/eggs-3.png
node $R/fit-sheets.mjs <8번 시트> rabbit-0-happy rabbit-0-eat fox-0-happy fox-0-eat --preview /tmp/review/eggs-4.png
```
- `public/assets/lucky/` 폴더는 새로 만든다(`mkdir -p public/assets/lucky`).
- 도구가 "배경이 투명하지 않아요"나 "칸이 비어 있어요"로 멈추면 그 시트는 1단계로 돌아가 다시 만든다.
- 미리보기에서 로보·알은 맨 왼쪽이 지금 앱 그림이다. 크기와 단계가 비슷해 보여야 한다.

## 3. 코드 연결

### `public/modules/character.js`
`EXPRESSIONS`를 고친다.
- 로보: `const ROBOT = ['happy', 'sad', 'attack', 'hurt'];`를 만들고 `robot: { 1: ROBOT, 2: ROBOT, 3: ROBOT }`로 바꾼다.
- 펫 8종에 알 단계를 더한다. 예: `dog: { 0: EGG, 1: ALL, 2: ALL, 3: ALL }`, `const EGG = ['happy', 'eat'];`
- 위 주석에 한 줄을 더한다: "알(0단계)은 기뻐함(쓰다듬기)과 따뜻해짐(eat 자리, 알 데워주기)만 있다."
- 실제로 넣은 그림만 등록한다. 넣지 못한 칸은 빼고, 이유를 PR에 적는다.
- 다른 코드는 고치지 않는다.
  - 홈의 쓰다듬기·데워주기는 이미 `showPose(art, 'happy' | 'eat')`를 부른다.
  - 야차전은 이미 `showPose(el, 'attack' | 'hurt')`를 부른다.
  - 그래서 등록만 하면 연결된다.

### `public/modules/lucky.js`
1. `luckyCard`의 `.lk-machine` 안을 바꾼다.
   - `.lk-bulbs`, `.lk-glass`, `.lk-base` 안의 `.lk-marquee` · `.lk-slot` 테두리 · `.lk-dial`을 지운다.
   - 대신 그림 두 장을 넣는다.
     - `<img class="lk-machine-art" src="/assets/lucky/machine.webp" alt="" draggable="false">`
     - `<img class="lk-machine-lit" src="/assets/lucky/machine-lit.webp" alt="" draggable="false">`
   - `.lk-coin-in`(들어가는 동전)과 `.lk-drop`(떨어지는 캡슐) 요소는 **남긴다**. `machineSpin`과 `machineDrop`이 이 요소를 움직인다.
   - 두 요소를 머신 그림 위의 동전 구멍과 캡슐 구멍 자리에 절대 위치로 놓는다(퍼센트).
     - 그림을 볼 수 있으면 잘라 낸 `machine.webp`에서 위치를 재서 맞춘다.
     - 볼 수 없으면 동전 구멍은 `left:70%; top:68%`, 캡슐 구멍은 `left:50%; top:90%`로 두고, PR에 "위치 눈으로 확인 필요"라고 적는다.
   - `.lk-drop`의 모양은 `capsule.webp` 배경 그림으로 바꾼다.
2. `.lk-machine.spin`과 `.lk-machine.drop`일 때 `.lk-machine-lit`을 보이게 한다(`opacity` 전환). 평소에는 숨긴다.
   - 기존 흔들림(`lk-shake`)은 그대로 둔다.
3. `luckyShow`의 `.lk-cap`을 바꾼다.
   - `<i class="top"></i><i class="bot"></i>`을 그림 두 장으로 바꾼다.
     - `<img class="top" src="/assets/lucky/capsule-top.webp" alt="">`
     - `<img class="bot" src="/assets/lucky/capsule-bottom.webp" alt="">`
   - `.lk-cap-band`와 `.lk-cap-shine`은 지운다(그림에 들어 있다).
   - 위 반쪽은 아래 반쪽 위에 딱 맞게 붙인다. 열릴 때(`.pop`) 지금처럼 위아래로 벌어지게 한다. 기존 `fall` · `wob` · `pop` 애니메이션과 `data-glow` 빛은 그대로 둔다.
4. 결과 화면 `.lk-result`의 `.lk-big` 위에 그림을 넣는다.
   - 꽝(`res.mult === 0`): `<img class="lk-result-art" src="/assets/lucky/miss.webp" alt="">`
   - 잭팟(`res.mult === 3`): `jackpot.webp`
   - 1배·2배는 그림 없이 지금 그대로다.
5. 뽑기권 버튼의 `<b>🎟</b>`을 `<img class="lk-ticket-art" src="/assets/lucky/ticket.webp" alt="">`로 바꾼다.
6. 확률, 판돈, 결과 계산, 소리, 진동은 **바꾸지 않는다**.

### 새 CSS `public/v1388.css`
- 위 그림의 크기와 위치를 넣는다.
  - 머신 그림은 `.lk-machine`(170×230)을 꽉 채우고 아래를 맞춘다(`object-fit:contain; object-position:50% 100%`).
  - 캡슐 반쪽은 `.lk-cap` 폭 120px에 맞춘다.
  - 뽑기권은 22px, 결과 그림은 96px이다.
- `prefers-reduced-motion`에서는 새로 넣은 전환 효과를 끈다.
- `server/build-assets.mjs`의 CSS 목록 맨 끝에 `"v1388.css"`를 더한다.

### `server/rewards-check.mjs`
- V13.85 블록의 `expressionSrc('robot', 2, 'attack') === null`을 경로를 기대하도록 바꾼다(`/assets/pets/robot-2-attack.webp`).
- V13.83 블록의 `expressionSrc('dog', 0, 'happy') === null`을 경로로 바꾸고, "그림이 없으면 null" 점검은 `expressionSrc('dog', 0, 'sad') === null`로 남긴다.
- 새 점검 블록 `V13.88`을 더한다.
  - 로보 1·2단계 그림 8장과 알 그림 16장이 등록되어 있고 파일이 있다.
  - `public/assets/lucky/`의 그림 8장이 있다.
  - `lucky.js`에 `machine.webp` · `capsule-top.webp` · `ticket.webp`가 있고 `🎟`가 없다.
  - 빌드 목록에 `"v1388.css"`가 있다.

### 버전 13.88.0
- `package.json`
- `package-lock.json`의 최상위 `version` 두 곳
- `public/index.html`의 `?v=` 두 곳
- `server/release-check.mjs`의 현재 버전 문자열
- 지금 버전이 이미 13.88.0 이상이면 그다음 minor로 올린다.

### `CHANGES_v13.88.0.md`
한국어로 쓴다. 넣은 그림 표, 넣지 못한 그림(이유 포함), 바뀐 화면을 적는다.

## 4. 점검
```
npm ci
npm run build:assets
npm run check            # release-check 전부 PASS
npm run check:cloudflare
```
그다음 `git status`로 바뀐 파일을 확인한다. 아래 파일만 바뀌어야 한다.
- `public/assets/pets/robot-{1,2}-*.webp`
- `public/assets/pets/*-0-{happy,eat}.webp`
- `public/assets/lucky/*.webp`
- `public/modules/character.js`, `public/modules/lucky.js`
- `public/v1388.css`, `server/build-assets.mjs`, `server/rewards-check.mjs`
- 버전 파일, `public/sw.js`(빌드가 바꿈), `CHANGES_v13.88.0.md`

기존 펫 그림이 하나도 바뀌거나 지워지지 않았는지 확인한다. 아래 명령에는 새 파일만 보여야 한다.
```
git diff --stat origin/sumus-voca-prod-deploy -- public/assets/pets
```

## 5. PR
- 대상: `sumus-voca-prod-deploy`
- 제목: `로보 쉬움·보통 동작 · 코인 뽑기 머신과 캡슐 · 알 반응 (v13.88.0)`
- 본문은 한국어로 쓴다.
  - 넣은 그림 표
  - 넣지 못한 그림과 이유
  - 시트마다 몇 번 다시 만들었는지
  - 점검 결과
  - "눈으로 확인 필요" 항목
  - 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다.`
- 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 합쳐 PR 코멘트로 올린다.
- **머지하지 않는다.**
