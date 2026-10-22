# Codex 작업 지시: 그림 37 (영웅 펫 6종: 밍고(플라밍고) · 방긋(쿼카) · 카멜(카멜레온) · 눈곰(아기 북극곰) · 설표(아기 눈표범) · 윙윙(벌새))

## 목표
SUMUS VOCA(저장소 `minsik2e5/sumus-quiz-battle`)의 그림 주문서 37로 새 펫 그림(설정 · 표정 · 알 반응 · 야차전 공격/맞음)을 만들고, 잘라서 `public/assets/`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.** 펫 등록 · 특기 · 알 · 도감 연결은 이미 되어 있고, `npm run build:assets`가 그림 폴더를 보고 `public/modules/pet-art.js`를 다시 만들면 **그림이 다 들어온 펫만 자동으로** 알 · 선생님 선물 알 · 몬스터 사냥 · 낚시 교환소 · 도감에 나온다(한 장이라도 빠진 펫은 계속 숨는다).

| 등급 | 펫 key | 이름 | 설정 시트 | 표정 시트 | 알 반응 | 전투 자세 |
|---|---|---|---|---|---|---|
| 영웅 | `flamingo` | 밍고 · 플라밍고 | 37a-1 | 37b-1~3 | 37b-19 | 37c-1~3 |
| 영웅 | `quokka` | 방긋 · 쿼카 | 37a-2 | 37b-4~6 | 37b-19 | 37c-1~3 |
| 영웅 | `chameleon` | 카멜 · 카멜레온 | 37a-3 | 37b-7~9 | 37b-20 | 37c-4~6 |
| 영웅 | `polarbear` | 눈곰 · 아기 북극곰 | 37a-4 | 37b-10~12 | 37b-20 | 37c-4~6 |
| 영웅 | `snowleopard` | 설표 · 아기 눈표범 | 37a-5 | 37b-13~15 | 37b-21 | 37c-7~9 |
| 영웅 | `hummingbird` | 윙윙 · 벌새 | 37a-6 | 37b-16~18 | 37b-21 | 37c-7~9 |

- 시트는 모두 **36장**(37a 6 · 37b 21 · 37c 9).
- 한 펫의 그림 = 기본 4 + 표정 12 + 알 반응 2 + 전투 6 + 작은 그림 4 = 28개.
- 앱은 이 파일 이름을 그대로 읽는다(`<key>-<단계>.webp`, `<key>-<단계>-<표정>.webp`, `<key>-<단계>-attack.webp`). 이름이 다르면 그 펫은 나오지 않는다.

## 그림체 (중요)
- **기존 펫과 똑같은 그림체**(3D 페인팅, 반짝이는 큰 눈, 볼터치, 금빛 테두리 빛). 영웅 펫은 기본 펫보다 성장 · 최종이 조금 더 화려하다.
- **만화 · 애니 캐릭터를 따라 그리거나 닮게 그리지 않는다.** 모두 새 캐릭터다.
- 기존 펫과 헷갈리지 않게 각 주문서의 "must look different" 문장을 지킨다.

## 꼭 지킬 것
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다. 예: `codex/art-37`
  - 그 브랜치에 `docs/asset-requests/runner/37a-epic-pets-design.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/new-pets-14`에서 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** 머지하면 운영에 바로 배포되고, 그림이 다 들어온 펫은 바로 학생들에게 나온다.
- **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- `public/assets/` 아래 새 그림, `docs/asset-requests/runner/DONE_37.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/pet-art.js` 말고는 고치지 않는다. 앱 코드, 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다. 임시 폴더(`/tmp/art/`)에 둔다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/` 폴더: 시트 하나 = 프롬프트 하나. 파일 이름이 시트 번호다(예: `split/37a-1 밍고 플라밍고 설정 시트.txt`).
- `slice-map.csv`: 각 칸의 이름(`key`)과 앱 파일(`app_file`). `list` 열이 `37a…`·`37b…`·`37c…`인 줄만 본다. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`, `fit-sheets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(기존 펫 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 영웅 펫 37 (Runner용)"에 정확한 파일 이름으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same character, keep its face, colors, markings and accessories exactly. Do NOT copy any other animal or character from the references, and do NOT copy or resemble any cartoon or anime character.`

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 37a 설정 | `pets/panda-3.webp`, `pets/capybara-3.webp`, `pets/chinchilla-2.webp` |
| 37b 표정 | 그 펫 · 단계의 새 그림 `pets/<키>-<단계>.webp` (예: 37b-1 → `pets/flamingo-1.webp`) |
| 37b 알 반응 | 두 펫의 `pets/<키>-0.webp` |
| 37c 전투 자세 | 두 펫의 그 단계 새 그림 + 기존 자세 `pets/elephant-2-attack.webp`, `pets/elephant-2-hurt.webp` |

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음).
2. 칸마다 그림이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 테두리, 바닥 그림자가 없다.
3. 같은 시트의 칸들은 같은 캐릭터 디자인이다(색, 무늬, 소품).
4. 설정 시트는 알 → 아기 → 성장 → 최종으로 분명히 커지고 화려해진다. 알에는 얼굴이 없다. 표정 · 전투 자세는 같은 단계의 몸 크기와 소품이 설정 시트와 같다. 공격은 오른쪽으로 달려들고, 맞음은 오른쪽에서 맞아 왼쪽으로 몸을 젖힌다(피 · 상처 없이 귀엽게).

