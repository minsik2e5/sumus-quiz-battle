# 그림 56 작업 완료

## 넣은 그림

| 파일 (`public/assets/` 기준) | 내용 | 크기 | 선택 |
|---|---|---|---|
| `ui/bug-egg.webp` | 곤충 채집 알 | 256×256 | 56a-1 왼쪽 위 |
| `ui/dino-egg.webp` | 공룡 화석 알 | 256×256 | 56a-1 오른쪽 위 |
| `titles/bugall.webp` | 곤충 채집왕 · 영웅 보라 방패 | 256×256 | 56b-1 왼쪽 위 |
| `titles/bugall-s.webp` | 곤충 채집왕 작은 그림 | 96×96 | 같은 시안 |
| `titles/dinoall.webp` | 쥬라기 반장 · 영웅 보라 방패 | 256×256 | 56b-1 오른쪽 위 |
| `titles/dinoall-s.webp` | 쥬라기 반장 작은 그림 | 96×96 | 같은 시안 |
| `ui/preview-56.webp` | PR 코멘트용 두 시트 선택 결과를 합친 작은 미리보기 | 512×512 | 검토용 |

## 생성·검토

- 내장 이미지 생성 기능 사용. API 키와 Google Drive는 사용하지 않았다.
- 최종 프롬프트: `split/56a-1 곤충 채집 알 공룡 화석 알 상점 아이콘.txt`, `split/56b-1 곤충 채집왕 쥬라기 반장 칭호 메달.txt`에서 지정된 Drive 참조·저장 지시 줄을 삭제하고, CODEX_PROMPT_56.md의 참고 이미지 문장을 세 번째 줄에 삽입했다. 지정된 기존 그림을 참고로 첨부했다.
- 시트마다 첫 생성 1회, 다시 만든 횟수: 56a-1 0회 / 56b-1 0회.
- 두 시트 모두 위쪽 주 시안을 선택했다. 아래쪽 여분은 별도 등록하지 않았다.
- 넣지 못한 필수 그림: 없음. 원본 PNG는 커밋하지 않았다.
- 자르기 미리보기를 눈으로 확인했고, 6개 최종 아이콘의 크기와 알파 채널을 검사했다.
- **눈으로 확인 필요**: 실제 앱 크기에서 알의 무늬와 메달 중앙 그림, 기존 영웅 방패 테두리와의 일치도를 최종 확인해 주세요.

## 기준 브랜치와 검사

- 운영 브랜치에 `56a-theme-egg-icons.txt`가 없어 `claude/bug-dino-pets-plan`에서 `codex/art-56`을 만들었다. PR 대상도 `claude/bug-dino-pets-plan`이다.
- `npm ci`: 통과.
- `npm run build:assets`: 통과. `public/sw.js`만 실제 내용이 바뀌었다.
- `npm run check`: 실패. 앱 코드·점검 파일을 수정하지 않았다. 실패 메시지 원문:

```text
Error: [release-check] FAIL · V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent
```

- `npm run check:cloudflare`: 통과(종료 코드 0, 로컬 모의 저장소 검사).
- PR 기준 브랜치와 비교해 기존 그림 삭제·수정 없음. 운영 브랜치와 비교하면 기준 브랜치에 원래 없는 SFX 14개가 D로 표시되지만, 이번 작업에서는 해당 파일을 건드리지 않았다.
- 운영 Supabase 연결 없음. 앱 코드·버전 변경 없음. 머지하지 않았다.

새 펫 · 알 · 칭호는 코드 등록(다음 세션) 후에 앱에 나온다
