# SUMUS 수업관리 플래너 (planner/) — Claude 인계 문서

선생님(사용자)이 직접 쓰는 수업·시험·메모 플래너와 Windows 바탕화면 위젯. 사용자는 한국어로 대화하고, 설명은 짧고 쉽게 원한다.
**이 폴더만의 문서다.** 저장소의 나머지(`server/`, `public/` 등)는 SUMUS VOCA(단어 앱)로 별개다. 건드리지 말 것.

## 배포 · 주소
- 운영: https://sumus-planner.minsik2e5.workers.dev/ (위젯 화면은 `/widget`)
- **브랜치 `sumus-planner-deploy` 에 푸시하면 자동 배포** (`.github/workflows/deploy-planner.yml`: `npm ci` → `node planner/check.mjs` → wrangler 배포). 테스트가 실패하면 배포가 안 된다.
- 푸시 전에 반드시 `node planner/check.mjs` (현재 49개 통과). 배포 결과는 `gh run list --workflow "Deploy Planner"` 로 본다.
- Cloudflare 토큰·계정 ID는 GitHub Secrets(`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`)에 있다. 저장소에는 없다.

## 구조
| 파일 | 역할 |
|---|---|
| `worker.mjs` | Cloudflare Worker. `/api/*` 는 Durable Object(`PlannerState`) 하나로, 나머지는 `public/` 정적 파일 |
| `server.mjs` | API 로직(PIN 로그인, 문서 저장·409 병합, 가져오기, **자동 백업 30일·복원**). DO 와 로컬 테스트가 같이 씀 |
| `public/core.js` | 플래너 규칙(기본 데이터, 시험·진도 계산, 기말 날짜 자동 입력, 마이그레이션) |
| `public/sync.js` | 저장: 변경 700ms 후 PUT, 409 면 3-way 병합. 플래너와 위젯이 같은 문서를 공유 |
| `public/app.js`, `index.html` | 전체 플래너 웹 |
| `public/widget.js`, `widget.html` | 위젯 화면(`?w=all|classes|work|quick|checklist|notes|clock|exams`) |
| `public/memo.js` | 메모장 서식(체크박스 줄 ☐/☑, 글씨색 7가지, 굵게, 제목 `# `) 저장·검증 |
| `widget-exe/` | Windows EXE(C#, WebView2). 위 `/widget` 페이지를 창으로 띄움 |
| `check.mjs`, `core-check.mjs` | 테스트 (서버 API·병합·규칙·메모 형식) |

- 데이터는 **서버의 JSON 문서 한 개**(`doc`)이고, 웹과 위젯은 같은 문서를 본다. 컴퓨터가 달라도 PIN 만 같으면 같은 데이터다.
- 로그인은 PIN 하나(쿠키 180일). **PIN 은 저장소에 없다.** 비밀번호를 찾아 달라고 하면 복구할 수 없고 `PATCH /api/auth` 로 바꾸는 것만 가능하다고 안내할 것.
- 메모(`notes[]`)는 `text`(글자만, 체크박스 줄은 `☐ `/`☑ `, 제목 줄은 `# `)와 `html`(화면용)을 함께 저장한다. `html` 은 `memo.js` 의 정해진 모양만 허용하고, 아니면 `text` 로 다시 만든다. 지운 메모는 `trash[]` 에 30일.
- 자동 백업: 서버가 하루 첫 저장 직전의 문서를 `snap:YYYY-MM-DD` 로 30일 보관. 플래너 상단 보관함 아이콘에서 받기·복원.
- 시험(`exams[]`): 끝난 시험은 `autoRollExams` 가 다음 시험(중간→기말)으로 넘기고 날짜를 비운다. 기말 날짜는 `core.js` 의 `FINAL_EXAM_DATES` 가 **한 번만**(`migrations['final-dates-<id>']`) 채워 준다. 사용자가 고친 날짜는 덮어쓰지 않는다.

## 위젯 EXE
- 소스 `widget-exe/src/*.cs`, 빌드 `widget-exe/build.ps1` (Windows 에서 `wv2.zip` = Microsoft.Web.WebView2 1.0.2903.40 NuGet 을 `widget-exe/sdk/` 에 풀고 실행 → `out/SUMUS_Widget.exe`). 결과물을 zip 으로 묶어 `public/SUMUS_Widget_Installer.zip` 교체.
- **Claude 클라우드 환경에는 C# 컴파일러가 없어서 EXE 를 빌드·실행해 본 적이 없다.** C# 을 고쳤다면 그렇게 말하고 사용자 PC 에서 빌드하도록 안내할 것.
- 웹(`widget.js`)이 바뀌면 EXE 재설치 없이 위젯 창 **오른쪽 클릭 → 모든 위젯 새로고침** 만 하면 된다. 웹 쪽 캐시는 `widget.html` 의 `?v=` 번호를 올린다.

## 지금 상태 (2026-10-22)
- 완료·배포: 기말 일정 자동 등록, 위젯 깜빡임 수정(바뀐 게 없으면 다시 안 그림), 위젯 접기, 체크리스트 수정·삭제, 메모 체크박스·글씨색·굵게·제목·휴지통, 시험 D-day 위젯, 자동 백업, 폰 홈 화면 설치(manifest).
- 위젯 전체 카드(`?w=all`)는 출퇴근·생활 → 시험 D-day(모든 학교) → 일정 메모 → 체크리스트. 오늘 수업은 빼고 별도 위젯(`classes`)으로만 남김. 출퇴근 시간은 직접 입력 가능(비어 있으면 '지금' 버튼).
- **아직 EXE 에 반영 안 됨(코드는 올라가 있음, 새 빌드 필요)**: 접을 때 창 높이도 줄이기(`h:<px>:fold|open` 메시지 → `SetViewHeight`), 트레이 '위젯 추가'의 시험 D-day.
- 임시값: **선부고 기말 종료일 12/10 은 추정**(시작 12/7 만 알려 줌). 공지가 나오면 `FINAL_EXAM_DATES` 가 아니라 앱의 시험 수정 화면에서 고치면 된다(이미 입력된 뒤라서).
- 아직 안 한 것(사용자와 논의 중): **메모 AI 정리 버튼**(정리본 + 바뀐 점 + 제안, `/api/memo-tidy` 를 Worker 에 추가, Anthropic API 키는 Cloudflare 비밀값으로, 유료 종량제라 월 한도 설정 필요), 메모 검색, 메모의 체크박스 → 오늘 체크리스트 보내기.

## 일하는 방식 (중요)
- 푸시하면 바로 운영에 배포되므로, 큰 변경은 테스트(`check.mjs`)를 먼저 통과시키고, 기능 변경 전에 사용자에게 한 줄로 확인한다.
- 화면 동작은 jsdom 으로 시험해 왔다(위젯 `widget.js` 를 가짜 `fetch` 로 돌려 클릭·입력 확인). 실제 Windows 위젯 창에서 눈으로 확인한 것은 아니므로, 결과를 말할 때 "확인함"과 "코드만 넣음"을 구분해서 말할 것.
- 사용자 데이터(운영 문서)를 직접 쓰거나 지우지 말 것. 백업·복원은 앱 기능으로만.
- Cloudflare 배포 계정·PIN·API 키 값을 저장소나 대화에 적지 말 것.
