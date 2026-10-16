# Codex 작업 지시: 그림 31 (낚싯대 강화 · 8시트)

## 목표
놀이터 **손맛 낚시**에 **낚싯대 강화(1~5단계)**를 넣는다. 단계마다 바뀌는 1인칭 낚싯대 · 릴, 메뉴 아이콘, 강화 연출, 강화 화면 배경을 만들어 `public/assets/fishing/`에 넣고 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다**(강화 화면 연결은 Claude가 한다).

| 묶음 | 시트 | 내용 | 넣는 곳 |
|---|---|---|---|
| 31a 1인칭 낚싯대 2~5단계 | 4 | 단계마다 곧음 · 왼쪽 휨 · 오른쪽 휨 · 앞으로 크게 휨(2 은빛 · 3 황금 · 4 보석 · 5 전설) | `fishing/pov-rod*-t2` ~ `-t5` |
| 31b 릴 몸통 2~5단계 | 1 | 손잡이 없는 릴 몸통 4개 | `fishing/pov-reel-t2` ~ `-t5` |
| 31c 아이콘 · 강화 연출 | 2 | 낚싯대 아이콘 1~4단계 / 5단계 아이콘 · 강화 성공 빛 · 강화 망치 · 단계 도장 틀 | `fishing/icon-rod-1` ~ `-5`, `fx-upgrade`, `fx-hammer`, `stamp-tier` |
| 31d 배경 | 1 | 낚시 가게 강화 작업대(세로) | `fishing/bg-forge` |

시트와 칸마다 넣을 파일은 `slice-map.csv`에서 `list` 열이 `31a-` ~ `31d-`로 시작하는 줄을 본다.

## 꼭 지킬 것
- **그리기 전에 Drive의 기존 그림을 열어 그림체를 맞춘다.**
  - 낚싯대 · 릴: Google Drive 폴더 "SUMUS 낚시 29 (Runner용)"의 `29b-1.png`(1인칭 낚싯대 4자세) · `29b-2.png`(릴). **모양 · 길이 · 시점 · 휨 · 손잡이 위치와 크기를 그대로** 두고 재질 · 색 · 장식만 바꾼다(게임이 기본 낚싯대와 갈아 끼운다). 손 · 팔 · 사람은 그리지 않는다.
  - 아이콘 · 효과: "SUMUS 낚시 27 (Runner용)"의 `27c-1.png` · `27c-7.png`. 31c-2는 같은 폴더(31)의 `31c-1.png`를 열어 마감 · 외곽선 · 색을 맞춘다.
  - 배경: 펫 폴더 "SUMUS_PET_SPRITES_ALL_20261002/original_1254"(MONG · NABI · PINKY · BAMBOO의 03_final)와 "SUMUS 낚시 29 (Runner용)"의 `29a-2.png` · `29a-3.png`.
  - 단계가 올라갈수록 한눈에 더 좋아 보여야 한다: 1 민트 · 흰색(기본) → 2 은빛 → 3 황금 → 4 보석 → 5 전설(진주빛 무지개 · 별 · 은은한 빛).
  - 강화 성공 빛과 단계 도장 틀은 **가운데를 비운다**(게임이 낚싯대와 숫자를 넣는다).
- **결과는 정해진 Drive 폴더 "SUMUS 낚시 31 (Runner용)"에 정확한 파일 이름(`31a-1.png` ~ `31a-4.png`, `31b-1.png`, `31c-1.png` · `31c-2.png`, `31d-1.png`)으로 저장한다.**
  - 채팅에 보여 주는 것만으로는 안 된다.
  - 같은 이름이 있으면 바꿔 넣는다.
  - 폴더가 없으면 만든다.
- 순서: 31a-1(은빛 · 기준) → 31a-2 ~ 31a-4 → 31b-1 → 31c-1 → 31c-2 → 31d-1.
- **브랜치:**
  - `origin/claude/rod-upgrade`에서 새로 만든다. 예: `codex/art-31`.
  - PR 대상도 `claude/rod-upgrade`. **`sumus-voca-prod-deploy`로 PR을 만들지 않는다**(운영에 바로 배포된다).
