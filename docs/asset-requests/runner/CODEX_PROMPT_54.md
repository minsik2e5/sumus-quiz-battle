# Codex 작업 지시: 그림 54 (곤충 · 공룡 펫 1차 8종(일반 4 · 영웅 4): 땡땡이(무당벌레) · 영차(개미) · 뿔뿔(트리케라톱스) · 길쭉(브라키오사우루스) · 장수(장수풍뎅이) · 팔랑(나비) · 뾰족(스테고사우루스) · 훨훨(프테라노돈))

## 목표
SUMUS VOCA(저장소 `minsik2e5/sumus-quiz-battle`)의 그림 주문서 54로 곤충 · 공룡 새 펫 그림(설정 · 표정 · 알 반응 · 야차전 공격/맞음)을 만들고, 잘라서 `public/assets/`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.** 이 펫들은 아직 `public/modules/core.js`(CHARACTERS)에 **등록되지 않았다.** 그림 PR이 머지되어도 학생에게는 나오지 않고, 그림이 다 온 뒤 다음 코드 세션에서 등록 · 특기 · 알 연결을 한다(구성안 `docs/pets-bug-dino-design.md`). 그래서 파일 이름(펫 key)을 **정확히** 지켜야 한다.

| 등급 | 묶음 | 펫 key | 이름(안) | 설정 시트 | 표정 시트 | 알 반응 | 전투 자세 |
|---|---|---|---|---|---|---|---|
| 일반 | 곤충 | `ladybug` | 땡땡이 · 무당벌레 | 54a-1 | 54b-1~3 | 54b-25 | 54c-1~3 |
| 일반 | 곤충 | `ant` | 영차 · 개미 | 54a-2 | 54b-4~6 | 54b-25 | 54c-1~3 |
| 일반 | 공룡 | `triceratops` | 뿔뿔 · 트리케라톱스 | 54a-3 | 54b-7~9 | 54b-26 | 54c-4~6 |
| 일반 | 공룡 | `brachio` | 길쭉 · 브라키오사우루스 | 54a-4 | 54b-10~12 | 54b-26 | 54c-4~6 |
| 영웅 | 곤충 | `beetle` | 장수 · 장수풍뎅이 | 54a-5 | 54b-13~15 | 54b-27 | 54c-7~9 |
| 영웅 | 곤충 | `butterfly` | 팔랑 · 나비 | 54a-6 | 54b-16~18 | 54b-27 | 54c-7~9 |
| 영웅 | 공룡 | `stego` | 뾰족 · 스테고사우루스 | 54a-7 | 54b-19~21 | 54b-28 | 54c-10~12 |
| 영웅 | 공룡 | `ptero` | 훨훨 · 프테라노돈 | 54a-8 | 54b-22~24 | 54b-28 | 54c-10~12 |

- 시트는 모두 **48장**(54a 8 · 54b 28 · 54c 12).
- 한 펫의 그림 = 기본 4 + 표정 12 + 알 반응 2 + 전투 6 + 작은 그림 4 = 28개.
- 앱은 이 파일 이름을 그대로 읽는다(`<key>-<단계>.webp`, `<key>-<단계>-<표정>.webp`, `<key>-<단계>-attack.webp`). 이름이 다르면 그 펫은 나오지 않는다.

## 그림체 (중요)
- **기존 펫과 똑같은 그림체**(3D 페인팅, 반짝이는 큰 눈, 볼터치, 금빛 테두리 빛). 곤충 · 공룡도 다른 펫과 한 가족처럼 보여야 한다.
- 곤충은 **징그럽지 않게**(동글동글한 몸, 짧은 다리 6개, 털 · 집게 · 뾰족한 부분 없음). 공룡은 **무섭지 않게**(뿔 · 가시는 둥글게), **용처럼 보이지 않게**(불 · 깃털 날개 · 갈기 없음).
- 영웅 펫은 일반 펫보다 성장 · 최종이 조금 더 화려하다.
- **만화 · 애니 캐릭터(포켓몬, 공룡 · 곤충 만화 등)를 따라 그리거나 닮게 그리지 않는다.** 모두 새 캐릭터다.
- 기존 펫 · 몬스터와 헷갈리지 않게 각 주문서의 "must look different" 문장을 지킨다.

## 꼭 지킬 것
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다. 예: `codex/art-54`
  - 그 브랜치에 `docs/asset-requests/runner/54a-bugdino-pets-design.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/pets-bug-dino-plan`에서 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** 머지하면 운영에 바로 배포된다.
