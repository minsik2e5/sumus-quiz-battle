# Codex 작업 지시: 그림 43 (인형뽑기 · 기계 · 집게 · 조작 UI · 6시트)

## 목표
놀이터 새 게임 **인형뽑기**(구성안 `docs/claw-machine-design.md`)에 쓸 **인형뽑기 기계 본체**(세로 한 장)와 그 위에 겹치는 부품 · 집게 · 레일 · 조작 버튼 · 숫자판 그림을 만들고, 잘라서 `public/assets/claw/`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.**

> ⚠️ **이 그림만으로는 인형뽑기가 앱에 나오지 않는다.** 게임 코드 · 서버 판정 · 그림 목록(`claw-art.js`, 그림 게이트)은 다음 세션에서 만든다(구성안 §8 · §13).
> 지금 `public/assets/claw/`를 읽는 코드가 없어서, 그림만 먼저 들어와도 앱은 바뀌지 않고 깨지지 않는다(`build:assets`는 새 폴더를 서비스 워커 목록에만 더한다).

| 시트 | 내용 | 넣을 파일 |
|---|---|---|
| `43-1` | 인형뽑기 기계 본체 | `claw/machine.webp` |
| `43-2` | 인형뽑기 앞 겹침 부품 | `claw/chute-front.webp` · `claw/glass-glare.webp` · `claw/prize-door.webp` · `claw/chute-glow.webp` |
| `43-3` | 인형뽑기 집게 | `claw/claw-open.webp` · `claw/claw-closed.webp` · `claw/claw-grip-back.webp` · `claw/claw-grip-front.webp` |
| `43-4` | 인형뽑기 레일 | `claw/carriage.webp` · `claw/rail-x.webp` · `claw/rail-y.webp` · `claw/fx-clack.webp` |
| `43-5` | 인형뽑기 조작 버튼 | `claw/stick-base.webp` · `claw/stick-knob.webp` · `claw/btn-drop.webp` · `claw/btn-drop-down.webp` |
| `43-6` | 인형뽑기 숫자판 · 아이콘 | `claw/readout.webp` · `claw/timer-ring.webp` · `claw/icon-ticket.webp` · `claw/icon-box.webp` |

- 앱은 그림을 층으로 쌓는다(뒤 → 앞): 배경 → **기계 본체(속이 빈 기계)** → 인형 더미 → 집게 뒤 발톱 → 잡힌 인형 → 집게 앞 발톱 · 레일 → 배출구 앞벽 → 유리 반사 → 버튼. 그래서 **기계 본체 안에는 인형 · 집게 · 레일을 그리지 않는다.**
- `43-3` 집게 네 칸은 **같은 크기 · 같은 위치**여야 한다(앱이 제자리에서 바꿔 끼운다). `--union`으로 같은 창으로 자른다.

