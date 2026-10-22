# SUMUS ISLAND — 작업 안내 (Claude용)

영어 학원 교실에서 쓰는 실시간 게임 사이트. 선생님 PC(빔프로젝터) + 학생 휴대폰. 사용자와는 한국어로 소통하고, 결과는 짧게 + "확인한 것 / 못 한 것"을 나눠서 보고한다.

## 저장소·배포
- GitHub: `minsik2e5/sumus-quiz-battle` 의 **`sumus-island` 브랜치** (main 아님. 같은 저장소의 다른 브랜치는 다른 프로젝트)
  - 받기: `git clone -b sumus-island https://github.com/minsik2e5/sumus-quiz-battle.git sumus-island`
- 실행: `npm install` → `node server.js` (또는 `실행하기.bat`) → http://localhost:3000
- 배포: Render 무료 플랜, https://sumus-island.onrender.com (서비스 `sumus-island`, id `srv-db29ak3tqb8s73cio490`, 빌드 `npm install --omit=dev`, 시작 `npm start`)
  - **push 해도 자동 배포가 안 됨** → Render 연결 도구 `trigger_deploy` 로 직접 배포하거나 대시보드에서 Manual Deploy
  - 무료 플랜은 15분 미사용 시 잠들고, 다시 켜지면 서버 메모리(방·리그)가 비워짐

## 구조
- 한 "수업 방"(세션) = 방 번호 하나에 4게임 방이 묶임. 선생님 화면 오른쪽 위 ①②③④ 버튼으로 전환, 학생은 `goto` 로 자동 이동(이름·색 유지). `server.js` 의 `KINDS`·`sessions` 참고
- PART 1 퀴즈쇼 `/host` · `/play` (server.js 안)
- PART 2 무궁화 `/mg` · `/m` (server.js 안, 거리 설정 dist 1/1.5/2)
- PART 3 단체 줄넘기 `/jr` · `/j` — 서버 `jr.js`, 공용 계산 `public/jr-common.js`, 규약 `docs/jr-protocol.md`
- PART 4 바나나킥 `/bk` · `/b` — 서버 `bk.js`, 공용 계산 `public/bk-common.js`(서버·폰이 같은 골키퍼 계산), 규약 `docs/bk-protocol.md`
- 공용: `public/common.js`(IQ.makeClock 서버 시계, 스냅샷 보간, drawChar), `public/session-bar.js`(게임 전환 막대), `public/ceremony.js`(공용 시상식 CEREMONY.show)
- 오늘의 리그: server.js `setupLeague` + `public/league.js`(선생님) + `public/league-phone.js`(학생). 순위 점수 10/8/6/상위30% 4/참가 2, 중간에 멈춘 판은 기본 미반영
- SUMUS RECORD: 게임별 역대 최고 기록, **선생님 PC 브라우저 localStorage `sumus-records`** 에 저장(학원 전체 하나). 다른 PC/브라우저로 옮기면 기록은 이어지지 않음
- 이동 방식: 내 캐릭터는 폰에서 직접 움직이고 위치만 보고(서버는 속도 제한), 서버 40Hz 계산·20Hz 전송, 화면은 서버 시각 기준 보간

## 새 게임/큰 화면 작업 방식
서버 모듈(`jr.js`·`bk.js` 패턴) + `docs/*-protocol.md` 작성 → 선생님 화면/폰 화면을 서브에이전트 2개로 병렬 제작 → 통합·테스트. 테스트는 socket.io-client 스크립트로 서버 흐름 확인 + 브라우저 확인.

## 남은 계획 (2026-10 기준)
- 공통 캐릭터 통합(게임마다 따로 그리는 캐릭터를 하나로), 게임 전환 타이틀 카드 연출, 게임별 배경음악(기본 작게, 끄기 가능), 퀴즈쇼·무궁화 연출 강화
- 사용자가 실제 수업에서 써 보고 줄 피드백 반영
