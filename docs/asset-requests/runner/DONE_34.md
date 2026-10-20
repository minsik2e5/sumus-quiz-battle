# 그림 34 완료 기록

Drive 결과 폴더: [SUMUS 펫 사냥 34 (Runner용)](https://drive.google.com/drive/folders/1nHMaM4AGMZxI9MX6k9yupFfIQtTHb0F0)

| 시트 | 앱에 넣은 그림 | 다시 만든 횟수 |
|---|---|---:|
| 34a-1 | bg-forest-day | 0 |
| 34a-2 | bg-forest-night | 0 |
| 34a-3 | bg-field-day | 0 |
| 34a-4 | bg-field-night | 0 |
| 34a-5 | bg-beach-day | 0 |
| 34a-6 | bg-beach-night | 0 |
| 34a-7 | bg-catch | 0 |
| 34a-8 | entry | 1 |
| 34b-1 | ball-basic, ball-good, ball-gold, ball-open | 0 |
| 34b-2 | ball-spin, ball-tilt-l, ball-tilt-r, ball-lock | 1 |
| 34b-3 | fx-sparkle, fx-star, fx-burst, fx-smoke | 0 |
| 34b-4 | ring-green, ring-yellow, ring-red, fx-mystery | 1 |
| 34b-5 | berry-razz, berry-pinap, berry-nanab, bag | 0 |

넣지 못한 그림: 없음. 펫 그림은 새로 그리지 않았다. 입구 그림은 펫을 다시 그리지 않도록 빈 표적 원으로 표현했다.

배경 8개는 720×1080(입구 1280×853) WebP이며 각각 200KB 이하이다. UI 20개는 투명 WebP이다. 원본 PNG 13장은 Drive 폴더에 정확한 이름으로 저장했고 Git에는 넣지 않았다.

검사: `npm ci`, `npm run build:assets`, `npm run check:cloudflare` 통과. `npm run check`는 변경하지 않은 기존 `server/battle-check.mjs`의 `V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent` 검사에서 실패했다.

**눈으로 확인 필요:** 실제 390px 화면에서 펫과 배경의 대비, 잡기 화면의 공·원 크기, 입구 카드의 제목 가독성.
