# Codex 작업 지시: 그림 56 (테마 알 상점 아이콘 2 · 테마 칭호 메달 2 · 2시트)

## 목표
곤충 · 공룡 새 펫 테마(`docs/bug-dino-pets-design.md`)의 알 상점 아이콘 2개(`ui/bug-egg` · `ui/dino-egg`, 256px)와 칭호 메달 2개(`titles/bugall` · `titles/dinoall`, 256px + 96px 작은 그림)를 만들어 `public/assets/`에 넣고 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다.** 알 · 칭호 등록은 다음 세션 코드에서 한다(그림만 먼저 들어와도 앱은 바뀌지 않는다).

| 시트 | 칸 | 파일 | 내용 |
|---|---|---|---|
| `56a-1` | 왼쪽 위 | `public/assets/ui/bug-egg.webp` | 곤충 채집 알 (알 상점) |
| `56a-1` | 오른쪽 위 | `public/assets/ui/dino-egg.webp` | 공룡 화석 알 (알 상점) |
| `56a-1` | 왼쪽 아래 | (여분: 왼쪽 위보다 나으면 이 칸을 ui/bug-egg로 넣는다) | 곤충 채집 알 (여분, 고르기용) |
| `56a-1` | 오른쪽 아래 | (여분: 오른쪽 위보다 나으면 이 칸을 ui/dino-egg로 넣는다) | 공룡 화석 알 (여분, 고르기용) |
| `56b-1` | 왼쪽 위 | `public/assets/titles/bugall.webp` | 곤충 채집왕 (영웅) |
| `56b-1` | 오른쪽 위 | `public/assets/titles/dinoall.webp` | 쥬라기 반장 (영웅) |
| `56b-1` | 왼쪽 아래 | (여분: 위 칸보다 나으면 이 칸을 titles/bugall로 넣는다) | 곤충 채집왕 (여분, 고르기용) |
| `56b-1` | 오른쪽 아래 | (여분: 위 칸보다 나으면 이 칸을 titles/dinoall로 넣는다) | 쥬라기 반장 (여분, 고르기용) |

- 두 시트 모두 **아래 줄은 같은 그림의 다른 시안(여분)** 이다. 위 줄보다 나으면 그 칸을 위 칸 파일 이름으로 넣는다. 여분은 따로 넣지 않는다.
- 메달 테두리는 **영웅(보라 방패)** 이다. 기존 영웅 메달과 테두리가 똑같아야 한다. 글자 · 숫자 없음.

## 꼭 지킬 것
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 기존 그림을 참고 그림으로 붙인다.
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-56`). 그 브랜치에 `docs/asset-requests/runner/56a-theme-egg-icons.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/bug-dino-pets-plan`에서 시작하고 PR 대상도 그 브랜치로 한다.
- `public/assets/` 아래 **새 그림**, `docs/asset-requests/runner/DONE_56.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/pet-art.js` 말고는 고치지 않는다. 앱 코드, 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다(`/tmp/art/`). 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.
- **한 번에 시트 하나씩** 만든다. 여러 시트를 한 장에 몰아 그리지 않는다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/56a-1 …` · `split/56b-1 …`, 묶음 전체는 `56a-theme-egg-icons.txt` · `56b-theme-title-medals.txt`, 칸과 파일은 `slice-map.csv`(`list` 열이 `56a-…` · `56b-…`).
- 자르기 도구: `fit-assets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 그림을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 테마 알 · 칭호 56 (Runner용)"에 정확한 파일 이름 "56a-1.png" … 으로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `CHARACTER REFERENCE`, `Also open`, `WHEN DONE`
2. 아래 표의 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. If a reference shows this same character, keep its face, colors, markings and accessories exactly. Do NOT copy any other animal or character from the references, and do NOT copy or resemble any cartoon, anime, game or movie character.`

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 56a 알 아이콘 | `ui/event-egg.webp`, `ui/epic-egg.webp`, `ui/mythic-egg.webp` |
| 56b 칭호 메달 | `titles/words1000.webp`, `titles/gram30.webp`, `titles/preview-25.webp` (영웅 테두리) |

## 자르고 넣기
```
R=docs/asset-requests/runner
node $R/fit-assets.mjs /tmp/art/56a-1.png ui/bug-egg ui/dino-egg - - --fit-each --size 256 --preview /tmp/review/56a-1.png   # 아래 줄(여분)이 더 나으면 그 칸을 ui/bug-egg · ui/dino-egg로
node $R/fit-assets.mjs /tmp/art/56b-1.png titles/bugall titles/dinoall - - --fit-each --small 96 --preview /tmp/review/56b-1.png   # 아래 줄(여분)이 더 나으면 그 칸을 titles/bugall · titles/dinoall로
```

## 점검
```
npm ci
npm run build:assets      # 펫 그림이면 public/modules/pet-art.js가 바뀐다(새 펫 key가 들어가도 core.js에 등록되기 전에는 앱에 나오지 않는다)
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `docs/asset-requests/runner/DONE_56.md`(한국어): 넣은 그림 표, 넣지 못한 그림과 이유, 시트마다 다시 만든 횟수, "눈으로 확인 필요". 마지막에 "새 펫 · 알 · 칭호는 코드 등록(다음 세션) 후에 앱에 나온다"를 적는다.
- PR 제목 `그림 56: 테마 알 아이콘 · 테마 칭호 메달`, 본문 한국어. 미리보기 그림(`/tmp/review/*.png`)을 한 장으로 작게 합쳐 PR 코멘트로 올린다. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.`
