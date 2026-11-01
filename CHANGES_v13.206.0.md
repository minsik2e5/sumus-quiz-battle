# v13.206.0 놀이터 메뉴 정리 (테스트 앱만)

놀이터에 게임이 너무 많아져서 **학습 탭과 같은 구조**로 묶는다. **테스트 앱(sumus-voca-test)과 로컬에서만 바뀌고, 운영 놀이터는 지금 그대로다.**

```
[ 게임 | 상점 | 기록 ]        ← 학습 탭과 같은 위쪽 탭
PLAYGROUND / 놀이터
코인 지갑
[오늘의 놀이터: 오늘 남은 판]  ← 학습의 '오늘의 추천 학습' 자리(누르면 미니게임)
[ ARCADE  미니게임  → ]  낚시 · 짝 맞추기 · 몬스터 사냥 · 인형뽑기 · 10초 맞추기
[ TAJJA   코인 승부 → ]  가위바위보 · 야바위(yabawiOn()일 때만)
[ MARKET  증권거래소 → ]  열릴 때만
교실 게임 참가
```

- **게임 탭**: 큰 카드를 누르면 지금 쓰는 게임 카드가 그대로 나오고, 위에 '← 놀이터' 버튼(학습의 '← 학습'과 같은 모양)이 있다. 게임 카드 · 로직은 바꾸지 않았다.
- **상점 탭**: 코인 뽑기 · 알 상점.
- **기록 탭**: 게임별 최고 기록(짝 맞추기 · 10초 맞추기 · 연속 완벽 · 몬스터 도감 · 인형 도감 · 낚싯대 · 가위바위보 · 야바위 연승) + 도감(모은 꾸미기).
- 마지막 탭 · 하위 화면은 `localStorage`(`sumus-pg-menu`, try/catch)에 기억한다. 저장이 막혀 있으면 게임 탭 첫 화면.
- 메뉴 아이콘: `public/assets/yabawi/menu-arcade.webp` · `menu-tajja.webp` · `menu-shop.webp`가 생기면 그림(야바위 그림 게이트 `YABAWI_ART`), 없으면 이모지.

## 어떻게
- `public/modules/playground-menu.js`(새 파일): 켜는 곳(`pgMenuOn`, `TEST_HOST` · 로컬), 기억(`pgRead` · `pgWrite`), 화면(`playgroundHtml`). 학습 탭 클래스(`study-tabs-v1368` · `study-hub-card` · `study-daily-v1371` · `study-back`)를 그대로 쓴다.
- `public/modules/arcade.js`: 테스트 호스트면 `arcadePage`가 빈 칸(`data-arcade-view="menu"` · `data-arcade-menu`, 데스크톱 2열 격자 규칙이 안 걸리게)만 내고 `draw()`가 메뉴 전체를 그린다. 게임 카드는 `arcade-games.js`의 카드 함수, 가위바위보 · 야바위 · 증권거래소 · 상점은 지금 함수 그대로 넘긴다. 운영 화면 줄은 손대지 않았다.
- `public/v13206.css`(새 파일): 카드 색(미니게임 초록 · 코인 승부 빨강 · 증권거래소 파랑), 아이콘 자리, 기록 목록, 폰 폭 줄이기.

## 검사
- `server/playground-menu-check.mjs`: 켜는 곳(테스트 · 로컬만) / 기억(저장 · 이상한 값 · 막힌 저장소) / 게임 탭 첫 화면 · 큰 카드 안 · 뒤로 가기 / 증권거래소는 열릴 때만 · 야바위는 켜졌을 때만 / 상점 · 기록 탭 / 그림 있을 때만 아이콘 / 운영 줄 그대로 · CSS 묶음 · 버전.
