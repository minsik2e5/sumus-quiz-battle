# 그림 17 작업 B 완료 기록

## 넣은 그림

| 펫 키 | 설정 시트 | 표정 시트 | 기본 그림 | 표정 그림 | 알 반응 | 160px 작은 그림 |
|---|---|---|---:|---:|---:|---:|
| squirrel | 17a-1 | 17b-1~3, 25 | 4 | 12 | 2 | 4 |
| turtle | 17a-2 | 17b-4~6, 25 | 4 | 12 | 2 | 4 |
| duck | 17a-3 | 17b-7~9, 26 | 4 | 12 | 2 | 4 |
| sheep | 17a-4 | 17b-10~12, 26 | 4 | 12 | 2 | 4 |
| redpanda | 17a-5 | 17b-13~15, 27 | 4 | 12 | 2 | 4 |
| arcticfox | 17a-6 | 17b-16~18, 27 | 4 | 12 | 2 | 4 |
| koala | 17a-7 | 17b-19~21, 28 | 4 | 12 | 2 | 4 |
| parrot | 17a-8 | 17b-22~24, 28 | 4 | 12 | 2 | 4 |
| **합계** | **8장** | **28장** | **32** | **96** | **16** | **32** |

새 펫 그림 144개와 작은 그림 32개, 총 176개를 `public/assets/pets/`에 넣었다. 설정 시트는 `fit-assets.mjs --stand`, 표정과 알 반응은 `fit-sheets.mjs`로 잘랐다. 원본 시트 PNG는 커밋하지 않았다.

## 넣지 못한 그림

없음.

## 시트마다 다시 만든 횟수

17b-23: 2회. 내장 그림 생성 도구가 처음 두 번 빈 결과를 반환해 세 번째 생성본을 사용했다. 그 밖의 17a-1~8 및 17b-1~28: 0회.

## 눈으로 확인 필요

없음. 36장 미리보기를 눈으로 확인했다. 양은 복숭아빛 털·짧은 목·둥근 뿔로 구분하고, 영웅 4종은 기본 4종보다 화려한 성장·최종 단계로 만들었다. 176개 파일의 존재, 512px/160px 크기와 알파 채널을 확인했다.

## 점검

- `npm ci`: 완료.
- `npm run build:assets`: PASS (`content-validation`, `browser-syntax` 포함). 이 명령으로 `public/sw.js`가 갱신됐다.
- `npm run check`: 실패. `[release-check] FAIL · V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent`
- 로컬 Windows 체크아웃의 `battle.js`는 CRLF이며, 해당 검사는 LF 줄바꿈이 포함된 문자열을 그대로 찾는다. 줄바꿈을 LF로 정규화하면 그 문자열이 존재한다. PR의 GitHub `release-check`는 PASS.
- `npm run check:cloudflare`: PASS.
- 그림 176개 모두 파일 존재, 512×512/160×160 크기, 알파 채널 확인.
