# 그림 70 완료 기록

내장 그림 생성 기능으로 스타일 가이드 70-1과 투명 배경 시트 70-2~70-5를 제작했다. 70-1은 참고용으로만 보관하고 저장소에는 넣지 않았다. 원본 PNG도 커밋하지 않았다.

| 시트 | 넣은 그림 | 경로 | 크기 | 용량 |
|---|---|---|---:|---:|
| 70-2 | 공격 | `public/assets/arena/ui2-ico-attack.webp` | 128×128 | 5.9KB |
| 70-2 | 필살 | `public/assets/arena/ui2-ico-ult.webp` | 128×128 | 5.8KB |
| 70-2 | 회피 | `public/assets/arena/ui2-ico-dodge.webp` | 128×128 | 7.1KB |
| 70-2 | 교체 | `public/assets/arena/ui2-ico-swap.webp` | 128×128 | 7.0KB |
| 70-2 | 연습장 | `public/assets/arena/ui2-ico-practice.webp` | 128×128 | 5.8KB |
| 70-2 | 꾸미기 | `public/assets/arena/ui2-ico-deco.webp` | 128×128 | 7.3KB |
| 70-2 | 랭킹 | `public/assets/arena/ui2-ico-rank.webp` | 128×128 | 4.0KB |
| 70-2 | 입장권 | `public/assets/arena/ui2-ico-ticket.webp` | 128×128 | 5.0KB |
| 70-2 | 코인 | `public/assets/arena/ui2-ico-coin.webp` | 128×128 | 6.7KB |
| 70-2 | 잠금 | `public/assets/arena/ui2-ico-lock.webp` | 128×128 | 5.8KB |
| 70-2 | 설명 | `public/assets/arena/ui2-ico-info.webp` | 128×128 | 6.5KB |
| 70-2 | 나가기 | `public/assets/arena/ui2-ico-exit.webp` | 128×128 | 5.5KB |
| 70-2 | 메달 1 | `public/assets/arena/ui2-ico-medal1.webp` | 128×128 | 6.4KB |
| 70-2 | 메달 2 | `public/assets/arena/ui2-ico-medal2.webp` | 128×128 | 6.0KB |
| 70-2 | 메달 3 | `public/assets/arena/ui2-ico-medal3.webp` | 128×128 | 6.3KB |
| 70-2 | 이모트 | `public/assets/arena/ui2-ico-emote.webp` | 128×128 | 6.4KB |
| 70-3 | 유리 판 | `public/assets/arena/ui2-panel.webp` | 444×286 | 7.5KB |
| 70-3 | 금 테 | `public/assets/arena/ui2-frame.webp` | 452×283 | 12.4KB |
| 70-3 | 칩 | `public/assets/arena/ui2-chip.webp` | 354×118 | 6.6KB |
| 70-3 | HUD 띠 | `public/assets/arena/ui2-hudbar.webp` | 512×164 | 16.2KB |
| 70-4 | 공격 버튼 | `public/assets/arena/ui2-btn-attack.webp` | 256×256 | 12.0KB |
| 70-4 | 필살 버튼 | `public/assets/arena/ui2-btn-ult.webp` | 256×256 | 11.3KB |
| 70-4 | 스킬 버튼 | `public/assets/arena/ui2-btn-skill.webp` | 256×256 | 10.5KB |
| 70-4 | 회피 버튼 | `public/assets/arena/ui2-btn-dodge.webp` | 256×256 | 9.3KB |
| 70-5 | 교체 버튼 | `public/assets/arena/ui2-btn-swap.webp` | 256×256 | 9.0KB |
| 70-5 | 조이스틱 바닥 | `public/assets/arena/ui2-joy-base.webp` | 256×256 | 8.9KB |
| 70-5 | 조이스틱 손잡이 | `public/assets/arena/ui2-joy-knob.webp` | 256×256 | 9.6KB |
| 70-5 | 준비됨 고리 | `public/assets/arena/ui2-ready-ring.webp` | 256×256 | 15.3KB |

- 다시 그린 횟수: 70-2 두 번(칸 경계에 닿는 아이콘 수정). 다른 시트는 0회.
- 눈으로 확인 필요: 70-1 스타일 가이드의 금 테 위계, 128px 아이콘 판독성, 9-slice를 늘린 화면에서 테두리와 가운데의 자연스러움, 버튼 위 게임 아이콘을 올렸을 때 가독성, 준비됨 고리의 투명한 가운데.
- 70-2는 `slice-grid.mjs`의 칸 경계 검사를 통과했다. 모든 조각은 WebP alpha가 있다.
- `npm run check`는 기존 전투 검사 `V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent`에서 실패했다. 검사 파일은 수정하지 않았다.
