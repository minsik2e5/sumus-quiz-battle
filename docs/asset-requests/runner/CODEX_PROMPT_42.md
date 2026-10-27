# Codex 작업 지시: 그림 42 (인형뽑기 · 인형 12종 · 12시트)

## 목표
놀이터 새 게임 **인형뽑기**(구성안 `docs/claw-machine-design.md`)에 쓸 12지 동물 **봉제 인형 12종**의 그림을 만들고, 잘라서 `public/assets/claw/`에 넣은 뒤 PR을 만든다. 인형마다 **기본 · 집힘 · 떨어짐 · 기쁨** 4자세(48장, 모두 필요)와 작은 그림(`-s`, 128px)이다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.**

> ⚠️ **이 그림만으로는 인형뽑기가 앱에 나오지 않는다.** 게임 코드 · 서버 판정 · 그림 목록(`claw-art.js`, 그림 게이트)은 다음 세션에서 만든다(구성안 §8 · §13).
> 지금 `public/assets/claw/`를 읽는 코드가 없어서, 그림만 먼저 들어와도 앱은 바뀌지 않고 깨지지 않는다(`build:assets`는 새 폴더를 서비스 워커 목록에만 더한다).

| 시트 | key | 이름 | 동물 | 헷갈리면 안 되는 진짜 펫(참고) |
|---|---|---|---|---|
| `42a-1` | `rat` | 쪼꼬 쥐 | 쥐 | `pets/mouse-1.webp` |
| `42a-2` | `ox` | 음메 소 | 소 | `pets/calf-1.webp` |
| `42a-3` | `tiger` | 어흥 호랑이 | 호랑이 | `pets/tiger-1.webp` |
| `42a-4` | `rabbit` | 깡총 토끼 | 토끼 | `pets/rabbit-1.webp` |
| `42a-5` | `dragon` | 미르 용 | 용 | `pets/dragon-1.webp` |
| `42a-6` | `snake` | 스르르 뱀 | 뱀 | `pets/snake-1.webp` |
| `42a-7` | `horse` | 따각 말 | 말 | `pets/pony-1.webp` |
| `42a-8` | `sheep` | 몽실 양 | 양 | `pets/sheep-1.webp` |
| `42a-9` | `monkey` | 끼끼 원숭이 | 원숭이 | `pets/monkey-1.webp` |
| `42a-10` | `rooster` | 꼬꼬 닭 | 닭 | `pets/rooster-1.webp` |
| `42a-11` | `dog` | 멍멍 강아지 | 개 | `pets/dog-1.webp` |
| `42a-12` | `pig` | 꿀꿀 돼지 | 돼지 | `pets/pig-1.webp` |

- 앱은 `public/assets/claw/doll-<key>.webp` · `-grab` · `-fall` · `-joy`(+ 각 `-s`)를 그대로 읽는다. 네 자세가 다 있는 인형만 게임에 나온다(그림 게이트). **key를 바꾸지 않는다.**
- **진짜 12지 펫과 헷갈리지 않게** 하는 것이 가장 중요하다: 시트마다 펫과 다른 색 · 봉제 선 · 단추 눈 · 엉덩이 쪽 빈 천 태그 · 머리 위 볼체인 고리가 들어간다.

