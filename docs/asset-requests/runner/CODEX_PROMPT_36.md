# Codex 작업 지시: 그림 36 (12지 기본 펫 6종: 찍찍이(아기 쥐) · 음매(송아지) · 어흥(아기 호랑이) · 다그닥(조랑말) · 끼끼(꼬마 원숭이) · 꼬꼬(꼬마 닭))

## 목표
SUMUS VOCA(저장소 `minsik2e5/sumus-quiz-battle`)의 그림 주문서 36로 새 펫 그림(설정 · 표정 · 알 반응 · 야차전 공격/맞음 · 칭호 메달)을 만들고, 잘라서 `public/assets/`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.** 펫 등록 · 특기 · 알 · 도감 연결은 이미 되어 있고, `npm run build:assets`가 그림 폴더를 보고 `public/modules/pet-art.js`를 다시 만들면 **그림이 다 들어온 펫만 자동으로** 알 · 선생님 선물 알 · 몬스터 사냥 · 낚시 교환소 · 도감에 나온다(한 장이라도 빠진 펫은 계속 숨는다).

| 등급 | 펫 key | 이름 | 설정 시트 | 표정 시트 | 알 반응 | 전투 자세 |
|---|---|---|---|---|---|---|
| 기본(12지) | `mouse` | 찍찍이 · 아기 쥐 | 36a-1 | 36b-1~3 | 36b-19 | 36c-1~3 |
| 기본(12지) | `calf` | 음매 · 송아지 | 36a-2 | 36b-4~6 | 36b-19 | 36c-1~3 |
| 기본(12지) | `tiger` | 어흥 · 아기 호랑이 | 36a-3 | 36b-7~9 | 36b-20 | 36c-4~6 |
| 기본(12지) | `pony` | 다그닥 · 조랑말 | 36a-4 | 36b-10~12 | 36b-20 | 36c-4~6 |
| 기본(12지) | `monkey` | 끼끼 · 꼬마 원숭이 | 36a-5 | 36b-13~15 | 36b-21 | 36c-7~9 |
| 기본(12지) | `rooster` | 꼬꼬 · 꼬마 닭 | 36a-6 | 36b-16~18 | 36b-21 | 36c-7~9 |

- 시트는 모두 **37장**(36a 6 · 36b 21 · 36c 9 · 36d 1).
- 한 펫의 그림 = 기본 4 + 표정 12 + 알 반응 2 + 전투 6 + 작은 그림 4 = 28개.
- 앱은 이 파일 이름을 그대로 읽는다(`<key>-<단계>.webp`, `<key>-<단계>-<표정>.webp`, `<key>-<단계>-attack.webp`). 이름이 다르면 그 펫은 나오지 않는다.
- `36d-1`은 칭호 '12지 수호자' 메달이다. 네 칸 모두 같은 메달의 시안이고, 왼쪽 위가 기본이다. 다른 칸이 더 나으면 그 칸을 `titles/zodiac12`로 넣는다(메달 그림이 있으면 앱이 자동으로 쓴다).

## 그림체 (중요)
- **기존 펫과 똑같은 그림체**(3D 페인팅, 반짝이는 큰 눈, 볼터치, 금빛 테두리 빛). 12지 펫은 지금 있는 12지 펫(토리 · 용이 · 초롱 · 뭉실 · 몽이 · 핑키)과 한 가족처럼 보이게.
- **만화 · 애니 캐릭터를 따라 그리거나 닮게 그리지 않는다.** 모두 새 캐릭터다.
- 기존 펫과 헷갈리지 않게 각 주문서의 "must look different" 문장을 지킨다.

## 꼭 지킬 것
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다. 예: `codex/art-36`
  - 그 브랜치에 `docs/asset-requests/runner/36a-zodiac-pets-design.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/new-pets-14`에서 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** 머지하면 운영에 바로 배포되고, 그림이 다 들어온 펫은 바로 학생들에게 나온다.
