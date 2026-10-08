# Codex 작업 지시: 그림 19 (신화 펫 5종 · 전설 천마 · 이벤트 주먹이 + 신화 등장 연출)

## 목표
SUMUS VOCA(저장소 `minsik2e5/sumus-quiz-battle`)의 그림 주문서 19로 **새 등급 "신화(mythic)" 펫 5종**, 전설 펫 1종, 이벤트 한정 펫 1종의 그림과 동작(표정·알 반응), 그리고 **신화가 나올 때의 등장 연출 그림**(알 균열 · 빛 효과 · 등급 장식 · 등장 포즈 · 세로 배경)을 만들고, 잘라서 `public/assets/`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다**(등급·확률·알림·연출 코드·펫 등록은 Claude가 따로 한다).

| 구분 | 펫 key | 이름(임시) | 설정 | 표정 | 알 반응 |
|---|---|---|---|---|---|
| 신화 | `gumiho` | 미호 · 구미호 | 19a-1 | 19b-1~3 | 19b-22 |
| 신화 | `cheongryong` | 청룡 | 19a-2 | 19b-4~6 | 19b-22 |
| 신화 | `baekho` | 백호 | 19a-3 | 19b-7~9 | 19b-23 |
| 신화 | `jujak` | 주작 | 19a-4 | 19b-10~12 | 19b-23 |
| 신화 | `hyeonmu` | 현무 | 19a-5 | 19b-13~15 | 19b-24 |
| 전설 | `cheonma` | 천마 | 19a-6 | 19b-16~18 | 19b-24 |
| 이벤트 한정 | `riceball` | 주먹이 · 주먹밥 병아리 | 19a-7 | 19b-19~21 | 19b-25 (위 줄) |

| 주문서 | 시트 | 내용 |
|---|---|---|
| 19a | 7 | 펫 7종 설정 시트(알 · 아기 · 성장 · 최종) |
| 19b | 25 | 표정 21(펫마다 3) + 알 반응 3 + 주먹이 알 반응·응원 알 아이콘 1 |
| 19c | 3 | 신화 알 균열 4단계 · 빛 효과 4 · 등급 장식 4 |
| 19d | 2 | 등장 포즈 6(펫 6종의 최종 모습) + 신화 오라 + 반짝이 |
| 19e | 5 | 등장 배경 5(**세로 1024×1536 한 장씩**, 투명 아님) |

- 한 펫의 그림 = 알·아기·성장·최종 4개 + 아기·성장·최종마다 표정 4개(기뻐함 `happy` · 냠냠 `eat` · 시무룩 `sad` · 응원 `cheer`) 12개 + 알 반응 2개(`happy` · `eat`) = **18개**. 앱은 이 파일 이름(`<key>-<단계>.webp`, `<key>-<단계>-<표정>.webp`)을 그대로 읽는다.
- 신화 5종은 **전설보다 더 화려한** 최고 등급이다(주문서에 "mythic" 문장이 있다). 특히 최종 모습은 지금까지 만든 어떤 펫보다 공들인 그림이어야 한다.
- 총 시트 37장(+ 세로 배경 5장), 넣을 파일은 **181개**(펫 그림 126 + 작은 그림 28 + 등장 포즈 6 + 효과·장식·오라 14 + 배경 5 + 응원 아이콘 2).