- **운영 Supabase에 연결하지 않는다.**
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 그림은 **Codex에 내장된 그림 생성 기능**으로 만든다. OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- `public/assets/` 아래 새 그림, `docs/asset-requests/runner/DONE_54.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/pet-art.js` 말고는 고치지 않는다. 앱 코드(core.js 포함), 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다. 임시 폴더(`/tmp/art/`)에 둔다. 미리보기(`/tmp/review/`)도 커밋하지 않는다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/` 폴더: 시트 하나 = 프롬프트 하나. 파일 이름이 시트 번호다(예: `split/54a-1 땡땡이 무당벌레 설정 시트.txt`).
- `slice-map.csv`: 각 칸의 이름(`key`)과 앱 파일(`app_file`). `list` 열이 `54a…`·`54b…`·`54c…`인 줄만 본다. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`, `fit-sheets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 저장소 그림을 참고 그림으로 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 펫 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 곤충·공룡 펫 54 (Runner용)"에 정확한 파일 이름으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림(저장소 파일)을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same character, keep its face, colors, markings and accessories exactly. Do NOT copy any other animal or character from the references, and do NOT copy or resemble any cartoon or anime character.`

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 54a 설정 · 일반 | `pets/panda-3.webp`, `pets/mouse-2.webp`, `pets/elephant-2.webp` |
| 54a 설정 · 영웅 | `pets/panda-3.webp`, `pets/flamingo-3.webp`, `pets/quokka-2.webp` |
| 54b 표정 | 그 펫 · 단계의 새 그림 `pets/<키>-<단계>.webp` (예: 54b-1 → `pets/ladybug-1.webp`) |
| 54b 알 반응 | 두 펫의 `pets/<키>-0.webp` |
| 54c 전투 자세 | 두 펫의 그 단계 새 그림 + 기존 자세 `pets/elephant-2-attack.webp`, `pets/elephant-2-hurt.webp` |

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음).
2. 칸마다 그림이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 테두리, 바닥 그림자가 없다.
3. 같은 시트의 칸들은 같은 캐릭터 디자인이다(색, 무늬, 소품).
4. 설정 시트는 알 → 아기 → 성장 → 최종으로 분명히 커지고 화려해진다. 알에는 얼굴이 없다. 표정 · 전투 자세는 같은 단계의 몸 크기와 소품이 설정 시트와 같다. 공격은 오른쪽으로 달려들고, 맞음은 오른쪽에서 맞아 왼쪽으로 몸을 젖힌다(피 · 상처 없이 귀엽게). 곤충은 징그럽지 않고 공룡은 무섭지 않다.

