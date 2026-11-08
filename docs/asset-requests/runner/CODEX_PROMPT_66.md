# Codex 작업 지시: 그림 66 (펫 아레나 2탄 ② 스킬 연출 그림 19장)

## 목표
펫 아레나 새 스킬 16개(불 뿜기 · 물대포 · 운석 · 덩굴 · 회오리 · 얼음 창 · 독구름 · 번개 · 분신 …)의 연출 그림과 친구 대전용 배경 · 깃발을 만들어 넣고 PR을 만든다.
선생님 주문: "스킬이 더 **화끈하고 화려했음** 좋겠어. 막 불 뿜고 물대포 하고." 구성안은 `docs/pet-arena-v2-plan.md` 4장 · 7장.

| 시트 | 내용 | 넣는 곳(`public/assets/arena/`) | 자르기 |
|---|---|---|---|
| 66-1 | 긴 줄기 4: 불 뿜기 · 물대포 · 번개 · 얼음 창(왼쪽에서 오른쪽으로 뻗음) | `fx-flame-breath` · `fx-water-jet` · `fx-lightning` · `fx-ice-spear` | `--trim --size 512` |
| 66-2 | 덩어리 4: 운석 · 굴러가는 바위 · 방울 보호막 · 치명타 별 | `fx-meteor` · `fx-boulder` · `fx-bubble` · `fx-crit` | `--fit-each --size 256` |
| 66-3 | 바닥 장판 4(가로로 긴 타원): 꽃잎 회복장 · 갈라진 땅 · 얼음판 · 독구름 | `fx-petal-field` · `fx-crack-field` · `fx-ice-field` · `fx-poison-cloud` | `--trim --size 384` |
| 66-4 | 덩굴 · 회오리 기둥 · 분신 별가루(오른쪽 아래 칸은 비움) | `fx-vine` · `fx-tornado` · `fx-clone` | `--fit-each --size 256` |
| 66-5 | 친구 대전 대기실 배경(세로 한 장) | `lobby-bg` (720×1080) | `resize(720,1080,{fit:'cover'})` |
| 66-6 | 2:2 · 1:1:1 VS 화면 배경(세로 한 장) | `vs-2v2` (720×1080) | `resize(720,1080,{fit:'cover'})` |
| 66-7 | 팀 깃발 파랑 · 빨강(아래 두 칸은 비움) | `team-blue` · `team-red` | `--fit-each --size 256` |

**그림 파일만 넣으면 된다.** `npm run build:assets`가 `public/modules/arena-art.js`(`ARENA_ART`)에 이름을 적고, 아레나 화면의 같은 자리(지금은 CSS로 그린 불꽃 · 물줄기 · 장판)가 알아서 그 그림으로 바뀐다. 앱 코드는 고치지 않는다.

## 꼭 지킬 것
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 기존 아레나 그림(65번)을 참고 그림으로 붙인다.
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-66-arena-skills`).
- 고치는 파일: 위 표의 그림 19장, `docs/asset-requests/runner/DONE_66.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/arena-art.js`. 그 밖의 앱 코드, 게임 규칙, 코인, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 원본 PNG는 커밋하지 않는다(`/tmp/art/`). 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.
- 그림에 **글자 · 숫자 · 로고가 없다.** 효과 그림 안에 펫 · 캐릭터를 그리지 않는다(펫은 게임이 위에 놓는다).
- 효과 그림(66-1 ~ 66-4 · 66-7)은 **진짜 투명 배경**(PNG alpha → WebP alpha). 체크무늬 · 흰 상자가 그려져 있으면 다시 만든다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/66-1 …` ~ `66-7 …`: 시트 하나 = 프롬프트 하나. 묶음 전체는 `66-pet-arena-skills.txt`, 파일 자리는 `slice-map.csv`(`list` 열이 `66-pet-arena-skills.txt`). 프롬프트는 `build-66.mjs`가 만든다(손으로 고치지 말고 그 파일을 고쳐 다시 돌린다).
- 시트는 서로 따로 돌려도 된다. 66-1 → 66-2 → 66-3 순서로 돌리면 색이 잘 맞는다(뒤 시트에 앞 시트 결과도 붙인다).

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 아레나 그림 폴더 "SUMUS 펫 아레나 65 (Runner용)"의 "65-2.png" · "65-5.png" · "65-6.png"를 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 펫 아레나 66 (Runner용)"에 정확한 파일 이름 "66-1.png" … "66-7.png"로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `WHEN DONE`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges, lighting and colors exactly. The effects must look like they belong on the attached arena floor, seen from the same high camera angle. Do NOT copy or resemble any cartoon, anime, game or movie character, logo or effect.`

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 모든 시트 | `arena/bg-plaza.webp`(경기장 바닥) · `arena/ult-icon.webp` · `arena/fx-faint.webp` · `arena/banner-win.webp`(65번 아이콘 그림체) |
| 66-1 · 66-2 · 66-4 | + `battle/bg-arena.webp`(야차전 효과가 놓이는 바닥) |
| 66-3 | + `arena/bg-forest.webp` · `arena/bg-night.webp`(장판이 세 경기장 모두에서 잘 보이는지) |
| 66-5 · 66-6 | + `arena/vs.webp` · `arena/entry.webp`(같은 세계 · 같은 에너지) |
| 66-7 | + `arena/banner-win.webp` · `arena/banner-lose.webp` |

