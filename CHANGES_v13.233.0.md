# v13.233.0 — 펫 아레나: 경기 버튼 다시 만들기(그림 67 자리) · 혼자 판 렉 줄이기

선생님 말: "옆에 버튼들 퀄이 너무 떨어져. 에셋으로 만들자. 그리고 혼자 해도 렉이 있다 이거 수정 좀."
④(1:1:1 · 2:2, v13.232.0) 위에 얹었다. 규칙(`arena-rules.js`)은 한 줄도 바꾸지 않았다(판 결과 · 서버 다시 돌리기 그대로).

## 1. 오른쪽 버튼 · 조이스틱 · 이모트(그림 오기 전에도 확실히 낫게)
- **버튼 바탕**: 금속 테두리(금 · 은, 두 겹 그라디언트) + 보석 바탕(공격 루비 · 필살기 금 · 회피 하늘 · 교체 보라 · 스킬은 펫 속성 색) + 윗면 반짝임 + 아래 두께.
- **이름표**: 버튼 아래 테두리에 걸친 작은 리본(스킬 이름이 길어도 버튼을 가리지 않는다).
- **누름**: 살짝 들어가며 작아진다(transform만).
- **쿨타임 원형 게이지**: 12시부터 시계 방향으로 어둠이 줄어든다(반쪽 원판 두 개를 rotate만 · 값이 바뀔 때만). 다 차면 **흰 링이 한 번 반짝**.
- **필살기 준비 빛**: 예전 box-shadow 무한 깜빡임(매 프레임 다시 그림) → 버튼 뒤 금빛 링이 opacity · scale로 숨 쉰다. 아직이면 은테 · 흐린 아이콘.
- **조이스틱**: 금테 바닥 · 어두운 유리 그릇 · 네 방향 눈금, 손잡이는 금테 사파이어 구슬.
- **이모트(경기 중)**: 금테 흰 말풍선 칩.
- 저사양(.ar-lite): 바깥 그림자만 줄인다(모양 · 게이지는 그대로).

## 2. 그림 주문서 67 (`docs/asset-requests/runner/`)
- `build-67.mjs` → `67-pet-arena-buttons.txt` · `split/67-1 …` ~ `67-9 …` · `slice-map.csv`(35줄) · `CODEX_PROMPT_67.md` · README 21번.
- 시트 9장 · 그림 35장: 버튼 바탕 6(공격 · 필살기 · 회피 · 교체 · 스킬 · 이모트) · 겹침 3(누름 · 쿨타임 · 준비됨 빛) · 조이스틱 2 · 아이콘 4(칼 · 필살기 · 회피 · 교체) · 스킬 ① 아이콘 4(공격 · 강화 · 중독 · 지키기) · 스킬 ② 아이콘 16(8속성 × 2, `EL_SKILLS` id).
- 시트마다: ① Drive의 "SUMUS 펫 아레나 65 (Runner용)" · "SUMUS 펫 아레나 66 (Runner용)" 그림을 열어 그림체를 맞추라 ② "SUMUS 펫 아레나 67 (Runner용)"에 "67-1.png" … "67-9.png" 정확한 이름으로 저장하라. 글자 · 숫자는 그리지 않는다.
- **그림 파일만 넣으면 된다**: `build:assets`가 `ARENA_ART`에 적고, `arena.js` uiArt · setIco가 같은 자리를 그림으로 바꾼다(.art-bg · .art-ico). 없으면 CSS 버튼 그대로.

## 3. 혼자 판 렉
측정: `node docs/arena-perf.mjs --cpu 4|6 --seconds 60`(폰 390px · 배율 3 · 같은 조작 순서). 기계가 흔들려 옛 코드 · 새 코드를 **번갈아** 3번씩 돌렸다. 표는 PR에.

| 찾은 원인(Performance 기록) | 고친 것(모습은 같게) |
|---|---|
| 쉬는(투명) 칸 35개(탄 14 · 경고 6 · 장판 4 …)가 늘 will-change 레이어 → 매 프레임 레이어 정리(Layerize) · 커밋이 무거움 | 켜질 때만 레이어(.idle · :not(.on)) |
| 공격 · 맞는 자세 그림을 `src`로 바꿈 → 바꿀 때마다 디코드 · 그림자 필터 다시 그리기 | 자세 그림을 미리 겹쳐 두고 opacity만(제 레이어) |
| 잔상: 펫 칸 통째 `cloneNode` + blur 필터를 새로 그림 | 쪽마다 칸 하나를 다시 씀 |
| 필살기 컷인 펫 그림을 처음 필살기 때 innerHTML로 만들고 디코드 | 판 시작 때 만들어 디코드, 하나만 켬 |
| 효과 그림(그림 66) 첫 사용 때 디코드 | 카운트다운 동안 120ms마다 하나씩 `img.decode()` |
| 효과 조각마다 경기장 전체 `querySelectorAll` + SVG를 innerHTML로 다시 읽음(battle-fx) | 개수는 세어 두고(상한에 닿을 때만 다시 셈) SVG는 템플릿 복사 |
| 필살기 준비 box-shadow 무한 애니메이션 · 빔 clip-path/filter 애니메이션 · 버프 box-shadow 애니메이션 | opacity · scale만(빔 끝 밝아짐은 흰 덧칠 opacity) |
| 서 있는 펫 · 멈춘 칸도 매 프레임 같은 transform을 다시 씀 | 바뀔 때만(setTf) |
| 처음 뜨는 글자(한글 · 이모지) 모양 만들기 | 카운트다운 동안 보이지 않는 칸에 한 번 배치(contain:strict) |

## 4. 검사(`server/arena-check.mjs` V13.233)
- 경기 화면 CSS 애니메이션은 transform · opacity만(대기실 ar-lv-pick 빼고) · 필살기 준비 빛은 ::before.
- 쉬는 칸 will-change 없음 · 자세 그림은 겹친 칸 opacity · 잔상 cloneNode 금지 · 컷인 innerHTML 금지 · 미리 디코드 · battle-fx 조각 querySelectorAll 금지 · setTf · 쿨타임 rotate.
- 그림 67 이름(build-67.mjs)과 화면 코드(uiArt · setIco · CSS)가 맞는지.
- `server/yacha-fps-check.mjs`: 효과 조각 상한 문구를 새 세기 방식으로.

## 5. 렉 방지 점검(docs/performance-rules.md)
- 서버 · 상태 객체 · 요청은 바꾸지 않았다(화면만). 새 데이터 묶음 없음.
- `docs/arena-perf.mjs`: 같은 조작 순서(씨앗 난수) · FIGHT! 뒤만 따로(fight_*) · 시작 프레임(start_max) · `--slow` · `--trace-out` · `--samples` · `--layers` · `--shot-device`.
