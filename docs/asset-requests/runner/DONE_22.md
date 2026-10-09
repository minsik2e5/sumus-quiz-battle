# 그림 22·23 완료 기록

2026-10-09 · 내장 그림 생성 기능 사용. 앱 코드·버전 변경 없음.

## 몬스터

각 일반 몬스터는 첫 시트 4포즈(기본·기본2·준비·공격), 둘째 시트 4포즈(공격2·스킬·맞음·쓰러짐)이다. 보스는 셋째 시트에 분노·핵 노출·포효·핵 맞음 4포즈를 더했다. 두세 시트의 `--stand-same` 배율을 동일하게 맞췄다.

| 몬스터 | 시트 | 포즈 | 공통 배율 |
|---|---|---:|---:|
| 밤샘 좀비 `nightzombie` | 22a-1~2 | 8 | 0.7709 |
| 빨간펜 귀신 `redpenghost` | 22a-3~4 | 8 | 0.6981 |
| 오답노트 미라 `wrongmummy` | 22a-5~6 | 8 | 0.6185 |
| 시험지 거미 `testspider` | 22a-7~8 | 8 | 0.7198 |
| OMR 사신 `omrreaper` | 22a-9~10 | 8 | 0.5995 |
| 칠판 아귀 `chalkangler` | 22a-11~12 | 8 | 0.5872 |
| 야자 박쥐 `nightbat` | 22a-13~14 | 8 | 0.6893 |
| 깜빡 해파리 `blinkjelly` | 22a-15~16 | 8 | 0.6371 |
| 책가방 거북 `bagturtle` | 22a-17~18 | 8 | 0.6281 |
| 커닝 닌자 `cheatninja` | 22a-19~20 | 8 | 0.7496 |
| 과학실 해골 `labskeleton` | 22a-21~22 | 8 | 0.7208 |
| 피아노 마귀 `pianofang` | 22a-23~24 | 8 | 0.8000 |
| 수행평가 오거 `homeworkogre` | 22a-25~26 | 8 | 0.6193 |
| 교문 불독 `gatehound` | 22a-27~28 | 8 | 0.6912 |
| 모래시계 마녀 `sandwitch` | 22a-29~30 | 8 | 0.6085 |
| 킬러 골렘 `killergolem` | 22b-1~3 | 12 | 0.6077 |

모든 몬스터 출력은 투명 배경 512×512 WebP다. 132개 모두 있고 각 파일은 80KB 이하다.

## 배경

모두 1280×853 WebP이며, 아래 크기는 소수 첫째 자리에서 반올림한 값이다.

| 시트 | 파일 | 크기 |
|---|---|---:|
| 23a-1 | `dungeon/bg-gate.webp` | 173.7KB |
| 23a-2 | `dungeon/bg-f1.webp` | 139.5KB |
| 23a-3 | `dungeon/bg-f2.webp` | 104.4KB |
| 23a-4 | `dungeon/bg-f3.webp` | 153.9KB |
| 23a-5 | `dungeon/bg-f4.webp` | 183.2KB |
| 23a-6 | `dungeon/bg-f5.webp` | 156.4KB |
| 23a-7 | `dungeon/bg-boss.webp` | 161.4KB |
| 23a-8 | `dungeon/bg-endless.webp` | 175.2KB |

## UI·칭호

UI 아이콘 20개는 256×256 WebP다. 파일 크기 범위는 12.9~27.8KB다.

| 시트 | 파일 키 | 개수 | 크기 범위 |
|---|---|---:|---:|
| 23b-1 | `dungeon-rank3`, `rank2`, `rank1`, `perfect` | 4 | 13.5~21.4KB |
| 23b-2 | `dungeon-door`, `door-open`, `chest`, `chest-open` | 4 | 14.7~19.1KB |
| 23b-3 | `dungeon-faint`, `revive`, `gauge`, `ultimate` | 4 | 17.1~27.8KB |
| 23b-4 | `dungeon-mark`, `core`, `break`, `hourglass` | 4 | 21.7~25.7KB |
| 23b-5 | `dungeon-tab`, `slot`, `invite`, `record` | 4 | 12.9~19.7KB |

칭호 메달 8개는 256×256 WebP(14.8~16.8KB), 작은 그림 8개는 96×96 WebP(3.9~4.6KB)다.

| 시트 | 파일 키 | 큰 그림/작은 그림 |
|---|---|---:|
| 23c-1 | `dungeon-first`, `rank3`, `rank2`, `rank1` | 4/4 |
| 23c-2 | `dungeon-perfect`, `flawless`, `record`, `hunter` | 4/4 |

## 생성·점검

- 원본 시트는 커밋하지 않았다. 내장 생성 기능이 시트마다 서로 다른 픽셀 크기를 출력했으나, 자르기 도구는 시트의 실제 크기를 사용하며 최종 파일 크기는 위 규격으로 맞췄다.
- 다시 만든 횟수: 22a-1 한 번, 나머지 시트는 0번. 배경 입구는 200KB 아래로 압축 품질을 조정했다.
- 넣지 못한 그림: 없음. `slice-map.csv`의 22·23번 168파일과 칭호 작은 그림 8파일, 합계 176파일이 모두 있다.
- 눈으로 확인: 배경 8장 전부와 몬스터·UI·칭호 대표 파일을 확인했다. 전체 176개 포즈·아이콘의 세부 형태는 PR에서 추가 육안 검토가 필요하다.
- `npm run build:assets` 통과. `npm run check`는 로컬 CRLF 때문에 처음 실패했으나 지시서의 임시 LF 변환 후 **1213/1213 통과**했다. 줄바꿈 변환은 되돌렸다. `check:cloudflare`, `check:load`, `check:sql` 통과.
- 앱은 아직 새 그림을 읽지 않는다. 이 그림만 머지해도 앱 화면은 바뀌지 않는다.
