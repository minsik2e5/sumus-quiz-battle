# 그림 26 완료 기록

| 시트 | 넣은 그림 |
|---|---|
| 26-1 | minnow, chub, crucian, sardine |
| 26-2 | mackerel, saury, carp, flounder |
| 26-3 | rockfish, salmon, catfish, puffer |
| 26-4 | tuna, ray, cod, lionfish |
| 26-5 | swordfish, sunfish, shark, squid |
| 26-6 | whaleshark, goldcarp, coelacanth, goldenegg |

- 모두 `public/assets/fish/<key>.webp`에 256×256으로 넣었습니다.
- 원본 6시트는 Google Drive의 `SUMUS 낚시 26 (Runner용)`에 `26-1.png`부터 `26-6.png`까지 저장했습니다.
- 넣지 못한 그림: 없음.
- 다시 만든 횟수: 26-3, 26-4, 26-5, 26-6 각 1회. 나머지 0회.
- 눈으로 확인 필요: 96px 이하에서 비슷한 작은 은빛 물고기의 구별, 메기 수염과 황새치 부리의 가장자리, 전설 등급 후광의 게임 화면 대비.
- 점검: `npm ci`, `npm run build:assets`, `npm run check:cloudflare` 통과. `npm run check`는 기준 브랜치의 기존 `V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent` 검사에서 실패했습니다. 앱 코드는 수정하지 않았습니다.
