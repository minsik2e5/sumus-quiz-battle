# 그림 68 완료 기록

경기장 꾸미기와 연습장 그림 14장을 내장 그림 생성 기능으로 제작했다. 원본 PNG는 커밋하지 않았다.

| 그림 | 파일 | 크기 | 용량 |
|---|---|---:|---:|
| 68-1 하늘 정원 | `public/assets/arena/bg-sky.webp` | 720×1080 | 85KB |
| 68-1 얼음 동굴 | `public/assets/arena/bg-glacier.webp` | 720×1080 | 71KB |
| 68-2 화산 | `public/assets/arena/bg-volcano.webp` | 720×1080 | 66KB |
| 68-2 은하 | `public/assets/arena/bg-galaxy.webp` | 720×1080 | 74KB |
| 68-3 꽃 고리 | `public/assets/arena/ring-flower.webp` | 512×253 | 44.4KB |
| 68-3 마법진 | `public/assets/arena/ring-rune.webp` | 509×252 | 38.0KB |
| 68-3 황금 링 | `public/assets/arena/ring-gold.webp` | 503×256 | 35.7KB |
| 68-3 별자리 링 | `public/assets/arena/ring-star.webp` | 512×254 | 34.7KB |
| 68-4 연기 | `public/assets/arena/entry-smoke.webp` | 384×384 | 33.7KB |
| 68-4 번개 | `public/assets/arena/entry-thunder.webp` | 384×384 | 33.7KB |
| 68-4 불꽃 | `public/assets/arena/entry-flame.webp` | 384×384 | 37.9KB |
| 68-4 무지개 | `public/assets/arena/entry-rainbow.webp` | 384×384 | 35.6KB |
| 68-5 왕관 | `public/assets/arena/pose-crown.webp` | 256×256 | 13.6KB |
| 68-5 허수아비 | `public/assets/arena/dummy.webp` | 256×256 | 11.5KB |

- 다시 그린 횟수: 각 시트 0회. 68-1·68-2의 가운데 구분선은 분할 위치를 조정해 잘라 냈다.
- 68-3~68-5는 WebP alpha가 있다. 68-5의 아래 두 칸은 투명 픽셀이며, 링은 안팎이 투명하다.
- 눈으로 확인 필요: 테스트 앱 아레나의 경기장 꾸미기 탭에서 네 경기장·링·입장 효과·왕관의 배치와 가독성, 연습장 허수아비가 바닥에 잘 서 있는지.
- `npm run check`는 기존 전투 검사 `V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent`에서 실패했다. 검사 파일은 수정하지 않았다.
