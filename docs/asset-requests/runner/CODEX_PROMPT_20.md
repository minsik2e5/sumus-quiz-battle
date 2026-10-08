# Codex 작업 지시: 그림 20 (펫 전투 자세: 공격하는 자세 · 맞는 자세)

## 목표
SUMUS VOCA(저장소 `minsik2e5/sumus-quiz-battle`)의 그림 주문서 20으로 **새 펫 8종 · 신화 5종 · 천마**의 **공격 자세(`attack`)와 맞는 자세(`hurt`)** 그림을 만들고, 잘라서 `public/assets/pets/`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다**(앱이 이 그림을 쓰게 하는 연결은 Claude가 따로 한다).

- 지금 펫은 싸울 때 공격은 응원(`cheer`) 그림, 맞음은 시무룩(`sad`) 그림을 빌려 쓴다. 로보와 몬스터만 전용 `attack`/`hurt` 그림이 있다. 이번 그림은 그 자리를 채운다.
- 펫 1마리 = 아기(1) · 성장(2) · 최종(3) 단계마다 `attack` 1개 + `hurt` 1개 = **6개**. 14마리 = **84개**, 시트 **21장**.
- 파일 이름: `<key>-<단계>-attack.webp`, `<key>-<단계>-hurt.webp` (예: `frog-2-attack.webp`). 앱은 이 이름을 그대로 읽는다.

| 시트 | 펫(위 줄 / 아래 줄) | 단계 |
|---|---|---|
| 20-1 · 20-2 · 20-3 | `frog` / `sapsaree` | 아기 · 성장 · 최종 |
| 20-4 · 20-5 · 20-6 | `deer` / `bear` | 아기 · 성장 · 최종 |
| 20-7 · 20-8 · 20-9 | `seal` / `wolf` | 아기 · 성장 · 최종 |
| 20-10 · 20-11 · 20-12 | `crocodile` / `octopus` | 아기 · 성장 · 최종 |
| 20-13 · 20-14 · 20-15 | `gumiho` / `cheongryong` | 아기 · 성장 · 최종 |
| 20-16 · 20-17 · 20-18 | `baekho` / `jujak` | 아기 · 성장 · 최종 |
| 20-19 · 20-20 · 20-21 | `hyeonmu` / `cheonma` | 아기 · 성장 · 최종 |

한 시트 안의 칸 순서(왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래)는 `위 펫 공격 · 위 펫 맞음 · 아래 펫 공격 · 아래 펫 맞음`이다.

## 꼭 지킬 것
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다. 예: `codex/art-20`
  - 그 브랜치에 `docs/asset-requests/runner/20-pet-battle-poses.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `feat/pet-poses-art-order-20`에서 시작한다.
  - **신화 · 천마 펫 그림(`public/assets/pets/gumiho-1.webp` 등)이 없으면 그림 19 PR이 아직 머지되지 않은 것이다.** 그때는 새 펫 8종(시트 20-1 ~ 20-12)만 먼저 하고, 나머지(20-13 ~ 20-21)는 `DONE_20.md`의 "넣지 못한 그림"에 "그림 19 머지 뒤"라고 적는다.
- **PR까지만 만든다. 머지하지 않는다.** 머지하면 운영에 바로 배포된다.
- **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- `public/assets/pets/` 아래 **새 파일**과 `DONE_20.md`, 빌드가 바꾸는 `public/sw.js` 말고는 고치지 않는다. 앱 코드, 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다(`/tmp/art/`).
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. 이번 작업은 **새 파일만 추가**한다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/20-N …txt`: 시트 하나 = 프롬프트 하나(예: `split/20-8 동글 · 달빛 성장 공격·맞음.txt`).
- `slice-map.csv`: `list` 열이 `20-pet-battle-poses.txt`인 줄(칸 이름 `key`와 앱 파일 `app_file`).
- 자르기 도구: `fit-sheets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 그 시트의 두 펫의 **그 단계 그림**(`public/assets/pets/<key>-<단계>.webp`)을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: each is the exact design, size and accessories of that pet at this growth step: keep its face, colors, markings and accessories exactly and only change the pose. Match their art style, rendering quality and crisp clean edges exactly. Do NOT make it softer, blurrier or more painterly than the references.`
   - 예: 20-8(동글 · 달빛 성장) → `pets/seal-2.webp`, `pets/wolf-2.webp`

