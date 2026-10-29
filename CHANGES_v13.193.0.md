# v13.193.0 — 인형뽑기 퀄리티업: 짜릿한 놓침 + 반 소식

선생님 요청 "인형뽑기 퀄리티업"의 ①② 를 넣었습니다(③ 3D · 물리 타당성은 따로 초안 PR). 자세한 설계는 `docs/claw-upgrade-design.md`.

| 무엇 | 바뀐 점 |
|---|---|
| 놓침을 더 짜릿하게 | 놓침이 네 단계(심쿵 · 미끄러짐 · 살짝 걸림 · 허공). 조준이 가까웠던 놓침은 인형이 발톱에서 흔들흔들 버티다 → 화면이 한순간 멈추고 → "툭" · 솜털 · SLIP! → 짧은 흔들림 → 슬로모션으로 떨어지고 → 한 박자 늦게 "아슬아슬! 아깝다!! 거의 잡았는데…" · 소리 · 진동. 조준이 멀면 약하게, 허공이면 멈춤 · 흔들림 없이 먼지만 |
| 반 소식 | 같은 학교 · 학년 친구가 황금 인형 · 대박 · 도감 완성 · 도감 6번째 새 인형을 뽑으면 인형뽑기 화면 위쪽에 "OO 학생이 황금 어흥 호랑이 인형을 뽑았어요!" 한 줄. 비공개 학생 · 미리보기 계정 제외, 한 명 하루 2개, 화면에 3개, 저장은 최근 50개(약 10KB). 푸시 알림 없음 |
| 새 소리 3개 | `claw-strain`(버팀) `claw-slip`(툭) `claw-aww`(아깝다), 합성 21KB(전체 약 2.17MB / 상한 2.2MB) |

## 그대로인 것

| 항목 | 상태 |
|---|---|
| 잡힐 확률 · 놓침 모양 비율 · 코인 · 하루 상한 · 도감 보너스 · 집게권 | 그대로(서버 `claw.mjs` · `claw-rules.js` 안 바뀜) |
| 잡힘 · 놓침 결과 | 서버가 정한 그대로. 화면은 결과를 받은 뒤 연출만 고른다(잡힘에는 놓침 연출이 나오지 않음: 검사) |
| 집게 하나 연출 시간 | 놓침이 늘어나도 0.9초 이내 → 서버 마감 계산(4.5초) 안 |
| 동작 줄이기 · 소리 끔 | 멈춤 · 슬로모션 · 흔들림 없이 문구로, 소리를 끄면 진동도 끔 |

## 파일

- 새 파일: `public/modules/claw-fx.js`, `server/claw-news.mjs`, `public/v13191.css`, `docs/sound/claw-synth.mjs`, `public/assets/sfx/` 3개, `server/claw-upgrade-check.mjs`, `docs/claw-upgrade-design.md`
- 바뀐 파일: `public/modules/claw.js`, `server/service.mjs`(`/claw/home` · `/claw/drop`에 소식), `public/modules/sound.js`, `docs/sound-library.md`, `server/sound-check.mjs`(효과음 90 → 93개), `server/build-assets.mjs`, `server/release-check.mjs`
