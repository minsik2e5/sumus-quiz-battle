# Codex 작업 지시: 그림 63 (놀이터 입구 카드 3장: 10초 맞추기 · 가위바위보 · 야바위)

## 목표
놀이터의 **10초 맞추기**(미니게임)와 **가위바위보 · 야바위**(코인 승부) 큰 입구 카드에 들어갈 가로 그림 3장을 만들어 넣고 PR을 만든다.
낚시터 · 짝 맞추기 · 펫 사냥 · 인형뽑기 카드와 나란히 크게 나오므로 **같은 수준(또는 더 멋진) 그림**이어야 한다. 선생님 주문: "간지나게".

| 시트 | 내용 | 넣는 곳 |
|---|---|---|
| 63-1 | 어두운 무대 · 빨간 빛, 커다란 빨간 버튼 + 빛나는 타이머 · 금색 '딱 맞춤' 고리 | `public/assets/timing/entry.webp` |
| 63-2 | 노을빛 게임쇼 무대, 가위바위보 로봇(기존 로봇 그대로) + 주먹 · 가위 · 보 토큰 · 코인 | `public/assets/rps/entry.webp` |
| 63-3 | 어두운 도박장 · 녹색 펠트 테이블, 곽 사장(기존 곽 사장 그대로, 얼굴이 안 잘리게) + 빨간 컵 · 공 · 칩 | `public/assets/yabawi/entry.webp` |

**그림 파일만 넣으면 된다.** `npm run build:assets`가 `public/modules/entry-art.js`(`ENTRY_ART`)에 이름을 적고, 카드가 알아서 그 그림으로 바뀐다(없으면 지금 그림: 코드로 그린 10초 화면 · 로봇 · 곽 사장 카드 그림). 앱 코드는 고치지 않는다.

## 꼭 지킬 것
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 기존 그림을 참고 그림으로 붙인다.
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-63`).
- 고치는 파일: 위 표의 그림 3장, `docs/asset-requests/runner/DONE_63.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/entry-art.js`. 그 밖의 앱 코드, 게임 규칙, 코인, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 원본 PNG는 커밋하지 않는다(`/tmp/art/`). 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.
- 그림에 **글자 · 숫자 · 로고가 없다**(게임이 위에 제목 · 기록을 쓴다). 10초 맞추기 타이머도 읽을 수 있는 숫자 없이 빛나는 막대 모양만.
- 왼쪽 45% · 아래 28%는 차분하게(제목 자리), 오른쪽 위 모서리도 조금 비운다(남은 판 점 배지 자리).

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/63-1 …` ~ `63-3 …`: 시트 하나 = 프롬프트 하나. 묶음 전체는 `63-playground-entries.txt`, 파일 자리는 `slice-map.csv`(`list` 열이 `63-playground-entries.txt`).
- 세 장은 서로 따로 돌려도 된다.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 입구 그림 "27a-3.png" · "32-1.png" · "44-4.png"와 로봇 · 곽 사장 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 놀이터 입구 63 (Runner용)"에 정확한 파일 이름 "63-1.png" · "63-2.png" · "63-3.png"로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `WHEN DONE`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges, lighting and colors exactly. Any character shown in the references (the robot, 곽 사장) must be drawn exactly on-model. Do NOT copy or resemble any cartoon, anime, game or movie character or any real person.`

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 모든 시트 | `fishing/bg-entry.webp`, `match/entry.webp`, `hunt/entry.webp`, `claw/entry.webp` (나란히 나오는 입구 카드) |
| 63-2 가위바위보 | + `rps/robot-ready.webp`, `rps/robot-win.webp`, `rps/hand-rock.webp`, `rps/hand-scissors.webp`, `rps/hand-paper.webp` |
| 63-3 야바위 | + `yabawi/card-hero.webp`, `yabawi/dealer-grin.webp`, `yabawi/dealer-point.webp`, `yabawi/cup.webp`, `yabawi/bg-room.webp` |

### 후보 점검 (모두 통과해야 쓴다)
1. 가로 1536×1024(또는 3:2), 끝까지 칠해져 있다(투명 · 테두리 · 둥근 모서리 없음). 글자 · 숫자 · 로고가 없다.
2. 주인공이 오른쪽 위쪽에 있고, 왼쪽 45% · 아래 28%가 차분하다.
3. 16:9로 가운데를 잘라도 주인공이 안 잘린다. **63-3은 곽 사장의 머리 · 얼굴 전체가 위로 여유 있게 들어 있다.**
4. 로봇 · 곽 사장은 참고 그림과 같은 캐릭터로 보인다(얼굴 · 옷 · 색).
5. 360px로 줄여도 무슨 게임인지 바로 알 수 있고, 다른 입구 카드와 나란히 놓아도 같은 게임 그림처럼 보인다.

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 넣기
```
mkdir -p public/assets/timing
# 1280×853 webp, 220KB 이하 (다른 입구 그림 claw/entry.webp · match/entry.webp와 같은 크기)
node -e "require('sharp')('/tmp/art/63-1.png').resize(1280,853,{fit:'cover'}).webp({quality:82}).toFile('public/assets/timing/entry.webp')"
node -e "require('sharp')('/tmp/art/63-2.png').resize(1280,853,{fit:'cover'}).webp({quality:82}).toFile('public/assets/rps/entry.webp')"
node -e "require('sharp')('/tmp/art/63-3.png').resize(1280,853,{fit:'cover'}).webp({quality:82}).toFile('public/assets/yabawi/entry.webp')"
```
`sharp`가 없으면 `npm i --no-save sharp`. 220KB가 넘으면 quality를 조금씩 낮춘다.

## 점검
```
npm ci
npm run build:assets      # public/modules/entry-art.js의 ENTRY_ART에 timing · rps · yabawi가 적힌다
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `docs/asset-requests/runner/DONE_63.md`(한국어): 넣은 그림 3장, 다시 만든 횟수, "눈으로 확인 필요"(16:9로 잘렸을 때 곽 사장 얼굴 · 로봇 · 버튼이 잘 보이는지).
- PR 제목 `그림 63: 놀이터 입구 카드 (10초 맞추기 · 가위바위보 · 야바위)`, 본문 한국어. 세 그림을 한 장에 모은 미리보기를 작게 PR 코멘트로 올린다. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.`
