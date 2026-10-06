# PART 4 · 바나나킥 — 프로토콜과 규칙

서버는 `bk.js`(완성, 수정 금지 — 필요하면 보고), 공용 계산은 `public/bk-common.js`(`window.BK`), 시계는 `public/common.js`의 `IQ.makeClock(socket)`.
화면은 두 개: **선생님(프로젝터) `public/bk-host.html` (주소 `/bk`)**, **학생 폰 `public/bk-play.html` (주소 `/b?pin=1234`)**.
설계 기준은 `docs/jr-protocol.md`(PART 3)와 같은 방식(서버 시계, 슬롯, `goto`, 세션 저장소 키)이며, 그 문서의 "시계와 시각", "저장소 키", "개발용 부트스트랩", "공통 디자인 규칙" 절을 **bk 로 바꿔서 그대로 따른다** (`jr`→`bk`, `/jr`→`/bk`, `/j`→`/b`, `sumus-jr:*`→`sumus-bk:*`).

## 게임 규칙
- 학생 전원이 **각자 골키퍼**. 같은 슛이 모두에게 동시에 날아오고, **좌우 버튼**(왼쪽/오른쪽)으로 자기 골키퍼를 움직여 막는다. 다이빙·드래그 조작 없음.
- 학생은 **자기 캐릭터(이름·색)로 골키퍼**를 한다. 슈터는 학생이 아니라 **섬의 마스코트**이고 슛 묶음마다 랜덤으로 바뀐다: `shot.shooter` = `'octo'`(문어) · `'crab'`(꽃게) · `'turtle'`(바다거북) · `'puffer'`(복어). 문어·꽃게는 `public/mg-host.html` 의 `octo()`/`crab()` 를 가져다 쓰고, 거북·복어는 같은 스타일로 새로 그린다(발/지느러미로 공을 차는 동작). 같은 묶음(시간차 2~3개)은 같은 슈터가 연속으로 찬다. 선생님 화면에 "문어 선수의 슛!" 같은 짧은 콜아웃.
- 모드 `out`(탈락): 한 골 먹으면 탈락, 마지막까지 살아남은 학생이 우승. 난이도는 시작 후 150초에 걸쳐 최고가 됨. 모드 `score`(점수전): 1·2·3분(`time` 60/120/180) 동안 가장 많은 점수를 얻은 학생이 우승, 탈락 없음. 난이도는 제한 시간 전체에 걸쳐 올라감.
- 난이도는 **연속적으로** 올라간다(`d` 0~1): 공이 빨라지고(비행시간 1.6s→0.95s), 슛 간격이 짧아지고, 휘는 정도가 조금 커지고, 한 번에 2개가 시간차로 날아온다. 공이 날아가는 모양은 원본 게임 영상과 같게: 골대 앞 가운데 근처(x0 ±0.3)에서 출발, 노란 공(바나나킥, kind=banana, 약 70%)은 살짝 휘고 흰 공(kind=straight)은 곧게. 너클볼 없음, 공 방향 표시(예측선) 없음. `bk:level` 로 이름표가 바뀐다: 워밍업 → 코너 노리기 → 바나나킥! → 연속 슛 → 너클볼 FINAL.
- 점수: 선방 100 + 정중앙 선방(WOW) 50 + 콤보(최대 10)×5. 실점하면 콤보 0.
- 서버가 만드는 모든 슛은 이론상 막을 수 있게(이전 슛 도착 위치에서 골키퍼 속도로 닿을 수 있게) 생성된다.

## 좌표와 화면 방향
- x: 골대 입구가 **-1 ~ +1, 화면 왼쪽이 -1**. 선생님 화면과 폰이 **같은 방향**(좌우 반전 금지 — 학생이 프로젝터와 폰을 번갈아 보기 때문).
- 카메라: 슈터 쪽(화면 아래)에서 골대(화면 위, 멀리)를 바라봄. 공은 아래에서 위로 날아가며 작아지고, 골키퍼는 골대 안에서 정면(관객 쪽)을 보고 좌우로 움직임. 폰은 골대 부분을 크게 확대해 보여 줘도 되지만 좌우 방향은 같아야 함.
- 값: 골키퍼 몸 반폭 `BK.GW`=0.17, 공 반지름 `BK.BR`=0.05, 선방 범위 `BK.REACH`=0.22, 정중앙 `BK.PERFECT`=0.06, 최고 속도 `BK.V`=1.5/초, 끝 `BK.XMAX`=0.92. 골대 입구 폭(-1~1)에 이 크기를 비율로 그릴 것.

## 공 궤적 (모두 같은 계산)
`shot = {id, shooter(마스코트 키), t0(차는 시각), t1(골대 도착 시각), x0(출발 x), x1(도착 x), A(바나나 곡선 크기, 부호=방향), dx(막판 꺾임), s(꺾임 시작 비율), lob(공중 높이 비율), kind:'straight'|'banana'|'knuckle'}`.
`BK.ballAt(shot, t)` → `{x, u(0 출발~1 도착), h(공중 높이 0~lob), flying}`. 그릴 때: 깊이는 `u`(0=카메라 쪽 아래, 1=골대), 크기는 u 가 커질수록 작게(원근), 화면 y 는 u 로 보간 + `h` 만큼 위로. 도착 순간(`u=1`)의 x 가 `x1`.
`t < t0` 에는 공이 슈터 발 앞에 있음(차기 직전 0.4~0.5초는 슈터 와인드업 연출, 슈터는 화면 아래쪽 가까이에 크게, `x0` 위치에서 공을 찬다). 지나간 공(`t > t1`)은 골대 그물/골키퍼에 맞은 뒤 사라지거나 튕겨 나감(결과에 따라).