이미지를 볼 수 있으면 4번은 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트: 1024×1024, **투명 배경 PNG**. 만든 그림은 `/tmp/art/<시트 번호>.png`로 저장한다(예: `/tmp/art/54a-1.png`).
- 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- **순서를 지킨다.** 설정 시트(`54a`)를 먼저 만들고 잘라 넣은 뒤, 그 그림을 참고로 표정 · 알 반응 · 전투 자세를 만든다. 순서: 54a → 54b → 54c.
- 한 번에 다 못 만들면 **펫 하나를 끝까지**(설정 · 표정 · 알 반응 · 전투) 만든 단위로 끊는다. 못 만든 시트는 `DONE_54.md`의 "넣지 못한 그림"에 적는다.

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
node $R/fit-assets.mjs /tmp/art/54a-1.png pets/ladybug-0 pets/ladybug-1 pets/ladybug-2 pets/ladybug-3 --stand --preview /tmp/review/54a-1.png
node $R/fit-assets.mjs /tmp/art/54a-2.png pets/ant-0 pets/ant-1 pets/ant-2 pets/ant-3 --stand --preview /tmp/review/54a-2.png
node $R/fit-assets.mjs /tmp/art/54a-3.png pets/triceratops-0 pets/triceratops-1 pets/triceratops-2 pets/triceratops-3 --stand --preview /tmp/review/54a-3.png
node $R/fit-assets.mjs /tmp/art/54a-4.png pets/brachio-0 pets/brachio-1 pets/brachio-2 pets/brachio-3 --stand --preview /tmp/review/54a-4.png
node $R/fit-assets.mjs /tmp/art/54a-5.png pets/beetle-0 pets/beetle-1 pets/beetle-2 pets/beetle-3 --stand --preview /tmp/review/54a-5.png
node $R/fit-assets.mjs /tmp/art/54a-6.png pets/butterfly-0 pets/butterfly-1 pets/butterfly-2 pets/butterfly-3 --stand --preview /tmp/review/54a-6.png
node $R/fit-assets.mjs /tmp/art/54a-7.png pets/stego-0 pets/stego-1 pets/stego-2 pets/stego-3 --stand --preview /tmp/review/54a-7.png
node $R/fit-assets.mjs /tmp/art/54a-8.png pets/ptero-0 pets/ptero-1 pets/ptero-2 pets/ptero-3 --stand --preview /tmp/review/54a-8.png
node $R/fit-sheets.mjs /tmp/art/54b-1.png ladybug-1-happy ladybug-1-eat ladybug-1-sad ladybug-1-cheer --preview /tmp/review/54b-1.png
node $R/fit-sheets.mjs /tmp/art/54b-2.png ladybug-2-happy ladybug-2-eat ladybug-2-sad ladybug-2-cheer --preview /tmp/review/54b-2.png
node $R/fit-sheets.mjs /tmp/art/54b-3.png ladybug-3-happy ladybug-3-eat ladybug-3-sad ladybug-3-cheer --preview /tmp/review/54b-3.png
node $R/fit-sheets.mjs /tmp/art/54b-4.png ant-1-happy ant-1-eat ant-1-sad ant-1-cheer --preview /tmp/review/54b-4.png
node $R/fit-sheets.mjs /tmp/art/54b-5.png ant-2-happy ant-2-eat ant-2-sad ant-2-cheer --preview /tmp/review/54b-5.png
node $R/fit-sheets.mjs /tmp/art/54b-6.png ant-3-happy ant-3-eat ant-3-sad ant-3-cheer --preview /tmp/review/54b-6.png
node $R/fit-sheets.mjs /tmp/art/54b-7.png triceratops-1-happy triceratops-1-eat triceratops-1-sad triceratops-1-cheer --preview /tmp/review/54b-7.png
node $R/fit-sheets.mjs /tmp/art/54b-8.png triceratops-2-happy triceratops-2-eat triceratops-2-sad triceratops-2-cheer --preview /tmp/review/54b-8.png
node $R/fit-sheets.mjs /tmp/art/54b-9.png triceratops-3-happy triceratops-3-eat triceratops-3-sad triceratops-3-cheer --preview /tmp/review/54b-9.png
node $R/fit-sheets.mjs /tmp/art/54b-10.png brachio-1-happy brachio-1-eat brachio-1-sad brachio-1-cheer --preview /tmp/review/54b-10.png
node $R/fit-sheets.mjs /tmp/art/54b-11.png brachio-2-happy brachio-2-eat brachio-2-sad brachio-2-cheer --preview /tmp/review/54b-11.png
node $R/fit-sheets.mjs /tmp/art/54b-12.png brachio-3-happy brachio-3-eat brachio-3-sad brachio-3-cheer --preview /tmp/review/54b-12.png
node $R/fit-sheets.mjs /tmp/art/54b-13.png beetle-1-happy beetle-1-eat beetle-1-sad beetle-1-cheer --preview /tmp/review/54b-13.png
node $R/fit-sheets.mjs /tmp/art/54b-14.png beetle-2-happy beetle-2-eat beetle-2-sad beetle-2-cheer --preview /tmp/review/54b-14.png
node $R/fit-sheets.mjs /tmp/art/54b-15.png beetle-3-happy beetle-3-eat beetle-3-sad beetle-3-cheer --preview /tmp/review/54b-15.png
node $R/fit-sheets.mjs /tmp/art/54b-16.png butterfly-1-happy butterfly-1-eat butterfly-1-sad butterfly-1-cheer --preview /tmp/review/54b-16.png
node $R/fit-sheets.mjs /tmp/art/54b-17.png butterfly-2-happy butterfly-2-eat butterfly-2-sad butterfly-2-cheer --preview /tmp/review/54b-17.png
node $R/fit-sheets.mjs /tmp/art/54b-18.png butterfly-3-happy butterfly-3-eat butterfly-3-sad butterfly-3-cheer --preview /tmp/review/54b-18.png
node $R/fit-sheets.mjs /tmp/art/54b-19.png stego-1-happy stego-1-eat stego-1-sad stego-1-cheer --preview /tmp/review/54b-19.png
node $R/fit-sheets.mjs /tmp/art/54b-20.png stego-2-happy stego-2-eat stego-2-sad stego-2-cheer --preview /tmp/review/54b-20.png
node $R/fit-sheets.mjs /tmp/art/54b-21.png stego-3-happy stego-3-eat stego-3-sad stego-3-cheer --preview /tmp/review/54b-21.png
node $R/fit-sheets.mjs /tmp/art/54b-22.png ptero-1-happy ptero-1-eat ptero-1-sad ptero-1-cheer --preview /tmp/review/54b-22.png
node $R/fit-sheets.mjs /tmp/art/54b-23.png ptero-2-happy ptero-2-eat ptero-2-sad ptero-2-cheer --preview /tmp/review/54b-23.png
node $R/fit-sheets.mjs /tmp/art/54b-24.png ptero-3-happy ptero-3-eat ptero-3-sad ptero-3-cheer --preview /tmp/review/54b-24.png
node $R/fit-sheets.mjs /tmp/art/54b-25.png ladybug-0-happy ladybug-0-eat ant-0-happy ant-0-eat --preview /tmp/review/54b-25.png
node $R/fit-sheets.mjs /tmp/art/54b-26.png triceratops-0-happy triceratops-0-eat brachio-0-happy brachio-0-eat --preview /tmp/review/54b-26.png
node $R/fit-sheets.mjs /tmp/art/54b-27.png beetle-0-happy beetle-0-eat butterfly-0-happy butterfly-0-eat --preview /tmp/review/54b-27.png
node $R/fit-sheets.mjs /tmp/art/54b-28.png stego-0-happy stego-0-eat ptero-0-happy ptero-0-eat --preview /tmp/review/54b-28.png
node $R/fit-sheets.mjs /tmp/art/54c-1.png ladybug-1-attack ladybug-1-hurt ant-1-attack ant-1-hurt --preview /tmp/review/54c-1.png
node $R/fit-sheets.mjs /tmp/art/54c-2.png ladybug-2-attack ladybug-2-hurt ant-2-attack ant-2-hurt --preview /tmp/review/54c-2.png
node $R/fit-sheets.mjs /tmp/art/54c-3.png ladybug-3-attack ladybug-3-hurt ant-3-attack ant-3-hurt --preview /tmp/review/54c-3.png
node $R/fit-sheets.mjs /tmp/art/54c-4.png triceratops-1-attack triceratops-1-hurt brachio-1-attack brachio-1-hurt --preview /tmp/review/54c-4.png
node $R/fit-sheets.mjs /tmp/art/54c-5.png triceratops-2-attack triceratops-2-hurt brachio-2-attack brachio-2-hurt --preview /tmp/review/54c-5.png
node $R/fit-sheets.mjs /tmp/art/54c-6.png triceratops-3-attack triceratops-3-hurt brachio-3-attack brachio-3-hurt --preview /tmp/review/54c-6.png
node $R/fit-sheets.mjs /tmp/art/54c-7.png beetle-1-attack beetle-1-hurt butterfly-1-attack butterfly-1-hurt --preview /tmp/review/54c-7.png
node $R/fit-sheets.mjs /tmp/art/54c-8.png beetle-2-attack beetle-2-hurt butterfly-2-attack butterfly-2-hurt --preview /tmp/review/54c-8.png
node $R/fit-sheets.mjs /tmp/art/54c-9.png beetle-3-attack beetle-3-hurt butterfly-3-attack butterfly-3-hurt --preview /tmp/review/54c-9.png
node $R/fit-sheets.mjs /tmp/art/54c-10.png stego-1-attack stego-1-hurt ptero-1-attack ptero-1-hurt --preview /tmp/review/54c-10.png
node $R/fit-sheets.mjs /tmp/art/54c-11.png stego-2-attack stego-2-hurt ptero-2-attack ptero-2-hurt --preview /tmp/review/54c-11.png
node $R/fit-sheets.mjs /tmp/art/54c-12.png stego-3-attack stego-3-hurt ptero-3-attack ptero-3-hurt --preview /tmp/review/54c-12.png
```
- **작은 그림**: 기본 그림(`<키>-<단계>.webp`, 단계 0~3)마다 `<키>-<단계>-s.webp`(160×160, 투명, `fit: 'contain'`)도 만든다. 8종 × 4 = 32개. 이게 없으면 그 펫은 나중에 등록해도 앱에 나오지 않는다.
- 도구가 "배경이 투명하지 않아요"나 "칸이 비어 있어요"로 멈추면 그 시트는 1단계로 돌아가 다시 만든다.

## 3. 기록
- `docs/asset-requests/runner/DONE_54.md`를 한국어로 쓴다: 펫별 넣은 그림 표, 넣지 못한 그림과 이유, 시트마다 다시 만든 횟수, "눈으로 확인 필요" 항목, **빌드 뒤 `pet-art.js`의 PET_ART에 들어간 새 키**(core.js에 등록되기 전이라 아직 학생에게는 안 나온다).
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
- 제목: `그림 54: 곤충 · 공룡 펫 1차 8종(일반 4 · 영웅 4)`
- 본문은 한국어로 쓴다. 넣은 그림 표, 넣지 못한 그림과 이유, 점검 결과, "눈으로 확인 필요" 항목.
- 마지막 줄: `> ⚠️ 그림만 들어갑니다. 펫 등록(core.js) · 특기 · 알 연결은 다음 코드 세션에서 합니다.`
- 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 합쳐 PR 코멘트로 올린다.
- **머지하지 않는다.**
