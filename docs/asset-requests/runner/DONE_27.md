# 그림 27 완료 기록

| 시트 | 넣은 그림 (`public/assets/` 기준) |
|---|---|
| 27a-1 | `fishing/bg-sea.webp` |
| 27a-2 | `fishing/bg-under.webp` |
| 27a-3 | `fishing/bg-entry.webp` |
| 27b-1 | `fish/minnow-hang`, `chub-hang`, `crucian-hang`, `sardine-hang` |
| 27b-2 | `fish/mackerel-hang`, `saury-hang`, `carp-hang`, `flounder-hang` |
| 27b-3 | `fish/rockfish-hang`, `salmon-hang`, `catfish-hang`, `puffer-hang` |
| 27b-4 | `fish/tuna-hang`, `ray-hang`, `cod-hang`, `lionfish-hang` |
| 27b-5 | `fish/swordfish-hang`, `sunfish-hang`, `shark-hang`, `squid-hang` |
| 27b-6 | `fish/whaleshark-hang`, `goldcarp-hang`, `coelacanth-hang`, `goldenegg-hang` |
| 27c-1 | `fishing/rod`, `rod-bend1`, `rod-bend2`, `reel` |
| 27c-2 | `fishing/bobber`, `bobber-bite`, `hook`, `line-snap` |
| 27c-3 | `fishing/lure-worm`, `lure-shrimp`, `lure-spinner`, `lure-gold` |
| 27c-4 | `fishing/btn-left`, `btn-right`, `btn-reel`, `btn-cast` |
| 27c-5 | `fishing/tension`, `power`, `skill-empty`, `skill-full` |
| 27c-6 | `fishing/bait-can`, `pearl`, `net`, `shop` |
| 27c-7 | `fishing/fx-splash`, `fx-ripple`, `fx-perfect`, `fx-star` |

- 표의 확장자 없는 항목은 각각 `.webp`입니다. 27b 24종에는 96px 크기의 `-s.webp`도 넣었습니다. 총 79개 파일입니다.
- 원본 PNG 16장은 Google Drive의 `SUMUS 낚시 27 (Runner용)` 폴더에 표의 정확한 시트 이름으로 저장했습니다. 원본은 커밋하지 않았습니다.
- 배경 WebP는 세로 720×1080, 가로 1280×853이며 모두 200KB 이하입니다.
- 넣지 못한 그림: 없음. 참고용 `15-1.png`는 Drive에서 검색되지 않아 확인 가능한 MONG · NABI · PINKY · BAMBOO의 `03_final.png`를 배경 그림체 기준으로 사용했습니다.
- 다시 만든 횟수: `27c-5` 1회. 나머지 시트는 0회. `27c-5`는 원하는 가로 게이지 형태를 살려 칸 안에 크기와 위치를 맞췄습니다.
- 눈으로 확인 필요: 실제 게임 화면의 글자·버튼과 배경 대비, 27b 물고기와 26 옆모습의 동일성, 작은 게이지의 색 구분. 좌우 조작 버튼은 96px 미리보기에서 화살표 방향이 보이는 것을 확인했습니다.
- 점검: `npm ci`, `npm run build:assets`, `npm run check:cloudflare` 통과. `npm run check`는 시작 브랜치의 기존 `V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent` 검사에서 실패했습니다. 앱 코드는 수정하지 않았습니다.