## 골키퍼 움직임 (서버와 폰이 같은 계산 → 폰은 지연 없이 즉시 반응)
- 폰은 **버튼 상태가 바뀔 때마다** `socket.emit('bk:in', { dir: -1|0|1, ts: clock.now() })` (dir: 왼쪽 누름 -1, 오른쪽 +1, 뗌/둘 다 누름 0). ts 는 누른 순간(`pointerdown` 처리 맨 앞에서 얻은 서버 시각).
- 폰은 자기 골키퍼 위치를 `const g = new BK.Goalie()` 로 계산: `g.reset(serverNow)` → 입력 때 `g.press(dir, ts)` → 그릴 때 `g.at(clock.now())` = `{x, v, dir}` (매 프레임 `g.compact(clock.now())` 로 오래된 기록 정리). **서버도 똑같이 계산**하므로 폰이 보는 위치 = 서버 판정 위치.
- `g.reset(t)` 를 부르는 때: 입장 직후(`clock.ready` 후 서버시각), 그리고 **`bk:phase` 를 받을 때마다 `phase.resetAt`** 으로(서버가 시작 때 모두의 골키퍼를 x=0 으로 되돌림). reset 전의 입력은 버림.
- 대기실·카운트다운 중에도 움직여 볼 수 있음(연습). 점수·판정은 `play` 중에만.
- 선생님 화면은 `bk:s`(20Hz, 모든 골키퍼 x)로 군중을 그린다: 배열 `[id, round(x*1000), 0, flags, …]`, flags bit0=살아있음(state 'in') bit1=움직이는 중 bit2=왼쪽으로 움직임, 두 번째 인자 = 서버 시각. `IQ.applyState(map, arr, performance.now(), serverT)` + `IQ.stepInterp(map, dt)` 를 그대로 써도 됨(e.x = x, e.y = 0, e.alive, e.moving, e.face).

## 서버 → 클라이언트 이벤트
| 이벤트 | 내용 |
|---|---|
| `bk:phase` | `{phase:'lobby'|'ready'|'play'|'end', mode:'out'|'score', time(초), serverT, readyRemain(ms), resetAt, playAt(play 시작 서버시각), endsAt(점수전 끝나는 서버시각), d(난이도 0~1), level, levels:[이름…], result}`. result(end) = `{why:'last'|'out'|'time'|'stop', mode, time, ranking:[{id,name,color,alive,score,saves,goals,perfect,best,survived(초)}]}` (순위순) |
| `bk:roster` | `[{id,name,color,state:'in'|'out',score,saves,goals,combo,best,perfect,slot,connected,bot}]`. `slot`=입장 순번(자리 배정용) |
| `bk:shots` | `{d, list:[shot…]}` — 다음 슛 묶음(차기 약 1.1~1.4초 전에 도착). 묶음에 1~3개(시간차). 늦게 들어온 클라이언트는 입장 직후 진행 중인 슛 목록을 받음 |
| `bk:res` | `{id(shot id), t1, bx(도착 x), res:[[학생id, code, out?]…]}` 판정(도착+320ms 뒤). code: 0 실점(3번째 값 1 이면 탈락) · 1 선방 · 2 정중앙 선방(WOW) |
| `bk:level` | `{n, name, t}` 난이도 이름이 바뀜 (선생님 화면 배너, 폰은 작은 토스트) |
| `bk:s` | 골키퍼 위치 20Hz (위 참고) |
| `goto` / `bk:kicked` | PART 3 와 같음 |

폰은 도착 순간(`t1`) 자기 위치와 `bx` 로 `BK.judge(gx, bx)` 를 **즉시 예측해서** OK!/실점 연출을 바로 보여 주고, `bk:res` 가 오면 확정(다르면 서버 결과로 보정). 선생님 화면은 `bk:res` 를 받는 즉시 모든 학생에게 연출(OK! 반짝임 / 골 먹은 학생은 탈락 연출).

## 클라이언트 → 서버
학생: `bk:join {pin,name,pid,color}` ack `{ok,pid,me}`|`{ok:false,redirect}`|`{ok:false,error}`, `bk:in {dir,ts}`, `time`(IQ.makeClock), `clientlog`.
선생님: `bk:resume {pin,hostKey}`, `bk:create {pin,sk,mode,time}`(재시작 복구), `bk:config {mode,time}`(대기실에서만), `bk:start`, `bk:stop`, `bk:reset`, `bk:kick id`, `bk:bots n`, `bk:clearbots`, `sess:switch`(session-bar.js).
저장소: sessionStorage `sumus-sess`, `sumus-bk:host` = `{ok,pin,hostKey}`; localStorage `sumus-bk:cfg` = `{mode:'out'|'score', time:60|120|180}` (홈이 저장, 대기실 설정 바꾸기도 같은 키).

## 개발용 부트스트랩
`docs/jr-protocol.md` 의 스니펫에서 `first:'bk'`, `bk:{mode:'out',time:120}`, `sumus-bk:host`(= `r.bk`) 로 바꾸면 됨. 학생은 `/b?pin=<pin>`. 혼자 테스트: 선생님 화면의 "봇 10명"(`bk:bots`)이 알아서 막고 놓친다.
