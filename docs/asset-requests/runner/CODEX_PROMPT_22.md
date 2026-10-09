# Codex 작업 지시: 그림 22 · 23 (기말고사 지옥 던전: 몬스터 · 보스 · 배경 · UI · 칭호)

## 목표
SUMUS VOCA(저장소 `minsik2e5/sumus-quiz-battle`)의 그림 주문서 22(던전 몬스터)와 23(던전 배경 · UI · 칭호)으로 **3명이 같이 싸우는 던전 모드**에 필요한 그림을 만들고, 잘라서 `public/assets/`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다**(던전 엔진 · 방 · 화면 · 칭호 등록은 Claude가 따로 한다).

던전은 "기말고사 지옥" 테마(밤의 학교, 시험지 · 빨간펜 · 책이 괴물이 된 모습)다. 중·고등학생이 몰입하는 **으스스하지만 귀여운** 느낌이고, 피나 잔인한 표현은 넣지 않는다.

## 몬스터 목록 (일반 15종 + 보스 1종)
앱이 읽는 key와 **크기 분류**다(크기는 앱이 화면에 그릴 때 곱하는 배율 분류이고, 그림은 모두 같은 크기로 그려서 자른다). 층마다 크기에 맞는 몬스터가 무작위로 나온다.

| 필수(먼저) | key | 이름(임시) | 크기 | 나오는 층 | 설정 시트 |
|---|---|---|---|---|---|
| ● | `nightzombie` | 밤샘 좀비 | M | 1~2층 | 22a-1~2 |
| ● | `redpenghost` | 빨간펜 귀신 | M | 2~3층 | 22a-3~4 |
| ● | `wrongmummy` | 오답노트 미라 | M | 2~3층 | 22a-5~6 |
| ● | `testspider` | 시험지 거미 | M | 3~4층 | 22a-7~8 |
| ● | `omrreaper` | OMR 사신 | L | 4~5층 | 22a-9~10 |
|  | `chalkangler` | 칠판 아귀 | L | 3~5층 | 22a-11~12 |
|  | `nightbat` | 야자 박쥐 | S | 1~2층 | 22a-13~14 |
|  | `blinkjelly` | 깜빡 해파리 | M | 2~4층 | 22a-15~16 |
|  | `bagturtle` | 책가방 거북 | L | 3~5층 | 22a-17~18 |
|  | `cheatninja` | 커닝 닌자 | S | 1~3층 | 22a-19~20 |
|  | `labskeleton` | 과학실 해골 | M | 2~4층 | 22a-21~22 |
|  | `pianofang` | 피아노 마귀 | L | 4~5층 | 22a-23~24 |
|  | `homeworkogre` | 수행평가 오거 | L | 3~5층 | 22a-25~26 |
|  | `gatehound` | 교문 불독 | L | 3~5층 | 22a-27~28 |
|  | `sandwitch` | 모래시계 마녀 | M | 2~4층 | 22a-29~30 |
| ● | `killergolem` | 킬러 골렘(보스) | 보스 | 보스방 | 22b-1~3 |

- 일반 몬스터 한 마리 = 시트 2장 = **8포즈**: 기본 `<key>` · 기본2 `-idle2` · 준비 `-windup` · 공격 `-attack` (첫 시트) / 공격2 `-attack2` · 스킬 `-skill` · 맞음 `-hurt` · 쓰러짐 `-down` (둘째 시트). 기본 · 공격 · 맞음 · 쓰러짐은 기존 몬스터와 같은 파일 이름이다.
- 보스 `killergolem` = 시트 3장 = **12포즈**: 위 8포즈 + 분노 기본 `-rage` · 핵 노출 `-core` · 포효 `-roar` · 핵 맞음 `-corehurt`(22b-3).
- 다른 주문서: `23a` 던전 배경 8장(가로 한 장씩) · `23b` UI 아이콘 5시트 20개 · `23c` 칭호 메달 2시트 8개.

| 주문서 | 시트 | 내용 |
|---|---|---|
| 22a | 30 | 일반 몬스터 15종 × 2시트 |
| 22b | 3 | 보스 킬러 골렘 |
| 23a | 8 | 배경: 입구 · 1~5층 · 보스방 · 만점 모드(무한 탑) |
| 23b | 5 | UI 아이콘: 등급컷 배지 · 입구·보상 · 전투 상태 · 보스 패턴 · 메뉴·파티 |
| 23c | 2 | 던전 칭호 메달 8개 |

넣을 파일은 **176개**: 몬스터 포즈 132(15 × 8 + 12) + 배경 8 + UI 20 + 칭호 8 + 칭호 작은 그림 8.

