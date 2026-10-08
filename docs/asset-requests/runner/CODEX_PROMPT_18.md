# Codex 작업 지시: 그림 18 (새 펫 8종: 개구리 · 삽살개 · 사슴 · 곰 · 물범 · 늑대 · 악어 · 문어)

## 목표
SUMUS VOCA(저장소 `minsik2e5/sumus-quiz-battle`)의 그림 주문서 18로 새 펫 8종의 그림과 동작(표정·알 반응)을 만들고, 잘라서 `public/assets/pets/`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다**(펫 등록·특기·알·도감 연결은 Claude가 따로 한다).

| 구분 | 펫 key | 이름(임시) | 설정 시트 | 표정 시트 | 알 반응 시트 |
|---|---|---|---|---|---|
| 기본 | `frog` | 폴짝 · 개구리 | 18a-1 | 18b-1~3 | 18b-25 |
| 기본 | `sapsaree` | 복실 · 삽살개 | 18a-2 | 18b-4~6 | 18b-25 |
| 기본 | `deer` | 새싹 · 사슴 | 18a-3 | 18b-7~9 | 18b-26 |
| 기본 | `bear` | 든든 · 곰 | 18a-4 | 18b-10~12 | 18b-26 |
| 영웅 | `seal` | 동글 · 물범 | 18a-5 | 18b-13~15 | 18b-27 |
| 영웅 | `wolf` | 달빛 · 늑대 | 18a-6 | 18b-16~18 | 18b-27 |
| 영웅 | `crocodile` | 덥썩 · 악어 | 18a-7 | 18b-19~21 | 18b-28 |
| 영웅 | `octopus` | 말랑 · 문어 | 18a-8 | 18b-22~24 | 18b-28 |

- 시트는 모두 **36장**(설정 8 + 표정 24 + 알 반응 4), 그림은 **144개**(+ 작은 그림 32개).
- 한 펫의 그림 = 알·아기·성장·최종 4개 + 아기·성장·최종마다 표정 4개(기뻐함 `happy` · 냠냠 `eat` · 시무룩 `sad` · 응원 `cheer`) 12개 + 알 반응 2개(`happy` · `eat`) = **18개**.
- 앱은 이 파일 이름을 그대로 읽는다(`<key>-<단계>.webp`, `<key>-<단계>-<표정>.webp`). 이름이 다르면 그림이 안 나온다.

