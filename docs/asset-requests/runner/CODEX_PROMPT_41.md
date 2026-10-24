# Codex 작업 지시: 그림 41 (몬스터전 지역 배경 4장)

## 목표
몬스터전 레벨 2.0(`docs/monster-level-design.md`)은 10레벨마다 지역이 바뀐다. 구성안의 8지역 중 **배경 그림이 아직 없는 4지역**의 레벨 카드 배경(폰 세로 비율 1024×1536)을 만들고, 줄여서 `public/assets/monster-stage/`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.** 지역 구조 · 배경 연결은 다음 세션에서 코드로 한다(그림만 먼저 들어와도 앱은 바뀌지 않고 깨지지 않는다).

### 8지역과 이미 있는 배경
| # | 지역 | 배경 |
|---|---|---|
| 1 | 야자 교실 | **새로 주문** (`41-1`) |
| 2 | 숲 | 있음: public/assets/hunt/bg-forest-day.webp · bg-forest-night.webp (720×1080 세로, 몬스터 사냥 지도) |
| 3 | 들판 | 있음: public/assets/hunt/bg-field-day.webp · bg-field-night.webp (720×1080 세로) |
| 4 | 바닷가 | 있음: public/assets/hunt/bg-beach-day.webp · bg-beach-night.webp (720×1080 세로) |
| 5 | 밤 | 있음: 사냥 지도의 밤 3장(hunt/bg-forest-night · bg-field-night · bg-beach-night)에서 코드 세션이 고른다 |
| 6 | 한밤의 도서관 | **새로 주문** (`41-2`) |
| 7 | 기말고사 학교 | **새로 주문** (`41-3`) |
| 8 | 온 세상 보스 모음 | **새로 주문** (`41-4`) |

- 있음으로 적은 지역은 중복으로 만들지 않는다(몬스터 사냥 지도 그림을 다음 세션이 재사용한다. 모양이 안 맞으면 그때 따로 주문한다).
- 표의 **새로 주문** 4장만 만든다.

| 시트 | 지역 | 넣을 파일 |
|---|---|---|
| `41-1` | 야자 교실 | `public/assets/monster-stage/bg-yaja.webp` |
| `41-2` | 한밤의 도서관 | `public/assets/monster-stage/bg-library.webp` |
| `41-3` | 기말고사 학교 | `public/assets/monster-stage/bg-school.webp` |
| `41-4` | 온 세상 보스 모음 | `public/assets/monster-stage/bg-world.webp` |

시트와 칸마다 넣을 파일은 `slice-map.csv`에서 `list` 열이 `41-monster-region-backgrounds.txt`인 줄을 본다.

