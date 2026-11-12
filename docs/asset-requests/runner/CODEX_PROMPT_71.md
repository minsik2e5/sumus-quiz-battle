# Codex 작업 지시: 그림 71 (펫 아레나 전투 효과 재료 28장)

## 목표
펫 아레나 전투를 캔버스로 다시 그리는 계획(`docs/arena-battle-reboot-plan.md`)에 쓸 **효과 재료 텍스처 28장**을 만들어 넣고 PR을 만든다.
선생님 주문: "이 정도의 퀄이 나왔으면 해. 부드럽고." 프레임 애니메이션 시트가 아니라, 코드가 수십~수백 번 찍고 · 돌리고 · 키우고 · 색을 입혀 움직일 **재료 한 장씩**이다(연기 뭉치 1장 → 연기 구름, 불티 1장 → 불꽃 200개).

| 시트 | 내용(칸: 왼쪽 위 · 오른쪽 위 · 왼쪽 아래 · 오른쪽 아래) | 배경 | 넣는 곳(`public/assets/arena/`) |
|---|---|---|---|
| 71-1 | 부드러운 빛 원 · 별빛 십자 · 충격파 고리 · 방사 섬광 | 검정 | `mat-glow` · `mat-star` · `mat-ring` · `mat-burst` |
| 71-2 | 불꽃 혀 · 불티 · 번개 줄기(가로) · 불꽃 줄(가로) | 검정 | `mat-flame` · `mat-ember` · `mat-bolt` · `mat-streak` |
| 71-3 | 물방울 · 물보라 · 얼음 조각 · 서리 반짝 | 검정 | `mat-drop` · `mat-splash` · `mat-shard` · `mat-frost` |
| 71-4 | 바위 파편 A · 바위 파편 B · 흙덩이 · 작은 돌 무더기 | 검정 | `mat-rock-a` · `mat-rock-b` · `mat-clod` · `mat-pebbles` |
| 71-5 | 연기 뭉치 · 흙먼지 · 속도선(가로) · 바람 소용돌이 (흰 · 회색만) | 검정 | `mat-smoke` · `mat-dust` · `mat-speed` · `mat-swirl` |
| 71-6 | 잎 · 꽃잎 · 독 거품 · 별가루 | 검정 | `mat-leaf` · `mat-petal` · `mat-bubble` · `mat-stardust` |
| 71-7 | 방사형 금 · 긴 금(가로) · 그을음 · 구덩이 테 | **흰색** | `mat-crack-star` · `mat-crack-line` · `mat-scorch` · `mat-crater` |

### 배경과 처리 방법(자를 때 `slice-71.mjs`가 알아서 한다)
| 처리 | 재료 | 그림 | 게임에서 |
|---|---|---|---|
| `add` | 빛 · 별빛 · 고리 · 섬광 · 불꽃 · 불티 · 번개 · 불꽃 줄 · 서리 반짝 · 별가루 | 검은 배경 위 빛나는 것 | 더하기 섞기 → 검정은 안 보임. **오려 내지 않는다** |
| `luma` | 연기 · 흙먼지 · 속도선 · 바람 소용돌이 | 검은 배경 위 **흰 · 회색만** | 자를 때 밝기 → 투명도, 게임이 속성 색을 입힘 |
| `key` | 물방울 · 물보라 · 얼음 조각 · 바위 2 · 흙덩이 · 돌 무더기 · 잎 · 꽃잎 · 독 거품 | 검은 배경 위 단단한 물체(물체 안에 새까만 색 없음) | 자를 때 검은 배경만 투명으로 |
| `mul` | 금 2 · 그을음 · 구덩이 | **흰 배경** 위 어두운 자국 | 곱하기 섞기로 바닥에 구움 → 흰색은 바닥을 안 바꾸고 어두운 곳만 어둡게 |

