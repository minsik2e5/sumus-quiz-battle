# 그림 30 작업 완료

- 기준 브랜치: `claude/treasure-v2` (`7f5d001b31c6c79a2e9c708cf645253ab5412b2e`)
- 작업 브랜치: `codex/art-29-30`
- 제작: Codex 내장 그림 생성. 유료 API 사용 없음. 운영 Supabase 연결 없음.
- 그림체: 진한 갈색 잉크 외곽선, 평면 색과 단단한 그림자, 제한된 색과 종이 질감. 글자·숫자 없음.

| 그림 | 넣은 파일 | 크기 | 용량 |
|---|---|---|---|
| 보물 사냥 폰 배경(세로) | `public/assets/treasure/bg-phone.webp` | 720×1080 | 54,912 B |
| 보물 사냥 TV 배경(가로) | `public/assets/treasure/bg-tv.webp` | 1280×853 | 95,876 B |
| 상자 주황 | `public/assets/treasure/chest-gold.webp` | 256×256 | 9,150 B |
| 상자 보라 | `public/assets/treasure/chest-violet.webp` | 256×256 | 8,906 B |
| 상자 초록 | `public/assets/treasure/chest-green.webp` | 256×256 | 8,884 B |
| 열린 상자 | `public/assets/treasure/chest-open.webp` | 256×256 | 14,018 B |
| 50:50 | `public/assets/treasure/item-fifty.webp` | 256×256 | 10,870 B |
| 시간 정지 | `public/assets/treasure/item-freeze.webp` | 256×256 | 14,610 B |
| 콤보 보호 | `public/assets/treasure/item-saver.webp` | 256×256 | 13,346 B |
| 엿보기 | `public/assets/treasure/item-peek.webp` | 256×256 | 13,362 B |
| 금고 | `public/assets/treasure/vault.webp` | 256×256 | 13,700 B |
| 도난 경보 사이렌 | `public/assets/treasure/siren.webp` | 256×256 | 9,220 B |
| 현상금 포스터 | `public/assets/treasure/bounty.webp` | 256×256 | 12,146 B |
| 해적선 | `public/assets/treasure/ship.webp` | 256×256 | 14,840 B |
| 황금 시간 | `public/assets/treasure/ev-golden.webp` | 256×256 | 11,438 B |
| 해적선 습격 | `public/assets/treasure/ev-raid.webp` | 256×256 | 12,772 B |
| 보물 폭풍 | `public/assets/treasure/ev-storm.webp` | 256×256 | 19,334 B |
| 팀 깃발 | `public/assets/treasure/flags.webp` | 256×256 | 9,322 B |

## 넣지 못한 것과 이유

- 앱 그림 파일 누락 없음.
- 참고 자료 `15-1.png`와 해당 전투 배경 15 폴더는 Drive 검색에서 발견되지 않아 열지 못함. 대신 지정된 펫 4종의 `03_final.png`, `06-3.png`, `06-4.png`, `27c-1.png` 원본을 열어 색·비율·디테일을 확인함.
- `30b-1`은 완성한 `29b-1`을 열어 참고했고, `30b-2`~`30b-4`는 `30b-1`, `30a-2`는 `30a-1`을 열어 색과 외곽선을 맞춤.

## 다시 만든 횟수

| 시트 | 최초 생성 후 재제작 | 이유 |
|---|---:|---|
| 30a-1 | 0 | 첫 결과 채택 |
| 30a-2 | 0 | 첫 결과 채택 |
| 30b-1 | 0 | 첫 결과 채택 |
| 30b-2 | 1 (총 2회 생성) | 50:50 아이콘의 사람 실루엣을 빈 답안 말풍선으로 수정 |
| 30b-3 | 0 | 첫 결과 채택 |
| 30b-4 | 0 | 첫 결과 채택 |

- 원본 PNG: [SUMUS 보물 사냥 30 (Runner용)](https://drive.google.com/drive/folders/1OCJtVrlpQgY8lyaGcO2GH_FiVvHEDmD6), 지정 이름 6개 업로드.
- UI 256px, `fit-assets.mjs --fit-each` 사용. 폰 배경 720×1080, TV 배경 가로 1280px, 모두 200KB 이하. 앱 연결 코드는 수정하지 않음.

## 눈으로 확인 필요

- 생성 원본과 잘라낸 그림의 글자·숫자 부재, 투명 여백, 손그림 마감을 확인함.
- 실제 폰·교실 TV에서 배경 위 글자 가독성, 카드 여백, 아이콘의 96px 식별성을 눈으로 확인 필요.

## 검사

- 최종 `npm ci && npm run build:assets && npm run check && npm run check:cloudflare`: 모두 PASS (종료 코드 0).
- `check`: 1,937/1,937 PASS. `check:cloudflare`: 저장·쓰기 예산·전투·던전·파티·테스트 앱 검사 PASS.
- 파일 27개의 app_file 경로, 규격, 투명 알파, 배경 200KB 이하 확인 PASS.
- 검사 로그의 503·디스크 실패·Supabase 커밋은 테스트 모의 상황이며 운영 연결을 사용하지 않음.
- 원본 시트 PNG는 `/tmp/art/`에만 두고 커밋하지 않음.