## 꼭 지킬 것
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다. 예: `codex/art-19`
  - 그 브랜치에 `docs/asset-requests/runner/19a-mythic-pets-design.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `feat/mythic-pets-art-order-19`에서 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** 머지하면 운영에 바로 배포된다.
- **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- `public/assets/pets/`, `public/assets/ui/`, `public/assets/fx/`, `public/assets/reveal/` 아래 **새 파일**과 `DONE_19.md`, 빌드가 바꾸는 `public/sw.js` 말고는 고치지 않는다. 앱 코드, 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다. 임시 폴더(`/tmp/art/`)에 둔다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다(`dog-*` 같은 패턴 삭제 금지). 이번 작업은 **새 파일만 추가**한다. `ui/limited-badge.webp`처럼 이미 있는 파일 이름은 쓰지 않는다.
- **실제 만화·게임 캐릭터를 따라 그리지 않는다.** 주먹이는 주문서 설명대로의 새 캐릭터다(곰·고양이·파란 귀 같은 특징은 넣지 않는다).

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/` 폴더: 시트 하나 = 프롬프트 하나(예: `split/19a-1 미호 구미호 설정 시트.txt`, `split/19e-1 미호 등장 배경.txt`).
- `slice-map.csv`: 각 칸의 이름(`key`)과 앱 파일(`app_file`). `list` 열이 `19a-…`~`19e-…`인 줄만 본다. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`, `fit-sheets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다. Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `STYLE AND CHARACTER REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림이 있으면 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same character, keep its face, colors, markings and accessories exactly. Do NOT copy any other animal or character shown in the references. Do NOT make it softer, blurrier or more painterly than the references.`

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트(19a~19d): 1024×1024, **투명 배경 PNG**. 세로 배경(19e): **1024×1536, 투명 아님**, 가장자리까지 꽉 채운다.
- 만든 그림은 `/tmp/art/<시트 번호>.png`로 저장한다(예: `/tmp/art/19a-1.png`).
- 결과가 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- 투명 배경이 안 나오고 흰색이나 단색 배경으로 나오면, 시트 둘레가 그 단색일 때만 그 색을 투명으로 바꿔도 된다(`sharp` 등으로). 그림 안쪽 색은 건드리지 않는다. 체크무늬를 그려 넣은 그림은 다시 만든다.
- **순서를 지킨다.** `19a-1` ~ `19a-7` → `19b-1` ~ `19b-25` → `19c-1` ~ `19c-3` → `19d-1` ~ `19d-2` → `19e-1` ~ `19e-5`. 표정·알 반응·등장 포즈 시트는 같은 펫의 설정 시트를 먼저 만들고 잘라 넣은 뒤, 그 그림을 참고 그림으로 쓴다.
- 한 번에 다 만들 수 없으면 **펫 하나를 끝까지** 만든 단위로 끊는다(신화 → 천마 → 주먹이 → 19c·19d·19e 순). 못 만든 시트는 `DONE_19.md`의 "넣지 못한 그림"에 적는다.

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 19a-1~5 신화 설정 | `pets/panda-3.webp`, `pets/phoenix-3.webp`, `pets/qilin-3.webp` (전설 최종. 신화는 이보다 더 화려하게) |
| 19a-6 천마 설정 | `pets/qilin-3.webp`, `pets/panda-3.webp` |
| 19a-7 주먹이 설정 | `pets/panda-3.webp`, `pets/duck-1.webp` |
| 19b 표정 | 그 펫·단계의 새 그림 `pets/<키>-<단계>.webp` |
| 19b-22~25 알 반응 | 그 펫들의 `pets/<키>-0.webp` (19b-25는 `riceball-0`) |
| 19c-1~3 효과·장식 | `ui/epic-egg.webp`, `ui/egg-shop.webp` |
| 19d-1~2 등장 포즈 | 그 펫들의 최종 `pets/<키>-3.webp` |
| 19e 배경 | 없음 (그림체는 `pets/panda-3.webp`, `monsters/slime.webp` 같은 기존 그림을 보고 맞춘다) |

