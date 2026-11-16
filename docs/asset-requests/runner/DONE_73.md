# 그림 73 완료 기록

스킬트리 판과 조각 4개를 내장 그림 생성 기능으로 제작했다. 원본 PNG는 커밋하지 않았다.

| 그림 | 파일 | 크기 | 용량 |
|---|---|---:|---:|
| 73-1 스킬트리 판 | `public/assets/arena/tree-bg.webp` | 720×1080 | 84KB |
| 73-2 노드 바탕 | `public/assets/arena/tree-node.webp` | 256×256 | 10.7KB |
| 73-2 고른 노드 빛 | `public/assets/arena/tree-node-on.webp` | 256×256 | 16.3KB |
| 73-2 잠긴 노드 | `public/assets/arena/tree-lock.webp` | 256×256 | 13.4KB |
| 73-2 빛 줄기 | `public/assets/arena/tree-flow.webp` | 256×256 | 5.0KB |

- 다시 그린 횟수: 각 시트 0회.
- 눈으로 확인 필요: 실제 스킬트리 화면에서 여덟 소켓과 게임 노드의 위치 일치, 선택 빛과 흐르는 줄기의 합성, 잠긴 노드의 판독성.
- 73-2의 네 조각은 WebP alpha가 있다.
- `npm run check`는 기존 전투 검사 `V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent`에서 실패했다. 검사 파일은 수정하지 않았다.
