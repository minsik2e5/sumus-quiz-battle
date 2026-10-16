# v13.158.0 — 놀이터 게임 카드 정리

## 바뀐 것
- 놀이터 순서: **코인 지갑 → 게임(낚시터 · 짝 맞추기 타임어택) → 상점 · 뽑기(코인 뽑기 · 알 상점 · 가위바위보, 그대로) → 교실 게임 참가(맨 아래)**.
- 낚시터 카드: 바다 · 부두 · 낚시 가게 그림(`fishing/bg-entry.webp`)을 크게 깔고, 미끼 수 · 낚싯대 단계 아이콘(`icon-rod-1~5`) · 진주를 작게 보여 준 뒤 '들어가기'.
- 짝 맞추기 카드: 낚시터와 같은 크기의 그림 카드. 그림이 오기 전에는 밤 무대 위 brave · 용감한 단어 카드를 크게 보여 주고,
  `public/assets/match/entry.webp`가 들어와 `MATCH_ART`에 `entry`가 적히면 자동으로 그림을 쓴다. 내 최고 기록 · 오늘 코인 판 · 게임 단어(바꾸기) · 시작은 그대로.
- 교실 게임 참가: 맨 아래 작은 한 줄 카드(번호 4자리 + 들어가기).
- 그림 주문서 32(놀이터 짝 맞추기 입구 그림): `docs/asset-requests/runner/32-match-entry.txt`, `split/32-1 …`, `CODEX_PROMPT_32.md`.
  Drive의 기존 그림(펫 · 낚시터 입구 27a-3 · 짝 맞추기 30)을 열어 그림체를 맞추고, Drive 폴더 "SUMUS 짝 맞추기 32 (Runner용)"에 `32-1.png`로 저장.

## 코드
- `public/modules/arcade-games.js`: `reelCard` · `matchCard` · `partyRow` 새로, `gamesSection(A, art)`는 그림 목록을 받는다.
- `public/modules/arcade.js`: 옛 낚시터 입구(`reelEntry`)를 빼고 새 순서로.
- `reel.js` · `match-game.js`: 불러올 때 `matchMedia`를 바로 부르지 않게(놀이터와 서버 검사가 그림 목록을 부른다).
- `public/v13158.css`: 그림 카드 · 교실 게임 한 줄.

## 검사
- `server/menu-check.mjs`: 새 순서, 낚시터 카드 내용(배경 · 미끼 · 낚싯대 단계 · 진주), 짝 맞추기 그림 있음/없음, 교실 게임 한 줄, 주문서 32 규칙.
- `games-check` · `rewards-check` · `dungeon-lobby-check` · `yacha-tab-check`: CSS 묶음 끝에 `v13158.css`.
