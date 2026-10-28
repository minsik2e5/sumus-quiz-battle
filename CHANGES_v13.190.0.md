# v13.190.0 — 낚시 손맛 더하기

선생님 요청 "낚시 손맛을 더 추가하고 싶다"의 구성안 4가지를 한 번에 넣었습니다. 새 그림 주문서는 없습니다(코드 · CSS · 기존 그림, 소리는 합성).
자세한 설계는 `docs/fishing-feel-design.md`.

| 무엇 | 바뀐 점 |
|---|---|
| 물고기마다 다른 몸부림 | 몸부림 13가지. 참치(긴 돌진 · 한 번 꺾기) · 대왕오징어(먹물 · 잠수) · 가오리(넓게 미끄러짐) · 아귀(발광 미끼) · 상어(치고 빠짐)는 대표 몸부림, 나머지는 몸 모양마다. 그림자 실루엣 · 움직임 · 물보라 · 진동 · 소리 높낮이가 다르다 |
| 낚싯대 단계별 감촉 | 1~5단계마다 휘는 정도 · 출렁임 · 릴 소리(톡톡 → 드르륵) · 진동 세기 · 줄 풀리는 소리 · 끊김 소리 · 반짝이. 강화 창에 "감촉 미리듣기"(지금 · 다음 단계) |
| 월척 | 전설이거나 보통 이상에서 무게 상위 15%(하루 평균 약 0.37번). 0.5초 멈춘 듯 · 번쩍 · 큰 물보라 · 무게가 천천히 · "월척!" 도장. 신기록이면 "NEW RECORD" 도장 · 별 |
| 깊은 바다 분위기 | 더 어두운 물속 · 빛줄기 · 발광 플랑크톤(9 → 35개, 저사양 23개) · 수심 표시 · 낮은 울림 · 물방울 · 입질 직전 큰 그림자(크기는 무작위, 힌트 아님) |
| 새 소리 14개 | `fish-turn` `fish-ink` `fish-glide` `fish-lure` `fish-thump` `rod-tick` `rod-ratchet` `rod-drag` `rod-shimmer` `rod-snap-heavy` `trophy-boom` `deep-hum` `deep-bubble` `deep-pass` (합계 약 134KB, 전체 약 2.12MB / 상한 2.2MB) |

## 그대로인 것

| 항목 | 상태 |
|---|---|
| FIGHT 등급별 세기 · 행동 가중치 · 서버 최소 파이팅 시간 | 그대로(서버는 몸부림 이름 `feel`과 기울기 `lean`만 더 보낸다) |
| 등급 평균 행동 비율(= 평균 난이도) | 같은 등급 물고기끼리 기울기 합이 0이라 바닷가 · 깊은 바다 모두 원래와 같다 |
| 확률 · 진주 · 코인 · 알 하루 한도 · 낚싯대 능력치 · 낚싯대 모양 | 그대로 |
| 응답의 물고기 정보 | key · 이름 · 무게 · 등급은 여전히 보내지 않는다 |
| 선생님 활동 기록 | "낚시 아귀 7.2kg" 그대로 |
| 소리 꺼짐 · 진동 없음(아이폰) · 동작 줄이기 | 그대로 동작(아이폰은 화면 흔들림, 동작 줄이기는 흔들림 · 번쩍 없이 글자로) |

## 파일

- 새 파일: `public/modules/reel-feel.js`, `public/v13190.css`, `docs/sound/feel-synth.mjs`, `public/assets/sfx/` 14개, `server/fishing-feel-check.mjs`, `docs/fishing-feel-design.md`
- 바뀐 파일: `public/modules/reel.js`, `server/reel.mjs`, `public/modules/sound.js`, `docs/sound-library.md`, `server/sound-check.mjs`(효과음 76 → 90개), `server/build-assets.mjs`, `server/release-check.mjs`