이미지를 볼 수 있으면 4번은 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트: 1024×1024, **투명 배경 PNG**. 만든 그림은 `/tmp/art/<시트 번호>.png`로 저장한다(예: `/tmp/art/37a-1.png`).
- 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- **순서를 지킨다.** 설정 시트(`37a`)를 먼저 만들고 잘라 넣은 뒤, 그 그림을 참고로 표정 · 알 반응 · 전투 자세를 만든다. 순서: 37a → 37b → 37c.
- 한 번에 다 못 만들면 **펫 하나를 끝까지**(설정 · 표정 · 알 반응) 만든 단위로 끊는다. 그래야 그 펫이 앱에 나온다. 못 만든 시트는 `DONE_37.md`의 "넣지 못한 그림"에 적는다.

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
node $R/fit-assets.mjs /tmp/art/37a-1.png pets/flamingo-0 pets/flamingo-1 pets/flamingo-2 pets/flamingo-3 --stand --preview /tmp/review/37a-1.png
node $R/fit-assets.mjs /tmp/art/37a-2.png pets/quokka-0 pets/quokka-1 pets/quokka-2 pets/quokka-3 --stand --preview /tmp/review/37a-2.png
node $R/fit-assets.mjs /tmp/art/37a-3.png pets/chameleon-0 pets/chameleon-1 pets/chameleon-2 pets/chameleon-3 --stand --preview /tmp/review/37a-3.png
node $R/fit-assets.mjs /tmp/art/37a-4.png pets/polarbear-0 pets/polarbear-1 pets/polarbear-2 pets/polarbear-3 --stand --preview /tmp/review/37a-4.png
node $R/fit-assets.mjs /tmp/art/37a-5.png pets/snowleopard-0 pets/snowleopard-1 pets/snowleopard-2 pets/snowleopard-3 --stand --preview /tmp/review/37a-5.png
node $R/fit-assets.mjs /tmp/art/37a-6.png pets/hummingbird-0 pets/hummingbird-1 pets/hummingbird-2 pets/hummingbird-3 --stand --preview /tmp/review/37a-6.png
node $R/fit-sheets.mjs /tmp/art/37b-1.png flamingo-1-happy flamingo-1-eat flamingo-1-sad flamingo-1-cheer --preview /tmp/review/37b-1.png
node $R/fit-sheets.mjs /tmp/art/37b-2.png flamingo-2-happy flamingo-2-eat flamingo-2-sad flamingo-2-cheer --preview /tmp/review/37b-2.png
node $R/fit-sheets.mjs /tmp/art/37b-3.png flamingo-3-happy flamingo-3-eat flamingo-3-sad flamingo-3-cheer --preview /tmp/review/37b-3.png
node $R/fit-sheets.mjs /tmp/art/37b-4.png quokka-1-happy quokka-1-eat quokka-1-sad quokka-1-cheer --preview /tmp/review/37b-4.png
node $R/fit-sheets.mjs /tmp/art/37b-5.png quokka-2-happy quokka-2-eat quokka-2-sad quokka-2-cheer --preview /tmp/review/37b-5.png
node $R/fit-sheets.mjs /tmp/art/37b-6.png quokka-3-happy quokka-3-eat quokka-3-sad quokka-3-cheer --preview /tmp/review/37b-6.png
node $R/fit-sheets.mjs /tmp/art/37b-7.png chameleon-1-happy chameleon-1-eat chameleon-1-sad chameleon-1-cheer --preview /tmp/review/37b-7.png
node $R/fit-sheets.mjs /tmp/art/37b-8.png chameleon-2-happy chameleon-2-eat chameleon-2-sad chameleon-2-cheer --preview /tmp/review/37b-8.png
node $R/fit-sheets.mjs /tmp/art/37b-9.png chameleon-3-happy chameleon-3-eat chameleon-3-sad chameleon-3-cheer --preview /tmp/review/37b-9.png
node $R/fit-sheets.mjs /tmp/art/37b-10.png polarbear-1-happy polarbear-1-eat polarbear-1-sad polarbear-1-cheer --preview /tmp/review/37b-10.png
node $R/fit-sheets.mjs /tmp/art/37b-11.png polarbear-2-happy polarbear-2-eat polarbear-2-sad polarbear-2-cheer --preview /tmp/review/37b-11.png
node $R/fit-sheets.mjs /tmp/art/37b-12.png polarbear-3-happy polarbear-3-eat polarbear-3-sad polarbear-3-cheer --preview /tmp/review/37b-12.png
node $R/fit-sheets.mjs /tmp/art/37b-13.png snowleopard-1-happy snowleopard-1-eat snowleopard-1-sad snowleopard-1-cheer --preview /tmp/review/37b-13.png
node $R/fit-sheets.mjs /tmp/art/37b-14.png snowleopard-2-happy snowleopard-2-eat snowleopard-2-sad snowleopard-2-cheer --preview /tmp/review/37b-14.png
node $R/fit-sheets.mjs /tmp/art/37b-15.png snowleopard-3-happy snowleopard-3-eat snowleopard-3-sad snowleopard-3-cheer --preview /tmp/review/37b-15.png
node $R/fit-sheets.mjs /tmp/art/37b-16.png hummingbird-1-happy hummingbird-1-eat hummingbird-1-sad hummingbird-1-cheer --preview /tmp/review/37b-16.png
node $R/fit-sheets.mjs /tmp/art/37b-17.png hummingbird-2-happy hummingbird-2-eat hummingbird-2-sad hummingbird-2-cheer --preview /tmp/review/37b-17.png
node $R/fit-sheets.mjs /tmp/art/37b-18.png hummingbird-3-happy hummingbird-3-eat hummingbird-3-sad hummingbird-3-cheer --preview /tmp/review/37b-18.png
node $R/fit-sheets.mjs /tmp/art/37b-19.png flamingo-0-happy flamingo-0-eat quokka-0-happy quokka-0-eat --preview /tmp/review/37b-19.png
node $R/fit-sheets.mjs /tmp/art/37b-20.png chameleon-0-happy chameleon-0-eat polarbear-0-happy polarbear-0-eat --preview /tmp/review/37b-20.png
node $R/fit-sheets.mjs /tmp/art/37b-21.png snowleopard-0-happy snowleopard-0-eat hummingbird-0-happy hummingbird-0-eat --preview /tmp/review/37b-21.png
node $R/fit-sheets.mjs /tmp/art/37c-1.png flamingo-1-attack flamingo-1-hurt quokka-1-attack quokka-1-hurt --preview /tmp/review/37c-1.png
node $R/fit-sheets.mjs /tmp/art/37c-2.png flamingo-2-attack flamingo-2-hurt quokka-2-attack quokka-2-hurt --preview /tmp/review/37c-2.png
node $R/fit-sheets.mjs /tmp/art/37c-3.png flamingo-3-attack flamingo-3-hurt quokka-3-attack quokka-3-hurt --preview /tmp/review/37c-3.png
node $R/fit-sheets.mjs /tmp/art/37c-4.png chameleon-1-attack chameleon-1-hurt polarbear-1-attack polarbear-1-hurt --preview /tmp/review/37c-4.png
node $R/fit-sheets.mjs /tmp/art/37c-5.png chameleon-2-attack chameleon-2-hurt polarbear-2-attack polarbear-2-hurt --preview /tmp/review/37c-5.png
node $R/fit-sheets.mjs /tmp/art/37c-6.png chameleon-3-attack chameleon-3-hurt polarbear-3-attack polarbear-3-hurt --preview /tmp/review/37c-6.png
node $R/fit-sheets.mjs /tmp/art/37c-7.png snowleopard-1-attack snowleopard-1-hurt hummingbird-1-attack hummingbird-1-hurt --preview /tmp/review/37c-7.png
node $R/fit-sheets.mjs /tmp/art/37c-8.png snowleopard-2-attack snowleopard-2-hurt hummingbird-2-attack hummingbird-2-hurt --preview /tmp/review/37c-8.png
node $R/fit-sheets.mjs /tmp/art/37c-9.png snowleopard-3-attack snowleopard-3-hurt hummingbird-3-attack hummingbird-3-hurt --preview /tmp/review/37c-9.png
```
- **작은 그림**: 기본 그림(`<키>-<단계>.webp`, 단계 0~3)마다 `<키>-<단계>-s.webp`(160×160, 투명, `fit: 'contain'`)도 만든다. 6종 × 4 = 24개. 이게 없으면 그 펫은 앱에 나오지 않는다.
- 도구가 "배경이 투명하지 않아요"나 "칸이 비어 있어요"로 멈추면 그 시트는 1단계로 돌아가 다시 만든다.

## 3. 기록
- `docs/asset-requests/runner/DONE_37.md`를 한국어로 쓴다: 펫별 넣은 그림 표, 넣지 못한 그림과 이유, 시트마다 다시 만든 횟수, "눈으로 확인 필요" 항목, **빌드 뒤 `pet-art.js`에 들어간 펫**(= 앱에 나오는 펫).
- 버전은 올리지 않는다.

## 4. 점검
```
npm ci
npm run build:assets      # public/modules/pet-art.js가 바뀐다(그림이 다 들어온 펫이 PET_ART에 들어간다)
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`

## 5. PR
- 대상: `sumus-voca-prod-deploy`
- 제목: `그림 37: 영웅 펫 6종 (밍고 · 방긋 · 카멜 · 눈곰 · 설표 · 윙윙)`
- 본문은 한국어로 쓴다. 넣은 그림 표, 넣지 못한 그림과 이유, 점검 결과, "눈으로 확인 필요" 항목, 앱에 나오게 되는 펫.
- 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포되고, 그림이 다 들어온 펫이 바로 학생들에게 나옵니다.`
- 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 합쳐 PR 코멘트로 올린다.
- **머지하지 않는다.**