## 꼭 지킬 것
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다.
  - 그 브랜치에 `docs/asset-requests/runner/22a-dungeon-monsters.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `feat/dungeon-art-order-21-23`에서 시작한다.
  - 파일이 많으므로 **PR을 둘로 나눠도 된다.** 먼저 ● 필수 6종(보스 포함) + 배경 + UI + 칭호(`codex/art-22`), 그다음 여유분 10종(`codex/art-22-spare`). 둘째 PR은 첫 PR의 브랜치에서 시작하거나 첫 PR이 머지된 뒤에 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** 머지하면 운영에 바로 배포된다.
- **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- `public/assets/monsters/`, `public/assets/dungeon/`, `public/assets/ui/`, `public/assets/titles/` 아래 **새 파일**과 `DONE_22.md`, 빌드가 바꾸는 `public/sw.js` 말고는 고치지 않는다. 앱 코드, 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다. 임시 폴더(`/tmp/art/`)에 둔다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. 기존 몬스터 18종(`slime`, `golem` 등)의 파일은 건드리지 않는다. 이번 작업은 **새 파일만 추가**한다.
- **실제 만화·게임 캐릭터를 따라 그리지 않는다.** 모든 몬스터는 주문서 설명대로의 새 디자인이다. 기존 몬스터와 닮지 않게(까먹귀 ≠ 빨간펜 귀신, 문법 골렘 ≠ 킬러 골렘, 째깍 도둑 ≠ 모래시계 마녀) 그린다.
- 무서운 이빨, 피, 해골 얼굴을 그리지 않는다(과학실 해골은 깨끗하고 귀여운 인체 모형 뼈다). 입이 있는 몬스터는 이빨을 둥글게 그린다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/` 폴더: 시트 하나 = 프롬프트 하나(예: `split/22a-1 던전 몬스터 밤샘 좀비 1 (기본·준비·공격).txt`).
- `slice-map.csv`: 각 칸의 이름(`key`)과 앱 파일(`app_file`). `list` 열이 `22a-…`~`23c-…`인 줄만 본다. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`(이번에 `--scale-max` 옵션이 생겼다. 사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다. Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `STYLE AND CHARACTER REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림이 있으면 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same character, keep its face, colors, markings and accessories exactly. Do NOT copy any other animal or character shown in the references. Do NOT make it softer, blurrier or more painterly than the references.`

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트(22a · 22b · 23b · 23c): 1024×1024, **투명 배경 PNG**. 배경(23a): **1536×1024 가로 한 장, 투명 아님**, 가장자리까지 꽉 채운다.
- 만든 그림은 `/tmp/art/<시트 번호>.png`로 저장한다(예: `/tmp/art/22a-1.png`).
- 결과가 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- 투명 배경이 안 나오고 흰색이나 단색 배경으로 나오면, 시트 둘레가 그 단색일 때만 그 색을 투명으로 바꿔도 된다(`sharp` 등으로). 그림 안쪽 색은 건드리지 않는다. 체크무늬를 그려 넣은 그림은 다시 만든다.
- **순서를 지킨다.** 몬스터마다 첫 시트(홀수 번호)를 먼저 만들고, 둘째 시트(짝수 번호)는 그 첫 시트를 참고 그림으로 열어 같은 디자인·같은 몸 크기로 그린다. 보스는 `22b-1` → `22b-2` → `22b-3`.
- 한 번에 다 만들 수 없으면 **몬스터 한 마리를 끝까지** 만든 단위로 끊는다. 필수 ●를 먼저, 못 만든 시트는 `DONE_22.md`의 "넣지 못한 그림"에 적는다.

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 22a · 22b 첫 시트 | `monsters/golem.webp`, `monsters/mockhydra.webp`, `monsters/finalking.webp`, `pets/panda-3.webp` (그림체와 마감. 이 몬스터들을 베끼지 않는다) |
| 22a 둘째 시트 · 22b-2~3 | 같은 몬스터의 첫 시트 그림 `monsters/<key>.webp`, `monsters/<key>-attack.webp` |
| 23a 배경 | `battle/bg-boss.webp`, `battle/bg-forest.webp` (그림체와 바닥 구도. 둘째 배경부터는 `dungeon/bg-gate.webp`도) |
| 23b UI | `ui/monster-hard.webp`, `ui/monster-stage-boss.webp`, `ui/monster-tab.webp` |
| 23c 칭호 | `titles/rookie.webp`, `titles/streak3.webp`, `ui/monster-stage-clear.webp` (메달 틀과 금속 마감) |

### 후보 점검 (모두 통과해야 쓴다)
1. **2×2 시트**: 배경이 진짜 투명이다. 네 모서리 alpha가 0이고, 체크무늬나 흰 상자를 그려 넣지 않았다. 흰 테두리(halo)가 없다.
2. 칸마다 그림이 하나씩 따로 있고, 서로 겹치거나 잘리지 않았다. 글자, 숫자, 테두리, 바닥 그림자가 없다.
3. 같은 시트의 칸들은 같은 디자인이다. 22a는 **8포즈가 한 세트로 보여야** 한다(몸 크기와 색이 포즈마다 같아야 한다).
4. 시트별 점검
   - **몬스터**: 모두 **왼쪽(플레이어 쪽)을 본다.** 기본과 기본2는 같은 자세에서 숨 쉬듯 조금만 다르다. 준비는 오른쪽으로 웅크린 자세, 공격1·2는 서로 다른 동작이다. 쓰러짐은 우스꽝스럽고 슬프지 않다. 읽을 수 있는 글자가 없다.
   - **보스**: 가장 크고 위엄 있다. 분노 기본은 불꽃이 커지고 눈이 빨갛다. 핵 노출은 가슴 패널이 열려 큰 핵이 보이고, 핵 맞음은 핵이 하얗게 번쩍인다.
   - **배경(23a)**: 캐릭터·동물·글자가 없다. 큰 몬스터가 설 오른쪽 위와 펫 셋이 설 왼쪽 아래 바닥이 평평하고 비어 있다. 위 15%와 오른쪽 아래 4분의 1은 차분하다. 8장이 같은 그림체이고 밝기는 캐릭터가 잘 보일 정도다.
   - **UI(23b)**: 아이콘 하나가 칸 하나. 글자·숫자가 없다. 등급컷 배지는 청동 → 은 → 금 → 다이아 순으로 점점 화려하다.
   - **칭호(23c)**: 둥근 에나멜 메달이고 테두리 금속이 등급(청동 · 은 · 금 · 무지개)을 보여 준다. 글자·숫자 없음.

이미지를 볼 수 있으면 4번은 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
# 22a 일반 몬스터: 시트 둘이 같은 배율이어야 한다(포즈를 바꿔 끼워도 크기가 튀지 않게).
#  1) 두 시트를 한 번씩 자른다. 각 줄에 "scale 0.xxxx"가 출력된다.
node $R/fit-assets.mjs <22a-1> monsters/nightzombie monsters/nightzombie-idle2 monsters/nightzombie-windup monsters/nightzombie-attack --stand-same --preview /tmp/review/22a-1.png
node $R/fit-assets.mjs <22a-2> monsters/nightzombie-attack2 monsters/nightzombie-skill monsters/nightzombie-hurt monsters/nightzombie-down --stand-same --preview /tmp/review/22a-2.png
#  2) 두 값 중 작은 값을 큰 쪽 시트에 --scale-max로 줘서 그 시트만 다시 자른다.
#     예) 22a-1이 0.9100, 22a-2가 0.8200이면 22a-1을 다시: ... --stand-same --scale-max 0.8200
#  나머지 몬스터도 같은 모양이다(key와 시트 번호는 위 표, 칸 이름은 slice-map.csv의 key).
# 22b 보스 3시트: 셋 중 가장 작은 scale을 나머지 두 시트에 --scale-max로 준다.
node $R/fit-assets.mjs <22b-1> monsters/killergolem monsters/killergolem-idle2 monsters/killergolem-windup monsters/killergolem-attack --stand-same --preview /tmp/review/22b-1.png
node $R/fit-assets.mjs <22b-2> monsters/killergolem-attack2 monsters/killergolem-skill monsters/killergolem-hurt monsters/killergolem-down --stand-same --preview /tmp/review/22b-2.png
node $R/fit-assets.mjs <22b-3> monsters/killergolem-rage monsters/killergolem-core monsters/killergolem-roar monsters/killergolem-corehurt --stand-same --preview /tmp/review/22b-3.png
# 23b UI (256px)
node $R/fit-assets.mjs <23b-1> ui/dungeon-rank3 ui/dungeon-rank2 ui/dungeon-rank1 ui/dungeon-perfect --fit-each --preview /tmp/review/23b-1.png
node $R/fit-assets.mjs <23b-2> ui/dungeon-door ui/dungeon-door-open ui/dungeon-chest ui/dungeon-chest-open --fit-each --preview /tmp/review/23b-2.png
node $R/fit-assets.mjs <23b-3> ui/dungeon-faint ui/dungeon-revive ui/dungeon-gauge ui/dungeon-ultimate --fit-each --preview /tmp/review/23b-3.png
node $R/fit-assets.mjs <23b-4> ui/dungeon-mark ui/dungeon-core ui/dungeon-break ui/dungeon-hourglass --fit-each --preview /tmp/review/23b-4.png
node $R/fit-assets.mjs <23b-5> ui/dungeon-tab ui/dungeon-slot ui/dungeon-invite ui/dungeon-record --fit-each --preview /tmp/review/23b-5.png
# 23c 칭호 (큰 그림 256px + 작은 그림 96px)
node $R/fit-assets.mjs <23c-1> titles/dungeon-first titles/dungeon-rank3 titles/dungeon-rank2 titles/dungeon-rank1 --fit-each --small 96 --preview /tmp/review/23c-1.png
node $R/fit-assets.mjs <23c-2> titles/dungeon-perfect titles/dungeon-flawless titles/dungeon-record titles/dungeon-hunter --fit-each --small 96 --preview /tmp/review/23c-2.png
```
- **배경(23a)**: 고른 PNG를 1280×853 webp로 줄여 `public/assets/dungeon/<이름>.webp`로 저장한다(`mkdir -p public/assets/dungeon`). 한 장에 **200KB 이하**가 목표이고, 넘으면 `quality`를 낮춰 다시 저장한다.
  ```
  sharp(src).resize(1280, 853, { fit: 'cover' }).webp({ quality: 80, effort: 6 })
  ```
  이름: `23a-1` → `bg-gate`, `23a-2` → `bg-f1`, `23a-3` → `bg-f2`, `23a-4` → `bg-f3`, `23a-5` → `bg-f4`, `23a-6` → `bg-f5`, `23a-7` → `bg-boss`, `23a-8` → `bg-endless`