- **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- `public/assets/` 아래 새 그림, `docs/asset-requests/runner/DONE_36.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/pet-art.js` 말고는 고치지 않는다. 앱 코드, 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다. 임시 폴더(`/tmp/art/`)에 둔다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/` 폴더: 시트 하나 = 프롬프트 하나. 파일 이름이 시트 번호다(예: `split/36a-1 찍찍이 아기 쥐 설정 시트.txt`).
- `slice-map.csv`: 각 칸의 이름(`key`)과 앱 파일(`app_file`). `list` 열이 `36a…`·`36b…`·`36c…`·`36d…`인 줄만 본다. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`, `fit-sheets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(기존 펫 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 새 펫 36 (Runner용)"에 정확한 파일 이름으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same character, keep its face, colors, markings and accessories exactly. Do NOT copy any other animal or character from the references, and do NOT copy or resemble any cartoon or anime character.`

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 36a 설정 | `pets/panda-3.webp`, `pets/dog-1.webp`, `pets/rabbit-2.webp`, `pets/elephant-2.webp` |
| 36b 표정 | 그 펫 · 단계의 새 그림 `pets/<키>-<단계>.webp` (예: 36b-1 → `pets/mouse-1.webp`) |
| 36b 알 반응 | 두 펫의 `pets/<키>-0.webp` |
| 36c 전투 자세 | 두 펫의 그 단계 새 그림 + 기존 자세 `pets/elephant-2-attack.webp`, `pets/elephant-2-hurt.webp` |
| 36d 메달 | `titles/pets30.webp`, `titles/legend1.webp` (전설 테두리) |

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음).
2. 칸마다 그림이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 테두리, 바닥 그림자가 없다.
3. 같은 시트의 칸들은 같은 캐릭터 디자인이다(색, 무늬, 소품).
4. 설정 시트는 알 → 아기 → 성장 → 최종으로 분명히 커지고 화려해진다. 알에는 얼굴이 없다. 표정 · 전투 자세는 같은 단계의 몸 크기와 소품이 설정 시트와 같다. 공격은 오른쪽으로 달려들고, 맞음은 오른쪽에서 맞아 왼쪽으로 몸을 젖힌다(피 · 상처 없이 귀엽게).