**그림 파일만 넣으면 된다.** `npm run build:assets`가 `public/modules/arena-art.js`(`ARENA_ART`)에 `mat-…` 이름을 적고, 시험 페이지(`/proto/arena-fx.html`)의 같은 이름 재료 칸이 코드 그림에서 이 그림으로 바뀐다. 앱 코드는 고치지 않는다.

## 꼭 지킬 것
- **PR까지만 만든다. 머지하지 않는다.** `sumus-voca-prod-deploy`에 머지하면 운영에 바로 배포된다. **운영 Supabase에 연결하지 않는다.**
- **그림은 Codex에 내장된 그림 생성 기능으로 만든다.** OpenAI API 키(`OPENAI_API_KEY`)나 유료 API를 쓰지 않는다. 키가 없다고 멈추지 않는다.
- **Google Drive는 쓰지 않는다. 멈추지 않는다.** 아래 "프롬프트 손보기"대로 Drive 문구를 지우고 저장소 안의 기존 그림을 참고 그림으로 붙인다.
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다(예: `codex/art-71-arena-fx-materials`).
- 고치는 파일: 위 표의 그림 28장, `docs/asset-requests/runner/DONE_71.md`, 빌드가 바꾸는 `public/sw.js` · `public/modules/arena-art.js`. 그 밖의 앱 코드, 게임 규칙, 코인, 서버 로직, 점검 파일은 건드리지 않는다. 버전은 올리지 않는다.
- 원본 PNG는 커밋하지 않는다(`/tmp/art/`). 기존 그림 파일은 지우거나 덮어쓰지 않는다. **새 파일만 추가**한다.
- 그림에 **글자 · 숫자 · 로고가 없다.** 펫 · 캐릭터 · 생물을 그리지 않는다. **다른 게임 · 만화 · 영화의 효과 · 캐릭터 · 생김새를 따라 하지 않는다**(참고 영상은 연출 기법만 참고했고 그림은 참고하지 않는다).
- 검은 배경 시트(71-1 ~ 71-6)는 **진짜 #000 검정**, 71-7은 **진짜 #FFF 흰색**. 체크무늬 · 투명 배경 · 무늬 · 비네팅이 있으면 다시 만든다.

## 입력 (저장소 안, `docs/asset-requests/runner/`)
- `split/71-1 …` ~ `71-7 …`: 시트 하나 = 프롬프트 하나. 묶음 전체는 `71-arena-fx-materials.txt`, 파일 자리는 `slice-map.csv`(`list` 열이 `71-arena-fx-materials.txt`). 프롬프트는 `build-71.mjs`가 만든다(손으로 고치지 말고 그 파일을 고쳐 다시 돌린다).
- 시트는 서로 따로 돌려도 된다. 71-1 → 71-2 순서로 먼저 돌리면 빛 · 불의 색이 잘 맞는다.

### 프롬프트 손보기 (Drive 대신 참고 그림 첨부)
주문서는 그림 GPT가 Google Drive를 여는 방식으로 쓰여 있다(Drive의 기존 그림 — 폴더 "SUMUS 펫 아레나 66 (Runner용)"의 "66-1.png" · "66-2.png" · "66-3.png", 폴더 "SUMUS 펫 아레나 65 (Runner용)"의 "65-2.png", 폴더 "SUMUS 전설 펫 07 (Runner용)"의 "07a-1.png" — 을 열어 그림체를 맞추고, 정해진 Drive 폴더 "SUMUS 펫 아레나 71 (Runner용)"에 정확한 파일 이름 "71-1.png" … "71-7.png"로 저장). Codex는 Drive를 쓰지 않으니 보내기 전에 이렇게 바꾼다.
1. 다음으로 **시작하는 줄을 지운다**: `STYLE REFERENCE`, `WHEN DONE`
2. 아래 참고 그림을 같이 보여 주고, 프롬프트 **세 번째 줄**에 이 문장을 넣는다:
   `REFERENCE IMAGES ARE ATTACHED: match their art style, rendering quality, crisp clean edges, lighting and colors exactly. Keep the background of this sheet exactly as instructed (pure black, or pure white for 71-7), NOT like the references. Do NOT copy or resemble any cartoon, anime, game or movie character, logo or effect.`