## 1. 그림 만들기
- Codex의 내장 그림 생성 기능으로 시트를 하나씩 만든다. 2×2 시트, 1024×1024, **투명 배경 PNG**. `/tmp/art/<시트 번호>.png`로 저장한다(예: `/tmp/art/20-8.png`).
- 결과가 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- 투명 배경이 안 나오고 단색 배경으로 나오면, 시트 둘레가 그 단색일 때만 그 색을 투명으로 바꿔도 된다. 체크무늬를 그려 넣은 그림은 다시 만든다.
- 순서: 20-1 → 20-21. 한 번에 다 만들 수 없으면 **쌍 하나(시트 3장)** 단위로 끊는다.

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬·흰 상자·흰 테두리 없음). 글자·숫자·테두리·바닥 그림자 없음.
2. 칸마다 그림이 하나씩 따로 있고 겹치거나 잘리지 않았다. **공격 자세는 몸이 앞으로(오른쪽으로) 뻗고, 날개·꼬리·촉수가 칸 안에 들어온다.**
3. **같은 펫의 두 칸(공격 · 맞음)은 그 단계 참고 그림과 같은 디자인**이다(얼굴 · 색 · 무늬 · 소품 · 몸 크기). 아기 단계가 성장·최종처럼, 성장·최종이 아기처럼 보이지 않는다.
4. **공격**: 힘차고 귀엽다. 늑대·악어·호랑이·용 등 맹수 계열은 입을 다물고 이빨이 안 보인다. **맞음**: 눈을 질끈 감고 뒤로 젖혀진 자세에 작은 충격 별과 땀방울. 피 · 상처 · 줄줄 흐르는 눈물이 없다(다치지 않은 귀여운 모습).
5. 구분: 구미호는 꼬리 개수가 단계 그대로(아기 1개 · 성장 3개 · 최종 9개), 청룡은 날개 없는 긴 몸, 문어는 촉수가 뻗는 공격이다.

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
# 칸 이름은 slice-map.csv의 key 그대로: 위 공격, 위 맞음, 아래 공격, 아래 맞음 (펫은 시트 번호 표 참고)
node $R/fit-sheets.mjs <20-1> frog-1-attack frog-1-hurt sapsaree-1-attack sapsaree-1-hurt --preview /tmp/review/20-1.png
node $R/fit-sheets.mjs <20-2> frog-2-attack frog-2-hurt sapsaree-2-attack sapsaree-2-hurt --preview /tmp/review/20-2.png
#   나머지 시트도 같은 모양 (deer·bear, seal·wolf, crocodile·octopus, gumiho·cheongryong, baekho·jujak, hyeonmu·cheonma)
```
- `fit-sheets.mjs`는 같은 펫·같은 단계의 기본 그림(`<key>-<단계>.webp`)에 키·발 위치를 맞춰 저장한다. 그 기본 그림이 없으면 멈추니, 그 펫은 "넣지 못한 그림"에 적는다.
- 작은 그림(`-s`)은 만들지 않는다.

## 3. 기록
- `docs/asset-requests/runner/DONE_20.md`를 한국어로 쓴다: 펫별 넣은 그림 표(단계별 `attack`·`hurt`), 넣지 못한 그림과 이유, 시트마다 다시 만든 횟수, "눈으로 확인 필요" 항목.
- 앱 코드가 아직 이 그림을 쓰지 않으니 버전은 올리지 않는다. 새 파일만 추가하므로 머지해도 앱 화면은 바뀌지 않는다고 PR에 적는다.

## 4. 점검
```
npm ci
npm run build:assets
npm run check            # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 그림 개수나 크기 때문에 실패하면 점검 파일을 고치지 말고, PR에 실패 메시지를 그대로 적는다.
- 로컬 Windows는 줄바꿈이 CRLF라 `V13.99 battle.js sends idx …` 같은 기존 검사가 실패할 수 있다. 이 경우 `git ls-files public server docs | grep -E '\.(js|mjs|css|html|json|csv|txt|md)$' | xargs sed -i 's/\r$//'`로 LF로 바꿔 다시 돌리고, PR의 GitHub `release-check` 결과를 함께 적는다.
- `V13.82 five games a day`는 한국 시간 자정 10분 전에 돌리면 실패하는 시간 문제다(펫과 무관). 그 시간대면 10분 뒤 다시 돌린다.
- `git status`로 바뀐 파일을 확인한다: `public/assets/pets/`(새 파일만), `public/sw.js`, `DONE_20.md`. `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`에 `D`(삭제)와 `M`(수정)이 없어야 한다.
- 그림 개수: 펫마다 6개, 14마리 **84개**(그림 19가 없으면 새 펫 8마리 48개).

## 5. PR
- 대상: `sumus-voca-prod-deploy`
- 제목: `그림 20: 펫 전투 자세 (새 펫 8종 · 신화 5종 · 천마 공격·맞음)`
- 본문은 한국어로: 넣은 그림 표, 넣지 못한 그림과 이유, 점검 결과, "눈으로 확인 필요" 항목.
- 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다.`
- 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 합쳐 PR 코멘트로 올린다.
- **머지하지 않는다.**
