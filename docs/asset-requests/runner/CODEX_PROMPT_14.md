# Codex 작업 지시: 그림 14~17 (할로윈 한정 · 전투 배경 · 몽이·핑키 다시 그리기 · 새 펫 8종)

## 목표
SUMUS VOCA(저장소 `minsik2e5/sumus-quiz-battle`)의 그림 주문서 14~17로 그림을 만들고, 잘라서 `public/assets/`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다**(펫 등록·할로윈 알·배경 연결은 Claude가 따로 한다).

작업은 두 번으로 나눈다. 선생님이 "작업 A"라고 하면 A만, "작업 B"라고 하면 B만 한다.

| 작업 | 주문서 | 시트 | 그림 | 급한 정도 |
|---|---|---|---|---|
| **A** | 14a · 14b 할로윈 한정 | 2 + 9 | 41 | **가장 급함** (10/20 판매 시작) |
| **A** | 15 전투 배경 | 4 | 4 | 급함 |
| **A** | 16 몽이·핑키 다시 그리기 | 5 | 20 | 보통 |
| **B** | 17a · 17b 새 펫 8종 | 8 + 28 | 144 | 보통 |

## 꼭 지킬 것
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다. 예: `codex/art-14-16`(작업 A), `codex/art-17`(작업 B)
  - 그 브랜치에 `docs/asset-requests/runner/14a-halloween-pets-design.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/zealous-franklin-9qhw79`에서 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** 머지하면 운영에 바로 배포된다.
- **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- `public/assets/` 아래 그림과 아래 "기록"에 적은 파일 말고는 고치지 않는다. 앱 코드, 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다. 임시 폴더(`/tmp/art/`)에 둔다.
- 기존 그림 파일은 지우지 않는다. `dog-*` 같은 패턴으로 지우지 않는다(예전에 `-s.webp`가 같이 지워졌다).
  - 덮어써도 되는 기존 파일은 **16의 몽이·핑키 성장·최종 그림뿐**이다(아래 표에 적은 이름만).

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/` 폴더: 시트 하나 = 프롬프트 하나. 파일 이름이 시트 번호다(예: `split/14a-1 호박냥 호박 고양이 설정 시트.txt`).
- `slice-map.csv`: 각 칸의 이름(`key`)과 앱 파일(`app_file`). 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`, `fit-sheets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다. Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `STYLE AND CHARACTER REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림이 있으면 그 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same character, keep its face, colors, markings and accessories exactly. Do NOT copy any other animal or character shown in the references. Do NOT make it softer, blurrier or more painterly than the references.`
   - 16 시트는 이 문장을 하나 더 넣는다: `The attached baby picture is this pet's baby stage: keep its face, fur colors, markings and eyes. The attached panda is ONLY the target quality (do NOT copy it). The old grown/final designs were too plain: make the new stages clearly grander.`

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트: 1024×1024, **투명 배경 PNG**. 아래 표의 참고 그림이 있으면 그 그림을 함께 보여 주고(첨부) 만든다.
- 배경 시트(`14b-9`, `15-1`~`15-4`): 가로 1536×1024, 배경을 꽉 채운 PNG(투명 아님).
- 만든 그림은 `/tmp/art/<시트 번호>.png`로 저장한다(예: `/tmp/art/14a-1.png`).
- 결과가 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- 투명 배경이 안 나오고 흰색이나 단색 배경으로 나오면, 시트 둘레가 그 단색일 때만 그 색을 투명으로 바꿔도 된다(`sharp` 등으로). 그림 안쪽 색은 건드리지 않는다. 체크무늬를 그려 넣은 그림은 다시 만든다.
- **순서를 지킨다.** 표정 시트는 같은 펫의 설정 시트를 먼저 만들고 잘라 넣은 뒤, 그 그림을 참고 그림으로 쓴다.

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 14a-1 호박냥 설정 | `pets/panda-3.webp`, `pets/cat-2.webp`, `pets/dog-1.webp` |
| 14a-2 부우 설정 | `pets/panda-3.webp`, `pets/rabbit-3.webp`, `pets/dog-1.webp` |
| 14b-1~3 호박냥 아기·성장·최종 표정 | 그 단계의 새 그림 `pets/pumpkincat-<1·2·3>.webp` (14a-1에서 만든 것) |
| 14b-4~6 부우 아기·성장·최종 표정 | `pets/ghost-<1·2·3>.webp` (14a-2에서 만든 것) |
| 14b-7 알 반응 | `pets/pumpkincat-0.webp`, `pets/ghost-0.webp` |
| 14b-8 할로윈 아이콘 | `ui/epic-egg.webp`, `ui/egg-shop.webp` |
| 14b-9, 15-1~4 배경 | 없음 |
| 16-1 몽이 새 성장 | `pets/dog-1.webp`, `pets/panda-3.webp` |
| 16-2 몽이 새 최종 | `pets/dog-1.webp`, `pets/panda-3.webp`, **새** `pets/dog-2.webp`(16-1에서 만든 것) |
| 16-3 핑키 새 성장 | `pets/pig-1.webp`, `pets/panda-3.webp` |
| 16-4 핑키 새 최종 | `pets/pig-1.webp`, `pets/panda-3.webp`, **새** `pets/pig-2.webp` |
| 16-5 새 응원 | **새** `pets/dog-2.webp`, `dog-3.webp`, `pig-2.webp`, `pig-3.webp` |
| 17a-1~4 기본 펫 설정 | `pets/panda-3.webp`, `pets/dog-1.webp` |
| 17a-5~8 영웅 펫 설정 | `pets/panda-3.webp`, `pets/capybara-3.webp`, `pets/owl-2.webp` |
| 17b 표정 | 그 펫·단계의 새 그림 `pets/<키>-<단계>.webp` |
| 17b-25~28 알 반응 | 두 펫의 `pets/<키>-0.webp` |

