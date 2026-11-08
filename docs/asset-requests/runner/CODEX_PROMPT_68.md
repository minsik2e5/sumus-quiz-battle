# Codex 작업 지시: 그림 68 (펫 아레나 경기장 꾸미기 · 연습장 그림 14장)

## 목표
펫 아레나 **경기장 꾸미기**(이긴 횟수로 열리는 경기장 · 링 · 입장 효과 · 승리 포즈, 새 재화 없음)와 **연습장**(허수아비) 그림을 만들어 넣고 PR을 만든다.
구성안은 `docs/pet-arena-v2-plan.md` 6장 7 · 8번, 앱 쪽은 V13.236(`public/modules/arena-deco.js` · `arena-practice.js`).

| 시트 | 내용 | 넣는 곳(`public/assets/arena/`) | 자르기 |
|---|---|---|---|
| 68-1 | 새 경기장 2장: 구름 위 하늘 정원(왼쪽 반) · 얼음 동굴(오른쪽 반) | `bg-sky` · `bg-glacier` (720×1080) | 반씩 잘라 `resize(720,1080,{fit:'cover'})` |
| 68-2 | 새 경기장 2장: 화산 분화구(왼쪽 반) · 별빛 은하(오른쪽 반) | `bg-volcano` · `bg-galaxy` (720×1080) | 반씩 잘라 `resize(720,1080,{fit:'cover'})` |
| 68-3 | 링 4개(가로로 긴 타원 테두리만): 꽃 고리 · 마법진 · 황금 링 · 별자리 링 | `ring-flower` · `ring-rune` · `ring-gold` · `ring-star` | `--trim --size 512` |
| 68-4 | 입장 효과 4개: 연기 펑 · 번개 낙하 · 불꽃 기둥 · 무지개 포털 | `entry-smoke` · `entry-thunder` · `entry-flame` · `entry-rainbow` | `--fit-each --size 384` |
| 68-5 | 승리 왕관 · 연습장 허수아비(아래 두 칸은 비움) | `pose-crown` · `dummy` | `--fit-each --size 256` |

**그림 파일만 넣으면 된다.** `npm run build:assets`가 `public/modules/arena-art.js`(`ARENA_ART`)에 이름을 적고, 아레나 화면의 같은 자리(지금은 CSS로 그린 장면 · 링 · 효과 · 허수아비)가 알아서 그 그림으로 바뀐다. 앱 코드는 고치지 않는다.

