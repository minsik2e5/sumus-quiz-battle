# Codex 작업 지시: 그림 38 (신화 펫 2종: 황룡(오방신 · 중앙) · 삼족오(세 발 까마귀))

## 목표
SUMUS VOCA(저장소 `minsik2e5/sumus-quiz-battle`)의 그림 주문서 38로 새 펫 그림(설정 · 표정 · 알 반응 · 야차전 공격/맞음 · 신화 등장 포즈 · 등장 배경)을 만들고, 잘라서 `public/assets/`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.** 펫 등록 · 특기 · 알 · 도감 연결은 이미 되어 있고, `npm run build:assets`가 그림 폴더를 보고 `public/modules/pet-art.js`를 다시 만들면 **그림이 다 들어온 펫만 자동으로** 알 · 선생님 선물 알 · 몬스터 사냥 · 낚시 교환소 · 도감에 나온다(한 장이라도 빠진 펫은 계속 숨는다).

| 등급 | 펫 key | 이름 | 설정 시트 | 표정 시트 | 알 반응 | 전투 자세 |
|---|---|---|---|---|---|---|
| 신화 | `hwangryong` | 황룡 · 오방신 · 중앙 | 38a-1 | 38b-1~3 | 38b-7 | 38c-1~3 |
| 신화 | `samjogo` | 삼족오 · 세 발 까마귀 | 38a-2 | 38b-4~6 | 38b-7 | 38c-1~3 |

- 시트는 모두 **15장**(38a 2 · 38b 7 · 38c 3 · 38d 1 · 38e 2).
- 한 펫의 그림 = 기본 4 + 표정 12 + 알 반응 2 + 전투 6 + 작은 그림 4 + 등장 포즈 1 = 29개(+ 등장 배경 1장).
- 앱은 이 파일 이름을 그대로 읽는다(`<key>-<단계>.webp`, `<key>-<단계>-<표정>.webp`, `<key>-<단계>-attack.webp`, `<key>-reveal.webp`, `reveal/bg-<key>.webp`). 이름이 다르면 그 펫은 나오지 않는다.
- `38d-1` 아래 줄은 등장 포즈 여분이다. 위 줄보다 나으면 그 칸을 `pets/<키>-reveal`로 넣는다.

## 그림체 (중요)
- **기존 펫과 똑같은 그림체**(3D 페인팅, 반짝이는 큰 눈, 볼터치, 금빛 테두리 빛). 신화 펫은 가장 높은 등급이라 가장 화려하다(무지개빛 금 테두리 빛). 기존 신화(청룡 · 주작)만큼 웅장하게.
- **만화 · 애니 캐릭터를 따라 그리거나 닮게 그리지 않는다.** 모두 새 캐릭터다.
- 기존 펫과 헷갈리지 않게 각 주문서의 "must look different" 문장을 지킨다.

## 꼭 지킬 것
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다. 예: `codex/art-38`
  - 그 브랜치에 `docs/asset-requests/runner/38a-mythic-pets-design.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/new-pets-14`에서 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** 머지하면 운영에 바로 배포되고, 그림이 다 들어온 펫은 바로 학생들에게 나온다.
- **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- `public/assets/` 아래 새 그림, `docs/asset-requests/runner/DONE_38.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/pet-art.js` 말고는 고치지 않는다. 앱 코드, 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다. 임시 폴더(`/tmp/art/`)에 둔다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/` 폴더: 시트 하나 = 프롬프트 하나. 파일 이름이 시트 번호다(예: `split/38a-1 황룡 오방신 · 중앙 설정 시트.txt`).
- `slice-map.csv`: 각 칸의 이름(`key`)과 앱 파일(`app_file`). `list` 열이 `38a…`·`38b…`·`38c…`·`38d…`·`38e…`인 줄만 본다. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`, `fit-sheets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(기존 펫 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 신화 펫 38 (Runner용)"에 정확한 파일 이름으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same character, keep its face, colors, markings and accessories exactly. Do NOT copy any other animal or character from the references, and do NOT copy or resemble any cartoon or anime character.`

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 38a 설정 | `pets/panda-3.webp`, `pets/cheongryong-3.webp`, `pets/jujak-3.webp` |
| 38b 표정 | 그 펫 · 단계의 새 그림 `pets/<키>-<단계>.webp` (예: 38b-1 → `pets/hwangryong-1.webp`) |
| 38b 알 반응 | 두 펫의 `pets/<키>-0.webp` |
| 38c 전투 자세 | 두 펫의 그 단계 새 그림 + 기존 자세 `pets/elephant-2-attack.webp`, `pets/elephant-2-hurt.webp` |
| 38d 등장 포즈 | 그 펫의 새 `pets/<키>-3.webp` + 기존 `pets/cheongryong-reveal.webp` |
| 38e 등장 배경 | 기존 `reveal/bg-cheongryong.webp`, `reveal/bg-jujak.webp` |

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음). 등장 배경(38e)만 투명이 아니고 가장자리까지 꽉 채운다.
2. 칸마다 그림이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 테두리, 바닥 그림자가 없다.
3. 같은 시트의 칸들은 같은 캐릭터 디자인이다(색, 무늬, 소품).
4. 설정 시트는 알 → 아기 → 성장 → 최종으로 분명히 커지고 화려해진다. 알에는 얼굴이 없다. 표정 · 전투 자세는 같은 단계의 몸 크기와 소품이 설정 시트와 같다. 공격은 오른쪽으로 달려들고, 맞음은 오른쪽에서 맞아 왼쪽으로 몸을 젖힌다(피 · 상처 없이 귀엽게). 삼족오는 모든 그림에서 다리가 3개다. 황룡은 날개가 없다.

