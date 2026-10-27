# 그림 42 완료 기록

- 기준 및 PR 대상: `claude/claw-design` (`sumus-voca-prod-deploy`에는 `42a-claw-dolls.txt`가 없음)
- 제작: Codex 내장 그림 생성 기능으로 시트 12장. 생성 PNG를 1024×1024 투명 배경으로 정규화한 뒤 `fit-assets.mjs --stand-same --small 128`로 잘랐다.
- 결과: 12종 × 기본·집힘·떨어짐·기쁨 4자세 = 48장(512px), 각각 `-s` 48장(128px). `slice-map.csv`의 48개 `app_file`과 파일명이 모두 일치한다.
- 눈으로 확인 필요: 없음. 전체 시트와 잘라낸 미리보기를 눈으로 확인했다. 게임 화면 배치 확인은 다음 세션의 게임 코드가 필요하다.

| 시트 | 인형 | 파일(각각 `-s.webp`도 포함) | 다시 만든 횟수 | 진짜 펫과 다르게 보이는 점 |
|---|---|---|---:|---|
| 42a-1 | rat | `doll-rat{,-grab,-fall,-joy}.webp` | 0 | 회색 펫과 달리 연보라 천, 민트 귀, 봉제선·단추 눈·태그·볼체인 고리 |
| 42a-2 | ox | `doll-ox{,-grab,-fall,-joy}.webp` | 0 | 갈색 종 달린 펫과 달리 흰 천·하늘색 무늬와 뿔, 종 없음 |
| 42a-3 | tiger | `doll-tiger{,-grab,-fall,-joy}.webp` | 0 | 주황색 펫과 달리 레몬색 천과 분홍색 펠트 줄무늬 |
| 42a-4 | rabbit | `doll-rabbit{,-grab,-fall,-joy}.webp` | 0 | 흰 펫과 달리 하늘색 천, 분홍 안감의 긴 귀, 당근 배지 |
| 42a-5 | dragon | `doll-dragon{,-grab,-fall,-joy}.webp` | 0 | 흰색·청록색 펫과 달리 산호색 천, 민트 가시와 별 배 |
| 42a-6 | snake | `doll-snake{,-grab,-fall,-joy}.webp` | 0 | 크림색·초록색 펫과 달리 연보라·노란 줄무늬 쿠션형 몸 |
| 42a-7 | horse | `doll-horse{,-grab,-fall,-joy}.webp` | 0 | 밤색 펫과 달리 복숭아색 천, 무지개 털실 갈기 |
| 42a-8 | sheep | `doll-sheep{,-grab,-fall,-joy}.webp` | 0 | 크림색 펫과 달리 분홍 부클레 천과 하늘색 리본 |
| 42a-9 | monkey | `doll-monkey{,-grab,-fall,-joy}.webp` | 0 | 캐러멜색 펫과 달리 청회색 니트 양말 인형과 빨간 입 패치 |
| 42a-10 | rooster | `doll-rooster{,-grab,-fall,-joy}.webp` | 0 | 노란 펫과 달리 흰 천, 산호색 볏과 무지개 꼬리 |
| 42a-11 | dog | `doll-dog{,-grab,-fall,-joy}.webp` | 0 | 황금 주황색 펫과 달리 초콜릿색 천과 빨간 점무늬 반다나 |
| 42a-12 | pig | `doll-pig{,-grab,-fall,-joy}.webp` | 0 | 분홍 펫과 달리 민트색 천과 노란 꽃 장식 |

모든 인형에 봉제선·단추 눈·빈 천 태그·볼체인 고리를 넣었다. 넣지 못한 인형은 없다.

## 점검

- `npm ci`: 완료
- `npm run build:assets`: PASS
- `npm run check:cloudflare`: 종료 코드 0
- `npm run check`: FAIL — `Error: [release-check] FAIL · V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent` (이번 그림 작업과 무관하며 점검 파일은 수정하지 않음)
- 기존 `public/assets` 그림의 삭제·수정 없음.

인형뽑기는 게임 코드(다음 세션)가 생겨야 앱에 나온다.
