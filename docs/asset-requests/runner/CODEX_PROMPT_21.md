# Codex 작업 지시: 그림 21 (이벤트 한정 펫 술술이 · 찰싹이 + 가을 이벤트 알 아이콘)

## 목표
SUMUS VOCA(저장소 `minsik2e5/sumus-quiz-battle`)의 그림 주문서 21로 **수능·기말 응원 이벤트 한정 펫 2종**(술술이 `tissue`, 찰싹이 `glue`)의 그림과 동작(표정·알 반응), 그리고 **가을 이벤트 알 상점 아이콘**을 만들고, 잘라서 `public/assets/`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다**(이벤트 알 · 펫 등록 · 도감은 Claude가 따로 한다).

이 두 펫은 **동물이 아니라 학용품이 살아난 동글동글한 마스코트**다. 그림체는 기존 펫(몽이 · 핑키 · 밤부 · 주먹이 등)과 같게, 아주 귀엽게 그린다.

| 구분 | 펫 key | 이름(임시) | 설정 | 표정 | 알 반응 |
|---|---|---|---|---|---|
| 이벤트 한정 | `tissue` | 술술이 · 두루마리 휴지 | 21a-1 | 21b-1~3 | 21b-7 (위 줄) |
| 이벤트 한정 | `glue` | 찰싹이 · 딱풀 | 21a-2 | 21b-4~6 | 21b-7 (아래 줄) |

| 주문서 | 시트 | 내용 |
|---|---|---|
| 21a | 2 | 펫 2종 설정 시트(알 · 아기 · 성장 · 최종) |
| 21b | 8 | 표정 6(펫마다 3) + 알 반응 1 + 가을 이벤트 알 아이콘 1 |

- 한 펫의 그림 = 알·아기·성장·최종 4개 + 아기·성장·최종마다 표정 4개(기뻐함 `happy` · 냠냠 `eat` · 시무룩 `sad` · 응원 `cheer`) 12개 + 알 반응 2개(`happy` · `eat`) = **18개**. 앱은 이 파일 이름(`<key>-<단계>.webp`, `<key>-<단계>-<표정>.webp`)을 그대로 읽는다.
- 넣을 파일은 **48개**: 펫 그림 36 + 작은 그림 8(`<키>-<단계>-s.webp`, 단계 0~3) + 아이콘 4.

## 꼭 지킬 것
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다. 예: `codex/art-21`
  - 그 브랜치에 `docs/asset-requests/runner/21a-event-pets-design.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `feat/dungeon-art-order-21-23`에서 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** 머지하면 운영에 바로 배포된다.
- **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- `public/assets/pets/`, `public/assets/ui/` 아래 **새 파일**과 `DONE_21.md`, 빌드가 바꾸는 `public/sw.js` 말고는 고치지 않는다. 앱 코드, 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다. 임시 폴더(`/tmp/art/`)에 둔다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. 이번 작업은 **새 파일만 추가**한다. `ui/cheer-egg.webp`, `ui/halloween-egg.webp`, `ui/limited-badge.webp`처럼 이미 있는 이름은 쓰지 않는다(새 아이콘 이름은 `ui/event-*.webp`).
- **실제 만화·게임·인형 캐릭터를 따라 그리지 않는다.** 술술이와 찰싹이는 주문서 설명대로의 새 캐릭터다. 줄무늬 볼, 처진 눈썹 선, 동물 귀 같은 특징은 넣지 않는다(둥근 분홍 볼터치와 점 눈, 작은 입).

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/` 폴더: 시트 하나 = 프롬프트 하나(예: `split/21a-1 술술이 두루마리 휴지 설정 시트.txt`).
- `slice-map.csv`: 각 칸의 이름(`key`)과 앱 파일(`app_file`). `list` 열이 `21a-…`~`21b-…`인 줄만 본다. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`, `fit-sheets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다. Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `STYLE AND CHARACTER REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림이 있으면 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same character, keep its face, colors, markings and accessories exactly. Do NOT copy any other animal or character shown in the references. Do NOT make it softer, blurrier or more painterly than the references.`

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트: 1024×1024, **투명 배경 PNG**.
- 만든 그림은 `/tmp/art/<시트 번호>.png`로 저장한다(예: `/tmp/art/21a-1.png`).
- 결과가 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- 투명 배경이 안 나오고 흰색이나 단색 배경으로 나오면, 시트 둘레가 그 단색일 때만 그 색을 투명으로 바꿔도 된다(`sharp` 등으로). 그림 안쪽 색은 건드리지 않는다. 체크무늬를 그려 넣은 그림은 다시 만든다.
- **순서를 지킨다.** `21a-1` ~ `21a-2` → `21b-1` ~ `21b-8`. 표정·알 반응 시트는 같은 펫의 설정 시트를 먼저 만들고 잘라 넣은 뒤, 그 그림을 참고 그림으로 쓴다.
- 한 번에 다 만들 수 없으면 **펫 하나를 끝까지** 만든 단위로 끊는다. 못 만든 시트는 `DONE_21.md`의 "넣지 못한 그림"에 적는다.

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 21a-1~2 설정 | `pets/panda-3.webp`, `pets/duck-1.webp`, `pets/riceball-1.webp` (그림체와 얼굴 단순함. 주먹이가 아직 없으면 `pets/panda-3.webp`만) |
| 21b-1~6 표정 | 그 펫·단계의 새 그림 `pets/<키>-<단계>.webp` |
| 21b-7 알 반응 | `pets/tissue-0.webp`, `pets/glue-0.webp` |
| 21b-8 알 아이콘 | `ui/halloween-egg.webp`, `ui/cheer-egg.webp`(있으면), `ui/limited-badge.webp` |

