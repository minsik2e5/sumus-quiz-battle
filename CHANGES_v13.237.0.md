# v13.237.0 — 펫 아레나: 새 전투 소리 23개

계획: `docs/arena-battle-reboot-plan.md` 6-3(소리) · `docs/pet-arena-v2-plan.md` 7장(소리 목록 14개).
전투 그리기(캔버스로 바꾸는 `arena-stage.js` 작업)와 겹치지 않게 **소리 파일 · 합성 스크립트 · 소리 재생 쪽만** 고쳤다.
`arena.js` · `arena-live.js`에서는 `sfx(...)`를 부르던 자리만 새 표의 사건 이름으로 바꿨고, 효과 · 그리기 코드는 그대로다.

## 1. 소리 23개(`public/assets/sfx/ar-*.mp3`, 녹음 없이 합성)
- 합성: `docs/sound/arena-synth.mjs`(던전 전투 소리 `battle-synth.mjs`의 악기를 그대로 쓰고 겹침).
  다시 만들기: `npm i --no-save @breezystack/lamejs` → `node docs/sound/arena-synth.mjs public/assets/sfx`.
- **맞힘 등급 5종** `ar-hit-1 ~ 5`: 모두 **타격(퍽) · 속성(밝은 기운) · 짧은 저음** 3층. 1 스침/여러 번 맞는 한 번/남끼리 → 2 평타 → 3 스킬 → 4 강타(효과 굉장 · 치명 스킬) → 5 필살기.
- **번개 "찌직-쾅"** `ar-thunder` · **광선 "웅-" 지속음** `ar-beam`(약 1초) · **지진 "쿵-우르르"** `ar-quake`.
- **필살 3단**: 컷인 때 `ar-ult-rise`(1.1초에서 딱 끊음) → 경기장이 멈춘 1.2초의 **마지막 0.1초 정적** → 터질 때 `ar-ult-blast`.
- **목록 14개**: 불 뿜기 `ar-flame-breath` · 운석 `ar-meteor` · 물대포 `ar-water-jet` · 방울 `ar-bubble-pop` · 덩굴 `ar-vine` · 바위 `ar-rock-roll` · 회오리 `ar-tornado` · 얼음 `ar-ice` · 독 `ar-poison` · 번개 `ar-thunder` · 치명타 `ar-crit` · 히트스톱 `ar-hitstop` · 초대 `ar-invite` · 준비 `ar-ready`.
- 96kbps 모노, 23개 합 약 480KB(하나 최대 약 70KB). 출처 · 길이는 `docs/sound-library.md`.

## 2. 연결: 사건 이름 → 소리 표(`public/modules/arena-sfx.js`)
- `arenaSound('meteor', { at })`, `arenaHitSound(e)`처럼 **사건 이름만** 부른다. 캔버스 쪽(`arena-stage.js`)도 같은 이름으로 부르면 된다. 소리를 바꾸려면 표(`ARENA_SFX`)만 고친다.
- **같은 소리 파일은 0.05초에 한 번까지만**(여러 마리가 한꺼번에 맞아도 겹쳐 터지지 않는다). 소리를 끄면 아무것도 안 한다.
- 이어진 곳:

| 사건 | 소리 |
|---|---|
| 맞는 순간 | 등급 소리(+ 치명타면 `ar-crit`, 4 · 5등급이면 `ar-hitstop`) + 펫 속성 소리(그대로) + 내가 맞으면 아픔(그대로) |
| 남끼리 친 것(여러 명 판) | 1등급 하나 |
| 필살기 컷인 / 터짐 | `ar-ult-rise` / `ar-ult-blast`(두 번째 필살기도), 일직선 필살기는 `ar-beam`을 더함 |
| 불 뿜기 · 회오리 · 바위 · 갈라진 땅 · 얼음 장판 · 독구름 | 각 소리 |
| 운석 | `ar-meteor`를 떨어지기 시작할 때 내되, 안의 쾅(0.55초)이 떨어지는 때에 맞도록 늦춘다 |
| 물대포 · 덩굴 · 번개 연쇄 | 줄기가 나갈 때 각 소리 |
| 얼음 창 | `ar-ice`(조금 높고 작게) |
| 방울 깨짐 | `ar-bubble-pop` |
| 친구 대전: 새 초대가 보임 / 대기실이 모두 준비됨 | `ar-invite`(같은 초대는 한 번) / `ar-ready`(그 순간 한 번) |

## 3. 렉 방지 · 첫 로딩
- 미리 받기 방식 그대로: 펫 아레나에 들어갈 때 `preloadSound`(이미 있던 목록에 23개를 더함). **첫 화면 · 첫 터치(CORE) · 서비스 워커 미리 받기에는 넣지 않았다** → 첫 로딩 영향 없음.
- 재생은 이미 있던 `playSound`(동시 재생 14개 상한)를 그대로 쓴다. 새 타이머 · 반복 · 서버 요청 · 저장 없음.
- 맞을 때 소리 수는 예전과 같거나 하나 많다(등급 + 속성 + 아픔, 강타면 퍽). 같은 파일 0.05초 막기가 표 쪽에도 있다.

## 4. 검사
- `server/arena-sound-check.mjs`(release-check에 붙임): 23개 파일 · 음량 · 합성 스크립트로 다시 만들 수 있음 · 크기(합 560KB 이하) · 층 3개 · 필살 1단 1.1초 끊김 · 운석 때 맞춤 · 등급 고르기 · 0.05초 막기 · 연결 자리 · 첫 로딩 영향 없음.
- `server/sound-check.mjs`: 효과음 93 → 116개, 전체 상한 2.2MB → 2.7MB(처음 쓸 때만 받는다).
