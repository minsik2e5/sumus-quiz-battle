# Codex 작업 지시: 그림 44 (인형뽑기 · 배경 3장 · 입구 카드 · 4시트)

## 목표
놀이터 새 게임 **인형뽑기**(구성안 `docs/claw-machine-design.md`)에 쓸 **배경 3장**(세로, 기계 뒤에 깔림)과 **놀이터 입구 카드 1장**(가로)을 만들고, 줄여서 `public/assets/claw/`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.**

> ⚠️ **이 그림만으로는 인형뽑기가 앱에 나오지 않는다.** 게임 코드 · 서버 판정 · 그림 목록(`claw-art.js`, 그림 게이트)은 다음 세션에서 만든다(구성안 §8 · §13).
> 지금 `public/assets/claw/`를 읽는 코드가 없어서, 그림만 먼저 들어와도 앱은 바뀌지 않고 깨지지 않는다(`build:assets`는 새 폴더를 서비스 워커 목록에만 더한다).

| 시트 | 내용 | 넣을 파일 | 크기 |
|---|---|---|---|
| `44-1` | 반짝이 보라 배경 | `public/assets/claw/bg-galaxy.webp` | 720×1080 |
| `44-2` | 민트 오락실 배경 | `public/assets/claw/bg-mint.webp` | 720×1080 |
| `44-3` | 밤 놀이공원 배경 | `public/assets/claw/bg-neon.webp` | 720×1080 |
| `44-4` | 놀이터 입구 카드 | `public/assets/claw/entry.webp` | 1280×853 |

## 꼭 지킬 것
- **기존 그림과 같은 게임 그림체**(펫 · 몬스터 · 낚시 · 몬스터 사냥 그림)로 맞춘다. 더 흐리거나 뿌옇거나 수채화처럼 만들지 않는다.
- 그림에 **글자 · 숫자 · 로고를 넣지 않는다**(버튼 · 숫자판 · 표지판은 비워 둔다. 글자는 앱이 쓴다).
- 투명 PNG가 아니다: 가장자리까지 꽉 채워 그린 그림이다. 배경 3장에는 기계 · 캐릭터 · 동물 · 인형 · 사람을 그리지 않는다(앱이 기계를 그 위에 그린다). 가운데는 조용하게.
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** Codex에는 Drive가 없다. 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 그림을 참고 그림으로 붙인다.
- 고치는 파일: `public/assets/claw/` 아래 **새 그림**, 빌드가 바꾸는 `public/sw.js`, `docs/asset-requests/runner/DONE_44.md`. 앱 코드 · 게임 규칙 · 코인 · 서버 · 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다. 원본 PNG는 커밋하지 않는다(`/tmp/art/`).
- **브랜치:** `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-44`). 그 브랜치에 `docs/asset-requests/runner/44-claw-backgrounds.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/claw-design`에서 시작하고 PR 대상도 그 브랜치로 한다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/44…`: 시트 하나 = 프롬프트 하나. 묶음 전체는 `44-claw-backgrounds.txt`.
- `slice-map.csv`: `list` 열이 `44-claw-backgrounds.txt`인 줄 = 칸마다 넣을 앱 파일(`app_file`). **이 이름이 다음 세션 코드가 읽는 이름이다. 바꾸지 않는다.** 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
시트 프롬프트(`split/`)는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 인형뽑기 배경 44 (Runner용)"에 정확한 파일 이름으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, color clarity and finish exactly. The pictures must look like one set with the backgrounds shown. Do NOT draw any character, animal or monster from the references.`
3. `44-2`부터는 방금 만든 `/tmp/art/44-1.png`도 같이 붙인다(마감 · 밝기 · 디테일을 맞춘다. 장면은 베끼지 않는다).

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 모든 시트 | `hunt/bg-forest-day.webp`, `hunt/bg-catch.webp`, `fishing/bg-entry.webp`, `fishing/bg-tank.webp` (같은 게임의 배경) |
| 44-3 밤 놀이공원 | 위 + `hunt/bg-forest-night.webp` (밤 색감) |
| 44-4 입구 카드 | 위 + `hunt/entry.webp`, `match/entry.webp` (놀이터 입구 카드), `pets/cat-1.webp`, `pets/panda-1.webp` (인형 그림체) · 주문서 42 그림이 이미 있으면 `claw/doll-rabbit.webp` 등도 |
| 44-2 이후 | `/tmp/art/44-1.png` |

### 후보 점검 (모두 통과해야 쓴다)
1. 가장자리까지 꽉 찬 그림이다(투명 · 테두리 · 둥근 모서리 없음). 글자 · 숫자 · 로고 · UI가 없다.
2. 배경 3장: 기계 · 캐릭터 · 동물 · 인형 · 사람이 없고, 가운데(너비 80% · 높이 10~90%)가 조용하다.
3. 입구 카드: 왼쪽 45%가 조용하다(앱이 제목을 쓴다).
4. 기존 배경과 나란히 놓아도 같은 게임 그림이다. 폭 390px로 줄여도 알아볼 수 있다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 하나씩 만든다. 배경은 세로 1024×1536, 입구 카드는 가로 1536×1024 PNG. `/tmp/art/44-1.png` … `/tmp/art/44-4.png`로 저장한다. 점검을 통과하지 못하면 다시 만든다(장마다 최대 4번).

## 2. 줄여서 넣기
```
mkdir -p public/assets/claw
node --input-type=module -e "
import sharp from 'sharp';
const map = {
  "44-1": ["claw/bg-galaxy", 720, 1080],
  "44-2": ["claw/bg-mint", 720, 1080],
  "44-3": ["claw/bg-neon", 720, 1080],
  "44-4": ["claw/entry", 1280, 853]
};
for (const [n, [out, w, h]] of Object.entries(map)) await sharp('/tmp/art/' + n + '.png').resize(w, h, { fit: 'cover' }).webp({ quality: 80, effort: 6 }).toFile('public/assets/' + out + '.webp');
"
```
- 배경 720×1080 webp는 장마다 **150KB 이하**, 입구 카드 1280×853은 **200KB 이하**(넘으면 quality를 낮춘다).

## 3. 마무리
```
npm ci
npm run build:assets
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `docs/asset-requests/runner/DONE_44.md`(한국어): 넣은 그림 표(시트 · 파일 · 다시 만든 횟수), 넣지 못한 것과 이유, "눈으로 확인 필요". 마지막에 "인형뽑기는 게임 코드(다음 세션)가 생겨야 앱에 나온다"를 적는다.
- PR 제목 `그림 44: 인형뽑기 배경 3장 · 입구 카드 (반짝이 보라 · 민트 오락실 · 밤 놀이공원)`, 본문 한국어. 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 작게 합쳐 PR 코멘트로 올린다. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 인형뽑기는 게임 코드가 생기기 전까지 앱에 나오지 않습니다.` **머지하지 않는다.**