### 후보 점검 (모두 통과해야 쓴다)
1. **2×2 시트**: 배경이 진짜 투명이다. 네 모서리 alpha가 0이고, 체크무늬나 흰 상자를 그려 넣지 않았다. 흰 테두리(halo)가 없다. (효과 시트는 빛이 가장자리에서 완전히 투명하게 사라진다.)
2. 칸마다 그림이 하나씩 따로 있고, 서로 겹치거나 잘리지 않았다. 글자, 숫자, 테두리, 바닥 그림자가 없다.
3. 같은 시트의 칸들은 같은 캐릭터 디자인이다(색, 무늬, 소품).
4. 시트별 점검
   - **설정 시트(19a)**: 알 → 아기 → 성장 → 최종으로 분명히 커지고 화려해진다. 알에는 얼굴이 없다. **구미호는 꼬리가 1개 → 3개 → 9개로 늘어난다.** 청룡은 날개 없는 긴 동양 용, 주작은 날씬한 붉은 새(불새와 다름), 현무는 어두운 거북이와 뱀, 백호는 줄무늬 흰 호랑이다. 늑대·호랑이·용·뱀이 무섭지 않다(입 다묾, 이빨 없음).
   - **구분**: 구미호 ≠ 호야·눈송, 청룡 ≠ 용이, 백호 ≠ 눈송·달빛, 주작 ≠ 불새, 현무 ≠ 느릿·초롱, 천마 ≠ 기린.
   - **표정 시트(19b)**: 같은 단계의 몸 크기와 소품이 설정 시트와 같다. 응원은 주문서의 `limb`(발·날개·발굽·발톱)를 든다.
   - **19b-25**: 위 줄은 주먹이 알 반응(금이 가거나 얼굴이 생기면 실패), 아래 줄은 응원 알 아이콘과 장식(글자 없음).
   - **19c**: 균열 4장은 같은 위치·크기의 균열선만(알 그림 없음), 빛줄기·링·별·오로라는 중심 물체 없이 효과만, 장식은 글자가 없다.
   - **19d**: 6마리 모두 설정 시트의 최종 모습 그대로 포즈만 바뀌고 몸이 칸의 약 92%를 채운다. 아래 두 칸(오라·반짝이)은 캐릭터가 없다.
   - **19e 배경**: 캐릭터·동물·글자가 없다. 가운데 약간 아래가 밝고 비어 있고(펫 자리), 위 20%는 차분하다. 5장이 같은 그림체다.

