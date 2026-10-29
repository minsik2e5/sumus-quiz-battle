# Codex 작업 지시: 그림 55 (공룡 펫 6종: 뿔뿔이(아기 트리케라톱스) · 삐죽이(아기 스테고사우루스) · 롱롱이(아기 브라키오사우루스) · 휘익(아기 프테라노돈) · 단단이(아기 안킬로사우루스) · 렉스(아기 티라노사우루스))

## 목표
SUMUS VOCA(저장소 `minsik2e5/sumus-quiz-battle`)의 그림 주문서 55로 새 펫 그림(설정 · 표정 · 알 반응 · 야차전 공격/맞음)을 만들고, 잘라서 `public/assets/pets/`에 넣은 뒤 PR을 만든다. 구성안: `docs/bug-dino-pets-design.md`.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.**

> ⚠️ **이 펫들은 아직 코드(`public/modules/core.js` CHARACTERS)에 없다.** 그림이 들어와도 펫 등록 · 특기 · 알은 다음 세션에서 코드로 하므로, 그림만으로는 앱이 바뀌지 않고 깨지지도 않는다(`build:assets`가 `pet-art.js`에 key를 넣어도 등록 전에는 아무도 부르지 않는다). 선생님 결정: 새 펫은 그림이 오면 코드와 **같이 머지**한다.

| 등급 | 펫 key | 이름 | 설정 시트 | 표정 시트 | 알 반응 | 전투 자세 |
|---|---|---|---|---|---|---|
| 기본 | `tricera` | 뿔뿔이 · 아기 트리케라톱스 | 55a-1 | 55b-1~3 | 55b-19 | 55c-1~3 |
| 기본 | `stego` | 삐죽이 · 아기 스테고사우루스 | 55a-2 | 55b-4~6 | 55b-19 | 55c-1~3 |
| 기본 | `brachio` | 롱롱이 · 아기 브라키오사우루스 | 55a-3 | 55b-7~9 | 55b-20 | 55c-4~6 |
| 영웅 | `ptera` | 휘익 · 아기 프테라노돈 | 55a-4 | 55b-10~12 | 55b-20 | 55c-4~6 |
| 영웅 | `ankylo` | 단단이 · 아기 안킬로사우루스 | 55a-5 | 55b-13~15 | 55b-21 | 55c-7~9 |
| 전설 | `tyranno` | 렉스 · 아기 티라노사우루스 | 55a-6 | 55b-16~18 | 55b-21 | 55c-7~9 |

- 시트는 모두 **36장**(55a 6 · 55b 21 · 55c 9).
- 한 펫의 그림 = 기본 4 + 표정 12 + 알 반응 2 + 전투 6 + 작은 그림 4 = 28개.
- 앱은 이 파일 이름을 그대로 읽는다(`<key>-<단계>.webp`, `<key>-<단계>-<표정>.webp`, `<key>-<단계>-attack.webp`). 이름이 다르면 그 펫은 나오지 않는다.

## 그림체 (중요)
- **기존 펫과 똑같은 그림체**(3D 페인팅, 반짝이는 큰 눈, 볼터치, 금빛 테두리 빛). 영웅은 성장 · 최종이 조금 더 화려하고, 전설 렉스는 이 묶음에서 가장 화려하다(금빛 기운).
- **무섭지 않게**: 인형처럼 통통, 날카로운 이빨 · 발톱 없음. 기존 용 펫(용이)과 헷갈리지 않게(날개는 프테라노돈만, 불 없음).
- **만화 · 애니 · 게임 · 영화 캐릭터를 따라 그리거나 닮게 그리지 않는다.** 모두 새 캐릭터다. 각 주문서의 "must look different" 문장을 지킨다.