## 꼭 지킬 것
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다. 예: `codex/art-18`
  - 그 브랜치에 `docs/asset-requests/runner/18a-new-pets-design.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `feat/new-pets-art-order-8`에서 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** 머지하면 운영에 바로 배포된다.
- **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- `public/assets/pets/` 아래 새 그림과 `DONE_18.md`, 빌드가 바꾸는 `public/sw.js` 말고는 고치지 않는다. 앱 코드, 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다. 임시 폴더(`/tmp/art/`)에 둔다.
- 기존 그림 파일은 지우지 않는다. `dog-*` 같은 패턴으로 지우지 않는다(예전에 `-s.webp`가 같이 지워졌다). 이번 작업은 **새 파일만 추가**하고 기존 파일을 덮어쓰지 않는다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/` 폴더: 시트 하나 = 프롬프트 하나. 파일 이름이 시트 번호다(예: `split/18a-1 폴짝 개구리 설정 시트.txt`).
- `slice-map.csv`: 각 칸의 이름(`key`)과 앱 파일(`app_file`). 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래. `list` 열이 `18a-…`·`18b-…`인 줄만 본다.
- 자르기 도구: `fit-assets.mjs`, `fit-sheets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다. Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `STYLE AND CHARACTER REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same character, keep its face, colors, markings and accessories exactly. Do NOT copy any other animal or character shown in the references. Do NOT make it softer, blurrier or more painterly than the references.`

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트: 1024×1024, **투명 배경 PNG**. 아래 표의 참고 그림을 함께 보여 주고(첨부) 만든다.
- 만든 그림은 `/tmp/art/<시트 번호>.png`로 저장한다(예: `/tmp/art/18a-1.png`).
- 결과가 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- 투명 배경이 안 나오고 흰색이나 단색 배경으로 나오면, 시트 둘레가 그 단색일 때만 그 색을 투명으로 바꿔도 된다(`sharp` 등으로). 그림 안쪽 색은 건드리지 않는다. 체크무늬를 그려 넣은 그림은 다시 만든다.
- **순서를 지킨다.** 표정 시트는 같은 펫의 설정 시트(`18a-N`)를 먼저 만들고 잘라 넣은 뒤, 그 그림을 참고 그림으로 쓴다. 순서: `18a-1` ~ `18a-8` → `18b-1` ~ `18b-28`.
- 한 번에 다 만들 수 없으면 **펫 하나를 끝까지**(설정 1 + 표정 3 + 알 반응에 쓰이는 알) 만든 단위로 끊는다. 못 만든 시트는 `DONE_18.md`의 "넣지 못한 그림"에 적는다.

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 18a-1~4 기본 펫 설정 | `pets/panda-3.webp`, `pets/dog-1.webp` |
| 18a-5~8 영웅 펫 설정 | `pets/panda-3.webp`, `pets/capybara-3.webp`, `pets/owl-2.webp` |
| 18b 표정 | 그 펫·단계의 새 그림 `pets/<키>-<단계>.webp` (예: 18b-2 → `pets/frog-2.webp`) |
| 18b-25~28 알 반응 | 두 펫의 `pets/<키>-0.webp` (예: 18b-25 → `frog-0`, `sapsaree-0`) |

### 후보 점검 (모두 통과해야 쓴다)
1. **2×2 시트**: 배경이 진짜 투명이다. 네 모서리 alpha가 0이고, 체크무늬나 흰 상자를 그려 넣지 않았다. 흰 테두리(halo)가 없다.
2. 칸마다 그림이 하나씩 따로 있고, 서로 겹치거나 잘리지 않았다. 글자, 숫자, 테두리, 바닥 그림자가 없다.
3. 같은 시트의 칸들은 같은 캐릭터 디자인이다(색, 무늬, 소품).
4. 시트별 점검
   - **설정 시트(18a)**: 알 → 아기 → 성장 → 최종으로 분명히 커지고 화려해진다. 알에는 얼굴이 없다. 최종은 판다 최종만큼 공들인 그림이다. **영웅 4종(물범·늑대·악어·문어)은 기본 4종보다 성장·최종이 더 화려하다.**
   - **구분**: 곰은 판다·코알라·레서판다와, 늑대는 여우·북극여우와, 삽살개는 몽이(주황 시바)와, 물범은 펭귄·수달·상어와 한눈에 구분된다(주문서의 "must look different" 문장).
   - **무섭지 않다**: 늑대와 악어는 입을 다물고 이빨이 보이지 않는다. 악어는 아가 얼굴의 귀여운 모습이다.
   - **표정 시트(18b)**: 같은 단계의 몸 크기와 소품이 설정 시트와 같다(아기 모습으로 돌아가지 않는다). 문어는 응원 때 **촉수 하나**를 들고, 개구리는 손, 물범은 지느러미를 든다. 냠냠은 그릇에서 먹는 모습, 시무룩은 눈물이 맺힌 모습이다.
   - **알 반응**: 알의 무늬와 색이 참고 그림과 같다. 금이 가거나 얼굴이 생기면 실패다.

이미지를 볼 수 있으면 4번은 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
# 18a 설정 시트: 기본 그림 (칸마다 512px 캔버스에 세우기). 키 순서는 18a-1 ~ 18a-8 = frog sapsaree deer bear seal wolf crocodile octopus
node $R/fit-assets.mjs <18a-1> pets/frog-0 pets/frog-1 pets/frog-2 pets/frog-3 --stand --preview /tmp/review/18a-1.png
node $R/fit-assets.mjs <18a-2> pets/sapsaree-0 pets/sapsaree-1 pets/sapsaree-2 pets/sapsaree-3 --stand --preview /tmp/review/18a-2.png
#   18a-3~8도 같은 모양 (deer · bear · seal · wolf · crocodile · octopus)
# 18b 표정: 위에서 만든 기본 그림에 키·발 위치를 맞춰요 (18b-1~3 = frog 아기·성장·최종, 4~6 = sapsaree, 7~9 = deer, 10~12 = bear, 13~15 = seal, 16~18 = wolf, 19~21 = crocodile, 22~24 = octopus)
node $R/fit-sheets.mjs <18b-1> frog-1-happy frog-1-eat frog-1-sad frog-1-cheer --preview /tmp/review/18b-1.png
node $R/fit-sheets.mjs <18b-2> frog-2-happy frog-2-eat frog-2-sad frog-2-cheer --preview /tmp/review/18b-2.png
#   나머지도 같은 모양 (slice-map.csv의 key 그대로)
# 18b-25~28 알 반응: 한 시트에 펫 둘 (위 줄 = 앞 펫의 알, 아래 줄 = 뒤 펫의 알)
node $R/fit-sheets.mjs <18b-25> frog-0-happy frog-0-eat sapsaree-0-happy sapsaree-0-eat --preview /tmp/review/18b-25.png
#   18b-26 = deer · bear, 18b-27 = seal · wolf, 18b-28 = crocodile · octopus
```
- **작은 그림**: 펫 기본 그림(`<키>-<단계>.webp`, 단계 0~3)마다 `<키>-<단계>-s.webp`(160×160, 투명, `fit: 'contain'`)도 만든다. 기존 `-s.webp`와 같은 방식이다. 8종 × 4 = 32개.
- 도구가 "배경이 투명하지 않아요"나 "칸이 비어 있어요"로 멈추면 그 시트는 1단계로 돌아가 다시 만든다.