이미지를 볼 수 있으면 4번은 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
# 19a 설정(칸마다 512px 캔버스에 세우기). 시트 순서 = gumiho cheongryong baekho jujak hyeonmu cheonma riceball
node $R/fit-assets.mjs <19a-1> pets/gumiho-0 pets/gumiho-1 pets/gumiho-2 pets/gumiho-3 --stand --preview /tmp/review/19a-1.png
#   19a-2~7도 같은 모양
# 19b 표정 (19b-1~3 = gumiho 아기·성장·최종, 4~6 = cheongryong, 7~9 = baekho, 10~12 = jujak, 13~15 = hyeonmu, 16~18 = cheonma, 19~21 = riceball)
node $R/fit-sheets.mjs <19b-1> gumiho-1-happy gumiho-1-eat gumiho-1-sad gumiho-1-cheer --preview /tmp/review/19b-1.png
#   나머지도 같은 모양 (slice-map.csv의 key 그대로)
# 19b-22~24 알 반응 (한 시트에 펫 둘: 위 줄 앞 펫, 아래 줄 뒤 펫)
node $R/fit-sheets.mjs <19b-22> gumiho-0-happy gumiho-0-eat cheongryong-0-happy cheongryong-0-eat --preview /tmp/review/19b-22.png
#   19b-23 = baekho · jujak, 19b-24 = hyeonmu · cheonma
# 19b-25: 위 줄은 알 반응, 아래 줄은 아이콘이라 두 번에 나눠 자른다
node $R/fit-sheets.mjs <19b-25> riceball-0-happy riceball-0-eat - - --preview /tmp/review/19b-25a.png
node $R/fit-assets.mjs <19b-25> - - ui/cheer-egg ui/cheer-deco --size 256 --preview /tmp/review/19b-25b.png
# 19c 효과·장식 (fx 폴더는 새로 만든다: mkdir -p public/assets/fx)
node $R/fit-assets.mjs <19c-1> fx/mythic-crack-1 fx/mythic-crack-2 fx/mythic-crack-3 fx/mythic-crack-4 --union --size 768 --preview /tmp/review/19c-1.png
node $R/fit-assets.mjs <19c-2> fx/mythic-rays fx/mythic-ring fx/mythic-stars fx/mythic-aurora --fit-each --size 768 --preview /tmp/review/19c-2.png
node $R/fit-assets.mjs <19c-3> ui/mythic-badge ui/mythic-frame ui/mythic-banner ui/mythic-egg --fit-each --size 512 --preview /tmp/review/19c-3.png
# 19d 등장 포즈 (칸마다 같은 크기로 1024px 정사각형 가운데에)
node $R/fit-assets.mjs <19d-1> pets/gumiho-reveal pets/cheongryong-reveal pets/baekho-reveal pets/jujak-reveal --fit-each --size 1024 --preview /tmp/review/19d-1.png
node $R/fit-assets.mjs <19d-2> pets/hyeonmu-reveal pets/cheonma-reveal - - --fit-each --size 1024 --preview /tmp/review/19d-2a.png
node $R/fit-assets.mjs <19d-2> - - ui/mythic-aura ui/mythic-sparkles --fit-each --size 768 --preview /tmp/review/19d-2b.png
```
- **작은 그림**: 펫 기본 그림(`<키>-<단계>.webp`, 단계 0~3)마다 `<키>-<단계>-s.webp`(160×160, 투명, `fit: 'contain'`)도 만든다. 기존 `-s.webp`와 같은 방식이다. 7종 × 4 = 28개.
- **세로 배경(19e)**: 고른 PNG를 720×1080 webp로 줄여 `public/assets/reveal/bg-<이름>.webp`로 저장한다(`mkdir -p public/assets/reveal`). 한 장에 150KB 이하가 목표다.
  ```
  sharp(src).resize(720, 1080, { fit: 'cover' }).webp({ quality: 80, effort: 6 })
  ```
  이름: `19e-1` → `bg-gumiho`, `19e-2` → `bg-cheongryong`, `19e-3` → `bg-baekho`, `19e-4` → `bg-jujak`, `19e-5` → `bg-hyeonmu`
- 도구가 "배경이 투명하지 않아요"나 "칸이 비어 있어요"로 멈추면 그 시트는 1단계로 돌아가 다시 만든다. 큰 그림(등장 포즈 · 효과)은 한 장에 250KB 이하가 목표이고, 넘으면 `quality`를 낮춰 다시 저장한다.

## 3. 기록
- `docs/asset-requests/runner/DONE_19.md`를 한국어로 쓴다.
  - 펫별 넣은 그림 표(설정 · 표정 시트 번호와 기본 · 표정 · 알 반응 · 작은 그림 개수, `DONE_18.md`와 같은 모양)
  - 등장 연출 그림 표(균열 4 · 빛 4 · 장식 4 · 오라 · 반짝이 · 등장 포즈 6 · 배경 5 · 응원 아이콘 2)와 파일 크기
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
- `git status`로 바뀐 파일을 확인한다. 아래 파일만 바뀌어야 한다.
  - `public/assets/pets/`, `public/assets/ui/`, `public/assets/fx/`, `public/assets/reveal/` (새 파일만)
  - `public/sw.js`(빌드가 바꿈)
  - `DONE_19.md`
- 기존 그림이 지워지거나 바뀌지 않았는지 확인한다. `D`(삭제)와 `M`(수정)이 하나도 없어야 한다.
  ```
  git diff --name-status origin/sumus-voca-prod-deploy -- public/assets
  ```
- 그림 개수를 센다: 펫마다 `<키>-<0~3>.webp` 4 + 표정 12 + 알 반응 2 + 작은 그림 4 = 22개, 7종 154개 + 등장 포즈 6 + 효과 8 + 장식·오라 등 ui 8 + 배경 5 = **181개**.

## 5. PR
- 대상: `sumus-voca-prod-deploy`
- 제목: `그림 19: 신화 펫 5종(구미호·청룡·백호·주작·현무) · 천마 · 이벤트 주먹이 · 신화 등장 연출`
- 본문은 한국어로 쓴다. 넣은 그림 표, 넣지 못한 그림과 이유, 점검 결과, "눈으로 확인 필요" 항목을 적는다.
- 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다.`
- 미리보기 그림(`/tmp/review/*.png`)과 세로 배경 5장을 한 장으로 합쳐 PR 코멘트로 올린다.
- **머지하지 않는다.**