이미지를 볼 수 있으면 4번은 눈으로 확인한다. 볼 수 없으면 1~3번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트: 1024×1024, **투명 배경 PNG**. 등장 배경: 1024×1536, 투명 아님. 만든 그림은 `/tmp/art/<시트 번호>.png`로 저장한다(예: `/tmp/art/38a-1.png`).
- 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- **순서를 지킨다.** 설정 시트(`38a`)를 먼저 만들고 잘라 넣은 뒤, 그 그림을 참고로 표정 · 알 반응 · 전투 자세를 만든다. 순서: 38a → 38b → 38c → 38d → 38e.
- 한 번에 다 못 만들면 **펫 하나를 끝까지**(설정 · 표정 · 알 반응) 만든 단위로 끊는다. 그래야 그 펫이 앱에 나온다. 못 만든 시트는 `DONE_38.md`의 "넣지 못한 그림"에 적는다.

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
node $R/fit-assets.mjs /tmp/art/38a-1.png pets/hwangryong-0 pets/hwangryong-1 pets/hwangryong-2 pets/hwangryong-3 --stand --preview /tmp/review/38a-1.png
node $R/fit-assets.mjs /tmp/art/38a-2.png pets/samjogo-0 pets/samjogo-1 pets/samjogo-2 pets/samjogo-3 --stand --preview /tmp/review/38a-2.png
node $R/fit-sheets.mjs /tmp/art/38b-1.png hwangryong-1-happy hwangryong-1-eat hwangryong-1-sad hwangryong-1-cheer --preview /tmp/review/38b-1.png
node $R/fit-sheets.mjs /tmp/art/38b-2.png hwangryong-2-happy hwangryong-2-eat hwangryong-2-sad hwangryong-2-cheer --preview /tmp/review/38b-2.png
node $R/fit-sheets.mjs /tmp/art/38b-3.png hwangryong-3-happy hwangryong-3-eat hwangryong-3-sad hwangryong-3-cheer --preview /tmp/review/38b-3.png
node $R/fit-sheets.mjs /tmp/art/38b-4.png samjogo-1-happy samjogo-1-eat samjogo-1-sad samjogo-1-cheer --preview /tmp/review/38b-4.png
node $R/fit-sheets.mjs /tmp/art/38b-5.png samjogo-2-happy samjogo-2-eat samjogo-2-sad samjogo-2-cheer --preview /tmp/review/38b-5.png
node $R/fit-sheets.mjs /tmp/art/38b-6.png samjogo-3-happy samjogo-3-eat samjogo-3-sad samjogo-3-cheer --preview /tmp/review/38b-6.png
node $R/fit-sheets.mjs /tmp/art/38b-7.png hwangryong-0-happy hwangryong-0-eat samjogo-0-happy samjogo-0-eat --preview /tmp/review/38b-7.png
node $R/fit-sheets.mjs /tmp/art/38c-1.png hwangryong-1-attack hwangryong-1-hurt samjogo-1-attack samjogo-1-hurt --preview /tmp/review/38c-1.png
node $R/fit-sheets.mjs /tmp/art/38c-2.png hwangryong-2-attack hwangryong-2-hurt samjogo-2-attack samjogo-2-hurt --preview /tmp/review/38c-2.png
node $R/fit-sheets.mjs /tmp/art/38c-3.png hwangryong-3-attack hwangryong-3-hurt samjogo-3-attack samjogo-3-hurt --preview /tmp/review/38c-3.png
node $R/fit-assets.mjs /tmp/art/38d-1.png pets/hwangryong-reveal pets/samjogo-reveal - - --fit-each --size 1024 --preview /tmp/review/38d-1.png   # 아래 줄(여분)이 더 나으면 그 칸을 pets/<키>-reveal로
# 38e-1: 1024×1536 PNG → 720×1080 webp(150KB 이하): public/assets/reveal/bg-hwangryong.webp
# 38e-2: 1024×1536 PNG → 720×1080 webp(150KB 이하): public/assets/reveal/bg-samjogo.webp
```
- **작은 그림**: 기본 그림(`<키>-<단계>.webp`, 단계 0~3)마다 `<키>-<단계>-s.webp`(160×160, 투명, `fit: 'contain'`)도 만든다. 2종 × 4 = 8개. 이게 없으면 그 펫은 앱에 나오지 않는다.
- **등장 배경(38e)**: 고른 PNG를 `sharp(src).resize(720, 1080, { fit: 'cover' }).webp({ quality: 80, effort: 6 })`로 줄여 `public/assets/reveal/bg-<키>.webp`로 저장한다. 등장 포즈와 등장 배경이 없으면 신화 펫은 나오지 않는다.
- 도구가 "배경이 투명하지 않아요"나 "칸이 비어 있어요"로 멈추면 그 시트는 1단계로 돌아가 다시 만든다.

## 3. 기록
- `docs/asset-requests/runner/DONE_38.md`를 한국어로 쓴다: 펫별 넣은 그림 표, 넣지 못한 그림과 이유, 시트마다 다시 만든 횟수, "눈으로 확인 필요" 항목, **빌드 뒤 `pet-art.js`에 들어간 펫**(= 앱에 나오는 펫).
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
- 제목: `그림 38: 신화 펫 2종 (황룡 · 삼족오)`
- 본문은 한국어로 쓴다. 넣은 그림 표, 넣지 못한 그림과 이유, 점검 결과, "눈으로 확인 필요" 항목, 앱에 나오게 되는 펫.
- 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포되고, 그림이 다 들어온 펫이 바로 학생들에게 나옵니다.`
- 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 합쳐 PR 코멘트로 올린다.
- **머지하지 않는다.**
