# 그림 29 작업 완료

- 기준 브랜치: `claude/treasure-v2` (`7f5d001b31c6c79a2e9c708cf645253ab5412b2e`)
- 작업 브랜치: `codex/art-29-30`
- 제작: Codex 내장 그림 생성. 유료 API 사용 없음. 운영 Supabase 연결 없음.
- 그림체: 진한 갈색 잉크 외곽선, 평면 색과 단단한 그림자, 제한된 색과 종이 질감. 글자·숫자 없음.

| 그림 | 넣은 파일 | 크기 | 용량 |
|---|---|---|---|
| 짝 맞추기 배경(세로) | `public/assets/match/bg.webp` | 720×1080 | 39,534 B |
| 영어 카드 앞면 | `public/assets/match/card-en.webp` | 256×256 | 5,406 B |
| 뜻 카드 앞면 | `public/assets/match/card-ko.webp` | 256×256 | 5,688 B |
| 카드 뒷면 | `public/assets/match/card-back.webp` | 256×256 | 6,710 B |
| 결과 별 | `public/assets/match/star.webp` | 256×256 | 8,164 B |
| 결과 리본 | `public/assets/match/ribbon.webp` | 512×512 | 11,594 B |
| 신기록 도장 | `public/assets/match/stamp.webp` | 256×256 | 10,842 B |
| 시상대 | `public/assets/match/podium.webp` | 512×512 | 7,816 B |
| 피버 불꽃 배지 | `public/assets/match/fever.webp` | 256×256 | 9,536 B |

## 넣지 못한 것과 이유

- 앱 그림 파일 누락 없음.
- 참고 자료 `15-1.png`와 해당 전투 배경 15 폴더는 Drive 검색에서 발견되지 않아 열지 못함. 대신 지정된 펫 4종의 `03_final.png`, `06-3.png`, `06-4.png`, `27c-1.png` 원본을 열어 색·비율·디테일을 확인함.
- `29b-2`는 먼저 완성한 `29b-1`을 열어 마감을 맞춤.

## 다시 만든 횟수

| 시트 | 최초 생성 후 재제작 | 이유 |
|---|---:|---|
| 29a-1 | 0 | 첫 결과 채택 |
| 29b-1 | 0 | 첫 결과 채택 |
| 29b-2 | 3 (총 4회 생성) | 리본의 칸 경계 초과를 수정하고 투명 여백 확보 |

- 원본 PNG: [SUMUS 짝 맞추기 29 (Runner용)](https://drive.google.com/drive/folders/1ANCGz3E5Ul2nHgggtL_dYi3OczPK2wUd), 지정 이름 3개 업로드.
- 카드·별·도장·피버 256px, 리본·시상대 512px. `fit-assets.mjs --fit-each` 사용. 배경 720×1080, 200KB 이하.
- `MATCH_ART` 한 줄에 실제 넣은 9개 이름 등록.

## 눈으로 확인 필요

- 생성 원본과 잘라낸 그림의 글자·숫자 부재, 투명 여백, 손그림 마감을 확인함.
- 실제 폰·교실 TV에서 배경 위 글자 가독성, 카드 여백, 아이콘의 96px 식별성을 눈으로 확인 필요.
- 시상대의 세 칸 폭은 손그림 오차가 있어 완전히 같지는 않음. 정확히 같은 폭이 필수라면 눈으로 확인 후 교체 필요.

## 검사

- 최종 `npm ci && npm run build:assets && npm run check && npm run check:cloudflare`: 모두 PASS (종료 코드 0).
- `check`: 1,937/1,937 PASS. `check:cloudflare`: 저장·쓰기 예산·전투·던전·파티·테스트 앱 검사 PASS.
- 파일 27개의 app_file 경로, 규격, 투명 알파, 배경 200KB 이하 확인 PASS.
- 검사 로그의 503·디스크 실패·Supabase 커밋은 테스트 모의 상황이며 운영 연결을 사용하지 않음.
- 원본 시트 PNG는 `/tmp/art/`에만 두고 커밋하지 않음.
