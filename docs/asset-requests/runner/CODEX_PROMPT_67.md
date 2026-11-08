# Codex 작업 지시: 그림 67 (펫 아레나 경기 버튼 · 조이스틱 · 이모트 · 아이콘 35장)

## 목표
선생님 주문: "옆에 버튼들 퀄이 너무 떨어져. **에셋으로 만들자.**" 경기장 오른쪽 버튼(공격 · 스킬 ① · 스킬 ② · 필살기 · 회피 · 교체), 왼쪽 조이스틱 바닥 · 손잡이, 이모트 버튼을 게임다운 그림 버튼으로 바꾼다.
v13.233에서 CSS 버튼(금속 테두리 · 보석 바탕 · 원형 쿨타임 · 준비됨 빛)과 그림 자리를 먼저 만들어 두었다. **그림 파일만 넣으면 된다.**

| 시트 | 내용 | 넣는 곳(`public/assets/arena/`) | 자르기 |
|---|---|---|---|
| 67-1 | 버튼 바탕 4개(공격 · 필살기 · 회피 · 교체) | `ui-btn-atk` · `ui-btn-ult` · `ui-btn-dodge` · `ui-btn-swap` | `--trim --size 256` |
| 67-2 | 스킬 버튼 바탕 · 누름 · 쿨타임 · 준비됨 빛 | `ui-btn-skill` · `ui-btn-press` · `ui-btn-cd` · `ui-btn-ready` | `--trim --size 256` |
| 67-3 | 조이스틱 바닥 · 손잡이 · 이모트 버튼 바탕 | `ui-stick-base` · `ui-stick-knob` · `ui-btn-emote` | `--trim --size 256` |
| 67-4 | 버튼 아이콘 4개(칼 · 필살기 · 회피 · 교체) | `ui-ico-atk` · `ui-ico-ult` · `ui-ico-dodge` · `ui-ico-swap` | `--fit-each --size 256` |
| 67-5 | 스킬 ① 아이콘 4개(공격 · 강화 · 중독 · 지키기) | `ui-ico-burst` · `ui-ico-boost` · `ui-ico-poison` · `ui-ico-guard` | `--fit-each --size 256` |
| 67-6 | 스킬 ② 아이콘 불 · 물(불 뿜기 · 운석 · 물대포 · 방울 보호막) | `ui-s2-breath` · `ui-s2-meteor` · `ui-s2-jet` · `ui-s2-bubble` | `--fit-each --size 256` |
| 67-7 | 스킬 ② 아이콘 풀 · 땅(덩굴 · 꽃잎 · 바위 · 지진) | `ui-s2-vine` · `ui-s2-petal` · `ui-s2-boulder` · `ui-s2-crack` | `--fit-each --size 256` |
| 67-8 | 스킬 ② 아이콘 바람 · 얼음(회오리 · 질풍 베기 · 얼음 장판 · 얼음 창) | `ui-s2-tornado` · `ui-s2-gale` · `ui-s2-icefield` · `ui-s2-spear` | `--fit-each --size 256` |
| 67-9 | 스킬 ② 아이콘 독 · 별(독구름 · 독침 · 번개 · 분신) | `ui-s2-cloud` · `ui-s2-darts` · `ui-s2-chain` · `ui-s2-clone` | `--fit-each --size 256` |

`npm run build:assets`가 `public/modules/arena-art.js`(`ARENA_ART`)에 이름을 적고, 경기 화면의 같은 자리(버튼 바탕 · 아이콘 · 조이스틱 · 이모트)가 알아서 그림으로 바뀐다(`arena.js` uiArt · setIco, `v13233.css` .art-bg · .art-ico). 앱 코드는 고치지 않는다.
스킬 ① 아이콘은 스킬 종류(공격 burst · 강화 boost · 중독 poison · 지키기 guard), 스킬 ② 아이콘은 스킬 id(`EL_SKILLS`의 16개)로 고른다.

