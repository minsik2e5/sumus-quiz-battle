# Codex 작업 지시: 그림 54 (곤충 펫 6종: 점순이(무당벌레) · 붕붕이(꿀벌) · 영차(일개미) · 반짝이(반딧불이) · 장수(장수풍뎅이) · 나풀(호랑나비))

## 목표
SUMUS VOCA(저장소 `minsik2e5/sumus-quiz-battle`)의 그림 주문서 54로 새 펫 그림(설정 · 표정 · 알 반응 · 야차전 공격/맞음)을 만들고, 잘라서 `public/assets/pets/`에 넣은 뒤 PR을 만든다. 구성안: `docs/bug-dino-pets-design.md`.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.**

> ⚠️ **이 펫들은 아직 코드(`public/modules/core.js` CHARACTERS)에 없다.** 그림이 들어와도 펫 등록 · 특기 · 알은 다음 세션에서 코드로 하므로, 그림만으로는 앱이 바뀌지 않고 깨지지도 않는다(`build:assets`가 `pet-art.js`에 key를 넣어도 등록 전에는 아무도 부르지 않는다). 선생님 결정: 새 펫은 그림이 오면 코드와 **같이 머지**한다.

| 등급 | 펫 key | 이름 | 설정 시트 | 표정 시트 | 알 반응 | 전투 자세 |
|---|---|---|---|---|---|---|
| 기본 | `ladybug` | 점순이 · 무당벌레 | 54a-1 | 54b-1~3 | 54b-19 | 54c-1~3 |
| 기본 | `bee` | 붕붕이 · 꿀벌 | 54a-2 | 54b-4~6 | 54b-19 | 54c-1~3 |
| 기본 | `ant` | 영차 · 일개미 | 54a-3 | 54b-7~9 | 54b-20 | 54c-4~6 |
| 기본 | `firefly` | 반짝이 · 반딧불이 | 54a-4 | 54b-10~12 | 54b-20 | 54c-4~6 |
| 영웅 | `rhinobeetle` | 장수 · 장수풍뎅이 | 54a-5 | 54b-13~15 | 54b-21 | 54c-7~9 |
| 영웅 | `butterfly` | 나풀 · 호랑나비 | 54a-6 | 54b-16~18 | 54b-21 | 54c-7~9 |

- 시트는 모두 **36장**(54a 6 · 54b 21 · 54c 9).
- 한 펫의 그림 = 기본 4 + 표정 12 + 알 반응 2 + 전투 6 + 작은 그림 4 = 28개.
- 앱은 이 파일 이름을 그대로 읽는다(`<key>-<단계>.webp`, `<key>-<단계>-<표정>.webp`, `<key>-<단계>-attack.webp`). 이름이 다르면 그 펫은 나오지 않는다.

## 그림체 (중요)
- **기존 펫과 똑같은 그림체**(3D 페인팅, 반짝이는 큰 눈, 볼터치, 금빛 테두리 빛). 영웅은 성장 · 최종이 조금 더 화려하고.
- **곤충을 싫어하는 학생도 귀엽게 볼 수 있게**: 인형처럼 동글동글, 다리는 짧고 뭉툭한 6개, 털 · 집게 · 겹눈 같은 실제 벌레 느낌 없음. 징그러우면 다시 만든다.
- **만화 · 애니 · 게임 · 영화 캐릭터를 따라 그리거나 닮게 그리지 않는다.** 모두 새 캐릭터다. 각 주문서의 "must look different" 문장을 지킨다.

## 꼭 지킬 것
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 기존 그림을 참고 그림으로 붙인다.
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-54`). 그 브랜치에 `docs/asset-requests/runner/54a-bug-pets-design.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/bug-dino-pets-plan`에서 시작하고 PR 대상도 그 브랜치로 한다.
- `public/assets/` 아래 **새 그림**, `docs/asset-requests/runner/DONE_54.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/pet-art.js` 말고는 고치지 않는다. 앱 코드, 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다(`/tmp/art/`). 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.
- **한 번에 시트 하나씩** 만든다. 여러 시트를 한 장에 몰아 그리지 않는다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/` 폴더: 시트 하나 = 프롬프트 하나(예: `split/54a-1 점순이 무당벌레 설정 시트.txt`).
- `slice-map.csv`: 각 칸의 이름(`key`)과 앱 파일(`app_file`). `list` 열이 `54a…`·`54b…`·`54c…`인 줄만 본다. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`, `fit-sheets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 곤충 펫 54 (Runner용)"에 정확한 파일 이름 "54a-1.png" … 으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same character, keep its face, colors, markings and accessories exactly. Do NOT copy any other animal or character from the references, and do NOT copy or resemble any cartoon, anime, game or movie character.`

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 54a 설정 | `pets/panda-3.webp`, `pets/mouse-1.webp`, `pets/hummingbird-2.webp`, `pets/chameleon-3.webp` |
| 54b 표정 | 그 펫 · 단계의 새 그림 `pets/<키>-<단계>.webp` (예: 54b-1 → `pets/ladybug-1.webp`) |
| 54b 알 반응 | 두 펫의 `pets/<키>-0.webp` |
| 54c 전투 자세 | 두 펫의 그 단계 새 그림 + 기존 자세 `pets/elephant-2-attack.webp`, `pets/elephant-2-hurt.webp` |

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음).
2. 칸마다 그림이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 테두리, 바닥 그림자가 없다.
3. 같은 시트의 칸들은 같은 캐릭터 디자인이다(색, 무늬, 소품).
4. 설정 시트는 알 → 아기 → 성장 → 최종으로 분명히 커지고 화려해진다. 알에는 얼굴이 없다. 표정 · 전투 자세는 같은 단계의 몸 크기와 소품이 설정 시트와 같다. 공격은 오른쪽으로 달려들고, 맞음은 오른쪽에서 맞아 왼쪽으로 몸을 젖힌다(피 · 상처 없이 귀엽게).

