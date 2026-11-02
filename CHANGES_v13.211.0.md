# v13.211.0 문법 증권거래소: 테스트 앱에서만 켜기

쌤 요청("테스트앱에서 일단 켜줘")대로 **테스트 앱(sumus-voca-test)에서만** 문법 증권거래소를 켠다. **운영은 지금처럼 꺼진 그대로다**(`MARKET_OPEN = false`).

- 테스트 앱이 켜질 때 저장 상태에 `market.open = true`를 넣는다(`server/test-seed.mjs`의 `openTestMarket`).
  - 판 번호(`SEED`)와 따로라 이미 돌고 있는 테스트 앱에도 한 번 들어간다. 학생 데이터(미끼 · 공 · 집게권)는 다시 채우지 않는다.
  - 시세가 없으면 이틀치 기록과 함께 새로 연다. 이미 있으면 시세는 그대로 두고 켜기만 한다.
- 놀이터 → 코인 승부에 증권거래소 카드가 나오고(`market_open`), `/api/market` · `/api/market/trade`가 열린다.
- 운영 Worker는 `applyTestSeed`를 부르지 않으므로(VOCA_STANDALONE일 때만) 영향이 없다.

## 검사
- `server/test-app-check.mjs`: 테스트 앱은 `market_open`이 true, 운영 스위치는 false. 꺼진 테스트 앱에 켜기 덧붙이기 · 있던 시세 유지 · 두 번 하지 않기.
