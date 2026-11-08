# DONE 66 — 펫 아레나 스킬 연출 그림

선생님이 그림 GPT로 만든 시트 7장(`SUMUS-pet-arena-66.zip`, 66-1 ~ 66-7)을 받아 `CODEX_PROMPT_66.md`의 "넣기" 명령 그대로 잘라 넣었다.

## 점검
- 시트 66-1 · 2 · 3 · 4 · 7: 1024×1024 RGBA, 네 모서리와 가운데 줄 alpha 0(진짜 투명), 투명 81~93%.
- 66-5 · 66-6: 1024×1536 배경(투명 없음) → 720×1080 webp.
- 글자 · 숫자 · 체크무늬 없음. 칸마다 효과 하나, 겹치거나 잘린 칸 없음(미리보기로 확인).
- 기존 그림 삭제 · 수정 없음(새 파일만).

## 넣은 그림 19장 (`public/assets/arena/`)
| 시트 | 그림 | 크기 | 용량 |
|---|---|---|---|
| 66-1 | fx-flame-breath · fx-water-jet · fx-lightning · fx-ice-spear | 긴 쪽 512 | 50 · 51 · 33 · 28KB |
| 66-2 | fx-meteor · fx-boulder · fx-bubble · fx-crit | 256 | 15 · 18 · 17 · 23KB |
| 66-3 | fx-petal-field · fx-crack-field · fx-ice-field · fx-poison-cloud | 긴 쪽 384 | 26 · 25 · 24 · 19KB |
| 66-4 | fx-vine · fx-tornado · fx-clone | 256 | 25 · 20 · 22KB |
| 66-7 | team-blue · team-red | 256 | 14 · 13KB |
| 66-5 | lobby-bg | 720×1080 | 64KB |
| 66-6 | vs-2v2 | 720×1080 | 177KB |

합계 약 716KB. 다시 만든 횟수: 0(받은 그대로 한 번에 통과).

## 눈으로 확인 필요
- 테스트 앱 아레나에서 불 뿜기 · 물대포 줄기가 펫 입에서 상대 쪽으로 뻗는지, 장판이 세 경기장 바닥에 잘 보이는지.
- lobby-bg · vs-2v2 · team-blue/red는 실시간 대전(③ · ④단계) 화면에서 쓴다. 지금은 앱 어디서도 부르지 않는다.
