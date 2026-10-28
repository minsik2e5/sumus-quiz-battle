# Codex 작업 지시: 그림 55 (곤충 · 공룡 펫 2차 4종(전설 1 · 신화 1 · 특이 2): 쿵쾅(티라노사우루스) · 태고(고대 왕잠자리) · 합격이(사마귀) · 짱돌(파키케팔로사우루스))

## 목표
SUMUS VOCA(저장소 `minsik2e5/sumus-quiz-battle`)의 그림 주문서 55로 곤충 · 공룡 새 펫 그림(설정 · 표정 · 알 반응 · 야차전 공격/맞음 · 신화 등장 포즈 · 등장 배경)을 만들고, 잘라서 `public/assets/`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.** 이 펫들은 아직 `public/modules/core.js`(CHARACTERS)에 **등록되지 않았다.** 그림 PR이 머지되어도 학생에게는 나오지 않고, 그림이 다 온 뒤 다음 코드 세션에서 등록 · 특기 · 알 연결을 한다(구성안 `docs/pets-bug-dino-design.md`). 그래서 파일 이름(펫 key)을 **정확히** 지켜야 한다.

| 등급 | 묶음 | 펫 key | 이름(안) | 설정 시트 | 표정 시트 | 알 반응 | 전투 자세 |
|---|---|---|---|---|---|---|---|
| 전설 | 공룡 | `trex` | 쿵쾅 · 티라노사우루스 | 55a-1 | 55b-1~3 | 55b-13 | 55c-1~3 |
| 신화 | 곤충 | `meganeura` | 태고 · 고대 왕잠자리 | 55a-2 | 55b-4~6 | 55b-13 | 55c-1~3 |
| 특이 | 곤충 | `mantis` | 합격이 · 사마귀 | 55a-3 | 55b-7~9 | 55b-14 | 55c-4~6 |
| 특이 | 공룡 | `pachy` | 짱돌 · 파키케팔로사우루스 | 55a-4 | 55b-10~12 | 55b-14 | 55c-4~6 |

- 시트는 모두 **26장**(55a 4 · 55b 14 · 55c 6 · 55d 1 · 55e 1).
- 한 펫의 그림 = 기본 4 + 표정 12 + 알 반응 2 + 전투 6 + 작은 그림 4 = 28개. 신화 태고는 여기에 등장 포즈 1 + 등장 배경 1.
- 앱은 이 파일 이름을 그대로 읽는다(`<key>-<단계>.webp`, `<key>-<단계>-<표정>.webp`, `<key>-<단계>-attack.webp`, `<key>-reveal.webp`, `reveal/bg-<key>.webp`). 이름이 다르면 그 펫은 나오지 않는다.
- `55d-1`은 태고의 등장 포즈 네 가지다. 왼쪽 위가 기본이고, 다른 칸이 더 나으면 그 칸을 `pets/meganeura-reveal`로 넣는다.

## 그림체 (중요)
- **기존 펫과 똑같은 그림체**(3D 페인팅, 반짝이는 큰 눈, 볼터치, 금빛 테두리 빛). 곤충 · 공룡도 다른 펫과 한 가족처럼 보여야 한다.
- 곤충은 **징그럽지 않게**(동글동글한 몸, 짧은 다리 6개, 털 · 집게 · 뾰족한 부분 없음). 공룡은 **무섭지 않게**(뿔 · 가시는 둥글게), **용처럼 보이지 않게**(불 · 깃털 날개 · 갈기 없음).
- 전설 쿵쾅: 해치 · 별고래처럼 금빛 오라. 신화 태고: 청룡 · 주작만큼 웅장하게(무지개빛 금 테두리 빛). 특이 합격이 · 짱돌: 술술이 · 찰싹이처럼 웃긴 마스코트 느낌.
- **만화 · 애니 캐릭터(포켓몬, 공룡 · 곤충 만화 등)를 따라 그리거나 닮게 그리지 않는다.** 모두 새 캐릭터다.
- 기존 펫 · 몬스터와 헷갈리지 않게 각 주문서의 "must look different" 문장을 지킨다.