## 꼭 지킬 것
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 기존 그림을 참고 그림으로 붙인다.
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-55`). 그 브랜치에 `docs/asset-requests/runner/55a-dino-pets-design.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/bug-dino-pets-plan`에서 시작하고 PR 대상도 그 브랜치로 한다.
- `public/assets/` 아래 **새 그림**, `docs/asset-requests/runner/DONE_55.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/pet-art.js` 말고는 고치지 않는다. 앱 코드, 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다(`/tmp/art/`). 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.
- **한 번에 시트 하나씩** 만든다. 여러 시트를 한 장에 몰아 그리지 않는다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/` 폴더: 시트 하나 = 프롬프트 하나(예: `split/55a-1 뿔뿔이 아기 트리케라톱스 설정 시트.txt`).
- `slice-map.csv`: 각 칸의 이름(`key`)과 앱 파일(`app_file`). `list` 열이 `55a…`·`55b…`·`55c…`인 줄만 본다. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`, `fit-sheets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 공룡 펫 55 (Runner용)"에 정확한 파일 이름 "55a-1.png" … 으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same character, keep its face, colors, markings and accessories exactly. Do NOT copy any other animal or character from the references, and do NOT copy or resemble any cartoon, anime, game or movie character.`

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 55a 설정 | `pets/panda-3.webp`, `pets/calf-1.webp`, `pets/polarbear-2.webp`, `pets/haechi-3.webp`(전설 렉스만) |
| 55b 표정 | 그 펫 · 단계의 새 그림 `pets/<키>-<단계>.webp` (예: 55b-1 → `pets/tricera-1.webp`) |
| 55b 알 반응 | 두 펫의 `pets/<키>-0.webp` |
| 55c 전투 자세 | 두 펫의 그 단계 새 그림 + 기존 자세 `pets/elephant-2-attack.webp`, `pets/elephant-2-hurt.webp` |

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음).
2. 칸마다 그림이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 테두리, 바닥 그림자가 없다.
3. 같은 시트의 칸들은 같은 캐릭터 디자인이다(색, 무늬, 소품).
4. 설정 시트는 알 → 아기 → 성장 → 최종으로 분명히 커지고 화려해진다. 알에는 얼굴이 없다. 표정 · 전투 자세는 같은 단계의 몸 크기와 소품이 설정 시트와 같다. 공격은 오른쪽으로 달려들고, 맞음은 오른쪽에서 맞아 왼쪽으로 몸을 젖힌다(피 · 상처 없이 귀엽게).