## 꼭 지킬 것
- **기존 그림과 같은 게임 그림체**(펫 · 몬스터 · 낚시 · 몬스터 사냥 그림)로 맞춘다. 더 흐리거나 뿌옇거나 수채화처럼 만들지 않는다.
- 그림에 **글자 · 숫자 · 로고를 넣지 않는다**(버튼 · 숫자판 · 표지판은 비워 둔다. 글자는 앱이 쓴다).
- 기계 본체는 프롬프트의 층 비율(위 장식 0~13% · 유리창 13~64% · 조작판 64~80% · 아래 몸통 80~100%, 배출구는 바닥 앞 왼쪽)을 지킨다. 다음 세션이 실제 그림에서 창 위치를 재서 맞춘다.
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** Codex에는 Drive가 없다. 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 그림을 참고 그림으로 붙인다.
- 고치는 파일: `public/assets/claw/` 아래 **새 그림**, 빌드가 바꾸는 `public/sw.js`, `docs/asset-requests/runner/DONE_43.md`. 앱 코드 · 게임 규칙 · 코인 · 서버 · 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다. 원본 PNG는 커밋하지 않는다(`/tmp/art/`).
- **브랜치:** `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-43`). 그 브랜치에 `docs/asset-requests/runner/43-claw-machine.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/claw-design`에서 시작하고 PR 대상도 그 브랜치로 한다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/43…`: 시트 하나 = 프롬프트 하나. 묶음 전체는 `43-claw-machine.txt`.
- `slice-map.csv`: `list` 열이 `43-claw-machine.txt`인 줄 = 칸마다 넣을 앱 파일(`app_file`). **이 이름이 다음 세션 코드가 읽는 이름이다. 바꾸지 않는다.** 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
시트 프롬프트(`split/`)는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 인형뽑기 기계 43 (Runner용)"에 정확한 파일 이름으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, glossy toy-like finish, crisp clean edges and colors exactly. Do NOT copy any object or character from the references; this is a new design.`
3. `43-2`부터는 참고 그림에 방금 만든 기계 `/tmp/art/43-1.png`도 같이 붙인다(색 · 재질 · 마감을 맞춘다).

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 모든 시트 | `hunt/ball-basic.webp`, `hunt/ball-gold.webp`, `hunt/bag.webp`, `fishing/btn-cast.webp`, `fishing/btn-reel.webp`, `fishing/bait-can.webp` (같은 게임의 물건 · 버튼 그림) |
| 43-1 기계 본체 | 위 + `pets/cat-1.webp`, `pets/panda-1.webp` (이 기계 안에 앉을 인형 그림체의 세계) |
| 43-2 이후 | 위 + `/tmp/art/43-1.png` (같은 묶음의 기계) |

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음).
2. 칸마다 그림이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 로고, 바닥 그림자가 없다.
3. 기존 그림(참고 그림)과 나란히 놓아도 같은 게임 그림처럼 보인다.
4. `43-1`: 기계 하나만, 바깥은 투명, **속이 비었다**(인형 · 집게 · 레일 · 줄 없음), 위 장식 · 유리창 · 조작판 · 아래 몸통 비율이 대략 맞고, 배출구 구멍이 바닥 앞 왼쪽 · 상품 문이 아래 왼쪽에 있다. 표지판 · 화면이 비어 있다.
5. `43-3`: 집게 네 칸의 모터 머리 위치 · 크기가 같다. `43-5` · `43-6`: 버튼 · 숫자판에 글자가 없다.

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1~2번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 하나씩 만든다. `43-1`은 **세로 1024×1536 투명 PNG**, 나머지는 2×2 시트 1024×1024 투명 PNG.
- `/tmp/art/43-1.png` … `/tmp/art/43-6.png`로 저장한다. 점검을 통과하지 못하면 다시 만든다(장마다 최대 4번).
- 보내는 순서: `43-1` → `43-2` … `43-6` (기계가 먼저 있어야 부품이 맞출 수 있다).

## 2. 자르고 넣기
```
mkdir -p public/assets/claw
# 43-1 기계 본체: 768×1152 webp(투명 유지), 300KB 이하(넘으면 quality를 낮춘다)
node --input-type=module -e "
import sharp from 'sharp';
await sharp('/tmp/art/43-1.png').resize(768, 1152, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 86, alphaQuality: 90, effort: 6 }).toFile('public/assets/claw/machine.webp');
"
R=docs/asset-requests/runner
node $R/fit-assets.mjs /tmp/art/43-2.png claw/chute-front claw/glass-glare claw/prize-door claw/chute-glow --trim --size 512 --preview /tmp/review/43-2.png
node $R/fit-assets.mjs /tmp/art/43-3.png claw/claw-open claw/claw-closed claw/claw-grip-back claw/claw-grip-front --union --size 384 --preview /tmp/review/43-3.png
node $R/fit-assets.mjs /tmp/art/43-4.png claw/carriage claw/rail-x claw/rail-y claw/fx-clack --trim --size 512 --preview /tmp/review/43-4.png
node $R/fit-assets.mjs /tmp/art/43-5.png claw/stick-base claw/stick-knob claw/btn-drop claw/btn-drop-down --trim --size 384 --preview /tmp/review/43-5.png
node $R/fit-assets.mjs /tmp/art/43-6.png claw/readout claw/timer-ring claw/icon-ticket claw/icon-box --trim --size 512 --preview /tmp/review/43-6.png
```
- 칸 이름은 `slice-map.csv`의 `app_file`과 같아야 한다.
- `43-3` 집게 네 장 중 하나라도 못 넣으면 네 장 모두 넣지 않는다.

## 3. 마무리
```
npm ci
npm run build:assets
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `docs/asset-requests/runner/DONE_43.md`(한국어): 넣은 그림 표(시트 · 파일 · 다시 만든 횟수), 넣지 못한 것과 이유, "눈으로 확인 필요". `43-1`의 유리창 · 바닥 · 배출구 구멍 위치를 그림 높이의 %로 재서 적는다(다음 세션이 층을 맞출 때 쓴다). 마지막에 "인형뽑기는 게임 코드(다음 세션)가 생겨야 앱에 나온다"를 적는다.
- PR 제목 `그림 43: 인형뽑기 기계 · 집게 · 조작 UI`, 본문 한국어. 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 작게 합쳐 PR 코멘트로 올린다. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 인형뽑기는 게임 코드가 생기기 전까지 앱에 나오지 않습니다.` **머지하지 않는다.**