## 꼭 지킬 것
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다. 예: `codex/art-55`
  - 그 브랜치에 `docs/asset-requests/runner/55a-bugdino-pets2-design.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/pets-bug-dino-plan`에서 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** 머지하면 운영에 바로 배포된다.
- **운영 Supabase에 연결하지 않는다.**
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 그림은 **Codex에 내장된 그림 생성 기능**으로 만든다. OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- `public/assets/` 아래 새 그림, `docs/asset-requests/runner/DONE_55.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/pet-art.js` 말고는 고치지 않는다. 앱 코드(core.js 포함), 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다. 임시 폴더(`/tmp/art/`)에 둔다. 미리보기(`/tmp/review/`)도 커밋하지 않는다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/` 폴더: 시트 하나 = 프롬프트 하나. 파일 이름이 시트 번호다(예: `split/55a-1 쿵쾅 티라노사우루스 설정 시트.txt`).
- `slice-map.csv`: 각 칸의 이름(`key`)과 앱 파일(`app_file`). `list` 열이 `55a…`·`55b…`·`55c…`·`55d…`·`55e…`인 줄만 본다. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`, `fit-sheets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 저장소 그림을 참고 그림으로 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 펫 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 곤충·공룡 펫 55 (Runner용)"에 정확한 파일 이름으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림(저장소 파일)을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same character, keep its face, colors, markings and accessories exactly. Do NOT copy any other animal or character from the references, and do NOT copy or resemble any cartoon or anime character.`

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 55a 설정 · 전설 | `pets/panda-3.webp`, `pets/haechi-3.webp`, `pets/whale-3.webp` |
| 55a 설정 · 신화 | `pets/panda-3.webp`, `pets/cheongryong-3.webp`, `pets/jujak-3.webp` |
| 55a 설정 · 특이 | `pets/panda-3.webp`, `pets/tissue-2.webp`, `pets/glue-2.webp` |
| 55b 표정 | 그 펫 · 단계의 새 그림 `pets/<키>-<단계>.webp` (예: 55b-1 → `pets/trex-1.webp`) |
| 55b 알 반응 | 두 펫의 `pets/<키>-0.webp` |
| 55c 전투 자세 | 두 펫의 그 단계 새 그림 + 기존 자세 `pets/elephant-2-attack.webp`, `pets/elephant-2-hurt.webp` |
| 55d 등장 포즈 | 새 `pets/meganeura-3.webp` + 기존 `pets/cheongryong-reveal.webp` |
| 55e 등장 배경 | 기존 `reveal/bg-cheongryong.webp`, `reveal/bg-jujak.webp` |

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음). 등장 배경(55e)만 투명이 아니고 가장자리까지 꽉 채운다.
2. 칸마다 그림이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 테두리, 바닥 그림자가 없다.
3. 같은 시트의 칸들은 같은 캐릭터 디자인이다(색, 무늬, 소품).
4. 설정 시트는 알 → 아기 → 성장 → 최종으로 분명히 커지고 화려해진다. 알에는 얼굴이 없다. 표정 · 전투 자세는 같은 단계의 몸 크기와 소품이 설정 시트와 같다. 공격은 오른쪽으로 달려들고, 맞음은 오른쪽에서 맞아 왼쪽으로 몸을 젖힌다(피 · 상처 없이 귀엽게). 곤충은 징그럽지 않고 공룡은 무섭지 않다. 태고(고대 왕잠자리)는 모든 그림에서 날개가 4장이다.