## 꼭 지킬 것
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 기존 아레나 그림(65 · 66번)을 참고 그림으로 붙인다.
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-68-arena-deco`).
- 고치는 파일: 위 표의 그림 14장, `docs/asset-requests/runner/DONE_68.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/arena-art.js`. 그 밖의 앱 코드, 게임 규칙, 코인, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 원본 PNG는 커밋하지 않는다(`/tmp/art/`). 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.
- 그림에 **글자 · 숫자 · 로고가 없다.** 경기장 배경에 펫 · 사람 · 캐릭터를 그리지 않는다(펫은 게임이 위에 놓는다). 경기장 바닥에 링 선을 그리지 않는다(게임이 링을 따로 그린다).
- 링 · 입장 효과 · 왕관 · 허수아비(68-3 ~ 68-5)는 **진짜 투명 배경**(PNG alpha → WebP alpha). 체크무늬 · 흰 상자가 그려져 있으면 다시 만든다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/68-1 …` ~ `68-5 …`: 시트 하나 = 프롬프트 하나. 묶음 전체는 `68-pet-arena-deco.txt`, 파일 자리는 `slice-map.csv`(`list` 열이 `68-pet-arena-deco.txt`). 프롬프트는 `build-68.mjs`가 만든다(손으로 고치지 말고 그 파일을 고쳐 다시 돌린다).
- 시트는 서로 따로 돌려도 된다. 68-1 → 68-2 순서로 돌리면 경기장 넷의 그림체가 잘 맞는다(뒤 시트에 앞 시트 결과도 붙인다).

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 아레나 그림 폴더 "SUMUS 펫 아레나 65 (Runner용)" · "SUMUS 펫 아레나 66 (Runner용)"를 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 펫 아레나 68 (Runner용)"에 정확한 파일 이름 "68-1.png" … "68-5.png"로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에:
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `WHEN DONE`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges, lighting, colors and the high camera angle exactly. The new pictures must look like they belong to the same pet arena. Do NOT copy or resemble any cartoon, anime, game or movie character, logo or effect.`

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 모든 시트 | `arena/bg-plaza.webp`(경기장 바닥 · 카메라 각도) · `arena/ult-icon.webp` · `arena/banner-win.webp`(65번 아이콘 그림체) |
| 68-1 · 68-2 | + `arena/bg-forest.webp` · `arena/bg-night.webp` · `arena/lobby-bg.webp`(같은 구도 · 같은 세계) |
| 68-3 · 68-4 | + `arena/fx-petal-field.webp` · `arena/fx-lightning.webp`(66번 효과 그림체) |
| 68-5 | + `arena/team-blue.webp` · `arena/fx-crit.webp` |

### 후보 점검 (모두 통과해야 쓴다)
1. 크기: 68-1 · 68-2는 1536×1536(왼쪽 · 오른쪽 반, 가운데 얇은 틈), 끝까지 칠해져 있다. 68-3 ~ 68-5는 1024×1024(2×2) 진짜 투명 배경. 글자 · 숫자 · 로고가 없다.
2. 경기장 4장: `arena/bg-plaza.webp`와 **같은 높은 카메라 각도**, 둥근 바닥이 가운데 아래(높이 약 60%)에 크게, 위 14% · 아래 20%는 차분하고 조금 어둡다. 바닥 가운데는 고르게 밝고 비어 있다(펫이 싸운다). 바닥에 링 선이 없다.
3. 링 4개: 가로가 세로의 약 2배인 타원 **테두리만**, 안쪽 · 바깥은 투명. 테두리는 얇다(폭의 6~8%).
4. 입장 효과 4개: 가운데가 열려 있거나 비친다(펫이 그 안에 나타난다). 120px로 줄여도 무엇인지 알아볼 수 있다.
5. 칸 사이 · 가장자리에 여백이 있어 자를 때 이웃 칸이 섞이지 않는다. 비우라고 한 칸은 비어 있다.
6. 화려하고 신나지만 무섭거나 징그럽지 않다(화산도 귀엽게).

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 넣기
```
npm i --no-save sharp   # 없으면
node -e "const s=require('sharp');s('/tmp/art/68-1.png').extract({left:0,top:0,width:768,height:1536}).resize(720,1080,{fit:'cover'}).webp({quality:80}).toFile('public/assets/arena/bg-sky.webp')"
node -e "const s=require('sharp');s('/tmp/art/68-1.png').extract({left:768,top:0,width:768,height:1536}).resize(720,1080,{fit:'cover'}).webp({quality:80}).toFile('public/assets/arena/bg-glacier.webp')"
node -e "const s=require('sharp');s('/tmp/art/68-2.png').extract({left:0,top:0,width:768,height:1536}).resize(720,1080,{fit:'cover'}).webp({quality:80}).toFile('public/assets/arena/bg-volcano.webp')"
node -e "const s=require('sharp');s('/tmp/art/68-2.png').extract({left:768,top:0,width:768,height:1536}).resize(720,1080,{fit:'cover'}).webp({quality:80}).toFile('public/assets/arena/bg-galaxy.webp')"
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/68-3.png arena/ring-flower arena/ring-rune arena/ring-gold arena/ring-star --trim --size 512
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/68-4.png arena/entry-smoke arena/entry-thunder arena/entry-flame arena/entry-rainbow --fit-each --size 384
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/68-5.png arena/pose-crown arena/dummy - - --fit-each --size 256
```
(가운데 틈이 한쪽으로 치우쳐 있으면 extract의 left · width를 틈에 맞춰 고친다. 가장자리 틈 몇 픽셀은 cover로 잘려도 된다.)
효과 · 링 그림은 한 장에 60KB 이하, 배경은 160KB 이하(넘으면 quality를 조금씩 낮춘다).

## 점검
```
npm ci
npm run build:assets      # public/modules/arena-art.js의 ARENA_ART에 bg-sky … dummy가 적힌다
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `docs/asset-requests/runner/DONE_68.md`(한국어): 넣은 그림 14장(경로 · 크기 · 용량), 다시 만든 횟수, "눈으로 확인 필요"(테스트 앱 아레나 → 경기장 꾸미기 탭 미리보기에서 경기장 · 링 · 입장 효과 · 왕관이 잘 보이는지, 연습장 허수아비가 바닥에 잘 서 있는지).
- PR 제목 `그림 68: 펫 아레나 경기장 꾸미기 · 연습장 (경기장 4 · 링 4 · 입장 효과 4 …)`, 본문 한국어. 시트 5장을 한 장에 모은 미리보기를 작게 PR 코멘트로 올린다. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.`
