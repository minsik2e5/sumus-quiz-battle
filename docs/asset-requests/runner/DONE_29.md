# 그림 29 — 낚시 화면 새 단장

## 범위

내장 이미지 생성 기능으로 12개 시트를 제작하고 `slice-map.csv`의 29a~29e에 대응하는 WebP 39개를 추가했다. 유료 이미지 API는 사용하지 않았다. 앱 화면·서버 코드는 수정하지 않았다. 운영 Supabase 연결 및 배포·머지는 하지 않는다.

기준 브랜치: `origin/claude/zen-knuth-m0c31z` → `codex/art-29`. PR 대상도 `claude/zen-knuth-m0c31z`.

## Drive 원본

[SUMUS 낚시 29 (Runner용)](https://drive.google.com/drive/folders/10GehhgnPq1IyIPF3IVMnV01AMjk1Dpg1)

`29a-1.png`~`29a-3.png`, `29b-1.png`~`29b-2.png`, `29c-1.png`~`29c-4.png`, `29d-1.png`, `29e-1.png`~`29e-2.png`를 저장하고 폴더 목록에서 12개 이름을 확인했다. 배경 PNG 1024×1536, 나머지 PNG 1024×1024·알파 투명. 원본 및 미리보기 PNG는 커밋하지 않는다.

제작 전 Drive에서 MONG·NABI·PINKY·BAMBOO의 `03_final.png`, `27a-1.png`·`27a-2.png`, `27c-1.png`·`27c-2.png`·`27c-7.png`, `06-3.png`, 진주 기준 `27c-6.png`를 내려받아 눈으로 확인했다.

## 넣은 그림

| 그림 | 파일 | 크기 | 용량 |
|---|---|---:|---:|
| 1인칭 바다 위 배경 | `public/assets/fishing/bg-pov.webp` | 720×1080 | 125,740 B |
| 어망 수조 배경 | `public/assets/fishing/bg-tank.webp` | 720×1080 | 79,408 B |
| 물고기 공개 배경 | `public/assets/fishing/bg-reveal.webp` | 720×1080 | 117,424 B |
| 낚싯대 곧음(1인칭) | `public/assets/fishing/pov-rod.webp` | 384×384 | 12,092 B |
| 낚싯대 왼쪽으로 휨 | `public/assets/fishing/pov-rod-left.webp` | 384×384 | 15,928 B |
| 낚싯대 오른쪽으로 휨 | `public/assets/fishing/pov-rod-right.webp` | 384×384 | 15,922 B |
| 낚싯대 앞으로 크게 휨 | `public/assets/fishing/pov-rod-deep.webp` | 384×384 | 17,574 B |
| 릴 몸통 | `public/assets/fishing/pov-reel.webp` | 384×384 | 25,690 B |
| 릴 손잡이 | `public/assets/fishing/pov-crank.webp` | 384×384 | 11,152 B |
| 릴 과열(줄 위험) | `public/assets/fishing/pov-reel-hot.webp` | 384×384 | 35,142 B |
| 릴 필살 준비 | `public/assets/fishing/pov-reel-gold.webp` | 384×384 | 32,130 B |
| 점프 물보라 | `public/assets/fishing/fx-jump.webp` | 384×384 | 43,056 B |
| 물방울 고리 | `public/assets/fishing/fx-drops.webp` | 384×384 | 38,640 B |
| 집중선 | `public/assets/fishing/fx-speed.webp` | 384×384 | 35,668 B |
| 충격 번쩍 | `public/assets/fishing/fx-impact.webp` | 384×384 | 37,156 B |
| 후광 고리 | `public/assets/fishing/fx-halo.webp` | 384×384 | 31,166 B |
| 빛줄기 | `public/assets/fishing/fx-rays.webp` | 384×384 | 42,222 B |
| 새로 발견 도장 틀 | `public/assets/fishing/stamp-new.webp` | 384×384 | 27,800 B |
| 신기록 리본 틀 | `public/assets/fishing/ribbon-record.webp` | 384×384 | 11,188 B |
| 진주 더미 | `public/assets/fishing/pearl-pile.webp` | 384×384 | 18,112 B |
| 진주 터짐 | `public/assets/fishing/pearl-burst.webp` | 384×384 | 44,492 B |
| 큰 조개 진주 | `public/assets/fishing/pearl-clam.webp` | 384×384 | 23,414 B |
| 진주 반짝 꼬리 | `public/assets/fishing/pearl-trail.webp` | 384×384 | 22,064 B |
| 찌 톡톡(가짜 입질) | `public/assets/fishing/bobber-nibble.webp` | 384×384 | 20,448 B |
| 찌 쑥(진짜 입질) | `public/assets/fishing/bobber-sink.webp` | 384×384 | 30,026 B |
| 챔질 터짐 | `public/assets/fishing/fx-strike.webp` | 384×384 | 25,792 B |
| 거품 무리 | `public/assets/fishing/fx-bubbles.webp` | 384×384 | 23,294 B |
| 보물 상자 | `public/assets/fishing/tank-chest.webp` | 384×384 | 23,906 B |
| 산호 | `public/assets/fishing/tank-coral.webp` | 384×384 | 22,748 B |
| 수초 | `public/assets/fishing/tank-weed.webp` | 384×384 | 22,100 B |
| 바위 성 | `public/assets/fishing/tank-rock.webp` | 384×384 | 18,934 B |
| 어망 아이콘 | `public/assets/fishing/icon-net.webp` | 384×384 | 27,518 B |
| 교환소 아이콘 | `public/assets/fishing/icon-shop.webp` | 384×384 | 28,394 B |
| 도감 아이콘 | `public/assets/fishing/icon-book.webp` | 384×384 | 21,562 B |
| 미끼 통 열림 | `public/assets/fishing/bait-open.webp` | 384×384 | 23,554 B |
| 남은 거리 게이지 틀 | `public/assets/fishing/gauge-distance.webp` | 384×384 | 8,624 B |
| 던지기 힘 반원 틀 | `public/assets/fishing/gauge-cast.webp` | 384×384 | 11,772 B |
| 필살 스와이프 버튼 | `public/assets/fishing/btn-special.webp` | 384×384 | 19,828 B |
| 터치 안내 손 | `public/assets/fishing/hint-hand.webp` | 384×384 | 21,944 B |

## 자르기 및 정렬

- 낚싯대는 칸별 크기 맞춤을 하지 않고 공통 배율을 적용했다. 코르크 손잡이 중심을 시트 각 칸의 `(256,408)`에 맞춰 평행 이동한 다음, 고정 512px 칸을 384px로 줄였다. 자세를 바꿔도 손잡이 축이 이동하지 않도록 했다.
- 릴 손잡이는 원본 허브 중심을 기준으로 정사각형에 넣었다. 허브 중심: 시트 칸 `(256,256)`, 최종 WebP `(192,192)`. 손잡이가 회전해도 캔버스 안에 머무를 여백을 확보했다.
- 그 밖의 효과·장식·아이콘은 `fit-assets.mjs --fit-each --size 384`로 분리했다. 칸 경계의 작은 챔질 조각이 거품 칸에 섞이지 않도록 거품 자르기 범위를 정리했다.
- 생성기가 반환한 정사각 시트 크기를 1024×1024로 정규화하고, 분리한 그림을 각 512px 칸에 여백을 두고 넣었다. 낚싯대 공통 배율·축, 릴 손잡이 축은 유지했다.
- 배경은 720×1080 WebP로 저장했고 모두 200KB 미만이다.

## 재제작 횟수

처음 제작은 제외하고 다시 생성한 횟수다. 모든 시트의 총 생성 횟수는 최대 4회 이하다.

| 시트 | 재제작 | 이유 |
|---|---:|---|
| 29b-1 | 3 | 손잡이 중복, 축·크기 불일치, 칸 여백 개선 |
| 29b-2 | 0 | 첫 결과 채택 |
| 29a-1 | 1 | 배 앞머리를 줄여 중앙·오른쪽 확보 |
| 29a-2 | 1 | 장식을 제거해 수조 공간 확보 |
| 29a-3 | 0 | 첫 결과 채택 |
| 29c-1 | 0 | 첫 결과 채택 |
| 29c-2 | 1 | 후광·빛줄기를 색 없는 흰색으로 수정 |
| 29c-3 | 0 | 첫 결과 채택 |
| 29c-4 | 0 | 첫 결과 채택 |
| 29d-1 | 1 | 모래성 느낌을 회색 바위 성으로 수정 |
| 29e-1 | 0 | 첫 결과 채택 |
| 29e-2 | 0 | 첫 결과 채택 |

## 넣지 못한 것

없음. 매핑된 39개 파일을 모두 넣었다.

## 검수 및 눈으로 확인 필요

- 글자·숫자 없음, 시트의 각 칸에 하나의 그림/효과, 투명 알파, 빈 도장·리본·챔질 중앙, 배경 중앙 여백을 미리보기로 확인했다.
- 메뉴 아이콘 4개를 실제 96px로 줄여 어망·교환소·도감·미끼 통을 구분할 수 있는지 확인했다.
- **눈으로 확인 필요:** Claude가 화면에 연결한 뒤 실제 낚싯대 교체 애니메이션의 코르크 실루엣·금색 띠의 미세 차이와 깊은 휨의 원근을 확인한다. 기준 디자인의 민트·흰색·코르크·금색 가이드를 반영했지만 이미지 생성 결과가 기존 그림의 픽셀 단위 복제는 아니다.
- **눈으로 확인 필요:** 릴 회전축을 `(192,192)`로 연결하고, 실제 버튼 크기와 회전 시 여백을 확인한다. 릴 몸통과 손잡이의 화면상 상대 크기 조절은 연결 코드 담당자가 한다.
- **눈으로 확인 필요:** 게임 글자를 빈 도장·리본·챔질 영역에 얹고, 밝은 배경 위에서 흰색 후광·빛줄기 대비를 확인한다.
- 전체 미리보기는 한 장으로 합쳤으며, PR 생성 후 코멘트에 링크로 제공할 예정이다. `public/`에는 미리보기를 넣지 않는다.

## 검사

- `npm ci`: 통과.
- `npm run build:assets`: 실행 완료.
- `npm run check`: PASS 1875/1875.
- `npm run check:cloudflare`: PASS (로컬 저장·동시 읽기·쓰기 예산·대결/던전/파티·테스트 앱 검사).
- 별도 파일 검사: 39개 경로 존재, 36개 WebP 알파·384×384, 3개 배경 720×1080·200KB 이하, 12개 원본 시트 규격 통과.

## PR 진행 상태

사용자가 `minsik2e5/sumus-quiz-battle` 저장소의 `codex/art-29` 브랜치로 푸시하고 `claude/zen-knuth-m0c31z`를 대상으로 PR을 만드는 것을 명시적으로 승인했다. 운영 브랜치 `sumus-voca-prod-deploy`는 수정하지 않고 머지도 하지 않는다.

[전체 미리보기 한 장](https://drive.google.com/file/d/16ZuN26Q6rCMxMlloAvcDJCXEeZcUkl6S/view?usp=drivesdk)은 Drive에 저장했다. 원본 시트 12개는 지정 폴더, 이 미리보기는 상위 에셋 폴더에 별도로 저장되어 있다.
