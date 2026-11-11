# Codex 작업 지시: 그림 70 (펫 아레나 UI 묶음 — 스타일 가이드 · 아이콘 16 · 유리 판 · 버튼 바탕)

## 목표
선생님 말 "지금 버튼이나 디자인이 AI 슬롭이야." → 구성안 `docs/arena-battle-reboot-plan.md`(부록 A, 앞 구성안 `docs/arena-ui-vfx-plan.md` 3-A). 아레나 UI를 **한 재료 언어**(남색 유리 · 금 테 3단계 · 속성 보석)로 맞추고, 이모지 105개를 대신할 아이콘을 **한 시트 · 한 그림체**로 받는다. 67(버튼 9장)은 내지 않고 여기로 합쳤다(버튼마다 같은 광택 대신 크기 · 재료로 위계).

| 시트 | 내용 | 넣는 곳(`public/assets/arena/`) | 자르기 |
|---|---|---|---|
| 70-1 | 스타일 가이드(금 테 3단계 · 유리 판 · 속성 색 8칸 · 아이콘 예시) | **넣지 않음**(참고용) | — |
| 70-2 | UI 아이콘 16개(4×4): 공격 · 필살 · 회피 · 교체 · 연습장 · 꾸미기 · 랭킹 · 입장권 · 코인 · 잠금 · 설명 · 나가기 · 메달 1~3 · 이모트 | `ui2-ico-*` 16장 (128px) | `slice-grid.mjs --grid 4 --size 128` |
| 70-3 | 남색 유리 판 · 금 테두리(9-slice) · 알약 칩 · 위쪽 HUD 띠 | `ui2-panel` · `ui2-frame` · `ui2-chip` · `ui2-hudbar` | `fit-assets.mjs --trim --size 512` |
| 70-4 | 버튼 바탕: 공격(가장 화려) · 필살(게이지 홈) · 스킬 · 회피(은 · 무광) | `ui2-btn-attack` · `ui2-btn-ult` · `ui2-btn-skill` · `ui2-btn-dodge` | `fit-assets.mjs --fit-each --size 256` |
| 70-5 | 교체 버튼 · 조이스틱 바닥 · 손잡이 · 준비됨 빛 고리 | `ui2-btn-swap` · `ui2-joy-base` · `ui2-joy-knob` · `ui2-ready-ring` | `fit-assets.mjs --fit-each --size 256` |

- **70-1을 먼저** 그리고 PR 코멘트로 올려 선생님 확인을 받은 뒤 70-2 ~ 70-5를 돌린다(70-1을 참고 그림으로 함께 붙인다).
- 그림만 넣는다. 앱 화면에 붙이는 일은 구성안 ⑧단계(별도 PR). 70-2 ~ 70-5는 진짜 투명 배경(PNG alpha).
- 입력: `split/70-1 …` ~ `70-5 …`, 묶음 `70-arena-ui-kit.txt`, 자리 `slice-map.csv`. 프롬프트는 `build-70.mjs`가 만든다.

## 꼭 지킬 것
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 그림을 참고 그림으로 붙인다.
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-70-arena-ui-kit`).
- 고치는 파일: 위 표의 그림 28장(70-2 ~ 70-5), `docs/asset-requests/runner/DONE_70.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/arena-art.js`. 그 밖의 앱 코드 · 규칙 · 코인 · 서버 · 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 원본 PNG는 커밋하지 않는다(`/tmp/art/`). 기존 그림을 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.
- 그림에 **글자 · 숫자 · 로고가 없다.** 다른 게임 · 만화 · 영화의 캐릭터 · 아이콘 · 화면 배치를 따라 하지 않는다.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식이다(기존 그림 폴더를 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 펫 아레나 70 (Runner용)"에 정확한 파일 이름 "70-N.png"로 저장). Codex는 보내기 전에:
1. `STYLE REFERENCE`, `WHEN DONE`으로 **시작하는 줄을 지운다**.
2. 아래 참고 그림을 같이 보여 주고, 세 번째 줄에 넣는다: `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges, light from the upper-left and colors exactly. Do NOT copy or resemble any cartoon, anime, game or movie character, logo, icon or screen layout.`
### 참고 그림 (`public/assets/` 아래)
`arena/bg-plaza.webp` · `arena/banner-win.webp` · `arena/ult-icon.webp` · `arena/tier-gold.webp` · `pets/dragon-3.webp` (+ 70-2 ~ 70-5에는 받은 70-1)

## 넣기
```
npm i --no-save sharp
node docs/asset-requests/runner/slice-grid.mjs /tmp/art/70-2.png --grid 4 --size 128
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/70-3.png arena/ui2-panel arena/ui2-frame arena/ui2-chip arena/ui2-hudbar --trim --size 512
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/70-4.png arena/ui2-btn-attack arena/ui2-btn-ult arena/ui2-btn-skill arena/ui2-btn-dodge --fit-each --size 256
node docs/asset-requests/runner/fit-assets.mjs /tmp/art/70-5.png arena/ui2-btn-swap arena/ui2-joy-base arena/ui2-joy-knob arena/ui2-ready-ring --fit-each --size 256
```
아이콘 한 장 8KB 이하, 버튼 · 판 40KB 이하.

## 점검
```
npm ci
npm run build:assets      # ARENA_ART에 새 이름이 적힌다
npm run check
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D` · `M`이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `DONE_70.md`(한국어): 넣은 그림(경로 · 크기 · 용량), 다시 만든 횟수, "눈으로 확인 필요" 항목.
- PR 본문 한국어, 시트 미리보기를 한 장에 모아 작게 PR 코멘트로. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.`