### 후보 점검 (모두 통과해야 쓴다)
1. **2×2 시트**: 배경이 진짜 투명이다. 네 모서리 alpha가 0이고, 체크무늬나 흰 상자를 그려 넣지 않았다. 흰 테두리(halo)가 없다.
2. 칸마다 그림이 하나씩 따로 있고, 서로 겹치거나 잘리지 않았다. 글자, 숫자, 테두리, 바닥 그림자가 없다.
3. 같은 시트의 칸들은 같은 캐릭터 디자인이다(색, 무늬, 소품).
4. 시트별 점검
   - **설정 시트(14a·17a)**: 알 → 아기 → 성장 → 최종으로 분명히 커지고 화려해진다. 알에는 얼굴이 없다. 최종은 판다 최종만큼 공들인 그림이다.
   - **할로윈**: 귀엽고 아늑하다. 무섭지 않다(이빨, 피, 해골, 텅 빈 눈 없음).
   - **16 몽이·핑키**: 얼굴, 털색, 무늬가 지금 아기(`dog-1`, `pig-1`)와 이어진다. 날개가 **없다**. 성장 < 최종으로 분명히 다르다. 핑키의 큰 돼지 코가 모든 칸에서 보인다.
   - **배경**: 캐릭터, 동물, 글자가 없다. 아래 60%가 평평한 바닥이고, 오른쪽 위와 왼쪽 아래(캐릭터 자리), 왼쪽 위와 오른쪽 아래(이름표 자리)가 복잡하지 않다.
   - **알 반응**: 알의 무늬와 색이 참고 그림과 같다. 금이 가거나 얼굴이 생기면 실패다.

