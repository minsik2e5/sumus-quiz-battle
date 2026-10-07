# 그림 14~16 작업 A 완료 기록

Codex 내장 그림 생성 기능으로 20개 시트를 만들었다. Drive 안내 문장을 제외하고 주문서의 참고 그림을 첨부했다. 원본 PNG와 미리보기는 임시 폴더에만 보관했다.

| 시트 | 넣은 그림 (`public/assets/` 아래) | 재생성 횟수 |
|---|---|---:|
| 14a-1 | `pets/pumpkincat-0~3.webp` | 0 |
| 14a-2 | `pets/ghost-0~3.webp` | 0 |
| 14b-1~3 | `pets/pumpkincat-1~3-{happy,eat,sad,cheer}.webp` | 각 0 |
| 14b-4~6 | `pets/ghost-1~3-{happy,eat,sad,cheer}.webp` | 각 0 |
| 14b-7 | `pets/pumpkincat-0-{happy,eat}.webp`, `pets/ghost-0-{happy,eat}.webp` | 0 |
| 14b-8 | `ui/halloween-egg.webp`, `ui/limited-badge.webp`, `ui/halloween-deco-pumpkins.webp`, `ui/halloween-deco-moon.webp` | 0 |
| 14b-9 | `battle/bg-halloween.webp` | 0 |
| 15-1~4 | `battle/bg-{arena,practice,forest,boss}.webp` | 각 0 |
| 16-1~2 | `pets/dog-{2,3}.webp`, 각 단계의 `{happy,eat,sad}.webp` | 각 0 |
| 16-3~4 | `pets/pig-{2,3}.webp`, 각 단계의 `{happy,eat,sad}.webp` | 각 0 |
| 16-5 | `pets/{dog,pig}-{2,3}-cheer.webp` | 0 |

추가로 `pumpkincat-0~3`, `ghost-0~3`, `dog-2~3`, `pig-2~3`의 `-s.webp` 12개를 160×160으로 만들었다. 총 65개 본 그림과 12개 작은 그림이다.

- 넣지 못한 그림: 없음.
- 눈으로 확인 필요: 없음. 원본 시트와 잘린 미리보기를 확인했다.
- 2×2 시트 15개의 1024×1024 크기, 투명 모서리, 네 칸 그림 유무를 확인했다. 배경 5개는 1280×853이며 모두 200KB 이하다.
- `fit-sheets.mjs`는 기본 이름(`dog-2` 등)을 받지 않아 16-1~4의 표정은 이 도구로, 기본 그림은 기존 그림을 기준으로 `fit-assets.mjs`로 잘랐다. 도구 파일은 고치지 않았다.
- 몽이·핑키는 기존 파일 이름을 덮어썼으므로 이 PR을 머지하면 운영 그림이 바로 바뀐다. 앱 버전은 올리지 않았다.

## 점검 결과

- `npm ci`: 성공
- `npm run build:assets`: 성공 (`content-validation`, `browser-syntax` PASS)
- `npm run check`: 실패 — `[release-check] FAIL · V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent`
- `npm run check:cloudflare`: 성공 (`cloudflare-check`, `battle-room-check` PASS)
- 기존 그림 삭제: 0개. 수정한 기존 그림은 `dog-2*`, `dog-3*`, `pig-2*`, `pig-3*`뿐이다.
