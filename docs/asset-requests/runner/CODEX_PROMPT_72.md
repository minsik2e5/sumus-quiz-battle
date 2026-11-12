# Codex 작업 지시: 그림 72 (위에서 내려다본 펫 아레나 경기장 바닥 7장)

## 목표
캔버스 전투(구성안 `docs/arena-battle-reboot-plan.md` 3-1)는 **위에서 비스듬히 내려다보는 시점**이다. 경기장 꾸미기 해금 7곳(벚꽃 광장 · 숲 · 밤 · 하늘 정원 · 얼음 동굴 · 화산 · 은하)을 같은 장소로, 위에서 본 바닥으로 다시 그린다.

| 시트 | 넣는 곳(`public/assets/arena/`, 1080×1620 webp) |
|---|---|
| 72-1 벚꽃 광장 · 72-2 숲 · 72-3 밤 · 72-4 하늘 정원 · 72-5 얼음 동굴 · 72-6 화산 · 72-7 은하 | `floor-plaza` · `floor-forest` · `floor-night` · `floor-sky` · `floor-glacier` · `floor-volcano` · `floor-galaxy` |

- **배치가 가장 중요하다**: 싸우는 판(가로:세로 = 84:72 둥근 사각형)이 그림의 **가로 6~94% · 세로 25~75%**에 딱 들어가고, 판 가운데는 무늬 · 물건 없이 차분하다(효과 · 금 · 펫이 잘 보이게). 위아래는 그 장소의 풍경.
- **72-1을 먼저** 그리고, 72-2 ~ 72-7에는 72-1을 함께 붙여 카메라 · 판 크기 · 위치 · 테두리 굵기를 똑같이 맞춘다.
- 그림만 넣는다. 앱에 붙이는 일은 구성안 ⑥단계. 입력: `split/72-1 …` ~ `72-7 …`, 묶음 `72-arena-top-floors.txt`, 프롬프트는 `build-72.mjs`.

## 꼭 지킬 것
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 그림을 참고 그림으로 붙인다.
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-72-arena-top-floors`).
- 고치는 파일: 위 표의 그림 7장, `docs/asset-requests/runner/DONE_72.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/arena-art.js`. 그 밖의 앱 코드 · 규칙 · 코인 · 서버 · 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 원본 PNG는 커밋하지 않는다(`/tmp/art/`). 기존 그림을 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.
- 그림에 **글자 · 숫자 · 로고가 없다.** 다른 게임 · 만화 · 영화의 캐릭터 · 아이콘 · 화면 배치를 따라 하지 않는다.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식이다(기존 그림 폴더를 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 펫 아레나 72 (Runner용)"에 정확한 파일 이름 "72-N.png"로 저장). Codex는 보내기 전에:
1. `STYLE REFERENCE`, `WHEN DONE`으로 **시작하는 줄을 지운다**.
2. 아래 참고 그림을 같이 보여 주고, 세 번째 줄에 넣는다: `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges, light from the upper-left and colors exactly. Do NOT copy or resemble any cartoon, anime, game or movie character, logo, icon or screen layout.`
### 참고 그림 (`public/assets/` 아래)
같은 장소의 지금 그림: `arena/bg-plaza.webp` · `arena/bg-forest.webp` · `arena/bg-night.webp` (68번 그림이 들어와 있으면 `arena/bg-sky` · `bg-glacier` · `bg-volcano` · `bg-galaxy`도)

## 넣기
```
npm i --no-save sharp
for k in 1:plaza 2:forest 3:night 4:sky 5:glacier 6:volcano 7:galaxy; do n=${k%%:*}; name=${k#*:}; node -e "require('sharp')('/tmp/art/72-$n.png').resize(1080,1620,{fit:'fill'}).webp({quality:80}).toFile('public/assets/arena/floor-$name.webp')"; done
```
한 장 250KB 이하(넘으면 quality 72). **확인**: 판의 네 모서리가 가로 6~94% · 세로 25~75% 안에 있는지 미리보기에 선을 그어 본다.

## 점검
```
npm ci
npm run build:assets      # ARENA_ART에 새 이름이 적힌다
npm run check
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D` · `M`이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `DONE_72.md`(한국어): 넣은 그림(경로 · 크기 · 용량), 다시 만든 횟수, "눈으로 확인 필요" 항목.
- PR 본문 한국어, 시트 미리보기를 한 장에 모아 작게 PR 코멘트로. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.`
