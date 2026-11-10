# Codex 작업 지시: 그림 73 (펫 아레나 스킬트리 화면)

## 목표
선생님 말 "스킬(트리)이 그렇게 화려했으면 해." → 구성안 `docs/arena-battle-reboot-plan.md` 6-4. 스킬트리 판을 같은 연출 언어로: 열릴 때 빛이 줄기를 따라 흐르고, 고른 노드가 타오른다(이 움직임은 코드). 그림은 바탕 1장 + 조각 4개.

| 시트 | 내용 | 넣는 곳(`public/assets/arena/`) | 자르기 |
|---|---|---|---|
| 73-1 | 스킬트리 판 바탕(세로 한 장): 아래에서 위로 3층 × 2갈래 나무, 빈 소켓 6 + 꼭대기 · 뿌리 | `tree-bg` (720×1080) | `resize(720,1080,{fit:'cover'})` |
| 73-2 | 노드 바탕 · 고른 노드 빛 · 잠긴 노드(사슬) · 빛 줄기 조각 | `tree-node` · `tree-node-on` · `tree-lock` · `tree-flow` | `fit-assets.mjs --fit-each --size 256` |

- 70-1 스타일 가이드 · 70-3 유리 판(받아 둔 것)과 71-1 빛 재료를 참고 그림으로 붙인다. 아직 없으면 65번 아레나 그림만.
- 그림만 넣는다. 앱에 붙이는 일은 구성안 ⑦단계. 입력: `split/73-1 …` · `73-2 …`, 묶음 `73-arena-skill-tree.txt`, 프롬프트는 `build-73.mjs`.

## 꼭 지킬 것
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 그림을 참고 그림으로 붙인다.
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-73-arena-skill-tree`).
- 고치는 파일: 위 표의 그림 5장, `docs/asset-requests/runner/DONE_73.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/arena-art.js`. 그 밖의 앱 코드 · 규칙 · 코인 · 서버 · 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 원본 PNG는 커밋하지 않는다(`/tmp/art/`). 기존 그림을 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.
- 그림에 **글자 · 숫자 · 로고가 없다.** 다른 게임 · 만화 · 영화의 캐릭터 · 아이콘 · 화면 배치를 따라 하지 않는다.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식이다(기존 그림 폴더를 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 펫 아레나 73 (Runner용)"에 정확한 파일 이름 "73-N.png"로 저장). Codex는 보내기 전에:
1. `STYLE REFERENCE`, `WHEN DONE`으로 **시작하는 줄을 지운다**.
2. 아래 참고 그림을 같이 보여 주고, 세 번째 줄에 넣는다: `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges, light from the upper-left and colors exactly. Do NOT copy or resemble any cartoon, anime, game or movie character, logo, icon or screen layout.`
### 참고 그림 (`public/assets/` 아래)
`arena/ult-icon.webp` · `arena/banner-win.webp` · `arena/tier-gold.webp` (+ 들어와 있으면 `arena/ui2-panel.webp` · `arena/mat-glow.webp`)

## 넣기
```
npm i --no-save sharp
node -e "require('sharp')('/tmp/art/73-1.png').resize(720,1080,{fit:'cover'}).webp({quality:80}).toFile('public/assets/arena/tree-bg.webp')"
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/73-2.png arena/tree-node arena/tree-node-on arena/tree-lock arena/tree-flow --fit-each --size 256
```
바탕 160KB 이하, 조각 40KB 이하.

## 점검
```
npm ci
npm run build:assets      # ARENA_ART에 새 이름이 적힌다
npm run check
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D` · `M`이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `DONE_73.md`(한국어): 넣은 그림(경로 · 크기 · 용량), 다시 만든 횟수, "눈으로 확인 필요" 항목.
- PR 본문 한국어, 시트 미리보기를 한 장에 모아 작게 PR 코멘트로. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.`
