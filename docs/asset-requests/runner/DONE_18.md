# 그림 18 작업 완료 기록

## 넣은 그림

| 펫 키 | 설정 시트 | 표정 시트 | 기본 그림 | 표정 그림 | 알 반응 | 160px 작은 그림 |
|---|---|---|---:|---:|---:|---:|
| frog | 18a-1 | 18b-1~3, 25 | 4 | 12 | 2 | 4 |
| sapsaree | 18a-2 | 18b-4~6, 25 | 4 | 12 | 2 | 4 |
| deer | 18a-3 | 18b-7~9, 26 | 4 | 12 | 2 | 4 |
| bear | 18a-4 | 18b-10~12, 26 | 4 | 12 | 2 | 4 |
| seal | 18a-5 | 18b-13~15, 27 | 4 | 12 | 2 | 4 |
| wolf | 18a-6 | 18b-16~18, 27 | 4 | 12 | 2 | 4 |
| crocodile | 18a-7 | 18b-19~21, 28 | 4 | 12 | 2 | 4 |
| octopus | 18a-8 | 18b-22~24, 28 | 4 | 12 | 2 | 4 |
| **합계** | **8장** | **28장** | **32** | **96** | **16** | **32** |

새 펫 그림 144개와 작은 그림 32개, 총 176개를 `public/assets/pets/`에 추가했다. 원본 시트 PNG는 커밋하지 않았다.

## 넣지 못한 그림

없음.

## 시트마다 다시 만든 횟수

18a-1~8 및 18b-1~28: 모두 0회.

## 눈으로 확인 필요

없음. 36장 미리보기를 눈으로 확인했다. 성장 단계, 소품, 표정, 알 무늬와 두 펫의 구분을 확인했다. 원본 시트 36장의 네 모서리 alpha는 모두 0이었다.

## 점검

- `npm ci`: 완료.
- `npm run build:assets`: PASS (`content-validation`, `browser-syntax` 포함). `public/sw.js`가 갱신됐다.
- `npm run check`: 로컬 Windows 체크아웃에서 실패. 최초 메시지: `[release-check] FAIL · V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent`. 추적된 `public/`, `server/` 텍스트 파일 165개를 임시로 LF로 바꾸고 다시 실행해도 `[release-check] FAIL · V13.82 five games a day`에서 실패했다. 임시 줄바꿈 변경은 모두 되돌렸다.
- `npm run check:cloudflare`: PASS.
- 새 그림 176개 모두 존재하며 기본·표정·알 반응은 512×512, 작은 그림은 160×160이고 모두 알파 채널을 가진다.
