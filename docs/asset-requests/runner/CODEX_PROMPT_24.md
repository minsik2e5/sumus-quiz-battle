# Codex 작업 지시: 그림 24 (새 펫 10종: 코끼리 · 미어캣 · 너구리 · 오목눈이 · 하마 · 기니피그 · 아홀로틀 · 친칠라 · 나무늘보 · 오리너구리)

## 목표
SUMUS VOCA(저장소 `minsik2e5/sumus-quiz-battle`)의 그림 주문서 24로 새 펫 10종의 그림(설정 · 표정 · 알 반응 · 야차전 공격/맞음 자세)을 만들고, 잘라서 `public/assets/pets/`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다**(펫 등록 · 특기 · 알 · 도감 연결은 Claude가 따로 한다).

| 구분 | 펫 key | 이름(임시) | 설정 시트 | 표정 시트 | 알 반응 | 전투 자세 |
|---|---|---|---|---|---|---|
| 기본 | `elephant` | 코롱 · 아기 코끼리 | 24a-1 | 24b-1~3 | 24b-31 | 24c-1~3 |
| 기본 | `meerkat` | 쫑긋 · 미어캣 | 24a-2 | 24b-4~6 | 24b-31 | 24c-1~3 |
| 기본 | `raccoondog` | 너굴 · 아기 너구리 | 24a-3 | 24b-7~9 | 24b-32 | 24c-4~6 |
| 기본 | `longtit` | 포롱 · 오목눈이 | 24a-4 | 24b-10~12 | 24b-32 | 24c-4~6 |
| 기본 | `hippo` | 하뭉 · 아기 하마 | 24a-5 | 24b-13~15 | 24b-33 | 24c-7~9 |
| 영웅 | `guineapig` | 꾸이 · 기니피그 | 24a-6 | 24b-16~18 | 24b-33 | 24c-7~9 |
| 영웅 | `axolotl` | 우파 · 아홀로틀 | 24a-7 | 24b-19~21 | 24b-34 | 24c-10~12 |
| 영웅 | `chinchilla` | 친친 · 친칠라 | 24a-8 | 24b-22~24 | 24b-34 | 24c-10~12 |
| 영웅 | `sloth` | 늘보 · 나무늘보 | 24a-9 | 24b-25~27 | 24b-35 | 24c-13~15 |
| 영웅 | `platypus` | 납작 · 오리너구리 | 24a-10 | 24b-28~30 | 24b-35 | 24c-13~15 |

- 시트는 모두 **60장**(설정 10 + 표정 30 + 알 반응 5 + 전투 자세 15), 그림 **240개** + 작은 그림 40개.
- 한 펫의 그림 = 알·아기·성장·최종 4개 + 단계마다 표정 4개(`happy` · `eat` · `sad` · `cheer`) 12개 + 알 반응 2개(`happy` · `eat`) + 단계마다 `attack` · `hurt` 6개 = **24개** (+ 작은 그림 4개).
- 앱은 이 파일 이름을 그대로 읽는다(`<key>-<단계>.webp`, `<key>-<단계>-<표정>.webp`, `<key>-<단계>-attack.webp`). 이름이 다르면 그림이 안 나온다.

## 그림체 (중요)
- **기존 펫과 똑같은 그림체**(3D 페인팅, 반짝이는 큰 눈, 볼터치, 금빛 테두리 빛). 영웅 5종은 기본 5종보다 성장·최종이 조금 더 화려하다.
- 분위기는 "아주 작고 동글동글, 단순하고 귀여운 얼굴, 큰 볼터치, 작은 소품 하나".
- **만화·애니 캐릭터(치이카와 · 하치와레 · 우사기 등)를 따라 그리거나 닮게 그리지 않는다.** 모두 새 캐릭터다.
- 기존 펫과 헷갈리지 않게 각 주문서의 "must look different" 문장을 지킨다(기니피그·친칠라 ↔ 햄스터 쿠키, 너구리 ↔ 레서판다·여우, 오리너구리 ↔ 오리·수달, 하마 ↔ 코끼리·핑키).

