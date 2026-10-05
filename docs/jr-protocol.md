# PART 3 · 단체 줄넘기 — 프로토콜과 규칙

서버는 `jr.js`(완성, 수정 금지 — 필요하면 보고), 공용 계산은 `public/jr-common.js`(`window.JR`), 시계 동기화는 `public/common.js`의 `IQ.makeClock(socket)`.
화면은 두 개: **선생님(프로젝터) 화면 `public/jr-host.html` (주소 `/jr`)**, **학생 폰 화면 `public/jr-play.html` (주소 `/j?pin=1234`)**.

## 게임 규칙
- 큰 두 술래(양쪽 끝)가 긴 줄을 돌리고, 학생 전원이 줄 아래 갑판에 서서 **동시에** 뛰어넘는다. 줄이 **땅을 스치는 순간(hit)** 에 공중에 있어야 통과.
- 단계 1~6 (`stages`=6). 단계마다 N번 뛰고, 사이에 3.6초 쉼. 단계가 오를수록 빠르고 박자가 어려워짐(느린 일정 → 짧-짧-길 → 점점 가속 → 정점에서 뜸 들이기 → FINAL).
  - 1 워밍업(8) · 2 박자 맞추기(10) · 3 따-따-다(12) · 4 점점 빨라져요(12) · 5 뜸 들이기(14) · 6 FINAL(16)
- 모드 `out`: 한 번 걸리면 탈락(갑판에서 바다로 퐁당). `life`: 하트 3개, 걸리면 -1 하트 후 1.8초 보호, 0이면 탈락.
- 점프는 눌렀을 때 시작해 `air`초 체공(단계마다 0.56→0.46). 착지 후 `rest`초(0.18) 웅크려 쉬어야 다시 뜀 → 연타로 항상 떠 있는 꼼수 불가.
- 통과 조건: 발이 땅에서 떨어진 구간 = `[ts+25ms, ts+air*1000-25ms]` 안에 hit 시각이 들어올 것. 정점(`ts+air/2`)과 ±80ms 이내면 **PERFECT**.
- 점수: 통과 100 + PERFECT 50 + 콤보(최대 10)×5. 순위: 생존 > 탈락 단계(늦게 탈락할수록 위) > 점수.
- 늦게 들어온 학생과 탈락자는 관전(`state:'out'`). 게임 도중 입장 가능(관전).

## 시계와 시각
모든 시각은 **서버 시계(ms, 에포크)**. 각 화면은 `const clock = IQ.makeClock(socket)` 로 `clock.now()`(= 서버 시각 추정)를 쓴다. `clock.ready` 가 false 면 잠깐 대기.
폰은 점프를 누른 순간 `clock.now()` 를 `ts` 로 보낸다(서버가 최근 0.45초 안으로만 인정, 서버가 판정을 hit+260ms 뒤에 하므로 늦게 도착해도 OK).

## 줄 움직임 (두 화면이 똑같이 그려야 함)
`jr:plan` 으로 한 단계의 `start`(줄이 돌기 시작하는 시각)와 `hits[]`(땅을 스치는 시각들)를 받는다.
`JR.swing(plan, t)` → `{theta, u, k, idle, hitIn}`. theta=0 이 땅(발밑)을 스치는 순간, π 가 머리 위 정점. `start→hits[0]`, `hits[k-1]→hits[k]` 가 각각 정확히 한 바퀴.
- 줄 위 점: `JR.ropePoint(theta, s)` (s=0 왼쪽 술래 손, 1 오른쪽 술래 손) → `dy`(−1 정점 … +1 땅)·`depth`(<0 학생 뒤, >0 학생 앞).
- `JR.ropeInFront(theta)` 가 true 면 줄이 학생 앞(카메라 쪽): **학생을 먼저 그리고 줄을 나중에**, false 면 줄을 먼저 그리고 학생을 나중에.
- 줄이 땅에 닿는 높이는 학생 발 높이, 정점 높이는 학생 키의 약 2.5~3배, 술래 손 높이는 학생 키의 약 1.6배(손은 줄 회전축).
- idle(단계 시작 전/마지막 hit 후)에는 줄이 땅에 늘어져 있음(살짝 출렁).
- `JR.jumpH(ts, air, t)` 0..1 포물선 점프 높이, `JR.squash(ts, air, rest, t)` 착지 웅크림 0..1.

