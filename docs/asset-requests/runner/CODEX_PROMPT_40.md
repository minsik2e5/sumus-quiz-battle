# Codex 작업 지시: 그림 40 (몬스터전 레벨 2.0 · 기말고사 학교 몬스터 9종 · 9시트)

## 목표
몬스터전 레벨 2.0(`docs/monster-level-design.md`)에 쓸 새 몬스터 9종(🏫 기말고사 학교: ★1 3 · ★2 2 · ★3 2 · ★4 1 · ★5 1)의 그림을 만들고, 잘라서 `public/assets/monsters/`에 넣은 뒤 PR을 만든다.
몬스터마다 **기본 · 공격 · 맞음** 3자세가 꼭 필요하다(27장). 시트 넷째 칸 **쓰러짐**은 여분이다(있으면 넣고, 없어도 된다).
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.**

> ⚠️ **이 그림만으로는 새 몬스터가 앱에 나오지 않는다.** 새 몬스터는 지도(몬스터 사냥)에 나오지 않고, 몬스터전 레벨 순서에도 아직 없다. 레벨 순서 · 지역 · 이름 등록은 다음 세션에서 코드로 한다(구성안 `docs/monster-level-design.md` §7의 세션 2).
> `npm run build:assets`가 그림 폴더를 보고 `public/modules/monster-art.js`(`MONSTER_ART`)를 만들 뿐이라, 그림만 먼저 들어와도 앱은 깨지지 않는다(새 key는 `MONSTERS` · `HUNT_MONSTERS`에 없으므로 어디에서도 쓰이지 않는다. 가짜 그림으로 `build:assets` · `check` · `check:cloudflare`가 통과하는 것을 확인했다).

| 시트 | 등급 | 몬스터 key | 이름 |
|---|---|---|---|
| `40a-1` | ★1 | `latebell` | 지각 종소리 |
| `40a-2` | ★1 | `lunchslime` | 급식 슬라임 |
| `40a-3` | ★1 | `timetablefairy` | 시간표 요정 |
| `40a-4` | ★2 | `staffroomguard` | 교무실 문지기 |
| `40a-5` | ★2 | `classrobot` | 반장 로봇 |
| `40a-6` | ★3 | `examoctopus` | 시험지 문어 |
| `40a-7` | ★3 | `barbargiant` | 체육관 철봉 거인 |
| `40a-8` | ★4 | `examsetter` | 출제 위원 마법사 |
| `40a-9` | ★5 | `yearendlord` | 학년 말 대마왕 |

- 시트와 칸마다 넣을 파일(키)은 `slice-map.csv`에서 `list` 열이 `40a-`로 시작하는 줄을 본다. 앱은 `public/assets/monsters/<key>.webp` · `<key>-attack.webp` · `<key>-hurt.webp` · `<key>-down.webp`를 그대로 읽는다.
- 기존 몬스터(10 · 12 · 22 · 35)와 key가 겹치지 않게 새로 지은 이름이다. **key를 바꾸지 않는다.**

## 꼭 지킬 것
- **기존 몬스터와 같은 게임 그림체**로 맞춘다. 더 흐리거나 뿌옇거나 수채화처럼 만들지 않는다. 기존 몬스터를 베끼지 않는다(새 디자인). 시트마다 "기존 몬스터와 헷갈리지 않게 보이는 포인트" 문장이 있으니 지킨다.
- 그림에 **글자 · 숫자 · 로고를 넣지 않는다**(책 · 종이 · 시간표는 줄 · 칸 · 동그라미 모양만). 배경 · 바닥 그림자 · 체크무늬가 없다(진짜 투명).
- 128px로 줄여도 알아볼 수 있는 큰 실루엣.
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** Codex에는 Drive가 없다. 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 그림을 참고 그림으로 붙인다.
- 고치는 파일: `public/assets/monsters/` 아래 **새 그림**, 빌드가 바꾸는 `public/modules/monster-art.js` · `public/sw.js`, `docs/asset-requests/runner/DONE_40.md`. 그 밖의 앱 코드, 게임 규칙, 코인, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다. 원본 시트 PNG는 커밋하지 않는다(`/tmp/art/`).
- **브랜치:** `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-40`). 그 브랜치에 `docs/asset-requests/runner/40a-school-monsters.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/art-orders-39-41`에서 시작하고 PR 대상도 그 브랜치로 한다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/40a-1 …` ~ `40a-9 …`: 시트 하나 = 프롬프트 하나. 묶음 전체는 `40a-school-monsters.txt`.
- `slice-map.csv`: 칸 이름 · 앱 파일. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.
- 보내는 순서: `40a-1` → `40a-2` … `40a-9`. 첫 시트가 먼저 있어야 뒤 시트가 맞출 수 있다.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
시트 프롬프트(`split/`)는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(기존 몬스터 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 몬스터 40 (Runner용)"에 정확한 파일 이름으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same monster, keep its face, colors, markings and accessories exactly. Do NOT copy any other monster from the references; this is a new design.`
3. `40a-2`부터는 참고 그림에 방금 만든 첫 시트 `/tmp/art/40a-1.png`도 같이 붙인다(마감 · 칸 안 크기 · 디테일을 맞춘다. 디자인은 베끼지 않는다).

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| ★1 시트 | `monsters/mochi.webp`, `monsters/slime.webp`, `monsters/nightbat.webp` |
| ★2 시트 | `monsters/blinkjelly.webp`, `monsters/redpenghost.webp`, `monsters/forgetghost.webp` |
| ★3 시트 | `monsters/chalkangler.webp`, `monsters/sandwitch.webp`, `monsters/testspider.webp` |
| ★4 시트 | `monsters/gatehound.webp`, `monsters/omrreaper.webp`, `monsters/cramwizard.webp` |
| ★5 시트 | `monsters/mockhydra.webp`, `monsters/dictdragon.webp`, `monsters/killergolem.webp` |
| 모든 시트 | 기존 자세 `monsters/mochi-attack.webp`, `monsters/mochi-hurt.webp`, `monsters/mochi-down.webp` (공격 · 맞음 · 쓰러짐 포즈의 느낌) |
| 40a-2 이후 | `/tmp/art/40a-1.png` (같은 묶음의 첫 시트) |

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음).
2. 칸마다 그림이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 로고, 바닥 그림자가 없다.
3. 네 칸이 같은 몬스터(색 · 모양 · 크기 · 소품이 같음), 왼쪽(플레이어 쪽)을 본다.
4. 기존 몬스터(10 · 12 · 22 · 35)와 나란히 놓아도 같은 게임 그림처럼 보이고, "헷갈리지 않게 보이는 포인트"가 분명하다. 128px로 줄여도 알아볼 수 있다.

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트 1024×1024, **투명 배경 PNG**. 칸: 왼쪽 위 기본 · 오른쪽 위 공격 · 왼쪽 아래 맞음 · 오른쪽 아래 쓰러짐(여분).
- 만든 그림은 `/tmp/art/<시트 번호>.png`로 저장한다(예: `/tmp/art/40a-1.png`). 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- 한 번에 다 못 만들면 **몬스터 하나를 끝까지** 만든 단위로 끊는다. 못 만든 시트는 `DONE_40.md`의 "넣지 못한 그림"에 적는다.