이미지를 볼 수 있으면 4번과 "무섭지 않은지"는 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. 2×2 시트 1024×1024, **투명 배경 PNG**. 만든 그림은 `/tmp/art/<시트 번호>.png`(예: `/tmp/art/55a-1.png`).
- 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- **순서를 지킨다.** 설정 시트(`55a`)를 먼저 만들고 잘라 넣은 뒤, 그 그림을 참고로 표정 · 알 반응 · 전투 자세를 만든다. 순서: 55a → 55b → 55c.
- 한 번에 다 못 만들면 **펫 하나를 끝까지**(설정 · 표정 · 알 반응 · 전투) 만든 단위로 끊는다. 못 만든 시트는 `DONE_55.md`의 "넣지 못한 그림"에 적는다.

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
node $R/fit-assets.mjs /tmp/art/55a-1.png pets/tricera-0 pets/tricera-1 pets/tricera-2 pets/tricera-3 --stand --preview /tmp/review/55a-1.png
node $R/fit-assets.mjs /tmp/art/55a-2.png pets/stego-0 pets/stego-1 pets/stego-2 pets/stego-3 --stand --preview /tmp/review/55a-2.png
node $R/fit-assets.mjs /tmp/art/55a-3.png pets/brachio-0 pets/brachio-1 pets/brachio-2 pets/brachio-3 --stand --preview /tmp/review/55a-3.png
node $R/fit-assets.mjs /tmp/art/55a-4.png pets/ptera-0 pets/ptera-1 pets/ptera-2 pets/ptera-3 --stand --preview /tmp/review/55a-4.png
node $R/fit-assets.mjs /tmp/art/55a-5.png pets/ankylo-0 pets/ankylo-1 pets/ankylo-2 pets/ankylo-3 --stand --preview /tmp/review/55a-5.png
node $R/fit-assets.mjs /tmp/art/55a-6.png pets/tyranno-0 pets/tyranno-1 pets/tyranno-2 pets/tyranno-3 --stand --preview /tmp/review/55a-6.png
node $R/fit-sheets.mjs /tmp/art/55b-1.png tricera-1-happy tricera-1-eat tricera-1-sad tricera-1-cheer --preview /tmp/review/55b-1.png
node $R/fit-sheets.mjs /tmp/art/55b-2.png tricera-2-happy tricera-2-eat tricera-2-sad tricera-2-cheer --preview /tmp/review/55b-2.png
node $R/fit-sheets.mjs /tmp/art/55b-3.png tricera-3-happy tricera-3-eat tricera-3-sad tricera-3-cheer --preview /tmp/review/55b-3.png
node $R/fit-sheets.mjs /tmp/art/55b-4.png stego-1-happy stego-1-eat stego-1-sad stego-1-cheer --preview /tmp/review/55b-4.png
node $R/fit-sheets.mjs /tmp/art/55b-5.png stego-2-happy stego-2-eat stego-2-sad stego-2-cheer --preview /tmp/review/55b-5.png
node $R/fit-sheets.mjs /tmp/art/55b-6.png stego-3-happy stego-3-eat stego-3-sad stego-3-cheer --preview /tmp/review/55b-6.png
node $R/fit-sheets.mjs /tmp/art/55b-7.png brachio-1-happy brachio-1-eat brachio-1-sad brachio-1-cheer --preview /tmp/review/55b-7.png
node $R/fit-sheets.mjs /tmp/art/55b-8.png brachio-2-happy brachio-2-eat brachio-2-sad brachio-2-cheer --preview /tmp/review/55b-8.png
node $R/fit-sheets.mjs /tmp/art/55b-9.png brachio-3-happy brachio-3-eat brachio-3-sad brachio-3-cheer --preview /tmp/review/55b-9.png
node $R/fit-sheets.mjs /tmp/art/55b-10.png ptera-1-happy ptera-1-eat ptera-1-sad ptera-1-cheer --preview /tmp/review/55b-10.png
node $R/fit-sheets.mjs /tmp/art/55b-11.png ptera-2-happy ptera-2-eat ptera-2-sad ptera-2-cheer --preview /tmp/review/55b-11.png
node $R/fit-sheets.mjs /tmp/art/55b-12.png ptera-3-happy ptera-3-eat ptera-3-sad ptera-3-cheer --preview /tmp/review/55b-12.png
node $R/fit-sheets.mjs /tmp/art/55b-13.png ankylo-1-happy ankylo-1-eat ankylo-1-sad ankylo-1-cheer --preview /tmp/review/55b-13.png
node $R/fit-sheets.mjs /tmp/art/55b-14.png ankylo-2-happy ankylo-2-eat ankylo-2-sad ankylo-2-cheer --preview /tmp/review/55b-14.png
node $R/fit-sheets.mjs /tmp/art/55b-15.png ankylo-3-happy ankylo-3-eat ankylo-3-sad ankylo-3-cheer --preview /tmp/review/55b-15.png
node $R/fit-sheets.mjs /tmp/art/55b-16.png tyranno-1-happy tyranno-1-eat tyranno-1-sad tyranno-1-cheer --preview /tmp/review/55b-16.png
node $R/fit-sheets.mjs /tmp/art/55b-17.png tyranno-2-happy tyranno-2-eat tyranno-2-sad tyranno-2-cheer --preview /tmp/review/55b-17.png
node $R/fit-sheets.mjs /tmp/art/55b-18.png tyranno-3-happy tyranno-3-eat tyranno-3-sad tyranno-3-cheer --preview /tmp/review/55b-18.png
node $R/fit-sheets.mjs /tmp/art/55b-19.png tricera-0-happy tricera-0-eat stego-0-happy stego-0-eat --preview /tmp/review/55b-19.png
node $R/fit-sheets.mjs /tmp/art/55b-20.png brachio-0-happy brachio-0-eat ptera-0-happy ptera-0-eat --preview /tmp/review/55b-20.png
node $R/fit-sheets.mjs /tmp/art/55b-21.png ankylo-0-happy ankylo-0-eat tyranno-0-happy tyranno-0-eat --preview /tmp/review/55b-21.png
node $R/fit-sheets.mjs /tmp/art/55c-1.png tricera-1-attack tricera-1-hurt stego-1-attack stego-1-hurt --preview /tmp/review/55c-1.png
node $R/fit-sheets.mjs /tmp/art/55c-2.png tricera-2-attack tricera-2-hurt stego-2-attack stego-2-hurt --preview /tmp/review/55c-2.png
node $R/fit-sheets.mjs /tmp/art/55c-3.png tricera-3-attack tricera-3-hurt stego-3-attack stego-3-hurt --preview /tmp/review/55c-3.png
node $R/fit-sheets.mjs /tmp/art/55c-4.png brachio-1-attack brachio-1-hurt ptera-1-attack ptera-1-hurt --preview /tmp/review/55c-4.png
node $R/fit-sheets.mjs /tmp/art/55c-5.png brachio-2-attack brachio-2-hurt ptera-2-attack ptera-2-hurt --preview /tmp/review/55c-5.png
node $R/fit-sheets.mjs /tmp/art/55c-6.png brachio-3-attack brachio-3-hurt ptera-3-attack ptera-3-hurt --preview /tmp/review/55c-6.png
node $R/fit-sheets.mjs /tmp/art/55c-7.png ankylo-1-attack ankylo-1-hurt tyranno-1-attack tyranno-1-hurt --preview /tmp/review/55c-7.png
node $R/fit-sheets.mjs /tmp/art/55c-8.png ankylo-2-attack ankylo-2-hurt tyranno-2-attack tyranno-2-hurt --preview /tmp/review/55c-8.png
node $R/fit-sheets.mjs /tmp/art/55c-9.png ankylo-3-attack ankylo-3-hurt tyranno-3-attack tyranno-3-hurt --preview /tmp/review/55c-9.png
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
- `docs/asset-requests/runner/DONE_55.md`(한국어): 넣은 그림 표, 넣지 못한 그림과 이유, 시트마다 다시 만든 횟수, "눈으로 확인 필요". 마지막에 "새 펫 · 알 · 칭호는 코드 등록(다음 세션) 후에 앱에 나온다"를 적는다.
- PR 제목 `그림 55: 공룡 펫 6종`, 본문 한국어. 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 작게 합쳐 PR 코멘트로 올린다. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.`
