# Codex 작업 지시: 그림 25 (칭호 메달 2탄 40개)

## 목표
SUMUS VOCA(저장소 `minsik2e5/sumus-quiz-battle`)의 그림 주문서 25로 새 칭호 메달 40개를 만들고, 잘라서 `public/assets/titles/`에 넣은 뒤 PR을 만든다.
**그림 파일만 넣는다. 앱 코드는 고치지 않는다**(칭호 등록·조건은 Claude가 따로 한다).

- 시트 **10장**(2×2, 메달 4개씩) = 메달 40개. 시트와 메달 key는 `slice-map.csv`의 `list` 열이 `25-titles-2.txt`인 줄을 본다.
- 메달 테두리는 **등급마다 정해진 모양**이다(기존 칭호와 똑같이). 일반 = 민트 둥근 메달, 희귀 = 파란 육각형, 영웅 = 보라 방패, 전설 = 금색 햇살 둥근 메달, 한정 = 무지개 테두리 남색 메달.
- 메달 안에는 **글자와 숫자가 없다.**

## 꼭 지킬 것
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다. 예: `codex/art-25`
  - 그 브랜치에 `docs/asset-requests/runner/25-titles-2.txt`가 없으면 주문서 PR이 아직 머지되지 않은 것이다. 그때는 `claude/zealous-franklin-9qhw79`에서 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** **운영 Supabase에 연결하지 않는다.**
- **Codex 내장 그림 생성 기능**으로 만든다. API 키나 유료 API를 쓰지 않는다.
- `public/assets/titles/` 아래 새 그림, `DONE_25.md`, 빌드가 바꾸는 `public/sw.js` 말고는 고치지 않는다. 기존 칭호 그림은 지우거나 덮어쓰지 않는다.
- 원본 시트 PNG는 커밋하지 않는다(`/tmp/art/`).

## 입력
- `docs/asset-requests/runner/split/25-1 …` ~ `25-10 …`: 시트 하나 = 프롬프트 하나.
- 프롬프트 손보기: `STYLE REFERENCE`, `Also open`, `WHEN DONE`으로 시작하는 줄을 지우고, 세 번째 줄에 넣는다:
  `REFERENCE IMAGES ARE ATTACHED: match their medal frames, size, metal finish, enamel colors and lighting exactly; a medal of the same tier must have exactly the same frame. Do NOT copy the pictures in the middle of the references.`
- 참고 그림(`public/assets/titles/`): 일반 `rookie.webp`, 희귀 `words500.webp`, 영웅 `words1000.webp`, 전설 `words3000.webp`, 한정 `weekly1.webp`. 시트에 나오는 등급의 그림만 첨부한다. 2번째 시트부터는 이미 만든 `25-1` 결과도 같이 첨부한다.

## 1. 그림 만들기
- 2×2 시트 1024×1024, **투명 배경 PNG**, `/tmp/art/25-<번호>.png`.
- 점검: 투명 배경, 칸마다 메달 하나, 글자·숫자 없음, **같은 등급 메달의 테두리가 참고 그림과 같다**, 가운데 그림이 주문서 설명과 맞고 48px로 줄여도 알아볼 수 있다. 통과 못하면 다시(시트마다 최대 4번).

## 2. 자르고 넣기 (큰 그림 256px + 작은 그림 96px, 23c와 같은 방식)
```
R=docs/asset-requests/runner
node $R/fit-assets.mjs <25-1> titles/away1 titles/egg10 titles/unit1 titles/fix50 --fit-each --small 96 --preview /tmp/review/25-1.png
#   25-2 ~ 25-10도 같은 모양: 칸 순서대로 slice-map.csv의 app_file(titles/<key>)
```

## 3. 기록 · 점검 · PR
- `docs/asset-requests/runner/DONE_25.md`(한국어): 넣은 메달 표, 넣지 못한 것과 이유, 다시 만든 횟수, "눈으로 확인 필요".
- `npm ci && npm run build:assets && npm run check && npm run check:cloudflare`. 실패하면 점검 파일을 고치지 말고 PR에 그대로 적는다.
- 바뀐 파일은 `public/assets/titles/`(새 파일만), `public/sw.js`, `DONE_25.md`뿐: `git diff --name-status origin/sumus-voca-prod-deploy -- public/assets`에 `D`·`M`이 없어야 한다.
- PR 대상 `sumus-voca-prod-deploy`, 제목 `그림 25: 칭호 메달 2탄 40개`, 본문 한국어, 미리보기를 한 장으로 합쳐 코멘트. 마지막 줄 `> ⚠️ 머지하면 운영에 바로 배포됩니다.` **머지하지 않는다.**
