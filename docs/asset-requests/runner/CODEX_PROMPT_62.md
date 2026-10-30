# Codex 작업 지시: 그림 62 (곤충 · 공룡 시리즈 알 상점 아이콘 · 1시트)

## 목표
곤충 · 공룡 시리즈 알(`docs/bug-dino-pets-design.md`, 알 상점 1,000코인)의 **전용 알 그림** 하나(`ui/series-egg`, 256px)를 만들어 `public/assets/ui/`에 넣고 PR을 만든다.
지금은 그림 56의 곤충 알 · 공룡 알 두 그림을 겹쳐 합친 `ui/bugdino-egg.webp`를 쓴다. **`ui/series-egg.webp`가 들어오면 `npm run build:assets`가 알아서 그 그림으로 바꾼다**(`public/modules/pet-art.js`의 `SERIES_EGG_ART`). 앱 코드는 고치지 않는다.

| 시트 | 칸 | 파일 | 내용 |
|---|---|---|---|
| `62-1` | 왼쪽 위 | `public/assets/ui/series-egg.webp` | 곤충 · 공룡 알 (알 상점 · 도감) |
| `62-1` | 오른쪽 위 | (여분 1: 왼쪽 위보다 나으면 이 칸을 ui/series-egg로 넣는다) | 여분 시안 |
| `62-1` | 왼쪽 아래 | (여분 2: 같은 방식) | 여분 시안 |
| `62-1` | 오른쪽 아래 | (여분 3: 같은 방식) | 여분 시안 |

- 네 칸 모두 **같은 알의 다른 시안**이다. 가장 좋은 한 칸만 `ui/series-egg`로 넣는다. 여분은 따로 넣지 않는다.
- 알 하나에 **곤충과 공룡이 함께** 보여야 한다(반은 곤충, 반은 공룡). 얼굴 · 생물 · 글자 없음.

## 꼭 지킬 것
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 기존 그림을 참고 그림으로 붙인다.
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-62`).
- `public/assets/ui/series-egg.webp`, `docs/asset-requests/runner/DONE_62.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/pet-art.js` 말고는 고치지 않는다. 앱 코드, 게임 규칙, 코인, 확률, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 원본 시트 PNG는 커밋하지 않는다(`/tmp/art/`). 기존 그림 파일(`ui/bugdino-egg.webp` 포함)은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/62-1 곤충 공룡 시리즈 알 상점 아이콘.txt`, 묶음 전체는 `62-series-egg.txt`, 칸과 파일은 `slice-map.csv`(`list` 열이 `62-series-egg.txt`).
- 자르기 도구: `fit-assets.mjs`(사용법은 파일 맨 위 주석). `sharp`가 없으면 `npm i --no-save sharp`.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 그림 "56a-1.png" · "21b-8.png"을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 곤충 · 공룡 알 62 (Runner용)"에 정확한 파일 이름 "62-1.png"로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `WHEN DONE`
2. 아래 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges and colors exactly. Do NOT copy their patterns one to one, and do NOT copy or resemble any cartoon, anime, game or movie character.`

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 62 알 아이콘 | `ui/bug-egg.webp`, `ui/dino-egg.webp`, `ui/event-egg.webp`, `ui/epic-egg.webp` |

## 자르고 넣기
```
R=docs/asset-requests/runner
node $R/fit-assets.mjs /tmp/art/62-1.png ui/series-egg - - - --fit-each --size 256 --preview /tmp/review/62-1.png   # 다른 칸이 더 나으면 그 칸 자리에 ui/series-egg를 쓴다
```

## 점검
```
npm ci
npm run build:assets      # public/modules/pet-art.js의 SERIES_EGG_ART가 "series-egg"로 바뀐다
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `docs/asset-requests/runner/DONE_62.md`(한국어): 넣은 그림, 어느 칸을 골랐는지와 이유, 다시 만든 횟수, "눈으로 확인 필요"(48px에서도 곤충 · 공룡이 둘 다 보이는지).
- PR 제목 `그림 62: 곤충 · 공룡 시리즈 알`, 본문 한국어. 미리보기 그림(`/tmp/review/62-1.png`)을 작게 PR 코멘트로 올린다. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.`
