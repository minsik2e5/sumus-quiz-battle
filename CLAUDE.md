# SUMUS VOCA — 작업 메모 (AI 코딩 도구용)

## 코드 짜는 방식: ponytail (lite)
- 코딩 작업에는 `.claude/skills/ponytail/SKILL.md`(ponytail, MIT, DietrichGebert/ponytail @ c982cd4)를 **lite 모드**로 따른다.
  - 요청받은 것은 끝까지 만든다. 더 간단한 방법이 있으면 한 줄로만 알린다.
  - 이미 있는 헬퍼·패턴을 먼저 쓴다(`public/modules/*`, `server/*`). 새 의존성은 넣지 않는다.
- 이 프로젝트에서 ponytail보다 앞서는 것:
  - 선생님이 "퀄리티 높게"라고 한 화면·연출·이펙트는 줄이지 않는다.
  - 바뀐 규칙마다 `server/*-check.mjs`에 검사를 남긴다. `npm run check`, `npm run check:cloudflare`가 통과해야 한다.
  - 버전을 올리면 루트에 `CHANGES_v<버전>.md`를 한국어로 남긴다.
  - 답변과 PR 설명은 한국어로 쓴다.

## 지켜야 할 것
- 운영 Supabase에는 절대 연결하지 않는다.
- 작업은 브랜치와 PR까지만 한다. 머지는 선생님이 "머지해"라고 했을 때만 한다. `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다.
- 전설 펫에는 야차전 특기가 없다.
- 그림 주문서(docs/asset-requests/runner)에는 두 가지를 꼭 넣는다.
  - Drive의 기존 그림을 열어 그림체를 맞추라는 말
  - 정해진 Drive 폴더에 정확한 파일 이름으로 저장하라는 말
