# Codex 작업 지시: 그림 53 (심해 물고기 8종 · 4시트 · 그림 24장)

## 목표
놀이터 손맛 낚시의 **깊은 바다**(구성안 `docs/fishing-upgrade-design.md`)에 나오는 심해 물고기 8종을 만들고, 잘라서 `public/assets/fish/`에 넣은 뒤 PR을 만든다.
물고기마다 **3장**: 옆모습 `<key>.webp`(256px), 매달린 그림 `<key>-hang.webp`(256px), 작은 매달린 그림 `<key>-hang-s.webp`(96px). 시트는 53a(옆모습) 2장 · 53b(매달린 그림) 2장이다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.** 세 장이 다 들어온 물고기는 `npm run build:assets`가 `public/modules/fish-art.js`(FISH_READY)에 자동으로 넣고, 그때부터 깊은 바다에서 나온다.

| 시트 | 칸 | key | 이름 | 등급 | 파일 |
|---|---|---|---|---|---|
| `53a-1` | 왼쪽 위 | `anglerfish` | 아귀 | 희귀 | `fish/anglerfish` |
| `53a-1` | 오른쪽 위 | `blobfish` | 블롭피시 | 희귀 | `fish/blobfish` |
| `53a-1` | 왼쪽 아래 | `fireflysquid` | 반딧불오징어 | 희귀 | `fish/fireflysquid` |
| `53a-1` | 오른쪽 아래 | `oarfish` | 산갈치 | 영웅 | `fish/oarfish` |
| `53a-2` | 왼쪽 위 | `toothfish` | 이빨고기 | 영웅 | `fish/toothfish` |
| `53a-2` | 오른쪽 위 | `vampiresquid` | 흡혈오징어 | 영웅 | `fish/vampiresquid` |
| `53a-2` | 왼쪽 아래 | `manta` | 대왕쥐가오리 | 전설 | `fish/manta` |
| `53a-2` | 오른쪽 아래 | `frilledshark` | 주름상어 | 전설 | `fish/frilledshark` |
| `53b-1` | 왼쪽 위 | `anglerfish` | 아귀 | 희귀 | `fish/anglerfish-hang` + `fish/anglerfish-hang-s` |
| `53b-1` | 오른쪽 위 | `blobfish` | 블롭피시 | 희귀 | `fish/blobfish-hang` + `fish/blobfish-hang-s` |
| `53b-1` | 왼쪽 아래 | `fireflysquid` | 반딧불오징어 | 희귀 | `fish/fireflysquid-hang` + `fish/fireflysquid-hang-s` |
| `53b-1` | 오른쪽 아래 | `oarfish` | 산갈치 | 영웅 | `fish/oarfish-hang` + `fish/oarfish-hang-s` |
| `53b-2` | 왼쪽 위 | `toothfish` | 이빨고기 | 영웅 | `fish/toothfish-hang` + `fish/toothfish-hang-s` |
| `53b-2` | 오른쪽 위 | `vampiresquid` | 흡혈오징어 | 영웅 | `fish/vampiresquid-hang` + `fish/vampiresquid-hang-s` |
| `53b-2` | 왼쪽 아래 | `manta` | 대왕쥐가오리 | 전설 | `fish/manta-hang` + `fish/manta-hang-s` |
| `53b-2` | 오른쪽 아래 | `frilledshark` | 주름상어 | 전설 | `fish/frilledshark-hang` + `fish/frilledshark-hang-s` |

- 시트와 칸마다 넣을 파일은 `slice-map.csv`에서 `list` 열이 `53a-deep-fish.txt` · `53b-deep-fish-hanging.txt`인 줄을 본다. **key를 바꾸지 않는다**(앱은 `public/assets/fish/<key>.webp`를 그대로 찾는다).
- 모든 물고기는 **옆모습, 오른쪽을 본다**(53a). 53b는 같은 물고기가 **머리를 위로, 낚싯바늘에 매달린** 모습이다(27b와 같은 자세).
- 심해 물고기답게 어둡고 신비한 느낌(발광 · 큰 눈 · 작은 이빨)이지만, **기존 물고기(26 · 27번)와 같은 그림체**여야 한다. 무섭거나 징그럽게 그리지 않는다.