## 3. 기록
- `docs/asset-requests/runner/DONE_18.md`를 한국어로 쓴다.
  - 펫별 넣은 그림 표(설정 시트 · 표정 시트 · 기본 그림 · 표정 그림 · 알 반응 · 160px 작은 그림 개수, `DONE_17.md`와 같은 모양)
  - 넣지 못한 그림과 이유
  - 시트마다 다시 만든 횟수
  - "눈으로 확인 필요" 항목
- 앱 코드가 아직 새 펫을 쓰지 않으니 버전은 올리지 않는다. 새 파일만 추가하므로 머지해도 앱 화면은 바뀌지 않는다는 점을 PR에 적는다.

## 4. 점검
```
npm ci
npm run build:assets
npm run check            # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 그림 개수나 크기 때문에 실패하면 점검 파일을 고치지 말고, PR에 실패 메시지를 그대로 적는다.
- 로컬 Windows 체크아웃은 줄바꿈이 CRLF라 `V13.99 battle.js sends idx …` 같은 기존 검사가 실패할 수 있다. 이 경우 줄바꿈을 LF로 바꿔(`git ls-files public server | xargs sed -i 's/\r$//'`) 다시 돌리고, PR의 GitHub `release-check` 결과를 함께 적는다.
- `git status`로 바뀐 파일을 확인한다. 아래 파일만 바뀌어야 한다.
  - `public/assets/pets/` (새 파일만)
  - `public/sw.js`(빌드가 바꿈)
  - `DONE_18.md`
- 기존 그림이 지워지거나 바뀌지 않았는지 확인한다. `D`(삭제)와 `M`(수정)이 하나도 없어야 한다.
  ```
  git diff --name-status origin/sumus-voca-prod-deploy -- public/assets
  ```
- 그림 개수를 센다: 펫마다 `<키>-<0~3>.webp` 4 + 표정 12 + 알 반응 2 + 작은 그림 4 = 22개, 8종 176개.

## 5. PR
- 대상: `sumus-voca-prod-deploy`
- 제목: `그림 18: 새 펫 8종 (개구리 · 삽살개 · 사슴 · 곰 · 물범 · 늑대 · 악어 · 문어)`
- 본문은 한국어로 쓴다. 넣은 그림 표, 넣지 못한 그림과 이유, 점검 결과, "눈으로 확인 필요" 항목을 적는다.
- 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다.`
- 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 합쳐 PR 코멘트로 올린다.
- **머지하지 않는다.**