### 후보 점검 (모두 통과해야 쓴다)
1. **2×2 시트**: 배경이 진짜 투명이다. 네 모서리 alpha가 0이고, 체크무늬나 흰 상자를 그려 넣지 않았다. 흰 테두리(halo)가 없다.
2. 칸마다 그림이 하나씩 따로 있고, 서로 겹치거나 잘리지 않았다. 글자, 숫자, 테두리, 바닥 그림자가 없다.
3. 같은 시트의 칸들은 같은 캐릭터 디자인이다(색, 무늬, 소품).
4. 시트별 점검
   - **설정 시트(21a)**: 알 → 아기 → 성장 → 최종으로 분명히 커지고 화려해진다. 알에는 얼굴이 없다. 술술이는 크림색 휴지 몸통에 풀려 나오는 휴지 리본, 찰싹이는 하늘색 몸통에 흰 뚜껑 모자와 하트 풀 방울이다. 둘 다 점 눈, 작은 입, 둥근 분홍 볼터치만 있는 아주 단순한 얼굴이다.
   - **표정 시트(21b-1~6)**: 같은 단계의 몸 크기와 소품이 설정 시트와 같다. 응원은 `limb`(작은 팔 한쪽)를 든다.
   - **21b-7**: 위 줄은 술술이 알, 아래 줄은 찰싹이 알 반응(금이 가거나 얼굴이 생기면 실패).
   - **21b-8**: 가을 이벤트 알(호박 주황 띠 · 보라 유령 소용돌이 · 휴지 리본 · 하트 풀 방울 · 응원 머리띠), 한정 배지, 장식 2개. 글자 없음. 기존 할로윈 한정 배지와 달라야 한다.

이미지를 볼 수 있으면 4번은 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
# 21a 설정(칸마다 512px 캔버스에 세우기). 시트 순서 = tissue glue
node $R/fit-assets.mjs <21a-1> pets/tissue-0 pets/tissue-1 pets/tissue-2 pets/tissue-3 --stand --preview /tmp/review/21a-1.png
node $R/fit-assets.mjs <21a-2> pets/glue-0 pets/glue-1 pets/glue-2 pets/glue-3 --stand --preview /tmp/review/21a-2.png
# 21b 표정 (21b-1~3 = tissue 아기·성장·최종, 4~6 = glue)
node $R/fit-sheets.mjs <21b-1> tissue-1-happy tissue-1-eat tissue-1-sad tissue-1-cheer --preview /tmp/review/21b-1.png
#   나머지도 같은 모양 (slice-map.csv의 key 그대로)
# 21b-7 알 반응 (위 줄 tissue, 아래 줄 glue)
node $R/fit-sheets.mjs <21b-7> tissue-0-happy tissue-0-eat glue-0-happy glue-0-eat --preview /tmp/review/21b-7.png
# 21b-8 알 상점 아이콘
node $R/fit-assets.mjs <21b-8> ui/event-egg ui/event-badge ui/event-deco-cheer ui/event-deco-autumn --fit-each --size 256 --preview /tmp/review/21b-8.png
```
- **작은 그림**: 펫 기본 그림(`<키>-<단계>.webp`, 단계 0~3)마다 `<키>-<단계>-s.webp`(160×160, 투명, `fit: 'contain'`)도 만든다. 기존 `-s.webp`와 같은 방식이다. 2종 × 4 = 8개.
- 도구가 "배경이 투명하지 않아요"나 "칸이 비어 있어요"로 멈추면 그 시트는 1단계로 돌아가 다시 만든다.

## 3. 기록
- `docs/asset-requests/runner/DONE_21.md`를 한국어로 쓴다.
  - 펫별 넣은 그림 표(설정 · 표정 시트 번호와 기본 · 표정 · 알 반응 · 작은 그림 개수, `DONE_19.md`와 같은 모양)
  - 이벤트 알 아이콘 4개와 파일 크기
  - 넣지 못한 그림과 이유
  - 시트마다 다시 만든 횟수
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
- `V13.82 five games a day`는 한국 시간 자정 10분 전에 돌리면 실패하는 시간 문제다(펫과 무관). 그 시간대에 실패하면 10분 뒤 다시 돌린다.
- `git status`로 바뀐 파일을 확인한다. `public/assets/pets/`, `public/assets/ui/`(새 파일만), `public/sw.js`(빌드가 바꿈), `DONE_21.md`만 바뀌어야 한다.
- 기존 그림이 지워지거나 바뀌지 않았는지 확인한다. `D`(삭제)와 `M`(수정)이 하나도 없어야 한다.
  ```
  git diff --name-status origin/sumus-voca-prod-deploy -- public/assets
  ```
- 그림 개수를 센다: 펫마다 `<키>-<0~3>.webp` 4 + 표정 12 + 알 반응 2 + 작은 그림 4 = 22개, 2종 44개 + 아이콘 4 = **48개**.

## 5. PR
- 대상: `sumus-voca-prod-deploy`
- 제목: `그림 21: 이벤트 한정 펫 술술이 · 찰싹이 + 가을 이벤트 알 아이콘`
- 본문은 한국어로 쓴다. 넣은 그림 표, 넣지 못한 그림과 이유, 점검 결과, "눈으로 확인 필요" 항목을 적는다.
- 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다.`
- 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 합쳐 PR 코멘트로 올린다.
- **머지하지 않는다.**
