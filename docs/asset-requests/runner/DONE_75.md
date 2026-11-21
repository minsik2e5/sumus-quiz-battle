# 그림 75 — 펫 대행진 ②단계

내장 그림 생성 기능으로 시트 6장, 게임용 WebP 24장을 만들었습니다. Google Drive·유료 API·운영 Supabase는 사용하지 않았습니다. 원본 PNG와 최종 생성 프롬프트는 저장소 밖 work/art에 보관하며 커밋하지 않습니다.

## 그림 목록

| 시트 | 경로 | 크기 | 처리 방법 | 용량 |
|---|---|---:|---|---:|
| 75-1 | `public/assets/runner/enemy-run.webp` | 160×160 | cut | 10.0 KB |
| 75-1 | `public/assets/runner/enemy-hit.webp` | 160×160 | cut | 9.2 KB |
| 75-1 | `public/assets/runner/enemy-down.webp` | 160×160 | cut | 10.3 KB |
| 75-1 | `public/assets/runner/enemy-boss.webp` | 256×256 | cut | 18.5 KB |
| 75-2 | `public/assets/runner/wall-sky.webp` | 448×224 | cut | 18.0 KB |
| 75-2 | `public/assets/runner/wall-desert.webp` | 448×224 | cut | 17.0 KB |
| 75-2 | `public/assets/runner/wall-ice.webp` | 448×224 | cut | 18.8 KB |
| 75-2 | `public/assets/runner/wall-volcano.webp` | 448×224 | cut | 17.4 KB |
| 75-3 | `public/assets/runner/wall-chunk-sky.webp` | 128×128 | cut | 6.9 KB |
| 75-3 | `public/assets/runner/wall-chunk-desert.webp` | 128×128 | cut | 6.9 KB |
| 75-3 | `public/assets/runner/wall-chunk-ice.webp` | 128×128 | cut | 7.6 KB |
| 75-3 | `public/assets/runner/wall-chunk-volcano.webp` | 128×128 | cut | 6.3 KB |
| 75-4 | `public/assets/runner/bridge-narrow.webp` | 256×256 | tile | 8.0 KB |
| 75-4 | `public/assets/runner/plank-broken.webp` | 256×160 | cut | 10.8 KB |
| 75-4 | `public/assets/runner/cliff-edge.webp` | 448×192 | cut | 17.9 KB |
| 75-4 | `public/assets/runner/bridge-post.webp` | 96×256 | cut | 6.2 KB |
| 75-5 | `public/assets/runner/tower-cannon.webp` | 256×256 | cut | 14.5 KB |
| 75-5 | `public/assets/runner/shield-guard.webp` | 192×192 | cut | 10.2 KB |
| 75-5 | `public/assets/runner/castle-flag.webp` | 128×256 | cut | 6.1 KB |
| 75-5 | `public/assets/runner/cannon-ball.webp` | 96×96 | cut | 3.6 KB |
| 75-6 | `public/assets/runner/fever-plate.webp` | 448×224 | cut | 15.9 KB |
| 75-6 | `public/assets/runner/light-band.webp` | 512×128 | add | 2.7 KB |
| 75-6 | `public/assets/runner/fever-aura.webp` | 256×256 | add | 5.6 KB |
| 75-6 | `public/assets/runner/clash-burst.webp` | 256×256 | add | 8.0 KB |

총 256.4 KB (0.250 MB). 모든 파일 40KB 이하, 전체 0.6MB 이하입니다. cut은 투명 배경 제거, tile은 세로 반복, add는 검정 바탕 더하기 합성입니다.

## 제작과 확인

- build-75.mjs를 작업 중 수정해 STYLE REFERENCE·WHEN DONE 줄을 제거하고 지정 참고 문장을 세 번째 줄에 넣어 재생성했습니다. 기존 주문서는 커밋 전에 원상복구했습니다.
- 저장소의 정령·펫·길·성·이펙트와 게임 스크린샷을 참고했습니다. 한 번에 참고 파일 최대 5개 제한에 맞춰 시트별로 선택했습니다. 75-3은 생성한 벽을, 75-5는 생성한 적 정령을 추가 참고했습니다.
- 다시 만든 횟수: 총 3회. 75-4의 세로로 긴 타일과 가장자리 구름을 고치기 위해 1회, 75-1 이웃 칸의 대장 깃털 혼입을 고치기 위해 2회. 정령 첫 수정 후보는 배경이 생겨 제외하고 투명 배경을 유지한 두 번째 수정 후보를 채택했습니다.
- 생성 결과를 1024×1024로 정규화하고 각 칸에 48px 여백을 주었습니다. 6시트 모두 slice-74.mjs --preview를 경고 없이 통과했습니다.
- 길 색 바닥 위 미리보기를 눈으로 확인했습니다. 투명 경계에 흰색·검정 테두리나 이웃 칸 그림이 없으며 빛 3개는 검은 사각형 없이 합성됩니다. 다리 타일의 세로 두 번 반복을 확인했습니다. 숫자 벽 중앙 판과 피버 판은 비어 있고 글자·숫자·로고·체크무늬는 없습니다.
- 눈으로 확인 필요: 테스트 앱 펫 대행진 26스테이지 이후에서 적 정령·숫자 벽·피버 판이 새 그림으로 바뀌는지, 실제 움직임 중 다리 이음매와 32px 적 정령 가독성을 확인해야 합니다.

## 점검

- npm ci: 통과.
- npm run build:assets: 통과. RUNNER_ART 68개(기존 44 + 신규 24), 콘텐츠·브라우저 문법 검사 PASS.
- npm run check:cloudflare: 통과.
- npm run check: 실패. DONE_74.md에 기록된 것과 같은 기존 전투 검사 실패이며 검사 파일은 수정하지 않았습니다.

```text
Error: [release-check] FAIL · V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent
```

- 기존 public/assets 파일 수정·삭제 없음. 새 WebP 24개와 이 문서, 빌드 결과 public/modules/runner-art.js·public/sw.js만 반영했습니다. 앱 코드·게임 규칙·서버·점검 파일·버전을 바꾸지 않았습니다.

## 렉 방지 점검

정적 그림만 추가했습니다. API·자동 갱신·서버 계산·메인 상태 묶음 추가가 없으며 새 데이터 예산은 해당 없음입니다. 그림은 각 40KB·전체 0.6MB 제한을 충족합니다. check:load는 서버 변경이 없어 실행하지 않았습니다.

> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.