## 꼭 지킬 것
- **기존 그림과 같은 게임 그림체**(몬스터 10 · 12와 같은 깨끗한 색, 사냥 지도 34a와 같은 밝기). 더 흐리거나 뿌옇거나 수채화처럼 만들지 않는다.
- 배경에는 **캐릭터 · 동물 · 몬스터 · 사람을 그리지 않는다**(앱이 몬스터를 그 위에 그린다). 글자 · 숫자 · 로고 · UI도 없다. 가운데 아래는 몬스터가 서는 자리라 비워 둔다.
- 투명 PNG가 아니다: 가장자리까지 꽉 채워 그린 그림이다.
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키나 유료 API를 쓰지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** Codex에는 Drive가 없다. 아래 "프롬프트 손보기"대로 한다.
- 고치는 파일: `public/assets/monster-stage/` 아래 새 그림, 빌드가 바꿀 수 있는 `public/sw.js`, `docs/asset-requests/runner/DONE_41.md`. 앱 코드 · 규칙 · 서버 · 점검 파일은 건드리지 않는다. 버전은 올리지 않는다. 원본 PNG는 커밋하지 않는다(`/tmp/art/`).
- **브랜치:** `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-41`). 그 브랜치에 `docs/asset-requests/runner/41-monster-region-backgrounds.txt`가 없으면 `claude/art-orders-39-41`에서 시작하고 PR 대상도 그 브랜치로 한다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/41-1 …` ~ `41-4 …`: 시트 하나 = 프롬프트 하나. 묶음 전체는 `41-monster-region-backgrounds.txt`.
- 보내는 순서: `41-1` → `41-2` → `41-3` → `41-4`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
시트 프롬프트는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(기존 그림을 열어 그림체를 맞추고, Drive 폴더 "SUMUS 몬스터전 지역 배경 41 (Runner용)"에 정확한 파일 이름으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, color clarity and finish exactly. The backgrounds must look like one set with the monsters and backgrounds shown. Do NOT draw any character, animal or monster from the references.`
3. `41-2`부터는 방금 만든 `/tmp/art/41-1.png`도 같이 붙인다(마감 · 밝기 · 디테일을 맞춘다. 장면은 베끼지 않는다).

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 모든 시트 | `hunt/bg-forest-day.webp`, `hunt/bg-catch.webp`, `dungeon/bg-f1.webp`, `battle/bg-forest.webp` (같은 게임의 배경), `monsters/mochi.webp`, `monsters/nightbat.webp`, `monsters/mockhydra.webp` (몬스터가 이 위에 선다) |
| 41-1 야자 교실 | 위 + `dungeon/bg-f2.webp` |
| 41-2 한밤의 도서관 | 위 + `hunt/bg-forest-night.webp` (밤 색감) |
| 41-3 기말고사 학교 | 위 + `dungeon/bg-f3.webp` |
| 41-4 온 세상 보스 모음 | 위 + `dungeon/bg-boss.webp`, `battle/bg-boss.webp` (보스 느낌) |

### 후보 점검 (모두 통과해야 쓴다)
1. 가장자리까지 꽉 찬 그림이다(투명 · 테두리 · 둥근 모서리 없음). 글자 · 숫자 · 로고 · UI가 없다.
2. 캐릭터 · 동물 · 몬스터 · 사람이 없다.
3. 가운데 아래(너비 60% · 높이 40%)가 비어 있고 조용하다. 위 15%가 단순하다.
4. 기존 배경(사냥 지도 · 던전)과 나란히 놓아도 같은 게임 그림이다. 폭 390px로 줄여도 알아볼 수 있다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 하나씩 만든다. 세로 1024×1536 PNG, `/tmp/art/41-1.png` … `/tmp/art/41-4.png`로 저장. 점검을 통과하지 못하면 다시 만든다(장마다 최대 4번).

## 2. 줄여서 넣기
```
mkdir -p public/assets/monster-stage
node --input-type=module -e "
import sharp from 'sharp';
const map = {
  "41-1": "monster-stage/bg-yaja.webp",
  "41-2": "monster-stage/bg-library.webp",
  "41-3": "monster-stage/bg-school.webp",
  "41-4": "monster-stage/bg-world.webp"
};
for (const [n, out] of Object.entries(map)) await sharp('/tmp/art/' + n + '.png').resize(720, 1080, { fit: 'cover' }).webp({ quality: 80, effort: 6 }).toFile('public/assets/' + out);
"
```
- 720×1080 webp, 장마다 **150KB 이하**여야 한다(넘으면 quality를 낮춘다).
- `sharp`가 없으면 `npm i --no-save sharp`.

## 3. 마무리
```
npm ci
npm run build:assets
npm run check
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- `docs/asset-requests/runner/DONE_41.md`(한국어): 넣은 그림 표(시트 · 파일 · 크기 · 다시 만든 횟수), 넣지 못한 것과 이유, "눈으로 확인 필요". "배경은 지역 구조 코드(다음 세션)가 연결해야 앱에 나온다"를 적는다.
- PR 제목 `그림 41: 몬스터전 지역 배경 4장 (야자 교실 · 한밤의 도서관 · 기말고사 학교 · 온 세상 보스 모음)`, 본문 한국어. 네 장을 한 장으로 작게 합쳐 PR 코멘트로 올린다. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다.` **머지하지 않는다.**