- **PR까지만 만든다. 머지하지 않는다.**
- **운영 Supabase에 연결하지 않는다.**
- Codex 내장 그림 생성 기능으로 만들고, 유료 API를 쓰지 않는다.
- `public/assets/fishing/` 아래 새 그림, `DONE_31.md`, 빌드가 바꾸는 `public/sw.js` 말고는 고치지 않는다.
- 원본 시트 PNG는 커밋하지 않는다(`/tmp/art/`). 미리보기 PNG도 `public/`에 넣지 않는다(PR 코멘트로만).

## 입력
- `docs/asset-requests/runner/split/31a-1 …` ~ `31d-1 …`: 시트 하나에 프롬프트 하나(Drive 참고 그림 · 저장 위치가 이미 들어 있다).

## 1. 그림 만들기
- 31a ~ 31c: 2×2 시트 1024×1024, **투명 배경 PNG**.
- 31d: 세로 배경 1024×1536, 투명 아님.
- 점검. 통과 못하면 다시 만든다(시트마다 최대 4번).
  - 글자 · 숫자가 없다.
  - 한 칸에 하나만 있다.
  - 31a: 4자세의 손잡이 위치 · 크기가 서로 같고, **29b-1의 기본 낚싯대와도 같다**(겹쳐 보면 손잡이가 맞는다).
  - 31b: 4개 모두 축 뚜껑이 칸 정중앙에 있고 크기가 같다. 손잡이(크랭크)는 그리지 않는다.
  - 31c-1 · 31c-2의 낚싯대 아이콘 5개는 같은 각도 · 같은 크기다.
  - 31d는 가운데(높이 18%~78%)가 조용하고, 아래 20%는 버튼을 올릴 만큼 단순하다.
  - 96px로 줄여도 단계 차이와 아이콘이 알아보인다.

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
# 31a: 29b와 똑같이 자른다. 코르크 손잡이 중심을 칸마다 (256,408)에 맞춰 평행 이동한 뒤, 512px 칸을 그대로 384px로 줄인다(칸별 크기 맞춤 없음).
#      결과를 public/assets/fishing/pov-rod.webp와 겹쳐 손잡이가 맞는지 본다.
#      칸 순서: pov-rod-tN · pov-rod-left-tN · pov-rod-right-tN · pov-rod-deep-tN (N = 2, 3, 4, 5)
# 31b: 축 뚜껑 중심을 기준으로 정사각형에 넣어 384px(pov-reel.webp와 같은 크기 · 같은 위치)
# 31c: 칸 순서대로 slice-map.csv의 app_file
node $R/fit-assets.mjs <31c-1> fishing/icon-rod-1 fishing/icon-rod-2 fishing/icon-rod-3 fishing/icon-rod-4 --fit-each --size 384 --preview /tmp/review/31c-1.png
node $R/fit-assets.mjs <31c-2> fishing/icon-rod-5 fishing/fx-upgrade fishing/fx-hammer fishing/stamp-tier --fit-each --size 384 --preview /tmp/review/31c-2.png
# 31d: 세로 배경은 720×1080 webp, 200KB 이하 → public/assets/fishing/bg-forge.webp
```

## 3. 기록 · 점검 · PR
- `docs/asset-requests/runner/DONE_31.md`(한국어): 넣은 그림 표, 넣지 못한 것과 이유, 다시 만든 횟수, 손잡이 · 축 맞춘 방법, "눈으로 확인 필요".
- `npm ci && npm run build:assets && npm run check && npm run check:cloudflare`.
- PR:
  - 대상 `claude/rod-upgrade`, 제목 `그림 31: 낚싯대 강화(1~5단계)`, 본문 한국어
  - 미리보기를 한 장으로 합쳐 코멘트(단계별 낚싯대를 나란히 · 기본 낚싯대와 겹친 그림 포함)
  - **머지하지 않는다.**
