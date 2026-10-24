# 그림 주문서 36 완료 기록

- 작업 브랜치: `codex/art-36`
- 기준 브랜치: `sumus-voca-prod-deploy`
- 제작: Codex 내장 imagegen. OpenAI API·Google Drive 사용 없음.
- 운영 Supabase 연결 없음. Cloudflare 검사는 저장소의 fetch 모의 응답을 사용한다.
- 원본 37장: `/tmp/art/36a-1.png` ~ `36d-1.png` (Windows: `C:/tmp/art/`). 원본 PNG는 커밋하지 않는다.
- 저장소 split 프롬프트의 Drive 지시 줄을 제거하고 지정 문장을 세 번째 줄에 추가했다. 기존 펫 4종과 각 단계의 새 그림, 기존 코끼리 전투 그림, 기존 칭호 2종을 직접 열고 참고 이미지로 첨부했다.

## 넣은 그림

| key | 이름 | 기본 | 표정 | 알 반응 | 전투 | 작은 그림 | 합계 |
|---|---|---:|---:|---:|---:|---:|---:|
| mouse | 찍찍이 | 4 | 12 | 2 | 6 | 4 | 28 |
| calf | 음매 | 4 | 12 | 2 | 6 | 4 | 28 |
| tiger | 어흥 | 4 | 12 | 2 | 6 | 4 | 28 |
| pony | 다그닥 | 4 | 12 | 2 | 6 | 4 | 28 |
| monkey | 끼끼 | 4 | 12 | 2 | 6 | 4 | 28 |
| rooster | 꼬꼬 | 4 | 12 | 2 | 6 | 4 | 28 |

- 펫 168개 + `titles/zodiac12.webp` 및 `titles/zodiac12-s.webp` 2개 = 앱용 170개.
- 메달은 36d-1 왼쪽 위 시안을 선택했다.
- PR 검토용 합본: `public/assets/reviews/art-36.webp` (원본 시트가 아닌 분할 결과 미리보기).
- 기본·표정·알 반응·전투: 512×512. 펫 작은 그림: 160×160. 메달: 256×256 및 96×96.
- 모든 파일은 저장소 fit-assets.mjs / fit-sheets.mjs로 분할·정렬했다.

## 넣지 못한 그림

없음. 37장 분할과 앱용 파일 170개를 모두 넣었다.

## 시트별 다시 만든 횟수

| 시트 | 재생성 | 이유 |
|---|---:|---|
| 36a-1 | 0 | 첫 시안 사용 |
| 36a-2 | 0 | 첫 시안 사용 |
| 36a-3 | 1 | 최종 단계 바위 여백 보완 |
| 36a-4 | 1 | 말의 주둥이·발굽 형태 보완 |
| 36a-5 | 0 | 첫 시안 사용 |
| 36a-6 | 0 | 첫 시안 사용 |
| 36b-1~2 | 각 0 | 첫 시안 사용 |
| 36b-3 | 1 | 밥그릇의 캐릭터 연상 무늬 제거 |
| 36b-4~14, 36b-16~21 | 각 0 | 첫 시안 사용 |
| 36b-15 | 1 | 꽃 덩굴 소품 유지 |
| 36c-1 | 1 | 음매의 젖병 유지 |
| 36c-2 | 1 | 찍찍이의 연필 유지 |
| 36c-3 | 1 | 치즈 받침 유지 |
| 36c-4 | 0 | 첫 시안 사용 |
| 36c-5 | 1 | 칸 사이 효과 겹침 방지 |
| 36c-6 | 1 | 바위와 소나무 유지 |
| 36c-7 | 1 | 던진 바나나의 칸 분류 보완 |
| 36c-8 | 1 | 던진 바나나의 위치 보완 |
| 36c-9 | 3 | 꽃 덩굴·황금 복숭아 유지, 덩굴 끝 잘림과 바나나 칸 위치 보완 |
| 36d-1 | 0 | 첫 시안 사용 |

## 점검

- `npm ci`: 완료. 이 환경에는 npm 명령이 없어 작업용 폴더에 npm 실행기를 설치하고 `node ../node_modules/npm/bin/npm-cli.js`로 실행했다. 저장소 package.json·잠금 파일 변경 없음.
- `npm run build:assets`: PASS. content-validation 및 browser-syntax PASS.
- 앱용 170개: 파일 존재·지정 크기·네 모서리 alpha 0·빈 그림 없음 PASS.
- 기존 `public/assets` 그림 수정·삭제 없음.
- `npm run check`: FAIL. 검사 파일을 수정하지 않았다.

```text
Error: [release-check] FAIL · V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent
    at assert (server/release-check.mjs:58:25)
    at runBattleChecks (server/battle-check.mjs:325:5)
    at Module.runReleaseCheck (server/release-check.mjs:1494:5)
```

- `npm run check:cloudflare`: 종료 코드 0. 아래 모의 동기화 로그 후 종료했으나 전체 PASS 배너가 없어 전체 검사 완료로 단정하지 않는다. 운영 접속은 없었다.

```text
[supabase-sync] revision moved; re-uploading local snapshot { expected: 42, remote: 43 }
```

## 눈으로 확인 필요

- 생성 시트와 분할 미리보기를 직접 열어 색·무늬·성장 단계·표정·전투 방향·잘림 여부를 확인했다.
- 머지 전 게임 화면에서 단계별 기본↔표정↔전투 전환 시 실제 표시 크기와 소품 위치를 최종 확인하면 좋다.
- 최종 검토에서 발견한 소품 누락(연필·젖병·치즈 받침·소나무와 바위·꽃 덩굴)과 분리 효과 위치를 재생성으로 보완했다.

## 빌드 뒤 앱에 나오는 펫

`PET_ART`와 `PET_FIGHT` 모두에 `mouse`, `calf`, `tiger`, `pony`, `monkey`, `rooster`가 포함됐다. `PET_TITLE_ART`에는 `zodiac12`가 포함됐다. 앱의 기능·펫 등록 코드는 변경하지 않았다.

> ⚠️ 머지하면 운영에 바로 배포되고, 그림이 다 들어온 펫이 바로 학생들에게 나옵니다.
