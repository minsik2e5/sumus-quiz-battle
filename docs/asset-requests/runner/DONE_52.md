# 그림 52 완료 기록

Codex 내장 그림 생성 기능으로 52-1 → 52-2 순서로 한 시트씩 생성했다. API 키·Google Drive·운영 Supabase를 사용하지 않았다. 기준/PR 대상은 `sumus-voca-prod-deploy`, 작업 브랜치는 `codex/art-52`다.

## 넣은 메달

파일은 모두 `public/assets/titles/` 아래에 있다. 각 행은 256px 본그림과 96px 작은 그림이다. 다시 만든 횟수는 최초 생성 이후의 재생성 횟수다.

| 시트 | 칸 | 칭호 | 파일 | 다시 만든 횟수 |
|---|---|---|---|---|
| 52-1 | 왼쪽 위 | 한 번에 딱! | blankperfect.webp · blankperfect-s.webp | 0 |
| 52-1 | 오른쪽 위 | 영작 폭주족 | blanks5.webp · blanks5-s.webp | 0 |
| 52-1 | 왼쪽 아래 | 오답 실종 사건 | gramclean.webp · gramclean-s.webp | 0 |
| 52-1 | 오른쪽 아래 | 문법 명탐정 | gram30.webp · gram30-s.webp | 0 |
| 52-2 | 왼쪽 위 | 보스 단톡방 방장 | mlv70.webp · mlv70-s.webp | 0 |
| 52-2 | 오른쪽 위 | 빈칸 없는 세상 | blankall.webp · blankall-s.webp | 0 |
| 52-2 | 왼쪽 아래 | 전설의 주인 | legend-owner.webp · legend-owner-s.webp | 0 |
| 52-2 | 오른쪽 아래 | 도감 마스터 | epic-dex.webp · epic-dex-s.webp | 0 |

PR 댓글에서 보여 줄 두 시트 합본 미리보기 `public/assets/titles/preview-52.webp`(640×320)를 함께 추가했다. 원본 시트 PNG는 커밋하지 않았다. Windows 환경에서는 `/tmp/art`, `/tmp/review` 대신 저장소 밖 작업 폴더 `../art`, `../review`를 사용했다. 생성 결과는 1024×1024로 리사이즈한 뒤 주문서의 `fit-assets.mjs --fit-each --small 96`으로 분할했다.

## 최종 프롬프트와 참고 그림

`split/52-1 칭호 3탄 ② 1 영웅.txt`, `split/52-2 칭호 3탄 ② 2 전설.txt`를 그대로 바탕으로 다음 변환을 적용했다. 파일 자체는 수정하지 않았다.

- `STYLE REFERENCE`, `Also open`, `WHEN DONE`으로 시작하는 줄을 삭제했다.
- 세 번째 줄에 다음 문장을 삽입했다.

> REFERENCE IMAGES ARE ATTACHED: they are title medals already in this game. Match their art style, glossy metal and enamel, medal size in the cell, crisp clean edges and colors exactly. A medal of the same tier must have exactly the same frame as the reference of that tier. Do NOT copy the center pictures of the references.

- 52-1: `words1000.webp`, `unit3.webp`, `preview-25.webp`를 참고 그림으로 첨부했다.
- 52-2: `words3000.webp`, `level60.webp`, `preview-25.webp`, 완성한 `../art/52-1.png`를 첨부했다. 다음 설명을 추가했다: `Input image 4 is the completed first sheet 52-1: match finish and scale in each cell, but do not copy its center pictures or purple tier frames.`
- 모든 참고 메달 경로는 `public/assets/titles/` 아래다. 내장 도구에 투명 배경을 지정했다.

## 후보 점검 / 눈으로 확인 필요

- 두 시트와 최종 16장 모두 투명 배경이며 네 모서리 alpha 0을 확인했다.
- 256×256 / 96×96 규격과 slice-map.csv의 파일 키를 확인했다.
- 직접 눈으로 확인: 칸마다 하나, 겹침·잘림·문자·숫자·로고·바닥 그림자 없음. 보라 방패와 금빛 햇살 테두리, 기존 메달과의 그림체, 48px 축소본을 확인했다.
- 눈으로 확인 필요: 자동 검사로 미술적 일치를 보증할 수 없으므로 최종 취향 판단은 PR 합본 미리보기로 확인할 수 있다. 작업 중 육안 검수는 완료했다.

## 넣지 못한 그림

없음. 8개 메달, 본그림/작은 그림 총 16장을 추가했다. 기존 그림은 삭제하거나 덮어쓰지 않았다. 앱 코드와 버전을 변경하지 않았다.

## 검증

- `npm ci`: 성공. 기존 의존성 audit 경고 3개(중간 2, 높음 1). 의존성/잠금 파일 변경 없음.
- `npm run build:assets`: 성공, content-validation / browser-syntax PASS.
- `npm run check`: 실패. 원문: `Error: [release-check] FAIL · V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent`
- 실패 위치: `server/battle-check.mjs:325`. LF 줄바꿈을 포함한 문자열 비교와 Windows CRLF 체크아웃의 차이. 관련 앱/검사 파일은 기준 브랜치와 동일하며 수정하지 않았다.
- `npm run check:cloudflare`: 성공(exit 0). 네트워크 fetch mock을 사용하는 검사이며 운영 Supabase에 연결하지 않았다.
- 빌드의 내용 변경은 허용된 `public/sw.js`만 포함한다. 내용 차이가 없는 생성 모듈의 줄바꿈 변경은 되돌렸다.

새 칭호는 코드 등록(TITLES · TITLE_ART, 다음 세션) 후에 앱에 나온다
