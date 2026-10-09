# 그림 19 완료 기록

2026-10-09. 내장 그림 생성 기능으로 19a~19e 시트 42장(2×2 시트 37장, 세로 배경 5장)을 만들고, 원본 PNG를 커밋하지 않은 채 WebP 181개를 추가했다. 시트 재생성 횟수는 **모두 0회**다.

## 펫 그림

| 펫 | 설정 | 표정 | 기본 | 표정 | 알 반응 | 작은 그림 | 등장 포즈 |
|---|---|---|---:|---:|---:|---:|---:|
| 미호·구미호 `gumiho` | 19a-1 | 19b-1~3, 22 | 4 | 12 | 2 | 4 | 1 |
| 청룡 `cheongryong` | 19a-2 | 19b-4~6, 22 | 4 | 12 | 2 | 4 | 1 |
| 백호 `baekho` | 19a-3 | 19b-7~9, 23 | 4 | 12 | 2 | 4 | 1 |
| 주작 `jujak` | 19a-4 | 19b-10~12, 23 | 4 | 12 | 2 | 4 | 1 |
| 현무 `hyeonmu` | 19a-5 | 19b-13~15, 24 | 4 | 12 | 2 | 4 | 1 |
| 천마 `cheonma` | 19a-6 | 19b-16~18, 24 | 4 | 12 | 2 | 4 | 1 |
| 주먹이 `riceball` | 19a-7 | 19b-19~21, 25 | 4 | 12 | 2 | 4 | — |
| **합계** | **7장** | **25장** | **28** | **84** | **14** | **28** | **6** |

펫 기본·표정·알 반응·작은 그림 154개와 등장 포즈 6개다. 주먹이 등장 포즈는 주문서 대상이 아니다.

## 등장 연출과 이벤트 그림

크기는 각 WebP 파일의 소수점 첫째 자리 KiB다.

| 구분 | 시트 | 파일과 크기 |
|---|---|---|
| 균열 4 | 19c-1 | `fx/mythic-crack-1.webp` 19.6, `-2` 54.0, `-3` 84.3, `-4` 102.3 |
| 빛 4 | 19c-2 | `fx/mythic-rays.webp` 113.8, `fx/mythic-ring.webp` 96.9, `fx/mythic-stars.webp` 145.1, `fx/mythic-aurora.webp` 84.2 |
| 장식 4 | 19c-3 | `ui/mythic-badge.webp` 59.6, `ui/mythic-frame.webp` 51.0, `ui/mythic-banner.webp` 36.4, `ui/mythic-egg.webp` 66.5 |
| 등장 포즈 6 | 19d-1~2 | `pets/gumiho-reveal.webp` 186.5, `cheongryong-reveal.webp` 199.1, `baekho-reveal.webp` 214.6, `jujak-reveal.webp` 214.4, `hyeonmu-reveal.webp` 201.8, `cheonma-reveal.webp` 192.9 |
| 오라·반짝이 2 | 19d-2 | `ui/mythic-aura.webp` 100.4, `ui/mythic-sparkles.webp` 97.5 |
| 세로 배경 5 | 19e-1~5 | `reveal/bg-gumiho.webp` 116.2, `bg-cheongryong.webp` 102.8, `bg-baekho.webp` 116.3, `bg-jujak.webp` 87.6, `bg-hyeonmu.webp` 114.8 |
| 응원 아이콘 2 | 19b-25 | `ui/cheer-egg.webp` 14.7, `ui/cheer-deco.webp` 12.0 |

배경은 모두 720×1080, 150 KiB 이하이고, 등장 포즈와 효과는 모두 250 KiB 이하다.

## 넣지 못한 그림

없음. 주문서의 181개 파일을 모두 넣었다.

## 점검

- 펫 154 + 등장 포즈 6 + 효과 8 + 장식·오라·반짝이·응원 아이콘 8 + 배경 5 = **181개**. 이름, WebP 형식, 투명 자산 네 모서리의 alpha 0, 배경 크기와 용량을 확인했다.
- 설정·표정·알 반응·연출·배경 미리보기를 눈으로 확인했다. 알에는 얼굴이나 균열이 없고, 각 시트 그림은 분리되어 있다. 배경에는 캐릭터·글자가 없다.
- `npm ci` 완료. `npm run build:assets` PASS (`content-validation`, `browser-syntax`).
- `npm run check`는 Windows CRLF 때문에 처음 실행 시 `V13.99 battle.js sends idx …`, 두 번째 실행 시 `V13.96 칭호 65개…`에서 멈췄다. 추적 중인 텍스트를 LF로 바꾼 뒤 **PASS 1198/1198**. 해당 줄바꿈 변경은 검사 후 되돌렸다.
- `npm run check:cloudflare` PASS (`cloudflare-check`, `battle-room-check`). 출력의 503은 실패 시뮬레이션이다.
- 기존 자산은 수정·삭제하지 않았다. 빌드 생성물 `public/sw.js`만 수정됐다.

## 눈으로 확인 필요

- 앱의 신화 등장 연출 코드는 이 PR에 없으므로, 배경·균열·빛·포즈를 실제 화면에 합성한 모습은 해당 코드 연결 후 확인해야 한다.

새 그림은 아직 앱 코드에서 참조하지 않는다. 이 PR만 머지해도 앱 화면은 바뀌지 않는다.