## 꼭 지킬 것
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 기존 아레나 그림(65 · 66번)을 참고 그림으로 붙인다.
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-67-arena-buttons`).
- 고치는 파일: 위 표의 그림 35장, `docs/asset-requests/runner/DONE_67.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/arena-art.js`. 그 밖의 앱 코드, 게임 규칙, 코인, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 원본 PNG는 커밋하지 않는다(`/tmp/art/`). 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.
- 그림에 **글자 · 숫자 · 로고가 없다**(버튼 이름 · 쿨타임 숫자는 앱이 쓴다). 펫 · 캐릭터를 그리지 않는다.
- 모든 시트는 **진짜 투명 배경**(PNG alpha → WebP alpha). 체크무늬 · 흰 상자가 그려져 있으면 다시 만든다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/67-1 …` ~ `67-9 …`: 시트 하나 = 프롬프트 하나. 묶음 전체는 `67-pet-arena-buttons.txt`, 파일 자리는 `slice-map.csv`(`list` 열이 `67-pet-arena-buttons.txt`). 프롬프트는 `build-67.mjs`가 만든다(손으로 고치지 말고 그 파일을 고쳐 다시 돌린다).
- 67-1 → 67-2 → 67-3 순서로 먼저 돌리고(테두리 · 크기가 맞아야 한다), 아이콘(67-4 ~ 67-9)은 따로 돌려도 된다(뒤 시트에 앞 시트 결과도 붙인다).

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 아레나 그림 폴더 "SUMUS 펫 아레나 65 (Runner용)"의 "65-2.png" · "65-5.png" · "65-6.png", "SUMUS 펫 아레나 66 (Runner용)"의 "66-1.png" … "66-4.png"를 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 펫 아레나 67 (Runner용)"에 정확한 파일 이름 "67-1.png" … "67-9.png"로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `WHEN DONE`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, gold trim, crisp clean edges, lighting and colors exactly. The buttons must look like they belong on the attached arena screen. Do NOT copy or resemble any cartoon, anime, game or movie character, logo, button or icon.`

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 모든 시트 | `arena/ult-icon.webp`(65번 금테 아이콘) · `arena/banner-win.webp` · `arena/bg-plaza.webp`(경기장) |
| 67-1 · 67-2 · 67-3 | + `arena/vs.webp`(같은 금빛 · 같은 에너지) |
| 67-4 · 67-5 | + `arena/fx-crit.webp` · `arena/fx-bubble.webp` |
| 67-6 ~ 67-9 | + 그 스킬의 66번 효과 그림(`arena/fx-flame-breath.webp` · `fx-meteor` · `fx-water-jet` · `fx-bubble` · `fx-vine` · `fx-petal-field` · `fx-boulder` · `fx-crack-field` · `fx-tornado` · `fx-ice-field` · `fx-ice-spear` · `fx-poison-cloud` · `fx-lightning` · `fx-clone`) |

### 후보 점검 (모두 통과해야 쓴다)
1. 크기: 시트는 1024×1024(2×2), 진짜 투명 배경. 글자 · 숫자 · 로고가 없다.
2. 칸 사이 · 가장자리에 여백이 있어 자를 때 이웃 칸이 섞이지 않는다. 비우라고 한 칸(67-3 오른쪽 아래)은 비어 있다.
3. 버튼 바탕(67-1 · 67-2 · 67-3)은 **정면에서 본 완전한 원**이고 같은 시트 안에서 지름이 같다. 바탕 가운데에 아이콘 · 무늬가 없다. 겹침(누름 · 쿨타임 · 준비됨 빛)은 가운데가 비치거나(누름 · 빛) 고르게 반투명(쿨타임)이다.
4. 아이콘(67-4 ~ 67-9)은 **아이콘만**(동그란 버튼 · 바탕 원판 없음). 40px로 줄여도 무슨 버튼 · 스킬인지 알아볼 수 있다.
5. `arena/bg-plaza.webp` 위 · 서로 옆에 놓았을 때 65 · 66번 그림과 같은 게임처럼 보인다.

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 넣기
```
npm i --no-save sharp   # 없으면
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/67-1.png arena/ui-btn-atk arena/ui-btn-ult arena/ui-btn-dodge arena/ui-btn-swap --trim --size 256
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/67-2.png arena/ui-btn-skill arena/ui-btn-press arena/ui-btn-cd arena/ui-btn-ready --trim --size 256
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/67-3.png arena/ui-stick-base arena/ui-stick-knob arena/ui-btn-emote - --trim --size 256
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/67-4.png arena/ui-ico-atk arena/ui-ico-ult arena/ui-ico-dodge arena/ui-ico-swap --fit-each --size 256
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/67-5.png arena/ui-ico-burst arena/ui-ico-boost arena/ui-ico-poison arena/ui-ico-guard --fit-each --size 256
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/67-6.png arena/ui-s2-breath arena/ui-s2-meteor arena/ui-s2-jet arena/ui-s2-bubble --fit-each --size 256
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/67-7.png arena/ui-s2-vine arena/ui-s2-petal arena/ui-s2-boulder arena/ui-s2-crack --fit-each --size 256
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/67-8.png arena/ui-s2-tornado arena/ui-s2-gale arena/ui-s2-icefield arena/ui-s2-spear --fit-each --size 256
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/67-9.png arena/ui-s2-cloud arena/ui-s2-darts arena/ui-s2-chain arena/ui-s2-clone --fit-each --size 256
```
한 장에 40KB 이하(넘으면 quality를 조금씩 낮춘다).

## 점검
```
npm ci
npm run build:assets      # public/modules/arena-art.js의 ARENA_ART에 ui-btn-atk … 이 적힌다
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `docs/asset-requests/runner/DONE_67.md`(한국어): 넣은 그림 35장(경로 · 크기 · 용량), 다시 만든 횟수, "눈으로 확인 필요"(테스트 앱 아레나에서 버튼 · 조이스틱 · 이모트가 그림으로 바뀌었는지, 누를 때 · 쿨타임 · 필살기 준비 때 모양).
- 폰 390px 경기 화면 스크린샷(`node docs/arena-perf.mjs --cpu 1 --seconds 15 --shot /tmp/after.png`)을 작게 PR 코멘트로 올린다.
- PR 제목 `그림 67: 펫 아레나 경기 버튼 · 조이스틱 · 아이콘`, 본문 한국어. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.`