## 꼭 지킬 것
- **기존 물고기 그림과 같은 그림체**로 맞춘다. 더 흐리거나 뿌옇거나 수채화처럼 만들지 않는다. 기존 물고기를 베끼지 않는다.
- 글자 · 숫자 · 로고 · 물 · 배경 · 바닥 그림자 · 체크무늬가 없다(진짜 투명).
- **한 번에 시트 하나(물고기 4마리)씩** 만든다. 53b는 같은 번호의 53a(`53a-1` → `53b-1`)가 먼저 있어야 맞출 수 있다.
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** Codex에는 Drive가 없다. 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 기존 물고기 그림을 참고 그림으로 붙인다.
- 고치는 파일: `public/assets/fish/` 아래 **새 그림**, 빌드가 바꾸는 `public/sw.js` · `public/modules/fish-art.js`, `docs/asset-requests/runner/DONE_53.md`. 그 밖의 앱 코드, 게임 규칙, 코인, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다. 원본 시트 PNG는 커밋하지 않는다(`/tmp/art/`).
- **브랜치:** `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-53`). 그 브랜치에 `docs/asset-requests/runner/53a-deep-fish.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/fishing-upgrade`에서 시작하고 PR 대상도 그 브랜치로 한다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/53a-1 …` ~ `53b-2 …`: 시트 하나 = 프롬프트 하나. 묶음 전체는 `53a-deep-fish.txt` · `53b-deep-fish-hanging.txt`.
- `slice-map.csv`: 칸 이름 · 앱 파일. 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.
- 보내는 순서: `53a-1` → `53a-2` → `53b-1` → `53b-2`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
시트 프롬프트(`split/`)는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 물고기 26 · 27번을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 심해 물고기 53 (Runner용)"에 정확한 파일 이름 "53a-1.png" … 으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 고친다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림(저장소 안 기존 물고기)을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: they are fish already in this game. Match their art style, glossy 3D look, eyes, outline, size in the cell and finish exactly. Do NOT copy the reference fish; these are new deep-sea fish.`
3. `53a-2`부터는 방금 만든 `/tmp/art/53a-1.png`도 붙이고, `53b-N`에는 **같은 번호의 `/tmp/art/53a-N.png`를 꼭 붙인다**(같은 물고기 디자인을 자세만 바꿔 그린다).

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 53a | `fish/tuna.webp`, `fish/squid.webp`, `fish/shark.webp`, `fish/coelacanth.webp`, `fish/whaleshark.webp` |
| 53b | `fish/tuna-hang.webp`, `fish/squid-hang.webp`, `fish/shark-hang.webp`, `fish/coelacanth-hang.webp` + 같은 번호의 `/tmp/art/53a-N.png` |

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음).
2. 칸마다 물고기가 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 물, 바닥 그림자가 없다.
3. 53a는 오른쪽을 보는 옆모습, 53b는 머리가 위 · 바늘과 줄이 칸 위 가운데에 있다.
4. 기존 물고기와 나란히 놓아도 같은 게임 그림처럼 보이고, 48px로 줄여도 어떤 물고기인지 알아볼 수 있다.

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1~2번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트 1024×1024, **투명 배경 PNG**, 칸마다 물고기 하나.
- 만든 그림은 `/tmp/art/<시트 번호>.png`로 저장한다(예: `/tmp/art/53a-1.png`). 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.

## 2. 자르고 넣기
기존 물고기와 같은 규격(옆모습 256px, 매달린 그림 256px + 작은 그림 96px, 투명 webp, 칸마다 같은 크기 `--fit-each`)으로 자른다.
```
R=docs/asset-requests/runner
node $R/fit-assets.mjs /tmp/art/53a-1.png fish/anglerfish fish/blobfish fish/fireflysquid fish/oarfish --fit-each --preview /tmp/review/53a-1.png
node $R/fit-assets.mjs /tmp/art/53a-2.png fish/toothfish fish/vampiresquid fish/manta fish/frilledshark --fit-each --preview /tmp/review/53a-2.png
node $R/fit-assets.mjs /tmp/art/53b-1.png fish/anglerfish-hang fish/blobfish-hang fish/fireflysquid-hang fish/oarfish-hang --fit-each --small 96 --preview /tmp/review/53b-1.png
node $R/fit-assets.mjs /tmp/art/53b-2.png fish/toothfish-hang fish/vampiresquid-hang fish/manta-hang fish/frilledshark-hang --fit-each --small 96 --preview /tmp/review/53b-2.png
```
- 칸 이름은 `slice-map.csv`의 `app_file`과 같아야 한다(키가 틀리면 앱이 그림을 못 찾는다).
- 한 물고기의 세 장(`<key>` · `<key>-hang` · `<key>-hang-s`)이 **다 있어야** 그 물고기가 나온다. 한 장이라도 빠지면 그 물고기는 나오지 않는다(앱은 깨지지 않는다).

## 3. 마무리
```
npm ci
npm run build:assets      # public/modules/fish-art.js에 새 물고기가 들어간다
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `docs/asset-requests/runner/DONE_53.md`(한국어): 넣은 물고기 표(시트 · 칸 · 물고기 · 파일 · 다시 만든 횟수), 넣지 못한 것과 이유, "눈으로 확인 필요". 마지막에 "세 장이 다 들어온 물고기는 깊은 바다(낚싯대 3단계)에서 바로 나온다"를 적는다.
- PR 제목 `그림 53: 심해 물고기 8종`, 본문 한국어. 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 작게 합쳐 PR 코멘트로 올린다. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.`
