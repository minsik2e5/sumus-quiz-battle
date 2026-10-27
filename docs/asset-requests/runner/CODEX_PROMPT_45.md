# Codex 작업 지시: 그림 45 (인형뽑기 · 도감 카드 · 장식 · 황금 효과 · 3시트)

## 목표
놀이터 새 게임 **인형뽑기**(구성안 `docs/claw-machine-design.md`)에 쓸 **도감 카드 틀**(보통 · 황금 · 아직 못 뽑은 카드 뒷면 · 완성 배지), **축하 장식**(반짝임 · 별 · 리본 · 색종이), **황금 · 대박 효과**(황금 오라 · 황금 리본 · 대박 빛줄기 · 도감 완성 트로피)를 만들고, 잘라서 `public/assets/claw/`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.**

> ⚠️ **이 그림만으로는 인형뽑기가 앱에 나오지 않는다.** 게임 코드 · 서버 판정 · 그림 목록(`claw-art.js`, 그림 게이트)은 다음 세션에서 만든다(구성안 §8 · §13).
> 지금 `public/assets/claw/`를 읽는 코드가 없어서, 그림만 먼저 들어와도 앱은 바뀌지 않고 깨지지 않는다(`build:assets`는 새 폴더를 서비스 워커 목록에만 더한다).

| 시트 | 내용 | 넣을 파일 |
|---|---|---|
| `45-1` | 도감 카드 틀 | `claw/card.webp` · `claw/card-gold.webp` · `claw/card-back.webp` · `claw/badge-complete.webp` |
| `45-2` | 장식 | `claw/fx-sparkle.webp` · `claw/fx-star.webp` · `claw/fx-ribbon.webp` · `claw/fx-confetti.webp` |
| `45-3` | 황금 · 대박 효과 | `claw/gold-aura.webp` · `claw/gold-ribbon.webp` · `claw/fx-jackpot.webp` · `claw/trophy.webp` |

- 인형별 도감 실루엣은 그리지 않는다: 다음 세션이 인형 기본 그림(주문서 42)을 코드로 검게 만들어 쓴다(늘 모양이 정확하다). 아직 못 뽑은 칸은 `card-back`.
- 황금 인형도 따로 그리지 않는다: 기본 그림에 금빛 필터 + `gold-aura` · `gold-ribbon`을 겹친다.

## 꼭 지킬 것
- **기존 그림과 같은 게임 그림체**(펫 · 몬스터 · 낚시 · 몬스터 사냥 그림)로 맞춘다. 더 흐리거나 뿌옇거나 수채화처럼 만들지 않는다.
- 그림에 **글자 · 숫자 · 로고를 넣지 않는다**(버튼 · 숫자판 · 표지판은 비워 둔다. 글자는 앱이 쓴다).
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** Codex에는 Drive가 없다. 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 그림을 참고 그림으로 붙인다.
- 고치는 파일: `public/assets/claw/` 아래 **새 그림**, 빌드가 바꾸는 `public/sw.js`, `docs/asset-requests/runner/DONE_45.md`. 앱 코드 · 게임 규칙 · 코인 · 서버 · 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다. 원본 PNG는 커밋하지 않는다(`/tmp/art/`).
- **브랜치:** `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-45`). 그 브랜치에 `docs/asset-requests/runner/45-claw-book-fx.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/claw-design`에서 시작하고 PR 대상도 그 브랜치로 한다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/45…`: 시트 하나 = 프롬프트 하나. 묶음 전체는 `45-claw-book-fx.txt`.
- `slice-map.csv`: `list` 열이 `45-claw-book-fx.txt`인 줄 = 칸마다 넣을 앱 파일(`app_file`). **이 이름이 다음 세션 코드가 읽는 이름이다. 바꾸지 않는다.** 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
시트 프롬프트(`split/`)는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 인형뽑기 도감·장식 45 (Runner용)"에 정확한 파일 이름으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, glossy toy-like finish, crisp clean edges and colors exactly. Do NOT copy any object or character from the references; this is a new design.`
3. `45-2`부터는 방금 만든 `/tmp/art/45-1.png`도 같이 붙인다.

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 모든 시트 | `hunt/fx-sparkle.webp`, `hunt/fx-star.webp`, `hunt/fx-burst.webp`, `hunt/ball-gold.webp`, `fishing/bait-can.webp` (같은 게임의 효과 · 물건 그림) |
| 45-1 도감 카드 | 위 + `titles/attend100.webp` (칭호 메달 마감) |
| 45-2 이후 | `/tmp/art/45-1.png` |

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음).
2. 칸마다 그림이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 로고, 바닥 그림자가 없다.
3. 기존 그림(참고 그림)과 나란히 놓아도 같은 게임 그림처럼 보인다.
4. `45-1` 카드 세 장(보통 · 황금 · 뒷면)이 같은 크기 · 모양이고, 가운데 창이 비어 있다. 물음표 · 글자가 없다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 하나씩 만든다. 2×2 시트 1024×1024 투명 PNG, `/tmp/art/45-1.png` … `/tmp/art/45-3.png`. 점검을 통과하지 못하면 다시 만든다(장마다 최대 4번).

## 2. 자르고 넣기
```
mkdir -p public/assets/claw
R=docs/asset-requests/runner
node $R/fit-assets.mjs /tmp/art/45-1.png claw/card claw/card-gold claw/card-back claw/badge-complete --trim --size 384 --preview /tmp/review/45-1.png
node $R/fit-assets.mjs /tmp/art/45-2.png claw/fx-sparkle claw/fx-star claw/fx-ribbon claw/fx-confetti --fit-each --size 256 --preview /tmp/review/45-2.png
node $R/fit-assets.mjs /tmp/art/45-3.png claw/gold-aura claw/gold-ribbon claw/fx-jackpot claw/trophy --fit-each --size 384 --preview /tmp/review/45-3.png
```
- 칸 이름은 `slice-map.csv`의 `app_file`과 같아야 한다.

## 3. 마무리
```
npm ci
npm run build:assets
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `docs/asset-requests/runner/DONE_45.md`(한국어): 넣은 그림 표(시트 · 파일 · 다시 만든 횟수), 넣지 못한 것과 이유, "눈으로 확인 필요". 마지막에 "인형뽑기는 게임 코드(다음 세션)가 생겨야 앱에 나온다"를 적는다.
- PR 제목 `그림 45: 인형뽑기 도감 카드 · 장식 · 황금 효과`, 본문 한국어. 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 작게 합쳐 PR 코멘트로 올린다. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 인형뽑기는 게임 코드가 생기기 전까지 앱에 나오지 않습니다.` **머지하지 않는다.**
