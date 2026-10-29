# 그림 54 작업 완료 기록

- 작업 브랜치: `codex/art-54`
- PR 기준: `claude/bug-dino-pets-plan` (`sumus-voca-prod-deploy`에 54a 주문서가 아직 없음).
- 생성: Codex 내장 이미지 생성 기능. 유료 API·API 키·Google Drive 사용 없음.
- 프롬프트: `split/54*.txt`의 STYLE REFERENCE / CHARACTER REFERENCE / Also open / WHEN DONE 시작 줄을 제외하고, 세 번째 줄에 CODEX_PROMPT_54.md의 첨부 참고 문장을 삽입했다. 설정은 기존 펫 4종, 표정·알 반응은 새 기본 그림, 전투는 새 기본 그림과 elephant-2-attack/hurt를 참고했다. 재생성 때 해부학·아기 날개·여백·얼굴 보존 조건을 강조했다.
- 시트마다 따로 생성했다. 설정 54a → 표정·알 반응 54b → 전투 54c 순서이며, 설정을 자른 뒤 다음 단계의 참고 그림으로 사용했다.
- 생성 원본은 저장소 밖 작업 폴더에 보관했다. 1024×1024 투명 PNG로 정규화하고, 자르기 도구와 동일하게 alpha 8 이하의 희미한 배경 픽셀을 제외했다. 불투명 배경 제거로 투명한 척한 그림은 없다.
- 원본 시트 PNG는 커밋하지 않았다. 앱 코드·버전·규칙·코인·확률·서버·검사 파일은 변경하지 않았다. 운영 Supabase 연결 및 머지 없음.

## 넣은 그림

| 펫 key | 이름 | 기본 | 표정 | 알 반응 | 전투 | 작은 그림 | 합계 |
|---|---|---:|---:|---:|---:|---:|---:|
| ladybug | 점순이 | 4 | 12 | 2 | 6 | 4 | 28 |
| bee | 붕붕이 | 4 | 12 | 2 | 6 | 4 | 28 |
| ant | 영차 | 4 | 12 | 2 | 6 | 4 | 28 |
| firefly | 반짝이 | 4 | 12 | 2 | 6 | 4 | 28 |
| rhinobeetle | 장수 | 4 | 12 | 2 | 6 | 4 | 28 |
| butterfly | 나풀 | 4 | 12 | 2 | 6 | 4 | 28 |
| 합계 | | 24 | 72 | 12 | 36 | 24 | 168 |

- 경로: `public/assets/pets/`. 파일명은 주문서의 36개 자르기 명령 및 `slice-map.csv`의 54a/b/c 매핑과 같다.
- 기본·표정·알 반응·전투 144개: 투명 WebP 512×512.
- 작은 그림 24개: 투명 WebP 160×160, contain.
- PR 코멘트용 작은 전체 합성 미리보기 1개: `public/assets/previews/art-54.webp`. 개별 원본 시트가 아닌 36개 검토용 미리보기의 축소 합성이다.
- 빌드가 갱신한 파일: `public/modules/pet-art.js`, `public/sw.js`.

## 넣지 못한 그림

없음. 36시트 / 펫 그림 168개 모두 추가했다.

## 시트별 다시 만든 횟수

첫 생성은 횟수에 포함하지 않는다. 최대 4회 제한 이내이며, 총 생성 호출은 40회다.

| 시트 | 다시 만든 횟수·이유 |
|---|---|
| 54a-1 | 1 — 포유류 같은 팔다리 수정 |
| 54a-2 | 0 |
| 54a-3 | 0 |
| 54a-4 | 0 |
| 54a-5 | 0 |
| 54a-6 | 1 — 아기 날개 제거, 연두 애벌레로 수정 |
| 54b-1 | 0 |
| 54b-2 | 0 |
| 54b-3 | 0 |
| 54b-4 | 0 |
| 54b-5 | 0 |
| 54b-6 | 0 |
| 54b-7 | 0 |
| 54b-8 | 0 |
| 54b-9 | 0 |
| 54b-10 | 0 |
| 54b-11 | 1 — 날개 가장자리 잘림 수정 |
| 54b-12 | 0 |
| 54b-13 | 0 |
| 54b-14 | 0 |
| 54b-15 | 0 |
| 54b-16 | 0 |
| 54b-17 | 0 |
| 54b-18 | 0 |
| 54b-19 | 0 |
| 54b-20 | 0 |
| 54b-21 | 0 |
| 54c-1 | 0 |
| 54c-2 | 0 |
| 54c-3 | 0 |
| 54c-4 | 0 |
| 54c-5 | 0 |
| 54c-6 | 0 |
| 54c-7 | 0 |
| 54c-8 | 1 — 나풀 맞음 얼굴의 코끼리 코 유사 변형 수정 |
| 54c-9 | 0 |

## 검사 결과

- `npm ci`: 성공.
- `sharp`: `npm install --no-save --package-lock=false sharp`로 작업 환경에만 설치. package.json / lock 파일 변경 없음.
- 36개 시트: 네 모서리 alpha 0, 가장자리의 alpha >24 픽셀 없음, 자르기 도구의 투명도·빈 칸 검사 모두 통과.
- 168개 WebP: 파일 존재·크기·비어 있지 않음·네 모서리 alpha 0 모두 통과.
- `npm run build:assets`: PASS (content-validation / browser-syntax 포함).
- `npm run check:cloudflare`: 종료 코드 0, PASS.
- `npm run check`: 종료 코드 1. 실패 메시지:
  `Error: [release-check] FAIL · V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent`
- 기준 브랜치의 pet-art.js / sw.js로 되돌려 같은 release-check를 실행해 동일 실패를 재현한 뒤 작업 파일을 복원했다. 이번 작업에서 battle.js / 검사 파일은 수정하지 않았다.
- 실제 PR 기준 `origin/claude/bug-dino-pets-plan` 대비 기존 public/assets 파일의 수정·삭제 없음.
- 요청된 `origin/sumus-voca-prod-deploy` 대비 검사에서는 아래 음원 삭제 14건이 보인다. 이 14건은 작업 전 계획 브랜치에도 이미 있던 동일 차이로, 이번 PR에 추가된 삭제가 아니다. 관련 파일을 임의로 복구하거나 변경하지 않았다:
  `deep-bubble.mp3`, `deep-hum.mp3`, `deep-pass.mp3`, `fish-glide.mp3`, `fish-ink.mp3`, `fish-lure.mp3`, `fish-thump.mp3`, `fish-turn.mp3`, `rod-drag.mp3`, `rod-ratchet.mp3`, `rod-shimmer.mp3`, `rod-snap-heavy.mp3`, `rod-tick.mp3`, `trophy-boom.mp3` (모두 public/assets/sfx/).

## 눈으로 확인 필요

생성 결과 36장과 합성 미리보기를 직접 열어 캐릭터·표정·성장 단계·소품·공격/맞음 방향·잘림을 확인했다. 발견한 부적합 후보 4장은 제외하고 재생성했다. 머지 전 선생님이 전체 미리보기로 그림체와 귀여움, 가려진 다리 표현 및 포즈의 최종 선호도를 확인하면 된다. 체크무늬·흰 상자·글자·숫자·테두리·바닥 그림자·피·상처가 없는 투명 그림으로 구성했다.

새 펫 · 알 · 칭호는 코드 등록(다음 세션) 후에 앱에 나온다
