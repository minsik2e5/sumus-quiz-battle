# SUMUS QUIZ BATTLE V0.9.1 RELEASE CANDIDATE

교사 1명과 학생 최대 24명이 인터넷으로 접속해 서로 다른 영어 단어 범위를 풀고, 교실 프로젝터에서 실시간 RUN 레이스를 진행하는 수업용 웹앱입니다.

## URLs

- Teacher: `/?role=teacher`
- Student: `/?role=student&code=12345`
- Health: `/health`
- Realtime: WebSocket `/ws`
- Fixed public origin: `https://sumus-quiz-battle-public-v083.onrender.com`

현재 live Render는 사용자 승인 전까지 V0.9.1로 배포하지 않습니다. 최종 배포 시 GitHub main commit, Render `/health` commit, ZIP build badge가 일치해야 합니다.

## Local verification

Node.js 20 이상이 필요합니다.

```text
npm install
npm test
npm run build
npm run test:e2e
npm run test:load
```

- `npm run test:e2e`: Chrome + Playwright로 서버 시작부터 HOME → 경기 결과와 교사 refresh 복구까지 검사합니다.
- `npm run test:load`: 로컬 서버를 자동 시작하고 24 JOIN/READY/ANSWER, 5 reconnect, pause/resume, finish를 검사합니다.

## Authoritative data migration

```text
python scripts/extract-incheon-pdf.py "<인천 WORDS&EXPRESSIONS PDF>" \
  data/incheon-g1-sep-2025-selected.source.json

node scripts/extract-v09-books.js \
  --ybm ../SUMUS_QUIZ_BATTLE_V0.6.4_KO_REVIEW_STABLE_CANDIDATE.html \
  --incheon ../SUMUS_QUIZ_BATTLE_V0.6.5.1_INCHEON_VOCAB_STABLE_CANDIDATE.html
```

V0.6.5.1 HTML이 없는 환경에서는 검증된 PDF 추출 JSON을 자동 fallback으로 사용합니다. PDF 추출기는 17페이지 좌표를 결정적으로 읽고 원본 SHA-256을 기록합니다. 통합 추출기는 Park 144, Kim 180, Incheon 214 및 대표 행/마지막 행을 모두 assert합니다. 외부 사전이나 AI로 단어·뜻을 생성하지 않습니다.

## Architecture

- `client/data.js`: authoritative data policy
- `client/network.js`: WebSocket lifecycle and collision recovery
- `client/range.js`: range invariants and pool audit
- `client/teacher.js`: private teacher state persistence and refresh restore
- `client/student.js`: lookup/reconnect and attempt-safe question transition
- `client/race.js`: RUN presentation renderer enhancements
- `client/assets.js`: replaceable local AssetRegistry
- `client/ui.js`: diagnostics and fatal error surface
- `lib/protocol.js`: server message permissions and validation
- `lib/room-registry.js`: room, public snapshot, private teacher state

Asset files are local-only under `assets/`; external hotlinks are not used.

## Deployment safety

Set `SUMUS_TEACHER_KEY` in the existing Render service environment. Do not commit the key. Do not create a new Render service.