## 서버 → 클라이언트 이벤트
| 이벤트 | 내용 |
|---|---|
| `jr:phase` | `{phase:'lobby'|'ready'|'play'|'end', mode:'out'|'life', startLevel, stage, stages, readyRemain(ms), serverT, result}`. `ready`=카운트다운(readyRemain ms 뒤 시작, 서버시각 기준 `serverT+readyRemain`). `result`(end일 때) = `{why:'clear'|'last'|'out'|'stop', stage, stages, mode, ranking:[{id,name,color,alive,hearts,score,jumps,perfect,best,outStage}]}` (이미 순위순) |
| `jr:roster` | 플레이어 배열 `[{id,name,color,state:'in'|'out',hearts,score,combo,best,jumps,perfect,slot,connected,bot}]`. `slot`=입장 순번(갑판 자리 배정용, 0부터 증가) |
| `jr:plan` | `{stage,stages,name,n,air(초),ease,rest(초),start,hits:[ms…],final}` — 단계 시작 때(다음 단계는 직전 단계 마지막 판정 직후 미리) |
| `jr:hit` | `{t,stage,i,n,res:[[id,code,out?]…]}` 판정 결과(hit 시각+260ms 뒤 도착). code: 0 걸림(3번째 값 1이면 탈락) · 1 통과 · 2 PERFECT · 3 보호 중이라 넘어감. `t`=그 hit 의 시각 |
| `jr:stage` | `{cleared,t,final}` 한 단계의 마지막 판정 직후 (연출: "STAGE n CLEAR") |
| `jr:j` | 점프 묶음 `[id, ts, id, ts, …]` (50ms 마다, 있을 때만) — 다른 학생 점프 연출용 (`ts` 는 서버시각) |
| `goto` | 문자열 경로 — 선생님이 다른 게임으로 바꿈. **학생 폰은 `location.href = 경로`** |
| `jr:kicked` | 선생님이 내보냄 |

## 클라이언트 → 서버
학생: `jr:join {pin,name,pid,color}` → ack `{ok,pid,me}` | `{ok:false,redirect}` | `{ok:false,error}` (redirect 는 `location.href`로 이동, 이동 전에 localStorage 에 이름/색 저장), `jr:jump {ts}`, `time`(IQ.makeClock 이 처리), `clientlog {msg,ua,pin}`.
선생님: `jr:resume {pin,hostKey}` ack `{ok}`, `jr:config {mode,level}`(대기실에서만), `jr:start`, `jr:stop`, `jr:reset`, `jr:kick id`, `jr:bots n`, `jr:clearbots`, `sess:switch` 는 `/session-bar.js` 가 처리.

## 저장소 키 (기존 게임과 같은 규칙)
- sessionStorage `sumus-sess` = `{pin,key}` (수업 방), `sumus-jr:host` = `{ok,pin,hostKey}` (이 게임 호스트 열쇠). 선생님 화면은 연결(`connect`)될 때마다 `jr:resume` 하고, 실패하면(서버 재시작) `jr:create {pin, sk:sess.key, mode, level}` 로 같은 번호를 되찾는다 (`public/mg-host.html` 의 `socket.on('connect'…)` 와 `setupJoin` 참고). 수업 방 정보(`sumus-sess`)가 없으면 `location.replace('/')`.
- localStorage `sumus-jr:cfg` = `{mode:'out'|'life', level:1..5}` (홈 화면이 저장, 선생님 화면의 설정 바꾸기도 같은 키).
- 학생: localStorage `sumus-island-player` = `{pin,name,color,pid}` — 세 게임이 공유(그대로 `public/mg-play.html` 방식 사용).
- QR/입장 주소는 항상 `/play?pin=번호` (수업 방은 `/play` 하나로 통일, 서버가 지금 게임으로 안내). `http://localhost` 로 열었으면 `/api/info` 로 LAN IP 를 얻어 QR 주소에 사용 (mg-host 의 `setupJoin` 과 같음).

## 개발용 부트스트랩 (홈 화면 없이 바로 /jr 확인)
아무 페이지(예: `/play`)의 콘솔에서:
```js
const s = io(); s.emit('sess:create', { first: 'jr', jr: { mode: 'out', level: 1 } }, r => {
  sessionStorage.setItem('sumus-sess', JSON.stringify({ pin: r.pin, key: r.key }));
  sessionStorage.setItem('sumus-island-quiz:v1:host', JSON.stringify(r.quiz));
  sessionStorage.setItem('sumus-mg:host', JSON.stringify(r.mg));
  sessionStorage.setItem('sumus-jr:host', JSON.stringify(r.jr));
  location.href = '/jr'; });
```
(`/play` 페이지는 socket.io 를 이미 로드함.) 학생은 `/j?pin=<pin>` 을 다른 탭에서 열고 이름 입력. 혼자 테스트: 선생님 화면의 "봇 10명" 버튼 → `jr:bots`.

## 공통 디자인 규칙
기존 화면(`public/mg-host.html`, `public/mg-play.html`)과 한 세트로 보이게: Pretendard 폰트(`https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css`), 네이비 `#0b2a4a`/골드 `#f2c14e` 카드, 둥근 모서리, 큼직한 글씨(교실 프로젝터용), 한국어 UI. 캐릭터는 `IQ.drawChar`(common.js) 스타일을 따르되 점프/넘어짐 포즈는 직접 그려도 됨. 효과음은 외부 파일 없이 WebAudio 로 합성(`mg-host.html` 의 `tone`/`sfx` 참고). 외부 라이브러리·이미지 사용 금지(폰트 CSS 제외).