## 꼭 지킬 것
- **기존 그림과 같은 게임 그림체**(펫 · 몬스터 · 낚시 · 몬스터 사냥 그림)로 맞춘다. 더 흐리거나 뿌옇거나 수채화처럼 만들지 않는다.
- 그림에 **글자 · 숫자 · 로고를 넣지 않는다**(버튼 · 숫자판 · 표지판은 비워 둔다. 글자는 앱이 쓴다).
- **인형(봉제 장난감)**이지 살아 있는 펫이 아니다. 진짜 펫 그림을 베끼지 않는다. 128px로 줄여도 어떤 동물인지 알아볼 수 있는 큰 실루엣.
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** Codex에는 Drive가 없다. 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 그림을 참고 그림으로 붙인다.
- 고치는 파일: `public/assets/claw/` 아래 **새 그림**, 빌드가 바꾸는 `public/sw.js`, `docs/asset-requests/runner/DONE_42.md`. 앱 코드 · 게임 규칙 · 코인 · 서버 · 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다. 원본 PNG는 커밋하지 않는다(`/tmp/art/`).
- **브랜치:** `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-42`). 그 브랜치에 `docs/asset-requests/runner/42a-claw-dolls.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/claw-design`에서 시작하고 PR 대상도 그 브랜치로 한다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/42…`: 시트 하나 = 프롬프트 하나. 묶음 전체는 `42a-claw-dolls.txt`.
- `slice-map.csv`: `list` 열이 `42a-claw-dolls.txt`인 줄 = 칸마다 넣을 앱 파일(`app_file`). **이 이름이 다음 세션 코드가 읽는 이름이다. 바꾸지 않는다.** 칸 순서는 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래.
- 자르기 도구: `fit-assets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
시트 프롬프트(`split/`)는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 인형뽑기 42 (Runner용)"에 정확한 파일 이름으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. The pet pictures show living pets of this game: make the plush toy clearly DIFFERENT from them (different colors, fabric, stitches, button eyes, tag, ball-chain loop). Do NOT copy any character from the references; this is a new toy design.`
3. `42a-2`부터는 참고 그림에 방금 만든 첫 시트 `/tmp/art/42a-1.png`도 같이 붙인다(천 느낌 · 봉제 선 · 단추 눈 · 태그 · 칸 안 크기를 맞춘다. 동물 · 색은 베끼지 않는다).

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 모든 시트 | `pets/cat-1.webp`, `pets/panda-2.webp`, `pets/rabbit-1-happy.webp` (우리 펫 그림체), `monsters/mochi.webp` (반짝임 · 테두리), `fishing/bait-can.webp`, `hunt/ball-basic.webp` (물건 그림 마감) |
| 시트마다 | 위 표의 "진짜 펫" 그림(예: `42a-1`은 `pets/mouse-1.webp`) — **다르게 그리기 위한** 참고 |
| 42a-2 이후 | `/tmp/art/42a-1.png` (같은 묶음의 첫 시트) |

### 후보 점검 (모두 통과해야 쓴다)
1. 배경이 진짜 투명이다(네 모서리 alpha 0, 체크무늬 · 흰 상자 · 흰 테두리 없음).
2. 칸마다 그림이 하나씩 따로 있고, 겹치거나 잘리지 않았다. 글자, 숫자, 로고, 바닥 그림자가 없다.
3. 기존 그림(참고 그림)과 나란히 놓아도 같은 게임 그림처럼 보인다.
4. 네 칸이 같은 인형(색 · 모양 · 크기 · 태그 · 고리가 같음), 자세만 다르다. 진짜 펫과 나란히 놓아도 "인형"으로 바로 보이고 색이 다르다. 128px로 줄여도 알아볼 수 있다.

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1~2번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 1. 그림 만들기
- **Codex의 내장 그림 생성 기능**으로 시트를 하나씩 만든다. API를 직접 부르지 않는다.
- 2×2 시트 1024×1024, **투명 배경 PNG**. 칸: 왼쪽 위 기본 · 오른쪽 위 집힘 · 왼쪽 아래 떨어짐 · 오른쪽 아래 기쁨.
- 만든 그림은 `/tmp/art/<시트 번호>.png`로 저장한다(예: `/tmp/art/42a-1.png`). 점검을 통과하지 못하면 같은 프롬프트로 다시 만든다. 시트마다 최대 4번이다.
- 보내는 순서: `42a-1` → `42a-2` … `42a-12`. 한 번에 다 못 만들면 **인형 하나를 끝까지** 만든 단위로 끊는다.

