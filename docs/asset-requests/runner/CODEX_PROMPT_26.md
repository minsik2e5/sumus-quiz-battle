# Codex 작업 지시: 그림 26 (단어 낚시 물고기 24종)

## 목표
SUMUS VOCA(저장소 `minsik2e5/sumus-quiz-battle`)의 그림 주문서 26으로 물고기 24종을 만들고, 잘라서 `public/assets/fish/`에 넣은 뒤 PR을 만든다.
지금 앱은 물고기를 코드 그림(`public/modules/fishing-art.js`)으로 그린다. 그림이 들어오면 `FISH_ART`에 키를 넣어 그림으로 바꾼다.

- 시트 **6장**(2×2, 물고기 4마리씩) = 24마리. 시트와 물고기 key는 `slice-map.csv`의 `list` 열이 `26-fishing.txt`인 줄을 본다.
- 모든 물고기는 **옆모습, 오른쪽을 본다.** 물, 낚싯줄, 글자, 숫자는 없다.
- 등급이 높을수록 크고 화려하다: 흔함(소박) → 보통(초록 빛 테두리) → 희귀(파란 빛) → 영웅(보라 오라) → 전설(금빛 오라 · 반짝이) → 특별(황금 알 물고기, 따뜻한 금빛 후광).

## 꼭 지킬 것
- **그리기 전에 Drive의 기존 그림을 열어 그림체를 맞춘다.**
  - Google Drive 폴더 "SUMUS 에셋 05·06 (Runner용)"의 `06-3.png`, `06-4.png`(이 앱의 반짝이는 3D 아이콘 그림체)
  - Google Drive 폴더 "SUMUS_PET_SPRITES_ALL_20261002/original_1254"의 `MONG/02_grown.png`(눈 · 외곽선 느낌)
  - 2번째 시트부터는 같은 폴더의 `26-1.png`를 열어 크기 · 외곽선 · 눈을 똑같이 맞춘다.
- **결과는 정해진 Drive 폴더 "SUMUS 낚시 26 (Runner용)"에 정확한 파일 이름 `26-1.png` ~ `26-6.png`로 저장한다.** 채팅에 보여 주는 것만으로는 안 된다(같은 이름이 있으면 바꿔 넣는다).
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다. 예: `codex/art-26`
  - 그 브랜치에 `docs/asset-requests/runner/26-fishing.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/zen-knuth-m0c31z`에서 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** **운영 Supabase에 연결하지 않는다.**
- `public/assets/fish/` 아래 새 그림, `DONE_26.md`, 빌드가 바꾸는 `public/sw.js` 말고는 고치지 않는다. 원본 시트 PNG는 커밋하지 않는다(`/tmp/art/`).

## 입력
- `docs/asset-requests/runner/split/26-1 …` ~ `26-6 …`: 시트 하나 = 프롬프트 하나(Drive 참고 그림 · 저장 위치가 이미 들어 있다).

## 1. 그림 만들기
- 2×2 시트 1024×1024, **투명 배경 PNG**.
- 점검: 투명 배경, 칸마다 물고기 하나, 오른쪽을 봄, 글자 · 숫자 없음, 주문서 설명(무늬 · 색)과 맞음, 96px로 줄여도 알아볼 수 있음. 통과 못하면 다시(시트마다 최대 4번).

## 2. 자르고 넣기 (256px 정사각형, 칸마다 같은 크기)
```
R=docs/asset-requests/runner
node $R/fit-assets.mjs <26-1> fish/minnow fish/chub fish/crucian fish/sardine --fit-each --preview /tmp/review/26-1.png
#   26-2 ~ 26-6도 같은 모양: 칸 순서대로 slice-map.csv의 app_file(fish/<key>)
```

## 3. 기록 · 점검 · PR
- `docs/asset-requests/runner/DONE_26.md`(한국어): 넣은 그림 표, 넣지 못한 것과 이유, 다시 만든 횟수, "눈으로 확인 필요".
- `npm ci && npm run build:assets && npm run check && npm run check:cloudflare`.
- PR 대상 `sumus-voca-prod-deploy`, 제목 `그림 26: 단어 낚시 물고기 24종`, 본문 한국어. 마지막 줄 `> ⚠️ 머지하면 운영에 바로 배포됩니다.` **머지하지 않는다.**