## 꼭 지킬 것
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다. 예: `codex/art-24`
  - 그 브랜치에 `docs/asset-requests/runner/24a-new-pets-design.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/zealous-franklin-9qhw79`에서 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** 머지하면 운영에 바로 배포된다.
- **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- `public/assets/pets/` 아래 새 그림과 `DONE_24.md`, 빌드가 바꾸는 `public/sw.js` 말고는 고치지 않는다. 앱 코드, 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다. 임시 폴더(`/tmp/art/`)에 둔다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/` 폴더: 시트 하나 = 프롬프트 하나. 파일 이름이 시트 번호다(예: `split/24a-1 코롱 아기 코끼리 설정 시트.txt`).
- `slice-map.csv`: 각 칸의 이름(`key`)과 앱 파일(`app_file`). `list` 열이 `24a-…`·`24b-…`·`24c-…`인 줄만 본다. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`, `fit-sheets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다. Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same character, keep its face, colors, markings and accessories exactly. Do NOT copy any other animal or character from the references, and do NOT copy or resemble any cartoon or anime character.`

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트: 1024×1024, **투명 배경 PNG**. 아래 표의 참고 그림을 함께 보여 주고(첨부) 만든다.
- 만든 그림은 `/tmp/art/<시트 번호>.png`로 저장한다(예: `/tmp/art/24a-1.png`).
- 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- 흰색이나 단색 배경으로 나오면, 시트 둘레가 그 단색일 때만 그 색을 투명으로 바꿔도 된다. 그림 안쪽 색은 건드리지 않는다. 체크무늬를 그려 넣은 그림은 다시 만든다.
- **순서를 지킨다.** 설정 시트(`24a-N`)를 먼저 만들고 잘라 넣은 뒤, 그 그림을 참고로 표정·알 반응·전투 자세를 만든다. 순서: `24a-1~10` → `24b-1~35` → `24c-1~15`.
- 한 번에 다 못 만들면 **펫 하나를 끝까지**(설정 1 + 표정 3) 만든 단위로 끊는다. 못 만든 시트는 `DONE_24.md`의 "넣지 못한 그림"에 적는다.

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 24a-1~5 기본 펫 설정 | `pets/panda-3.webp`, `pets/dog-1.webp`, `pets/frog-2.webp` |
| 24a-6~10 영웅 펫 설정 | `pets/panda-3.webp`, `pets/capybara-3.webp`, `pets/seal-2.webp` |
| 24b-1~30 표정 | 그 펫·단계의 새 그림 `pets/<키>-<단계>.webp` (예: 24b-2 → `pets/elephant-2.webp`) |
| 24b-31~35 알 반응 | 두 펫의 `pets/<키>-0.webp` (예: 24b-31 → `elephant-0`, `meerkat-0`) |
| 24c 전투 자세 | 두 펫의 그 단계 새 그림(예: 24c-2 → `elephant-2`, `meerkat-2`) + 기존 자세 `pets/frog-2-attack.webp`, `pets/frog-2-hurt.webp`(있으면) |

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬·흰 상자·흰 테두리 없음).
2. 칸마다 그림이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 테두리, 바닥 그림자가 없다.
3. 같은 시트의 칸들은 같은 캐릭터 디자인이다(색, 무늬, 소품).
4. 시트별 점검
   - **설정(24a)**: 알 → 아기 → 성장 → 최종으로 분명히 커지고 화려해진다. 알에는 얼굴이 없다.
   - **구분**: 위 "그림체"의 헷갈리는 짝이 한눈에 구분된다. 어떤 만화 캐릭터와도 닮지 않았다.
   - **표정(24b)**: 같은 단계의 몸 크기와 소품이 설정 시트와 같다. 응원 때 코끼리는 코, 오목눈이는 날개, 나무늘보는 긴 팔을 든다.
   - **전투 자세(24c)**: 공격은 오른쪽으로 달려들고, 맞음은 오른쪽에서 맞아 왼쪽으로 몸을 젖힌다. 피·상처 없이 귀엽다. 나무늘보 발톱은 둥글다.
   - **알 반응**: 알의 무늬와 색이 참고 그림과 같다. 금이 가거나 얼굴이 생기면 실패다.