이미지를 볼 수 있으면 4번은 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
# 14a 설정 시트: 새 펫 기본 그림 (칸마다 512px 캔버스에 세우기)
node $R/fit-assets.mjs <14a-1> pets/pumpkincat-0 pets/pumpkincat-1 pets/pumpkincat-2 pets/pumpkincat-3 --stand --preview /tmp/review/14a-1.png
node $R/fit-assets.mjs <14a-2> pets/ghost-0 pets/ghost-1 pets/ghost-2 pets/ghost-3 --stand --preview /tmp/review/14a-2.png
# 14b 표정: 위에서 만든 기본 그림에 키·발 위치를 맞춰요
node $R/fit-sheets.mjs <14b-1> pumpkincat-1-happy pumpkincat-1-eat pumpkincat-1-sad pumpkincat-1-cheer --preview /tmp/review/14b-1.png
#   14b-2·3은 pumpkincat-2·3, 14b-4·5·6은 ghost-1·2·3 (같은 모양)
node $R/fit-sheets.mjs <14b-7> pumpkincat-0-happy pumpkincat-0-eat ghost-0-happy ghost-0-eat --preview /tmp/review/14b-7.png
node $R/fit-assets.mjs <14b-8> ui/halloween-egg ui/limited-badge ui/halloween-deco-pumpkins ui/halloween-deco-moon --size 256 --preview /tmp/review/14b-8.png
# 16 몽이·핑키 (지금 그림의 키·발 위치에 맞춰 같은 이름으로 덮어써요)
node $R/fit-sheets.mjs <16-1> dog-2 dog-2-happy dog-2-eat dog-2-sad --preview /tmp/review/16-1.png
node $R/fit-sheets.mjs <16-2> dog-3 dog-3-happy dog-3-eat dog-3-sad --preview /tmp/review/16-2.png
node $R/fit-sheets.mjs <16-3> pig-2 pig-2-happy pig-2-eat pig-2-sad --preview /tmp/review/16-3.png
node $R/fit-sheets.mjs <16-4> pig-3 pig-3-happy pig-3-eat pig-3-sad --preview /tmp/review/16-4.png
node $R/fit-sheets.mjs <16-5> dog-2-cheer dog-3-cheer pig-2-cheer pig-3-cheer --preview /tmp/review/16-5.png
# 17a 설정(작업 B): 14a와 같은 방식. 키는 squirrel turtle duck sheep redpanda arcticfox koala parrot (17a-1 ~ 17a-8 순서)
# 17b 표정(작업 B): 14b와 같은 방식. 17b-1~24는 펫마다 아기·성장·최종, 17b-25~28은 알 반응 (slice-map.csv의 key 그대로)
```
- 16을 덮어쓸 때 `fit-sheets.mjs`가 기준으로 삼는 `dog-2.webp` 등은 **지금 그림**이다. 16-1을 자르기 전에 기존 `dog-2.webp`를 `/tmp/art/old/`에 복사해 두고, 미리보기에서 크기를 비교한다.
- **배경**: 고른 PNG를 1280×853 webp로 줄여 `public/assets/battle/bg-<이름>.webp`로 저장한다(`mkdir -p public/assets/battle`). 한 장에 200KB 이하가 목표다.
  ```
  sharp(src).resize(1280, 853, { fit: 'cover' }).webp({ quality: 80, effort: 6 })
  ```
  이름: `14b-9` → `bg-halloween`, `15-1` → `bg-arena`, `15-2` → `bg-practice`, `15-3` → `bg-forest`, `15-4` → `bg-boss`
- **작은 그림**: 펫 기본 그림(`<키>-<단계>.webp`, 단계 0~3)마다 `<키>-<단계>-s.webp`(160×160, 투명, `fit: 'contain'`)도 만든다. 기존 `-s.webp`와 같은 방식이다.
  - 작업 A: `pumpkincat-0~3`, `ghost-0~3`, 그리고 **새로 바뀐** `dog-2`, `dog-3`, `pig-2`, `pig-3`
  - 작업 B: 17의 8종 × 0~3
- 도구가 "배경이 투명하지 않아요"나 "칸이 비어 있어요"로 멈추면 그 시트는 1단계로 돌아가 다시 만든다.

## 3. 기록
- `docs/asset-requests/runner/DONE_14.md`(작업 B는 `DONE_17.md`)를 한국어로 쓴다.
  - 넣은 그림 표
  - 넣지 못한 그림과 이유
  - 시트마다 다시 만든 횟수
  - "눈으로 확인 필요" 항목
- 앱 코드가 아직 새 펫·배경을 쓰지 않으니 버전은 올리지 않는다. 몽이·핑키는 같은 파일 이름이라 머지하면 바로 바뀐다는 점을 PR에 적는다.

## 4. 점검
```
npm ci
npm run build:assets
npm run check            # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 그림 개수나 크기 때문에 실패하면 점검 파일을 고치지 말고, PR에 실패 메시지를 그대로 적는다.
- `git status`로 바뀐 파일을 확인한다. 아래 파일만 바뀌어야 한다.
  - `public/assets/pets/`, `public/assets/ui/`, `public/assets/battle/`
  - `public/sw.js`(빌드가 바꿈)
  - `DONE_14.md` 또는 `DONE_17.md`
- 기존 그림이 지워지지 않았는지 확인한다. `D`(삭제)가 하나도 없어야 한다.
  ```
  git diff --name-status origin/sumus-voca-prod-deploy -- public/assets
  ```
  - 작업 A에서 `M`(수정)은 `dog-2*`, `dog-3*`, `pig-2*`, `pig-3*`에만 있어야 한다.

## 5. PR
- 대상: `sumus-voca-prod-deploy`
- 제목
  - 작업 A: `그림 14~16: 할로윈 한정 펫·전투 배경·몽이 핑키 새 성장·최종`
  - 작업 B: `그림 17: 새 펫 8종`
- 본문은 한국어로 쓴다. 넣은 그림 표, 넣지 못한 그림과 이유, 점검 결과, "눈으로 확인 필요" 항목을 적는다.
- 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다.`
- 미리보기 그림(`/tmp/review/*.png`)과 배경 5장을 한 장으로 합쳐 PR 코멘트로 올린다.
- **머지하지 않는다.**
