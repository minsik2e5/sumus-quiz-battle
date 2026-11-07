# 그림 64 — 벽 통과 게임 그림

내장 image_gen으로 13개 원본을 생성하고 게임용 WebP 31개와 검토용 preview.webp 1개를 추가했습니다. 앱 코드·서버·규칙·버전 변경 없음. 머지·배포·운영 Supabase 연결 없음. Google Drive·유료 API·API 키 사용 없음.

## 그림 목록

| 경로 | 크기 | 용량 |
|---|---|---|
| `public/assets/wall/entry.webp` | 1280×853 | 170.9 KB |
| `public/assets/wall/bg-1.webp` | 720×1080 | 106.9 KB |
| `public/assets/wall/bg-2.webp` | 720×1080 | 109.0 KB |
| `public/assets/wall/bg-3.webp` | 720×1080 | 111.0 KB |
| `public/assets/wall/wall-1.webp` | 768×768 | 146.2 KB |
| `public/assets/wall/wall-2.webp` | 768×768 | 144.4 KB |
| `public/assets/wall/wall-3.webp` | 768×768 | 145.1 KB |
| `public/assets/wall/fx-splash.webp` | 512×512 | 65.8 KB |
| `public/assets/wall/fx-ripple.webp` | 512×512 | 20.8 KB |
| `public/assets/wall/water-front.webp` | 512×512 | 28.0 KB |
| `public/assets/wall/fx-drops.webp` | 512×512 | 44.5 KB |
| `public/assets/wall/tube-back.webp` | 512×476 | 21.5 KB |
| `public/assets/wall/tube-front.webp` | 512×476 | 20.6 KB |
| `public/assets/wall/fx-pass.webp` | 512×476 | 53.0 KB |
| `public/assets/wall/fx-combo.webp` | 512×476 | 43.1 KB |
| `public/assets/wall/fx-impact.webp` | 512×512 | 54.1 KB |
| `public/assets/wall/fx-dust.webp` | 512×512 | 26.3 KB |
| `public/assets/wall/heart.webp` | 256×256 | 12.9 KB |
| `public/assets/wall/heart-broken.webp` | 256×256 | 18.1 KB |
| `public/assets/yabawi/menu-wall.webp` | 136×136 | 6.2 KB |
| `public/assets/wall/badge-stage.webp` | 256×256 | 11.4 KB |
| `public/assets/wall/ribbon-record.webp` | 256×256 | 8.3 KB |
| `public/assets/wall/siren.webp` | 256×256 | 13.0 KB |
| `public/assets/wall/ref-ready.webp` | 512×512 | 35.3 KB |
| `public/assets/wall/ref-pass.webp` | 512×512 | 34.2 KB |
| `public/assets/wall/ref-splash.webp` | 512×512 | 34.3 KB |
| `public/assets/wall/ref-fever.webp` | 512×512 | 39.4 KB |
| `public/assets/wall/fx-light.webp` | 512×512 | 21.7 KB |
| `public/assets/wall/fx-confetti.webp` | 512×512 | 44.4 KB |
| `public/assets/wall/fx-sparkle.webp` | 512×512 | 25.6 KB |
| `public/assets/wall/podium.webp` | 512×512 | 21.4 KB |

게임용 총 1637.4 KB. preview.webp는 검토 전용이며 게임 코드에서 참조하지 않습니다.

## 생성 및 가공

- 64-1: 첫 후보에서 다섯 번째 구멍이 발견되어 1회 수정 생성. 나머지 64-2~13은 재생성 0회. 총 내장 도구 호출 14회.
- 요청 프롬프트 원문은 64-wall-game.txt에 보존. 실제 호출에는 세 번째 줄에 지정된 참조 문장을 넣고 해당 저장소 그림을 첨부. 무대 변형에는 64-2, 벽 변형에는 64-5를 첨부.
- 원본 PNG는 작업 폴더 work/art/에만 보관하며 커밋하지 않음(Windows 환경). 최종 WebP만 추가.
- 벽의 마젠타를 공통 마스크로 제거하고 경계를 2px 정리하여 세 벽의 구멍을 동일하게 맞춤. 튜브는 --union으로 동일 배율·캔버스 분리. 효과 512px, 하트·배지 256px, 메뉴 136px. 튜브·통과·콤보는 공통 창 512×476px.

## 벽 구멍 좌표

좌상단이 (0,0), 전체 이미지 기준 백분율. 중심은 투명 구멍 경계 상자의 중심이며 크기는 경계 상자 폭·높이. 세 벽 공통 마스크. 생성 결과가 주문서의 명목 중심 25/75%, 하단 78%와 달라 **아래 실측 좌표를 게임 구현에서 사용해야 합니다**. 임의로 명목 좌표에 버튼을 얹으면 어긋납니다.

| 구멍 | 중심 x,y (%) | 폭,높이 (%) |
|---|---|---|
| 좌상 | 28.96, 33.40 | 27.34, 26.07 |
| 우상 | 72.85, 33.54 | 26.86, 26.76 |
| 좌하 | 32.96, 73.49 | 31.64, 26.76 |
| 우하 | 69.14, 71.88 | 27.64, 26.27 |

단어 판의 사용 가능한 내부 영역(세 벽 공통, 약 ±0.5%): 좌상 중심(30.0,14.0), 우상(70.0,14.0), 좌하(30.0,52.5), 우하(70.0,52.5), 각 폭 29%, 높이 5.5%. 글자는 코드에서 씁니다.

## 무대 경계

세 무대 공통: 아치 프레임 대략 x23~77%, y3~16%; 원근 바닥 y16~60%; 노란 패딩 y60~68%; 풀장 y68~100%. 낮·노을·밤의 카메라·아치·바닥선·풀장 배치를 눈으로 비교 확인.

## 검토

- 원본과 변환 결과를 직접 확인: 글자·숫자·로고 없음, 투명 시트에 체크무늬·흰 상자 없음.
- 벽 구멍 4개 투명, 단어 판 4개 공백. 투명 경계는 회색 배경과 체크무늬에서 확인.
- 튜브 앞·뒤 중첩 미리보기로 한 개의 링이 되는지 확인.
- 390px 폭 축소 미리보기 확인. 게임 코드는 없으므로 실제 게임 화면의 버튼·펫 정렬은 아직 검증 불가.
- 눈으로 확인 필요: 선생님의 최종 미감 확인, 향후 게임 구현 시 실제 단어 길이·구멍 버튼·펫 크기 및 튜브 가림 순서.

## 점검

- npm ci: 통과.
- npm run build:assets: 통과(콘텐츠·브라우저 문법 포함).
- npm run check:cloudflare: 통과.
- npm run check: 실패. 앱 코드 및 점검 파일은 수정하지 않았습니다. 원문:

```text
Error: [release-check] FAIL · V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent
```

## 렉 방지 점검

정적 WebP 자산만 추가. 새 API·자동 새로고침·상태 묶음·서버 계산 없음. 자산은 기존 service worker의 요청 시 캐시 규칙을 따름. 새 데이터 묶음 및 예산: 없음. 부하 점검 대회 판 열기 p95 253ms, 놀이터 보기 p95 1ms, 사냥 첫 화면 p95 206ms; 보관 후 각각 232ms/1ms/247ms. npm run check:load 전체 통과(연습·대회·보관 전후·던전 10/40파티).

> ⚠️ 머지하면 운영에 바로 배포됩니다. 선생님이 "머지해"라고 할 때만 머지합니다.