## 2. 자르고 넣기
기존 몬스터와 같은 규격(512×512 webp, 투명, 같은 배율로 바닥에 세움 `--stand-same`)으로 자른다.
```
R=docs/asset-requests/runner
node $R/fit-assets.mjs /tmp/art/40a-1.png monsters/latebell monsters/latebell-attack monsters/latebell-hurt monsters/latebell-down --stand-same --preview /tmp/review/40a-1.png
node $R/fit-assets.mjs /tmp/art/40a-2.png monsters/lunchslime monsters/lunchslime-attack monsters/lunchslime-hurt monsters/lunchslime-down --stand-same --preview /tmp/review/40a-2.png
node $R/fit-assets.mjs /tmp/art/40a-3.png monsters/timetablefairy monsters/timetablefairy-attack monsters/timetablefairy-hurt monsters/timetablefairy-down --stand-same --preview /tmp/review/40a-3.png
node $R/fit-assets.mjs /tmp/art/40a-4.png monsters/staffroomguard monsters/staffroomguard-attack monsters/staffroomguard-hurt monsters/staffroomguard-down --stand-same --preview /tmp/review/40a-4.png
node $R/fit-assets.mjs /tmp/art/40a-5.png monsters/classrobot monsters/classrobot-attack monsters/classrobot-hurt monsters/classrobot-down --stand-same --preview /tmp/review/40a-5.png
node $R/fit-assets.mjs /tmp/art/40a-6.png monsters/examoctopus monsters/examoctopus-attack monsters/examoctopus-hurt monsters/examoctopus-down --stand-same --preview /tmp/review/40a-6.png
node $R/fit-assets.mjs /tmp/art/40a-7.png monsters/barbargiant monsters/barbargiant-attack monsters/barbargiant-hurt monsters/barbargiant-down --stand-same --preview /tmp/review/40a-7.png
node $R/fit-assets.mjs /tmp/art/40a-8.png monsters/examsetter monsters/examsetter-attack monsters/examsetter-hurt monsters/examsetter-down --stand-same --preview /tmp/review/40a-8.png
node $R/fit-assets.mjs /tmp/art/40a-9.png monsters/yearendlord monsters/yearendlord-attack monsters/yearendlord-hurt monsters/yearendlord-down --stand-same --preview /tmp/review/40a-9.png
# 쓰러짐 칸을 못 쓰면 넷째 이름을 - 로 준다(버림): … monsters/latebell-hurt - --stand-same
```
- 칸 이름은 `slice-map.csv`의 `app_file`과 같아야 한다(키가 틀리면 앱이 그림을 못 찾는다).
- 세 자세 중 하나라도 못 넣은 몬스터는 세 장 모두 넣지 않는다.

## 3. 마무리
```
npm ci
npm run build:assets      # public/modules/monster-art.js에 넣은 몬스터 key가 들어갔는지 본다
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `docs/asset-requests/runner/DONE_40.md`(한국어): 넣은 몬스터 표(시트 · 키 · 쓰러짐 여분 넣음 여부 · 다시 만든 횟수), 넣지 못한 것과 이유, "눈으로 확인 필요". 마지막에 "새 몬스터는 코드 등록(레벨 순서 · 지역)이 끝나야 앱에 나온다"를 적는다.
- PR 제목 `그림 40: 기말고사 학교 몬스터 9종 (latebell · lunchslime · timetablefairy · staffroomguard · classrobot · examoctopus · barbargiant · examsetter · yearendlord)`, 본문 한국어. 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 작게 합쳐 PR 코멘트로 올린다. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 새 몬스터는 코드 등록 전까지 앱에 나오지 않습니다.` **머지하지 않는다.**
