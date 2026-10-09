# 그림 21 작업 완료 기록

## 넣은 그림

| 펫 키 | 이름 | 설정 시트 | 표정 시트 | 기본 그림 | 표정 그림 | 알 반응 | 160px 작은 그림 |
|---|---|---|---|---:|---:|---:|---:|
| tissue | 술술이 | 21a-1 | 21b-1~3, 21b-7 위 줄 | 4 | 12 | 2 | 4 |
| glue | 찰싹이 | 21a-2 | 21b-4~6, 21b-7 아래 줄 | 4 | 12 | 2 | 4 |
| **합계** |  | **2장** | **7장** | **8** | **24** | **4** | **8** |

새 펫 그림 36개와 160px 작은 그림 8개, 총 44개를 `public/assets/pets/`에 추가했다. 원본 시트 PNG는 커밋하지 않았다.

## 이벤트 알 아이콘

| 파일 | 내용 | 파일 크기 |
|---|---|---:|
| `public/assets/ui/event-egg.webp` | 가을 이벤트 알 | 16,282 bytes |
| `public/assets/ui/event-badge.webp` | 이벤트 한정 배지 | 14,418 bytes |
| `public/assets/ui/event-deco-cheer.webp` | 응원 장식 | 15,658 bytes |
| `public/assets/ui/event-deco-autumn.webp` | 가을 장식 | 17,518 bytes |

이벤트 알 아이콘 4개를 `public/assets/ui/`에 추가했다. 펫 그림 44개와 합쳐 그림 21의 최종 파일은 총 48개다.

## 넣지 못한 그림

없음.

## 시트마다 다시 만든 횟수

21a-1~2 및 21b-1~8: 모두 0회.

## 눈으로 확인 필요

없음. 10장 미리보기를 한 장으로 합쳐 눈으로 확인했다. 설정 시트의 성장 단계, 같은 단계의 몸 크기와 소품, 표정 순서, 알의 무표정·무균열, 이벤트 아이콘의 칸 분리와 기존 할로윈 아이콘과의 차이를 확인했다. 원본 시트 10장은 모두 실제 투명 배경이었다.

## 점검

- `npm ci`: 완료.
- `npm run build:assets`: PASS (`content-validation`, `browser-syntax` 포함). `public/sw.js`가 갱신됐다.
- `npm run check`: PASS (`1213/1213`).
- `npm run check:cloudflare`: PASS (`local-first storage + 200 concurrent reads`, `battle-room-check` 포함).
- `npm run check:load`: PASS (학생 20명, 600답안, 처리량 약 94/s).
- `npm run check:sql`: PASS (`supabase/voca_v13_parts.sql`, PGlite).
- 새 그림 48개 모두 존재한다.
- 기본·표정·알 반응 36개는 512×512, 작은 그림 8개는 160×160, UI 아이콘 4개는 256×256이며 모두 알파 채널을 가진다.
- 앱 코드는 바꾸지 않았고 버전도 올리지 않았다. 새 그림은 아직 앱에서 읽지 않으므로 이 작업만 머지해도 앱 화면은 바뀌지 않는다.