이미지를 볼 수 있으면 4번은 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트: 1024×1024, **투명 배경 PNG**. 등장 배경: 1024×1536, 투명 아님. 만든 그림은 `/tmp/art/<시트 번호>.png`로 저장한다(예: `/tmp/art/55a-1.png`).
- 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- **순서를 지킨다.** 설정 시트(`55a`)를 먼저 만들고 잘라 넣은 뒤, 그 그림을 참고로 표정 · 알 반응 · 전투 자세를 만든다. 순서: 55a → 55b → 55c → 55d → 55e.
- 한 번에 다 못 만들면 **펫 하나를 끝까지**(설정 · 표정 · 알 반응 · 전투) 만든 단위로 끊는다. 못 만든 시트는 `DONE_55.md`의 "넣지 못한 그림"에 적는다.

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
node $R/fit-assets.mjs /tmp/art/55a-1.png pets/trex-0 pets/trex-1 pets/trex-2 pets/trex-3 --stand --preview /tmp/review/55a-1.png
node $R/fit-assets.mjs /tmp/art/55a-2.png pets/meganeura-0 pets/meganeura-1 pets/meganeura-2 pets/meganeura-3 --stand --preview /tmp/review/55a-2.png
node $R/fit-assets.mjs /tmp/art/55a-3.png pets/mantis-0 pets/mantis-1 pets/mantis-2 pets/mantis-3 --stand --preview /tmp/review/55a-3.png
node $R/fit-assets.mjs /tmp/art/55a-4.png pets/pachy-0 pets/pachy-1 pets/pachy-2 pets/pachy-3 --stand --preview /tmp/review/55a-4.png
node $R/fit-sheets.mjs /tmp/art/55b-1.png trex-1-happy trex-1-eat trex-1-sad trex-1-cheer --preview /tmp/review/55b-1.png
node $R/fit-sheets.mjs /tmp/art/55b-2.png trex-2-happy trex-2-eat trex-2-sad trex-2-cheer --preview /tmp/review/55b-2.png
node $R/fit-sheets.mjs /tmp/art/55b-3.png trex-3-happy trex-3-eat trex-3-sad trex-3-cheer --preview /tmp/review/55b-3.png
node $R/fit-sheets.mjs /tmp/art/55b-4.png meganeura-1-happy meganeura-1-eat meganeura-1-sad meganeura-1-cheer --preview /tmp/review/55b-4.png
node $R/fit-sheets.mjs /tmp/art/55b-5.png meganeura-2-happy meganeura-2-eat meganeura-2-sad meganeura-2-cheer --preview /tmp/review/55b-5.png
node $R/fit-sheets.mjs /tmp/art/55b-6.png meganeura-3-happy meganeura-3-eat meganeura-3-sad meganeura-3-cheer --preview /tmp/review/55b-6.png
node $R/fit-sheets.mjs /tmp/art/55b-7.png mantis-1-happy mantis-1-eat mantis-1-sad mantis-1-cheer --preview /tmp/review/55b-7.png
node $R/fit-sheets.mjs /tmp/art/55b-8.png mantis-2-happy mantis-2-eat mantis-2-sad mantis-2-cheer --preview /tmp/review/55b-8.png
node $R/fit-sheets.mjs /tmp/art/55b-9.png mantis-3-happy mantis-3-eat mantis-3-sad mantis-3-cheer --preview /tmp/review/55b-9.png
node $R/fit-sheets.mjs /tmp/art/55b-10.png pachy-1-happy pachy-1-eat pachy-1-sad pachy-1-cheer --preview /tmp/review/55b-10.png
node $R/fit-sheets.mjs /tmp/art/55b-11.png pachy-2-happy pachy-2-eat pachy-2-sad pachy-2-cheer --preview /tmp/review/55b-11.png
node $R/fit-sheets.mjs /tmp/art/55b-12.png pachy-3-happy pachy-3-eat pachy-3-sad pachy-3-cheer --preview /tmp/review/55b-12.png
node $R/fit-sheets.mjs /tmp/art/55b-13.png trex-0-happy trex-0-eat meganeura-0-happy meganeura-0-eat --preview /tmp/review/55b-13.png
node $R/fit-sheets.mjs /tmp/art/55b-14.png mantis-0-happy mantis-0-eat pachy-0-happy pachy-0-eat --preview /tmp/review/55b-14.png
node $R/fit-sheets.mjs /tmp/art/55c-1.png trex-1-attack trex-1-hurt meganeura-1-attack meganeura-1-hurt --preview /tmp/review/55c-1.png
node $R/fit-sheets.mjs /tmp/art/55c-2.png trex-2-attack trex-2-hurt meganeura-2-attack meganeura-2-hurt --preview /tmp/review/55c-2.png
node $R/fit-sheets.mjs /tmp/art/55c-3.png trex-3-attack trex-3-hurt meganeura-3-attack meganeura-3-hurt --preview /tmp/review/55c-3.png
node $R/fit-sheets.mjs /tmp/art/55c-4.png mantis-1-attack mantis-1-hurt pachy-1-attack pachy-1-hurt --preview /tmp/review/55c-4.png
node $R/fit-sheets.mjs /tmp/art/55c-5.png mantis-2-attack mantis-2-hurt pachy-2-attack pachy-2-hurt --preview /tmp/review/55c-5.png
node $R/fit-sheets.mjs /tmp/art/55c-6.png mantis-3-attack mantis-3-hurt pachy-3-attack pachy-3-hurt --preview /tmp/review/55c-6.png
node $R/fit-assets.mjs /tmp/art/55d-1.png pets/meganeura-reveal - - - --fit-each --size 1024 --preview /tmp/review/55d-1.png   # 여분 칸(-)이 더 나으면 그 칸을 pets/meganeura-reveal로
# 55e-1: 1024×1536 PNG → 720×1080 webp(150KB 이하): public/assets/reveal/bg-meganeura.webp
```
- **작은 그림**: 기본 그림(`<키>-<단계>.webp`, 단계 0~3)마다 `<키>-<단계>-s.webp`(160×160, 투명, `fit: 'contain'`)도 만든다. 4종 × 4 = 16개. 이게 없으면 그 펫은 나중에 등록해도 앱에 나오지 않는다.
- **등장 배경(55e)**: 고른 PNG를 `sharp(src).resize(720, 1080, { fit: 'cover' }).webp({ quality: 80, effort: 6 })`로 줄여 `public/assets/reveal/bg-meganeura.webp`로 저장한다. 등장 포즈와 등장 배경이 없으면 신화 펫은 나오지 않는다.
- 도구가 "배경이 투명하지 않아요"나 "칸이 비어 있어요"로 멈추면 그 시트는 1단계로 돌아가 다시 만든다.

## 3. 기록
- `docs/asset-requests/runner/DONE_55.md`를 한국어로 쓴다: 펫별 넣은 그림 표, 넣지 못한 그림과 이유, 시트마다 다시 만든 횟수, "눈으로 확인 필요" 항목, **빌드 뒤 `pet-art.js`의 PET_ART에 들어간 새 키**(core.js에 등록되기 전이라 아직 학생에게는 안 나온다).
- 버전은 올리지 않는다.

## 4. 점검
```
npm ci
npm run build:assets      # public/modules/pet-art.js가 바뀐다(그림이 다 들어온 키가 PET_ART에 들어간다)
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`

## 5. PR
- 대상: `sumus-voca-prod-deploy`
- 제목: `그림 55: 곤충 · 공룡 펫 2차 4종(전설 1 · 신화 1 · 특이 2)`
- 본문은 한국어로 쓴다. 넣은 그림 표, 넣지 못한 그림과 이유, 점검 결과, "눈으로 확인 필요" 항목.
- 마지막 줄: `> ⚠️ 그림만 들어갑니다. 펫 등록(core.js) · 특기 · 알 연결은 다음 코드 세션에서 합니다.`
- 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 합쳐 PR 코멘트로 올린다.
- **머지하지 않는다.**