### 후보 점검 (모두 통과해야 쓴다)
1. 크기: 시트는 1024×1024(2×2), 66-5 · 66-6은 1024×1536. 효과 시트는 진짜 투명 배경, 배경 두 장은 끝까지 칠해져 있다. 글자 · 숫자 · 로고가 없다.
2. 칸 사이 · 가장자리에 여백이 있어 자를 때 이웃 칸이 섞이지 않는다. 비우라고 한 칸은 비어 있다.
3. 66-1의 줄기 4개는 **왼쪽 끝에서 시작해 오른쪽으로** 뻗는다(게임이 이 방향을 기준으로 돌린다). 66-3 장판은 가로가 세로의 약 2배인 타원이다.
4. 120px로 줄여도 무슨 스킬인지 알아볼 수 있고, `arena/bg-plaza.webp` 위에 올려 봐도 바닥에 묻히지 않는다.
5. 화끈하고 화려하다(밝은 중심 · 진한 색 · 또렷한 모양). 무섭거나 징그럽지 않다.

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 넣기
```
npm i --no-save sharp   # 없으면
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/66-1.png arena/fx-flame-breath arena/fx-water-jet arena/fx-lightning arena/fx-ice-spear --trim --size 512
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/66-2.png arena/fx-meteor arena/fx-boulder arena/fx-bubble arena/fx-crit --fit-each --size 256
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/66-3.png arena/fx-petal-field arena/fx-crack-field arena/fx-ice-field arena/fx-poison-cloud --trim --size 384
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/66-4.png arena/fx-vine arena/fx-tornado arena/fx-clone - --fit-each --size 256
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/66-7.png arena/team-blue arena/team-red - - --fit-each --size 256
node -e "require('sharp')('/tmp/art/66-5.png').resize(720,1080,{fit:'cover'}).webp({quality:80}).toFile('public/assets/arena/lobby-bg.webp')"
node -e "require('sharp')('/tmp/art/66-6.png').resize(720,1080,{fit:'cover'}).webp({quality:80}).toFile('public/assets/arena/vs-2v2.webp')"
```
효과 그림은 한 장에 60KB 이하, 배경은 160KB 이하(넘으면 quality를 조금씩 낮춘다).

## 점검
```
npm ci
npm run build:assets      # public/modules/arena-art.js의 ARENA_ART에 fx-flame-breath … 이 적힌다
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `docs/asset-requests/runner/DONE_66.md`(한국어): 넣은 그림 19장(경로 · 크기 · 용량), 다시 만든 횟수, "눈으로 확인 필요"(테스트 앱 아레나에서 불 뿜기 · 물대포 줄기가 펫 입에서 상대 쪽으로 뻗는지, 장판이 바닥에 잘 보이는지).
- PR 제목 `그림 66: 펫 아레나 스킬 연출 (불 뿜기 · 물대포 · 장판 …)`, 본문 한국어. 시트 7장을 한 장에 모은 미리보기를 작게 PR 코멘트로 올린다. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.`
