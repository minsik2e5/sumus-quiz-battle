# Codex 작업 지시: 그림 50 (레벨 칭호 Lv.65~100 · 메달 8개 · 2시트)

## 목표
칭호 3탄(`docs/titles-plan.md`)에 쓸 칭호 메달 8개를 만들고, 잘라서 `public/assets/titles/`에 넣은 뒤 PR을 만든다.
메달마다 **256px 본그림(`<key>.webp`)과 96px 작은 그림(`<key>-s.webp`)** 두 장이다(16장).
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.**

> ⚠️ **이 그림만으로는 새 칭호가 앱에 나오지 않는다.** 칭호 등록(`public/modules/titles.js` TITLES · `emblems.js` TITLE_ART)은 다음 세션에서 코드로 한다. 그림만 먼저 들어와도 앱은 바뀌지 않고 깨지지 않는다(아무 곳에서도 이 파일을 부르지 않는다). 선생님 결정: 칭호는 그림이 오면 코드와 **같이 머지**한다.

| 시트 | 칸 | 칭호 key | 이름 | 등급 |
|---|---|---|---|---|
| `50-1` | 왼쪽 위 | `level65` | 한계 돌파 | 영웅 |
| `50-1` | 오른쪽 위 | `level70` | 일흔 계단 | 영웅 |
| `50-1` | 왼쪽 아래 | `level75` | 단어 곳간지기 | 영웅 |
| `50-1` | 오른쪽 아래 | `level80` | 불꽃 학습자 | 전설 |
| `50-2` | 왼쪽 위 | `level85` | 별빛 여행자 | 전설 |
| `50-2` | 오른쪽 위 | `level90` | 지식의 탑 | 전설 |
| `50-2` | 왼쪽 아래 | `level95` | 전설 직전 | 전설 |
| `50-2` | 오른쪽 아래 | `level100` | 백 레벨의 전설 | 한정 |

- 시트와 칸마다 넣을 파일은 `slice-map.csv`에서 `list` 열이 `50-titles-level.txt`인 줄을 본다. 앱은 `public/assets/titles/<key>.webp` · `<key>-s.webp`를 그대로 찾는다. **key를 바꾸지 않는다.**
- 메달 **테두리(모양 · 테두리 · 법랑 색)는 등급**이다: 일반 민트 동그라미 · 희귀 파란 육각형 · 영웅 보라 방패 · 전설 금빛 햇살 · 한정 무지개. 같은 등급의 기존 메달과 테두리가 **똑같아야** 한다.

## 꼭 지킬 것
- **기존 칭호 메달(11 · 25번)과 같은 그림체**로 맞춘다. 더 흐리거나 뿌옇거나 수채화처럼 만들지 않는다. 기존 메달의 가운데 그림은 베끼지 않는다.
- 메달에 **글자 · 숫자 · 로고를 넣지 않는다**(Lv.100 트로피의 앞판도 비워 둔다: 숫자는 앱이 쓴다. 과 번호 · 레벨 숫자도 그리지 않는다). 배경 · 바닥 그림자 · 체크무늬가 없다(진짜 투명).
- 48px로 줄여도 알아볼 수 있는 큰 가운데 그림.
- **한 번에 시트 하나(메달 4개)씩** 만든다. 2시트를 한 장에 몰아 그리지 않는다.
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** Codex에는 Drive가 없다. 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 기존 메달 그림을 참고 그림으로 붙인다.
- 고치는 파일: `public/assets/titles/` 아래 **새 그림**, 빌드가 바꿀 수 있는 `public/sw.js`, `docs/asset-requests/runner/DONE_50.md`. 그 밖의 앱 코드, 게임 규칙, 코인, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다. 원본 시트 PNG는 커밋하지 않는다(`/tmp/art/`).
- **브랜치:** `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-50`). 그 브랜치에 `docs/asset-requests/runner/50-titles-level.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/titles-plan`에서 시작하고 PR 대상도 그 브랜치로 한다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/50-1 …` ~ `50-2 …`: 시트 하나 = 프롬프트 하나. 묶음 전체는 `50-titles-level.txt`.
- `slice-map.csv`: 칸 이름 · 앱 파일. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.
- 보내는 순서: `50-1` → `50-2`. 첫 시트가 먼저 있어야 뒤 시트가 맞출 수 있다.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
시트 프롬프트(`split/`)는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 칭호 메달 11 · 25번을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 칭호 50 (Runner용)"에 정확한 파일 이름 "50-1.png" … 으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 고친다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림(저장소 안 기존 메달)을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: they are title medals already in this game. Match their art style, glossy metal and enamel, medal size in the cell, crisp clean edges and colors exactly. A medal of the same tier must have exactly the same frame as the reference of that tier. Do NOT copy the center pictures of the references.`
3. `50-2`부터는 참고 그림에 방금 만든 첫 시트 `/tmp/art/50-1.png`도 같이 붙인다(마감 · 칸 안 크기를 맞춘다. 가운데 그림은 베끼지 않는다).