- 도구가 "배경이 투명하지 않아요"나 "칸이 비어 있어요"로 멈추면 그 시트는 1단계로 돌아가 다시 만든다. 몬스터 그림은 한 장에 80KB 이하가 목표다.

## 3. 기록
- `docs/asset-requests/runner/DONE_22.md`를 한국어로 쓴다.
  - 몬스터별 넣은 포즈 표(시트 번호와 포즈 개수. 보스는 12포즈)
  - 배경 · UI · 칭호 표와 파일 크기
  - 넣지 못한 그림과 이유
  - 시트마다 다시 만든 횟수
  - 두 시트를 같은 배율로 맞춘 `scale` 값(몬스터마다 한 줄)
  - "눈으로 확인 필요" 항목
- 앱 코드가 아직 새 그림을 쓰지 않으니 버전은 올리지 않는다. 새 파일만 추가하므로 머지해도 앱 화면은 바뀌지 않는다는 점을 PR에 적는다.

## 4. 점검
```
npm ci
npm run build:assets
npm run check            # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 그림 개수나 크기 때문에 실패하면 점검 파일을 고치지 말고, PR에 실패 메시지를 그대로 적는다.
- 로컬 Windows 체크아웃은 줄바꿈이 CRLF라 `V13.99 battle.js sends idx …` 같은 기존 검사가 실패할 수 있다. 이 경우 줄바꿈을 LF로 바꿔(`git ls-files public server docs | grep -E '\.(js|mjs|css|html|json|csv|txt|md)$' | xargs sed -i 's/\r$//'`) 다시 돌리고, PR의 GitHub `release-check` 결과를 함께 적는다.
- `V13.82 five games a day`는 한국 시간 자정 10분 전에 돌리면 실패하는 시간 문제다(몬스터와 무관). 그 시간대에 실패하면 10분 뒤 다시 돌린다.
- `git status`로 바뀐 파일을 확인한다. `public/assets/monsters/`, `public/assets/dungeon/`, `public/assets/ui/`, `public/assets/titles/`(새 파일만), `public/sw.js`(빌드가 바꿈), `DONE_22.md`만 바뀌어야 한다.
- 기존 그림이 지워지거나 바뀌지 않았는지 확인한다. `D`(삭제)와 `M`(수정)이 하나도 없어야 한다.
  ```
  git diff --name-status origin/sumus-voca-prod-deploy -- public/assets
  ```
- 그림 개수를 센다: 일반 몬스터 15종 × 8 = 120 + 보스 12 + 배경 8 + UI 20 + 칭호 8 + 칭호 작은 그림 8 = **176개**.

## 5. PR
- 대상: `sumus-voca-prod-deploy`
- 제목: `그림 22·23: 기말고사 지옥 던전 몬스터 · 킬러 골렘 · 배경 · UI · 칭호` (둘로 나누면 `… (필수 6종)`, `… (여유분 10종)`)
- 본문은 한국어로 쓴다. 넣은 그림 표, 넣지 못한 그림과 이유, 점검 결과, "눈으로 확인 필요" 항목을 적는다.
- 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다.`
- 미리보기 그림(`/tmp/review/*.png`)과 배경 8장을 한 장으로 합쳐 PR 코멘트로 올린다.
- **머지하지 않는다.**