## 2. 자르고 넣기
네 자세를 같은 배율로 바닥에 세운다(`--stand-same`, 512×512 webp, 투명) + 작은 그림 128px(`--small 128`).
```
mkdir -p public/assets/claw
R=docs/asset-requests/runner
node $R/fit-assets.mjs /tmp/art/42a-1.png claw/doll-rat claw/doll-rat-grab claw/doll-rat-fall claw/doll-rat-joy --stand-same --small 128 --preview /tmp/review/42a-1.png
node $R/fit-assets.mjs /tmp/art/42a-2.png claw/doll-ox claw/doll-ox-grab claw/doll-ox-fall claw/doll-ox-joy --stand-same --small 128 --preview /tmp/review/42a-2.png
node $R/fit-assets.mjs /tmp/art/42a-3.png claw/doll-tiger claw/doll-tiger-grab claw/doll-tiger-fall claw/doll-tiger-joy --stand-same --small 128 --preview /tmp/review/42a-3.png
node $R/fit-assets.mjs /tmp/art/42a-4.png claw/doll-rabbit claw/doll-rabbit-grab claw/doll-rabbit-fall claw/doll-rabbit-joy --stand-same --small 128 --preview /tmp/review/42a-4.png
node $R/fit-assets.mjs /tmp/art/42a-5.png claw/doll-dragon claw/doll-dragon-grab claw/doll-dragon-fall claw/doll-dragon-joy --stand-same --small 128 --preview /tmp/review/42a-5.png
node $R/fit-assets.mjs /tmp/art/42a-6.png claw/doll-snake claw/doll-snake-grab claw/doll-snake-fall claw/doll-snake-joy --stand-same --small 128 --preview /tmp/review/42a-6.png
node $R/fit-assets.mjs /tmp/art/42a-7.png claw/doll-horse claw/doll-horse-grab claw/doll-horse-fall claw/doll-horse-joy --stand-same --small 128 --preview /tmp/review/42a-7.png
node $R/fit-assets.mjs /tmp/art/42a-8.png claw/doll-sheep claw/doll-sheep-grab claw/doll-sheep-fall claw/doll-sheep-joy --stand-same --small 128 --preview /tmp/review/42a-8.png
node $R/fit-assets.mjs /tmp/art/42a-9.png claw/doll-monkey claw/doll-monkey-grab claw/doll-monkey-fall claw/doll-monkey-joy --stand-same --small 128 --preview /tmp/review/42a-9.png
node $R/fit-assets.mjs /tmp/art/42a-10.png claw/doll-rooster claw/doll-rooster-grab claw/doll-rooster-fall claw/doll-rooster-joy --stand-same --small 128 --preview /tmp/review/42a-10.png
node $R/fit-assets.mjs /tmp/art/42a-11.png claw/doll-dog claw/doll-dog-grab claw/doll-dog-fall claw/doll-dog-joy --stand-same --small 128 --preview /tmp/review/42a-11.png
node $R/fit-assets.mjs /tmp/art/42a-12.png claw/doll-pig claw/doll-pig-grab claw/doll-pig-fall claw/doll-pig-joy --stand-same --small 128 --preview /tmp/review/42a-12.png
```
- 칸 이름은 `slice-map.csv`의 `app_file`과 같아야 한다(틀리면 앱이 그림을 못 찾는다).
- 네 자세 중 하나라도 못 넣은 인형은 네 장 모두 넣지 않는다(그림 게이트가 그 인형을 빼고 쓴다).

## 3. 마무리
```
npm ci
npm run build:assets
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `docs/asset-requests/runner/DONE_42.md`(한국어): 넣은 그림 표(시트 · 파일 · 다시 만든 횟수), 넣지 못한 것과 이유, "눈으로 확인 필요". 인형마다 "진짜 펫과 다르게 보이는 점"을 한 줄씩 적는다. 마지막에 "인형뽑기는 게임 코드(다음 세션)가 생겨야 앱에 나온다"를 적는다.
- PR 제목 `그림 42: 인형뽑기 인형 12종 (rat · ox · tiger · rabbit · dragon · snake · horse · sheep · monkey · rooster · dog · pig)`, 본문 한국어. 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 작게 합쳐 PR 코멘트로 올린다. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 인형뽑기는 게임 코드가 생기기 전까지 앱에 나오지 않습니다.` **머지하지 않는다.**