### 참고 그림 (`public/assets/` 아래 경로, 시트에 나오는 등급만)
| 등급 | 참고 그림 |
|---|---|
| 영웅 | `titles/words1000.webp`, `titles/unit3.webp` |
| 전설 | `titles/words3000.webp`, `titles/level60.webp` |
| 한정 | `titles/mythic1.webp`, `titles/weekly1.webp` |
| 모든 시트 | `titles/preview-25.webp` (칭호 2탄 40개를 한 장에 모은 그림: 메달 가족 전체 느낌) |
| 50-2 이후 | `/tmp/art/50-1.png` (같은 묶음의 첫 시트) |

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음).
2. 칸마다 메달이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 로고, 바닥 그림자가 없다.
3. 칸마다 테두리가 표의 등급과 같고, 같은 등급의 기존 메달(참고 그림)과 테두리 모양 · 색이 같다.
4. 기존 메달과 나란히 놓아도 같은 게임 그림처럼 보이고, 48px로 줄여도 가운데 그림을 알아볼 수 있다.

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1~2번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트 1024×1024, **투명 배경 PNG**, 칸마다 메달 하나.
- 만든 그림은 `/tmp/art/<시트 번호>.png`로 저장한다(예: `/tmp/art/50-1.png`). 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- 한 번에 다 못 만들면 **시트 단위**로 끊는다. 못 만든 시트는 `DONE_50.md`의 "넣지 못한 그림"에 적는다.

## 2. 자르고 넣기
기존 메달과 같은 규격(256px 본그림 + 96px 작은 그림, 투명 webp, 칸마다 같은 크기 `--fit-each`)으로 자른다.
```
R=docs/asset-requests/runner
node $R/fit-assets.mjs /tmp/art/50-1.png titles/level65 titles/level70 titles/level75 titles/level80 --fit-each --small 96 --preview /tmp/review/50-1.png
node $R/fit-assets.mjs /tmp/art/50-2.png titles/level85 titles/level90 titles/level95 titles/level100 --fit-each --small 96 --preview /tmp/review/50-2.png
```
- 칸 이름은 `slice-map.csv`의 `app_file`과 같아야 한다(키가 틀리면 앱이 그림을 못 찾는다).
- 한 칸이 점검을 통과하지 못하면 그 칸 이름을 `-`로 주어 버리고, 그 메달만 다시 만든다.

## 3. 마무리
```
npm ci
npm run build:assets
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `docs/asset-requests/runner/DONE_50.md`(한국어): 넣은 메달 표(시트 · 칸 · 칭호 · 파일 · 다시 만든 횟수), 넣지 못한 것과 이유, "눈으로 확인 필요". 마지막에 "새 칭호는 코드 등록(TITLES · TITLE_ART, 다음 세션) 후에 앱에 나온다"를 적는다.
- PR 제목 `그림 50: 레벨 칭호 Lv.65~100 메달 8개`, 본문 한국어. 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 작게 합쳐 PR 코멘트로 올린다. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.`