이미지를 볼 수 있으면 4번은 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트: 1024×1024, **투명 배경 PNG**. 만든 그림은 `/tmp/art/<시트 번호>.png`로 저장한다(예: `/tmp/art/36a-1.png`).
- 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- **순서를 지킨다.** 설정 시트(`36a`)를 먼저 만들고 잘라 넣은 뒤, 그 그림을 참고로 표정 · 알 반응 · 전투 자세를 만든다. 순서: 36a → 36b → 36c → 36d.
- 한 번에 다 못 만들면 **펫 하나를 끝까지**(설정 · 표정 · 알 반응) 만든 단위로 끊는다. 그래야 그 펫이 앱에 나온다. 못 만든 시트는 `DONE_36.md`의 "넣지 못한 그림"에 적는다.

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
node $R/fit-assets.mjs /tmp/art/36a-1.png pets/mouse-0 pets/mouse-1 pets/mouse-2 pets/mouse-3 --stand --preview /tmp/review/36a-1.png
node $R/fit-assets.mjs /tmp/art/36a-2.png pets/calf-0 pets/calf-1 pets/calf-2 pets/calf-3 --stand --preview /tmp/review/36a-2.png
node $R/fit-assets.mjs /tmp/art/36a-3.png pets/tiger-0 pets/tiger-1 pets/tiger-2 pets/tiger-3 --stand --preview /tmp/review/36a-3.png
node $R/fit-assets.mjs /tmp/art/36a-4.png pets/pony-0 pets/pony-1 pets/pony-2 pets/pony-3 --stand --preview /tmp/review/36a-4.png
node $R/fit-assets.mjs /tmp/art/36a-5.png pets/monkey-0 pets/monkey-1 pets/monkey-2 pets/monkey-3 --stand --preview /tmp/review/36a-5.png
node $R/fit-assets.mjs /tmp/art/36a-6.png pets/rooster-0 pets/rooster-1 pets/rooster-2 pets/rooster-3 --stand --preview /tmp/review/36a-6.png
node $R/fit-sheets.mjs /tmp/art/36b-1.png mouse-1-happy mouse-1-eat mouse-1-sad mouse-1-cheer --preview /tmp/review/36b-1.png
node $R/fit-sheets.mjs /tmp/art/36b-2.png mouse-2-happy mouse-2-eat mouse-2-sad mouse-2-cheer --preview /tmp/review/36b-2.png
node $R/fit-sheets.mjs /tmp/art/36b-3.png mouse-3-happy mouse-3-eat mouse-3-sad mouse-3-cheer --preview /tmp/review/36b-3.png
node $R/fit-sheets.mjs /tmp/art/36b-4.png calf-1-happy calf-1-eat calf-1-sad calf-1-cheer --preview /tmp/review/36b-4.png
node $R/fit-sheets.mjs /tmp/art/36b-5.png calf-2-happy calf-2-eat calf-2-sad calf-2-cheer --preview /tmp/review/36b-5.png
node $R/fit-sheets.mjs /tmp/art/36b-6.png calf-3-happy calf-3-eat calf-3-sad calf-3-cheer --preview /tmp/review/36b-6.png
node $R/fit-sheets.mjs /tmp/art/36b-7.png tiger-1-happy tiger-1-eat tiger-1-sad tiger-1-cheer --preview /tmp/review/36b-7.png
node $R/fit-sheets.mjs /tmp/art/36b-8.png tiger-2-happy tiger-2-eat tiger-2-sad tiger-2-cheer --preview /tmp/review/36b-8.png
node $R/fit-sheets.mjs /tmp/art/36b-9.png tiger-3-happy tiger-3-eat tiger-3-sad tiger-3-cheer --preview /tmp/review/36b-9.png
node $R/fit-sheets.mjs /tmp/art/36b-10.png pony-1-happy pony-1-eat pony-1-sad pony-1-cheer --preview /tmp/review/36b-10.png
node $R/fit-sheets.mjs /tmp/art/36b-11.png pony-2-happy pony-2-eat pony-2-sad pony-2-cheer --preview /tmp/review/36b-11.png
node $R/fit-sheets.mjs /tmp/art/36b-12.png pony-3-happy pony-3-eat pony-3-sad pony-3-cheer --preview /tmp/review/36b-12.png
node $R/fit-sheets.mjs /tmp/art/36b-13.png monkey-1-happy monkey-1-eat monkey-1-sad monkey-1-cheer --preview /tmp/review/36b-13.png
node $R/fit-sheets.mjs /tmp/art/36b-14.png monkey-2-happy monkey-2-eat monkey-2-sad monkey-2-cheer --preview /tmp/review/36b-14.png
node $R/fit-sheets.mjs /tmp/art/36b-15.png monkey-3-happy monkey-3-eat monkey-3-sad monkey-3-cheer --preview /tmp/review/36b-15.png
node $R/fit-sheets.mjs /tmp/art/36b-16.png rooster-1-happy rooster-1-eat rooster-1-sad rooster-1-cheer --preview /tmp/review/36b-16.png
node $R/fit-sheets.mjs /tmp/art/36b-17.png rooster-2-happy rooster-2-eat rooster-2-sad rooster-2-cheer --preview /tmp/review/36b-17.png
node $R/fit-sheets.mjs /tmp/art/36b-18.png rooster-3-happy rooster-3-eat rooster-3-sad rooster-3-cheer --preview /tmp/review/36b-18.png
node $R/fit-sheets.mjs /tmp/art/36b-19.png mouse-0-happy mouse-0-eat calf-0-happy calf-0-eat --preview /tmp/review/36b-19.png
node $R/fit-sheets.mjs /tmp/art/36b-20.png tiger-0-happy tiger-0-eat pony-0-happy pony-0-eat --preview /tmp/review/36b-20.png
node $R/fit-sheets.mjs /tmp/art/36b-21.png monkey-0-happy monkey-0-eat rooster-0-happy rooster-0-eat --preview /tmp/review/36b-21.png
node $R/fit-sheets.mjs /tmp/art/36c-1.png mouse-1-attack mouse-1-hurt calf-1-attack calf-1-hurt --preview /tmp/review/36c-1.png
node $R/fit-sheets.mjs /tmp/art/36c-2.png mouse-2-attack mouse-2-hurt calf-2-attack calf-2-hurt --preview /tmp/review/36c-2.png
node $R/fit-sheets.mjs /tmp/art/36c-3.png mouse-3-attack mouse-3-hurt calf-3-attack calf-3-hurt --preview /tmp/review/36c-3.png
node $R/fit-sheets.mjs /tmp/art/36c-4.png tiger-1-attack tiger-1-hurt pony-1-attack pony-1-hurt --preview /tmp/review/36c-4.png
node $R/fit-sheets.mjs /tmp/art/36c-5.png tiger-2-attack tiger-2-hurt pony-2-attack pony-2-hurt --preview /tmp/review/36c-5.png
node $R/fit-sheets.mjs /tmp/art/36c-6.png tiger-3-attack tiger-3-hurt pony-3-attack pony-3-hurt --preview /tmp/review/36c-6.png
node $R/fit-sheets.mjs /tmp/art/36c-7.png monkey-1-attack monkey-1-hurt rooster-1-attack rooster-1-hurt --preview /tmp/review/36c-7.png
node $R/fit-sheets.mjs /tmp/art/36c-8.png monkey-2-attack monkey-2-hurt rooster-2-attack rooster-2-hurt --preview /tmp/review/36c-8.png
node $R/fit-sheets.mjs /tmp/art/36c-9.png monkey-3-attack monkey-3-hurt rooster-3-attack rooster-3-hurt --preview /tmp/review/36c-9.png
node $R/fit-assets.mjs /tmp/art/36d-1.png titles/zodiac12 - - - --fit-each --small 96 --preview /tmp/review/36d-1.png   # 여분 칸이 더 나으면 그 칸을 titles/zodiac12로
```
- **작은 그림**: 기본 그림(`<키>-<단계>.webp`, 단계 0~3)마다 `<키>-<단계>-s.webp`(160×160, 투명, `fit: 'contain'`)도 만든다. 6종 × 4 = 24개. 이게 없으면 그 펫은 앱에 나오지 않는다.
- 도구가 "배경이 투명하지 않아요"나 "칸이 비어 있어요"로 멈추면 그 시트는 1단계로 돌아가 다시 만든다.

## 3. 기록
- `docs/asset-requests/runner/DONE_36.md`를 한국어로 쓴다: 펫별 넣은 그림 표, 넣지 못한 그림과 이유, 시트마다 다시 만든 횟수, "눈으로 확인 필요" 항목, **빌드 뒤 `pet-art.js`에 들어간 펫**(= 앱에 나오는 펫).
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
- 제목: `그림 36: 12지 기본 펫 6종 (찍찍이 · 음매 · 어흥 · 다그닥 · 끼끼 · 꼬꼬)`
- 본문은 한국어로 쓴다. 넣은 그림 표, 넣지 못한 그림과 이유, 점검 결과, "눈으로 확인 필요" 항목, 앱에 나오게 되는 펫.
- 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포되고, 그림이 다 들어온 펫이 바로 학생들에게 나옵니다.`
- 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 합쳐 PR 코멘트로 올린다.
- **머지하지 않는다.**