### 참고 그림 (`public/assets/` 아래 경로)
| 시트 | 참고 그림 |
|---|---|
| 모든 시트 | `arena/fx-flame-breath.webp` · `arena/fx-lightning.webp` · `arena/fx-crit.webp` · `arena/fx-meteor.webp`(66번 효과 그림체) · `pets/dragon-3.webp` · `pets/tiger-3.webp`(효과가 놓일 펫 그림체) |
| 71-4 · 71-7 | + `arena/bg-plaza.webp` · `arena/fx-crack-field.webp`(돌 · 흙 · 금 색이 바닥과 맞게) |
| 71-3 · 71-6 | + `arena/fx-water-jet.webp` · `arena/fx-ice-spear.webp` · `arena/fx-petal-field.webp` · `arena/fx-poison-cloud.webp` |

### 후보 점검 (모두 통과해야 쓴다)
1. 크기 1024×1024, 2×2. 배경이 지시대로 순수 검정(71-7은 순수 흰색)이고 칸마다 재료가 **하나씩** 떨어져 있다. 글자 · 숫자 · 로고가 없다.
2. `node docs/asset-requests/runner/slice-71.mjs /tmp/art/71-N.png --preview /tmp/art/71-N-check.png`가 ⚠️ 없이 끝난다(⚠️ "칸 가장자리 밝기" = 배경이 순수하지 않거나 이웃 칸이 묻음 → 다시 그린다).
3. 미리보기(풀밭 위에 게임과 같은 섞기로 올린 그림)에서: 빛 재료는 검은 테 없이 빛나고, 물체 재료는 검은 테두리 찌꺼기가 없고, 자국은 바닥이 자연스럽게 어두워진다.
4. 48px로 줄여도 무엇인지 알아본다. 가로 재료(번개 줄기 · 불꽃 줄 · 속도선 · 긴 금)는 왼쪽에서 오른쪽으로 길게 누워 있다.
5. 화려하지만 귀엽다. 무섭거나 징그럽지 않다.

이미지를 볼 수 있으면 눈으로 확인한다. 볼 수 없으면 1 · 2번만 확인하고 PR에 "눈으로 확인 필요"라고 적는다.

## 넣기
```
npm i --no-save sharp   # 없으면
for n in 1 2 3 4 5 6 7; do node docs/asset-requests/runner/slice-71.mjs /tmp/art/71-$n.png --preview /tmp/art/71-$n-check.png; done
```
재료 한 장 20KB 이하, 28장 합계 350KB 이하(넘으면 그 시트만 `--quality 70`으로 다시).

## 점검
```
npm ci
npm run build:assets      # public/modules/arena-art.js의 ARENA_ART에 mat-glow … 가 적힌다
npm run check             # release-check 전부 PASS
npm run check:cloudflare
```
- 점검이 실패하면 점검 파일을 고치지 말고 PR에 실패 메시지를 그대로 적는다.
- 기존 그림의 `D`(삭제) · `M`(수정)이 없어야 한다: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`
- `docs/asset-requests/runner/DONE_71.md`(한국어): 넣은 재료 28장(경로 · 크기 · 처리 방법 · 용량), 다시 만든 횟수, "눈으로 확인 필요"(테스트 앱 `/proto/arena-fx.html`에서 연기 · 불꽃 · 번개 · 금이 그림으로 바뀌었는지, 왼쪽 위 글자 "재료 그림 N/28").
- PR 제목 `그림 71: 펫 아레나 전투 효과 재료 28장`, 본문 한국어. 미리보기 7장을 한 장에 모아 작게 PR 코멘트로 올린다. 마지막 줄: `> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.`
