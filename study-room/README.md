# SUMUS 공부방

학원 학생들이 카메라 없이 귀여운 캐릭터로 "지금 공부 중"을 보여주며 같이 공부하는 실시간 웹앱입니다.
퀴즈배틀과는 별도의 서버로 동작합니다.

## 화면

| 주소 | 누가 | 내용 |
|---|---|---|
| `/` | 학생 | 입장(반 코드 + 이름 + PIN) → 캐릭터 꾸미기 → 공부방 |
| `/?code=1234` | 학생 | 반 코드가 미리 채워진 입장 링크 |
| `/teacher` | 선생님 | 반 관리, 공부 기록 확인, 공지, CSV 받기 |
| `/health` | 서버 | 상태 확인 |

### 학생
- **우리 반 / 학원 전체** 탭: 우리 반은 반 학생 전원, 학원 전체는 지금 접속한 학생 모두가 보입니다.
- **▶ / ⏸**: 공부 시작/쉬기. 공부 중엔 화면이 꺼지지 않게 요청합니다(지원 브라우저).
- **말풍선**: 내 카드를 누르거나 💬 버튼. 하루 20회, 20자, 욕설은 ♡로 가려집니다.
- **응원**: 친구 카드를 누르면 하트가 날아가고 친구에게 알림이 갑니다.
- **혼자 모드(👤)**: 큰 타이머와 내 캐릭터만 보여 주는 집중 화면입니다.
- **기록(🕒)**: 오늘, 최근 7일, 연속 공부일(하루 30분 이상), 반 TOP 3, 내 순위를 보여 줍니다.
- 연결이 끊겨도(화면 꺼짐 등) **10분 안에 돌아오면** 시간이 이어서 흐르고, 그 이상이면 끊긴 시점에 자동으로 멈춥니다.
- **카메라로 캐릭터 움직이기(📷)**: 폰 카메라로 얼굴 방향만 읽어 캐릭터가 따라 움직입니다(고개 숙임 → 공부, 고개 듦, 하품, 💤 조는 중, 빈 의자). 영상은 기기 밖으로 나가지 않고 서버에는 자세 이름만 보냅니다. 얼굴이 5분 넘게 안 보이면 자리를 뜬 시점까지만 기록하고 멈추며, 카메라를 켠 동안은 집중 확인 창이 뜨지 않습니다. 얼굴 인식은 MediaPipe Face Landmarker를 브라우저에서 1초에 2번 돌립니다.
- **집중 확인**: 공부 중엔 30~50분마다 무작위로 "아직 공부 중이에요?" 창이 뜹니다(소리+진동). 3분 안에 누르지 않으면 자동으로 멈추고, 창이 뜬 시점까지만 기록됩니다. 켜두기만 하고 딴짓하는 것을 막기 위한 장치입니다.

### 선생님
- 반 만들기/이름 변경/삭제(4자리 반 코드 자동 생성)
- 반별·학원 전체 현황: 상태, 오늘(또는 선택한 날) 공부 시간, 최근 7일, 7일 추이, 연속일, 말풍선, 받은 응원, 마지막 접속
- 학생별 카메라 인증 시간(얼굴이 보인 채 공부한 시간)과 실시간 카메라 자세
- 학생별 집중 확인 기록(✔ 통과 / ✖ 놓쳐서 자동 정지)
- 말풍선 지우기, PIN 재설정, 반 이동, 학생 삭제
- 반/전체 공지 띄우기
- 기간별 공부 시간 CSV(엑셀) 받기

## 로컬 실행

```text
cd study-room
npm install
STUDY_TEACHER_KEY=원하는키 npm start   # http://localhost:8790
npm test
```

`STUDY_TEACHER_KEY`가 없으면 서버가 임시 키를 만들어 로그에 출력합니다.

## 환경 변수

| 이름 | 설명 |
|---|---|
| `STUDY_TEACHER_KEY` | 선생님 화면 비밀번호 (배포 시 꼭 설정) |
| `DATABASE_URL` | 있으면 Postgres에 기록을 저장합니다 (권장) |
| `STUDY_DATA_FILE` | DB가 없을 때 쓸 JSON 파일 경로 (기본 `study-room/data/study-room.json`) |
| `PORT` | 서버 포트 (기본 8790) |

## Cloudflare 배포 (권장)

학원 전체를 Durable Object 하나가 맡아 실시간 연결과 기록 저장(내장 SQLite)을 함께 처리합니다. 잠들지 않고, DB를 따로 붙일 필요가 없습니다.

**GitHub 연결로 자동 배포 (Workers Builds)**
1. Cloudflare 대시보드 → Workers & Pages → Create → **Import a repository** → 이 저장소 선택
2. Project name: `sumus-study-room` (wrangler.jsonc의 `name`과 같아야 함)
3. Branch: 배포할 브랜치 / **Root directory**: `study-room`
4. **Build command**: `npm ci` / **Deploy command**: `npx wrangler deploy`
5. 선생님 키는 `wrangler.jsonc`의 `STUDY_TEACHER_KEY_HASH`(키의 SHA-256 해시)로 확인합니다. 저장소가 공개라 키 자체는 넣지 않습니다. 키를 바꾸려면 새 키의 해시로 바꾸거나 Settings → Variables and Secrets에서 `STUDY_TEACHER_KEY`를 **Secret**으로 추가하세요.

**내 컴퓨터에서 배포**
```text
cd study-room
npm ci
npx wrangler login
npx wrangler secret put STUDY_TEACHER_KEY
npm run cf:deploy
```

로컬 테스트: `.dev.vars`에 `STUDY_TEACHER_KEY=...`를 적고 `npm run cf:dev` (http://localhost:8787)

## Render 배포 (Node 서버)

1. Render에서 **New → Web Service**, 이 저장소 선택
2. **Build Command**: `cd study-room && npm install --omit=dev` / **Start Command**: `cd study-room && npm start`
3. 환경 변수 `STUDY_TEACHER_KEY` 설정
4. 기록이 재배포 때 사라지지 않게 Render Postgres의 Internal Database URL을 `DATABASE_URL`로 넣습니다.

## 구조

```text
lib/hub.js         API·WebSocket 처리 (Node/Cloudflare 공용)
server.js          Node 서버 (HTTP + ws + 정적 파일)
cloudflare/        Cloudflare Worker + Durable Object + SQLite 저장소
wrangler.jsonc     Cloudflare 배포 설정
lib/academy.js     반/학생/공부 시간/말풍선/응원/통계 핵심 로직
lib/store.js       JSON 스냅샷 저장 (Postgres 또는 파일)
lib/time.js        한국 시간 기준 날짜 계산
lib/filter.js      이름/말풍선 정리, 욕설 필터
public/avatar.js   SVG 캐릭터 (서버/브라우저 공용)
public/camera.js   카메라 얼굴 방향 → 자세 판정 (기기 안에서만 실행)
public/app.js      학생 화면
public/teacher.*   선생님 화면
```

타이머는 서버가 매초 보내지 않고, 서버는 `baseMs`(오늘 저장된 시간)와 `since`(공부 시작 시각)만 보내며 각 기기가 직접 계산합니다.
