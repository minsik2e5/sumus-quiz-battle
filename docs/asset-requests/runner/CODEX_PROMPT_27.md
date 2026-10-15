# Codex 작업 지시: 그림 27 (낚시 손맛 업그레이드 · 16시트)

## 목표
놀이터(오락실)에 들어갈 **손맛 낚시**(텐션 게이지 + 좌우 연타 파이팅)에 쓸 그림을 만들고, 잘라서 `public/assets/fishing/` · `public/assets/fish/`에 넣은 뒤 PR을 만든다. **그림 파일만 넣는다. 앱 코드는 고치지 않는다**(화면 연결은 Claude가 한다).

| 묶음 | 시트 | 내용 | 넣는 곳 |
|---|---|---|---|
| 27a 배경 | 3 | 바다 위(세로) · 물속(세로) · 놀이터 낚시터 입구(가로) | `fishing/bg-sea` · `bg-under` · `bg-entry` |
| 27b 낚인 물고기 | 6 | 물고기 24종이 줄에 매달려 올라온 모습(뽑기 공개 장면) | `fish/<key>-hang` |
| 27c 도구 · 조작 · 재화 · 효과 | 7 | 낚싯대 3단계 · 릴, 찌 · 바늘 · 줄 끊김, 미끼 4단계, 좌 · 우 · 릴 · 던지기 버튼, 게이지 틀, 미끼 통 · 진주 · 어망 · 교환소, 첨벙 · 물결 · 퍼펙트 · 별 | `fishing/<이름>` |

시트와 칸마다 넣을 파일은 `slice-map.csv`에서 `list` 열이 `27a-` · `27b-` · `27c-`로 시작하는 줄을 본다.

## 꼭 지킬 것
- **그리기 전에 Drive의 기존 그림을 열어 그림체를 맞춘다.**
  - 아이콘 · 도구: Google Drive 폴더 "SUMUS 에셋 05·06 (Runner용)"의 `06-3.png` · `06-4.png`
  - 배경: 펫 폴더 "SUMUS_PET_SPRITES_ALL_20261002/original_1254"(MONG · NABI · PINKY · BAMBOO의 03_final)와 "SUMUS 전투 배경 15 (Runner용)"의 `15-1.png`
  - 27b 낚인 물고기: **같은 번호의 26 시트**(Drive 폴더 "SUMUS 낚시 26 (Runner용)"의 `26-1.png` ~ `26-6.png`)를 열어 물고기 디자인을 그대로 둔다. 바뀌는 것은 자세뿐이다.
  - 27c 2번째 시트부터는 같은 폴더의 `27c-1.png`를 열어 마감 · 외곽선 · 색을 맞춘다.
- **결과는 정해진 Drive 폴더 "SUMUS 낚시 27 (Runner용)"에 정확한 파일 이름(`27a-1.png` ~ `27a-3.png`, `27b-1.png` ~ `27b-6.png`, `27c-1.png` ~ `27c-7.png`)으로 저장한다.** 채팅에 보여 주는 것만으로는 안 된다(같은 이름이 있으면 바꿔 넣는다).
- **순서: 26(물고기 옆모습)을 먼저 끝낸다** → 27b → 27a → 27c. 27b는 26이 Drive에 있어야 맞출 수 있다.
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다. 예: `codex/art-27`. 그 브랜치에 `docs/asset-requests/runner/27c-fishing-gear-ui.txt`가 없으면 `claude/zen-knuth-m0c31z`에서 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** **운영 Supabase에 연결하지 않는다.** Codex 내장 그림 생성 기능으로 만들고 유료 API를 쓰지 않는다.
- `public/assets/fishing/`, `public/assets/fish/` 아래 새 그림, `DONE_27.md`, 빌드가 바꾸는 `public/sw.js` 말고는 고치지 않는다. 원본 시트 PNG는 커밋하지 않는다(`/tmp/art/`).

## 입력
- `docs/asset-requests/runner/split/27a-1 …` ~ `27c-7 …`: 시트 하나 = 프롬프트 하나(Drive 참고 그림 · 저장 위치가 이미 들어 있다).

## 1. 그림 만들기
- 27b · 27c: 2×2 시트 1024×1024, **투명 배경 PNG**. 27a: 배경 한 장(세로 1024×1536 두 장, 가로 1536×1024 한 장), 투명 아님.
- 점검: 글자 · 숫자 없음, 칸마다 하나, 27b는 26과 같은 물고기(무늬 · 색 · 지느러미)로 머리가 위 · 줄이 위로, 27c 버튼은 96px로 줄여도 화살표가 보인다. 통과 못하면 다시(시트마다 최대 4번).

## 2. 자르고 넣기
```
R=docs/asset-requests/runner
# 27b: 물고기마다 같은 크기(256px), 작은 그림 96px도
node $R/fit-assets.mjs <27b-1> fish/minnow-hang fish/chub-hang fish/crucian-hang fish/sardine-hang --fit-each --small 96 --preview /tmp/review/27b-1.png
# 27c: 칸 순서대로 slice-map.csv의 app_file (예: 27c-1)
node $R/fit-assets.mjs <27c-1> fishing/rod fishing/rod-bend1 fishing/rod-bend2 fishing/reel --fit-each --preview /tmp/review/27c-1.png
# 27a: 세로 배경은 720×1080, 가로는 1280px, webp 200KB 이하
```

## 3. 기록 · 점검 · PR
- `docs/asset-requests/runner/DONE_27.md`(한국어): 넣은 그림 표, 넣지 못한 것과 이유, 다시 만든 횟수, "눈으로 확인 필요".
- `npm ci && npm run build:assets && npm run check && npm run check:cloudflare`.
- PR 대상 `sumus-voca-prod-deploy`, 제목 `그림 27: 낚시 손맛 업그레이드`, 본문 한국어, 미리보기를 한 장으로 합쳐 코멘트. 마지막 줄 `> ⚠️ 머지하면 운영에 바로 배포됩니다.` **머지하지 않는다.**