이미지를 볼 수 있으면 4번은 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
# 24a 설정 시트: 기본 그림. 24a-1~10 = elephant meerkat raccoondog longtit hippo guineapig axolotl chinchilla sloth platypus
node $R/fit-assets.mjs <24a-1> pets/elephant-0 pets/elephant-1 pets/elephant-2 pets/elephant-3 --stand --preview /tmp/review/24a-1.png
#   24a-2~10도 같은 모양
# 24b 표정: 기본 그림에 키·발 위치를 맞춰요 (24b-1~3 = elephant 아기·성장·최종, 4~6 = meerkat … 28~30 = platypus)
node $R/fit-sheets.mjs <24b-1> elephant-1-happy elephant-1-eat elephant-1-sad elephant-1-cheer --preview /tmp/review/24b-1.png
#   나머지도 같은 모양 (slice-map.csv의 key 그대로)
# 24b-31~35 알 반응: 한 시트에 펫 둘 (위 줄 = 앞 펫, 아래 줄 = 뒤 펫)
node $R/fit-sheets.mjs <24b-31> elephant-0-happy elephant-0-eat meerkat-0-happy meerkat-0-eat --preview /tmp/review/24b-31.png
#   24b-32 = raccoondog · longtit, 33 = hippo · guineapig, 34 = axolotl · chinchilla, 35 = sloth · platypus
# 24c 전투 자세: 위 공격, 위 맞음, 아래 공격, 아래 맞음
node $R/fit-sheets.mjs <24c-1> elephant-1-attack elephant-1-hurt meerkat-1-attack meerkat-1-hurt --preview /tmp/review/24c-1.png
#   24c-2 = 같은 두 펫 성장(2), 24c-3 = 최종(3), 24c-4~6 = raccoondog · longtit, 7~9 = hippo · guineapig, 10~12 = axolotl · chinchilla, 13~15 = sloth · platypus
```
- **작은 그림**: 기본 그림(`<키>-<단계>.webp`, 단계 0~3)마다 `<키>-<단계>-s.webp`(160×160, 투명, `fit: 'contain'`)도 만든다. 10종 × 4 = 40개. 전투 자세는 작은 그림을 만들지 않는다.
- 도구가 "배경이 투명하지 않아요"나 "칸이 비어 있어요"로 멈추면 그 시트는 1단계로 돌아가 다시 만든다.

## 3. 기록
- `docs/asset-requests/runner/DONE_24.md`를 한국어로 쓴다: 펫별 넣은 그림 표, 넣지 못한 그림과 이유, 시트마다 다시 만든 횟수, "눈으로 확인 필요" 항목.
- 앱 코드가 아직 새 펫을 쓰지 않으니 버전은 올리지 않는다. 새 파일만 추가하므로 머지해도 앱 화면은 바뀌지 않는다는 점을 PR에 적는다.

## 4. 점검
```
npm ci
npm run build:assets
npm run check            # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 바뀐 파일은 `public/assets/pets/`(새 파일만), `public/sw.js`, `DONE_24.md`뿐이어야 한다. 기존 그림의 `D`(삭제)·`M`(수정)이 없어야 한다:
  `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- 그림 개수: 펫마다 기본 4 + 표정 12 + 알 반응 2 + 전투 6 + 작은 그림 4 = 28개, 10종 280개.

## 5. PR
- 대상: `sumus-voca-prod-deploy`
- 제목: `그림 24: 새 펫 10종 (코끼리 · 미어캣 · 너구리 · 오목눈이 · 하마 · 기니피그 · 아홀로틀 · 친칠라 · 나무늘보 · 오리너구리)`
- 본문은 한국어로 쓴다. 넣은 그림 표, 넣지 못한 그림과 이유, 점검 결과, "눈으로 확인 필요" 항목.
- 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다.`
- 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 합쳐 PR 코멘트로 올린다.
- **머지하지 않는다.**