이미지를 볼 수 있으면 4번과 "징그럽지 않은지"는 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. 2×2 시트 1024×1024, **투명 배경 PNG**. 만든 그림은 `/tmp/art/<시트 번호>.png`(예: `/tmp/art/54a-1.png`).
- 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- **순서를 지킨다.** 설정 시트(`54a`)를 먼저 만들고 잘라 넣은 뒤, 그 그림을 참고로 표정 · 알 반응 · 전투 자세를 만든다. 순서: 54a → 54b → 54c.
- 한 번에 다 못 만들면 **펫 하나를 끝까지**(설정 · 표정 · 알 반응 · 전투) 만든 단위로 끊는다. 못 만든 시트는 `DONE_54.md`의 "넣지 못한 그림"에 적는다.

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
node $R/fit-assets.mjs /tmp/art/54a-1.png pets/ladybug-0 pets/ladybug-1 pets/ladybug-2 pets/ladybug-3 --stand --preview /tmp/review/54a-1.png
node $R/fit-assets.mjs /tmp/art/54a-2.png pets/bee-0 pets/bee-1 pets/bee-2 pets/bee-3 --stand --preview /tmp/review/54a-2.png
node $R/fit-assets.mjs /tmp/art/54a-3.png pets/ant-0 pets/ant-1 pets/ant-2 pets/ant-3 --stand --preview /tmp/review/54a-3.png
node $R/fit-assets.mjs /tmp/art/54a-4.png pets/firefly-0 pets/firefly-1 pets/firefly-2 pets/firefly-3 --stand --preview /tmp/review/54a-4.png
node $R/fit-assets.mjs /tmp/art/54a-5.png pets/rhinobeetle-0 pets/rhinobeetle-1 pets/rhinobeetle-2 pets/rhinobeetle-3 --stand --preview /tmp/review/54a-5.png
node $R/fit-assets.mjs /tmp/art/54a-6.png pets/butterfly-0 pets/butterfly-1 pets/butterfly-2 pets/butterfly-3 --stand --preview /tmp/review/54a-6.png
node $R/fit-sheets.mjs /tmp/art/54b-1.png ladybug-1-happy ladybug-1-eat ladybug-1-sad ladybug-1-cheer --preview /tmp/review/54b-1.png
node $R/fit-sheets.mjs /tmp/art/54b-2.png ladybug-2-happy ladybug-2-eat ladybug-2-sad ladybug-2-cheer --preview /tmp/review/54b-2.png
node $R/fit-sheets.mjs /tmp/art/54b-3.png ladybug-3-happy ladybug-3-eat ladybug-3-sad ladybug-3-cheer --preview /tmp/review/54b-3.png
node $R/fit-sheets.mjs /tmp/art/54b-4.png bee-1-happy bee-1-eat bee-1-sad bee-1-cheer --preview /tmp/review/54b-4.png
node $R/fit-sheets.mjs /tmp/art/54b-5.png bee-2-happy bee-2-eat bee-2-sad bee-2-cheer --preview /tmp/review/54b-5.png
node $R/fit-sheets.mjs /tmp/art/54b-6.png bee-3-happy bee-3-eat bee-3-sad bee-3-cheer --preview /tmp/review/54b-6.png
node $R/fit-sheets.mjs /tmp/art/54b-7.png ant-1-happy ant-1-eat ant-1-sad ant-1-cheer --preview /tmp/review/54b-7.png
node $R/fit-sheets.mjs /tmp/art/54b-8.png ant-2-happy ant-2-eat ant-2-sad ant-2-cheer --preview /tmp/review/54b-8.png
node $R/fit-sheets.mjs /tmp/art/54b-9.png ant-3-happy ant-3-eat ant-3-sad ant-3-cheer --preview /tmp/review/54b-9.png
node $R/fit-sheets.mjs /tmp/art/54b-10.png firefly-1-happy firefly-1-eat firefly-1-sad firefly-1-cheer --preview /tmp/review/54b-10.png
node $R/fit-sheets.mjs /tmp/art/54b-11.png firefly-2-happy firefly-2-eat firefly-2-sad firefly-2-cheer --preview /tmp/review/54b-11.png
node $R/fit-sheets.mjs /tmp/art/54b-12.png firefly-3-happy firefly-3-eat firefly-3-sad firefly-3-cheer --preview /tmp/review/54b-12.png
node $R/fit-sheets.mjs /tmp/art/54b-13.png rhinobeetle-1-happy rhinobeetle-1-eat rhinobeetle-1-sad rhinobeetle-1-cheer --preview /tmp/review/54b-13.png
node $R/fit-sheets.mjs /tmp/art/54b-14.png rhinobeetle-2-happy rhinobeetle-2-eat rhinobeetle-2-sad rhinobeetle-2-cheer --preview /tmp/review/54b-14.png
node $R/fit-sheets.mjs /tmp/art/54b-15.png rhinobeetle-3-happy rhinobeetle-3-eat rhinobeetle-3-sad rhinobeetle-3-cheer --preview /tmp/review/54b-15.png
node $R/fit-sheets.mjs /tmp/art/54b-16.png butterfly-1-happy butterfly-1-eat butterfly-1-sad butterfly-1-cheer --preview /tmp/review/54b-16.png
node $R/fit-sheets.mjs /tmp/art/54b-17.png butterfly-2-happy butterfly-2-eat butterfly-2-sad butterfly-2-cheer --preview /tmp/review/54b-17.png
node $R/fit-sheets.mjs /tmp/art/54b-18.png butterfly-3-happy butterfly-3-eat butterfly-3-sad butterfly-3-cheer --preview /tmp/review/54b-18.png
node $R/fit-sheets.mjs /tmp/art/54b-19.png ladybug-0-happy ladybug-0-eat bee-0-happy bee-0-eat --preview /tmp/review/54b-19.png
node $R/fit-sheets.mjs /tmp/art/54b-20.png ant-0-happy ant-0-eat firefly-0-happy firefly-0-eat --preview /tmp/review/54b-20.png
node $R/fit-sheets.mjs /tmp/art/54b-21.png rhinobeetle-0-happy rhinobeetle-0-eat butterfly-0-happy butterfly-0-eat --preview /tmp/review/54b-21.png
node $R/fit-sheets.mjs /tmp/art/54c-1.png ladybug-1-attack ladybug-1-hurt bee-1-attack bee-1-hurt --preview /tmp/review/54c-1.png
node $R/fit-sheets.mjs /tmp/art/54c-2.png ladybug-2-attack ladybug-2-hurt bee-2-attack bee-2-hurt --preview /tmp/review/54c-2.png
node $R/fit-sheets.mjs /tmp/art/54c-3.png ladybug-3-attack ladybug-3-hurt bee-3-attack bee-3-hurt --preview /tmp/review/54c-3.png
node $R/fit-sheets.mjs /tmp/art/54c-4.png ant-1-attack ant-1-hurt firefly-1-attack firefly-1-hurt --preview /tmp/review/54c-4.png
node $R/fit-sheets.mjs /tmp/art/54c-5.png ant-2-attack ant-2-hurt firefly-2-attack firefly-2-hurt --preview /tmp/review/54c-5.png
node $R/fit-sheets.mjs /tmp/art/54c-6.png ant-3-attack ant-3-hurt firefly-3-attack firefly-3-hurt --preview /tmp/review/54c-6.png
node $R/fit-sheets.mjs /tmp/art/54c-7.png rhinobeetle-1-attack rhinobeetle-1-hurt butterfly-1-attack butterfly-1-hurt --preview /tmp/review/54c-7.png
node $R/fit-sheets.mjs /tmp/art/54c-8.png rhinobeetle-2-attack rhinobeetle-2-hurt butterfly-2-attack butterfly-2-hurt --preview /tmp/review/54c-8.png
node $R/fit-sheets.mjs /tmp/art/54c-9.png rhinobeetle-3-attack rhinobeetle-3-hurt butterfly-3-attack butterfly-3-hurt --preview /tmp/review/54c-9.png
```
- **작은 그림**: 기본 그림(`<키>-<단계>.webp`, 단계 0~3)마다 `<키>-<단계>-s.webp`(160×160, 투명, `fit: 'contain'`)도 만든다. 6종 × 4 = 24개.
- 도구가 "배경이 투명하지 않아요"나 "칸이 비어 있어요"로 멈추면 그 시트는 1단계로 돌아가 다시 만든다.

## 점검
```
npm ci
npm run build:assets      # 펫 그림이면 public/modules/pet-art.js가 바뀐다(새 펫 key가 들어가도 core.js에 등록되기 전에는 앱에 나오지 않는다)
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `docs/asset-requests/runner/DONE_54.md`(한국어): 넣은 그림 표, 넣지 못한 그림과 이유, 시트마다 다시 만든 횟수, "눈으로 확인 필요". 마지막에 "새 펫 · 알 · 칭호는 코드 등록(다음 세션) 후에 앱에 나온다"를 적는다.
- PR 제목 `그림 54: 곤충 펫 6종`, 본문 한국어. 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 작게 합쳐 PR 코멘트로 올린다. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.`
