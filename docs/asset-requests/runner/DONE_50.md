# 그림 50 작업 기록

`sumus-voca-prod-deploy`에서 만든 `codex/art-50`에서 작업했다. Codex 내장 그림 생성 기능으로 50-1 다음 50-2를 한 시트씩 생성했다. Google Drive, API 키, 유료 API, 운영 Supabase는 사용하지 않았다.

## 넣은 메달

파일은 모두 `public/assets/titles/` 아래이며 본그림은 256×256, 작은 그림은 96×96 투명 WebP다.

| 시트 | 칸 | 칭호 | 파일 | 다시 만든 횟수 |
|---|---|---|---|---|
| 50-1 | 왼쪽 위 | 한계 돌파 | level65.webp · level65-s.webp | 0 |
| 50-1 | 오른쪽 위 | 일흔 계단 | level70.webp · level70-s.webp | 0 |
| 50-1 | 왼쪽 아래 | 단어 곳간지기 | level75.webp · level75-s.webp | 0 |
| 50-1 | 오른쪽 아래 | 불꽃 학습자 | level80.webp · level80-s.webp | 0 |
| 50-2 | 왼쪽 위 | 별빛 여행자 | level85.webp · level85-s.webp | 0 |
| 50-2 | 오른쪽 위 | 지식의 탑 | level90.webp · level90-s.webp | 0 |
| 50-2 | 왼쪽 아래 | 전설 직전 | level95.webp · level95-s.webp | 0 |
| 50-2 | 오른쪽 아래 | 백 레벨의 전설 | level100.webp · level100-s.webp | 0 |

## 생성 프롬프트와 참고 그림

`split/50-1 레벨 칭호 1 영웅 전설.txt`, `split/50-2 레벨 칭호 2 전설 한정.txt`를 사용했다. 원본 주문서는 수정하지 않았다. 전송할 때 `STYLE REFERENCE`, `Also open`, `WHEN DONE`으로 시작하는 줄을 제거하고 세 번째 줄에 다음 문장을 넣었다.

> REFERENCE IMAGES ARE ATTACHED: they are title medals already in this game. Match their art style, glossy metal and enamel, medal size in the cell, crisp clean edges and colors exactly. A medal of the same tier must have exactly the same frame as the reference of that tier. Do NOT copy the center pictures of the references.

50-1에는 words1000, unit3, words3000, level60, preview-25를 첨부했다. 50-2에는 words3000, level60, mythic1, weekly1을 한 참고용 모음으로 묶고 preview-25와 완성한 50-1도 첨부했다. 기존 그림은 참고용이며 가운데 그림은 새로 생성했다. 50-2에는 첫 시트의 마감과 칸 안 크기를 맞추고 가운데 그림은 복사하지 말라는 문장도 덧붙였다.

생성된 1254×1254 PNG를 투명도를 유지하며 1024×1024로 축소한 뒤 주문서의 `fit-assets.mjs --fit-each --small 96`으로 잘랐다. 원본 시트와 확인용 PNG는 저장소 밖 작업 폴더에만 두고 커밋하지 않았다.

## 후보 점검

- 시트와 최종 16파일의 진짜 알파 채널 및 모서리 alpha 0 확인.
- 칸별 독립 배치, 잘림·겹침·글자·숫자·로고·바닥 그림자 없음 확인.
- 기존 메달과 보라 방패·금빛 햇살·무지개 테두리 및 광택을 눈으로 비교.
- 최종 미리보기와 48px 축소본을 눈으로 확인.
- 기존 그림 파일 삭제·수정 없음. 앱 코드와 버전 변경 없음. 빌드가 생성한 `public/sw.js` 해시만 갱신.

## 넣지 못한 그림

없음. 8개 메달, 16개 파일을 모두 추가했다.

## 눈으로 확인 필요

Codex의 시각 점검은 완료했다. 최종 승인 전 선생님이 PR 미리보기에서 기존 메달과의 통일감과 작은 화면 가독성을 확인하면 된다.

## 검증

- `npm ci`: 통과. 기존 의존성 감사 경고 3건(보통 2, 높음 1)은 의존성 변경 없이 기록만 남겼다.
- `npm run build:assets`: 통과.
- `npm run check`: 통과, `[release-check] PASS 3010/3010`.
- `npm run check:cloudflare`: 통과. 가짜 저장소를 사용하는 로컬 검사이며 운영 Supabase에는 연결하지 않았다.
- Windows CRLF 체크아웃에서는 개행에 민감한 battle.js 소스 검사에 실패했다. 저장소 원문의 LF로 복원해 다시 검사했으며 앱·점검 코드의 내용은 수정하지 않았다.

새 칭호는 코드 등록(TITLES · TITLE_ART, 다음 세션) 후에 앱에 나온다
