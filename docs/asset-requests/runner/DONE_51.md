# 그림 51 작업 결과

Codex 내장 그림 생성으로 51-1 → 51-2 → 51-3을 한 시트씩 만들었다. Google Drive, OpenAI API 키, 유료 API, 운영 Supabase는 사용하지 않았다.

## 넣은 메달

각 파일은 `public/assets/titles/` 아래에 있으며, 표의 본그림(256×256)과 같은 이름의 `-s.webp` 작은 그림(96×96)을 함께 추가했다.

| 시트 | 칸 | 칭호 | 본그림 | 다시 만든 횟수 |
|---|---|---|---|---|
| 51-1 | 왼쪽 위 | 야자 탈출 | `mlv10.webp` | 0 |
| 51-1 | 오른쪽 위 | 몬스터 세 끼 | `mday3.webp` | 0 |
| 51-1 | 왼쪽 아래 | 빈칸 메우미 | `blank1.webp` | 0 |
| 51-1 | 오른쪽 아래 | 어법 첫 감별 | `gram1.webp` | 0 |
| 51-2 | 왼쪽 위 | 들판 무법자 | `mlv30.webp` | 2 |
| 51-2 | 오른쪽 위 | 보스 퇴근 도우미 | `boss3.webp` | 2 |
| 51-2 | 왼쪽 아래 | 5과 빈칸 땜장이 | `blank5.webp` | 2 |
| 51-2 | 오른쪽 아래 | 6과 빈칸 미장이 | `blank6.webp` | 2 |
| 51-3 | 왼쪽 위 | 7과 빈칸 목수 | `blank7.webp` | 0 |
| 51-3 | 오른쪽 위 | 어법 감별사 | `gram10.webp` | 0 |
| 51-3 | 왼쪽 아래 | 밤도깨비 퇴치반 | `mlv50.webp` | 0 |
| 51-3 | 오른쪽 아래 | 영웅 수집가 | `epic-collector.webp` | 0 |

## 생성과 가공

- `split/51-*.txt`에서 `STYLE REFERENCE`, `Also open`, `WHEN DONE`으로 시작하는 줄을 제외하고, 지시된 참고 그림 문장을 세 번째 줄에 넣었다. 원본 주문서는 수정하지 않았다.
- 51-1은 `rookie`, `away1`, `preview-25`, 51-2는 `words500`, `unit1`, `preview-25`와 완성한 51-1을 참고했다.
- 51-3은 `words500`, `unit1`, `words1000`, `unit3`, `preview-25`와 완성한 51-1을 참고했다. 도구의 참고 파일 5개 제한에 맞춰 영웅 참고 메달 두 장을 나란히 합친 한 파일로 첨부했다.
- 생성된 PNG는 투명도를 유지한 채 1024×1024로 정규화한 후, 저장소의 `fit-assets.mjs --fit-each --small 96`으로 잘랐다. 원본 시트와 작업용 프롬프트는 Git에 넣지 않았다.
- 51-1과 51-3은 첫 생성본을 사용했다. 51-2는 첫 두 후보에서 모서리 alpha 1이 확인되어 같은 프롬프트로 두 번 다시 생성했고, 세 번째 후보를 사용했다. 51-3의 첫 도구 호출은 참고 파일 개수 제한으로 생성 전에 거절되어, 참고 그림을 합쳐 다시 요청했다.

## 넣지 못한 그림

없음.

## 점검

- 세 시트는 1024×1024이며 네 모서리 alpha 0이다. 24개 WebP 모두 256×256 / 96×96 규격과 네 모서리 alpha 0을 검사했다.
- 눈으로 확인 필요: 자동 생성 결과의 최종 미술 승인은 PR 미리보기에서 검토한다. 작업 중에는 원본, 잘라낸 합본, 48px 미리보기를 직접 보며 배경·잘림·글자·숫자·로고·바닥 그림자가 없고 등급별 테두리와 가운데 소재가 맞는지 확인했다.
- `npm ci`: 통과. npm audit은 기존 의존성 취약점 3개(보통 2, 높음 1)를 보고했다. 의존성·잠금 파일은 수정하지 않았다.
- `npm run build:assets`: 통과(content-validation / browser-syntax PASS).
- `npm run check`: 통과(`[release-check] PASS 3010/3010`).
- `npm run check:cloudflare`: 통과(exit 0).
- Windows 기본 CRLF 체크아웃에서 처음 실행한 `npm run check`는 `[release-check] FAIL · V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent`를 보고했다. LF를 전제로 하는 문자열 검사 때문에 발생한 환경 문제로, 작업 사본의 줄바꿈만 LF로 맞췄다. 검사 코드·앱 코드의 Git 변경은 없다. LF 환경의 선행 전체 검사는 `[release-check] PASS 3010/3010`이었다.
- 검증 프로세스의 Supabase URL·키·상태 secret을 비우고 로컬 모의 저장소로 검사했다. 운영 연결은 하지 않았다.
- 새 WebP 24개, 이 보고서, 빌드 산출물 `public/sw.js`만 PR에 포함한다. 기존 그림 삭제·수정은 없다.
- 합본 미리보기 PNG만 담은 별도 `codex/art-51-preview` 브랜치를 PR 코멘트에서 참조한다. 원본 시트 PNG는 어느 브랜치에도 커밋하지 않았다.

새 칭호는 코드 등록(TITLES · TITLE_ART, 다음 세션) 후에 앱에 나온다.
