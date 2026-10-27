# 그림 43 완료 기록

내장 그림 생성 기능으로 6장을 만들고, 저장소 그림을 참고해 21개 WebP로 잘랐다. 모든 시트는 첫 후보를 사용했으며 다시 만든 횟수는 0회다.

| 시트 | 넣은 파일 | 다시 만든 횟수 |
|---|---|---:|
| 43-1 | `claw/machine.webp` | 0 |
| 43-2 | `claw/chute-front.webp`, `claw/glass-glare.webp`, `claw/prize-door.webp`, `claw/chute-glow.webp` | 0 |
| 43-3 | `claw/claw-open.webp`, `claw/claw-closed.webp`, `claw/claw-grip-back.webp`, `claw/claw-grip-front.webp` | 0 |
| 43-4 | `claw/carriage.webp`, `claw/rail-x.webp`, `claw/rail-y.webp`, `claw/fx-clack.webp` | 0 |
| 43-5 | `claw/stick-base.webp`, `claw/stick-knob.webp`, `claw/btn-drop.webp`, `claw/btn-drop-down.webp` | 0 |
| 43-6 | `claw/readout.webp`, `claw/timer-ring.webp`, `claw/icon-ticket.webp`, `claw/icon-box.webp` | 0 |

넣지 못한 그림은 없다. 원본 PNG는 커밋하지 않았다. 네 모서리 투명도를 확인했고, 잘라낸 집게 4장은 같은 384×362 크기다. 눈으로 확인 필요: 실제 게임 화면에 겹쳤을 때의 위치와 크기는 게임 코드가 생긴 뒤 확인해야 한다.

기계 원본 높이 기준 대략적인 위치: 유리창 안쪽은 23~56%, 바닥은 48~57%, 배출구 구멍은 51~56%이며 왼쪽에 있다. 배출구 앞벽과 상품 문을 겹칠 때 실제 그림을 기준으로 다시 재야 한다.

점검: `npm run build:assets` 통과. `npm run check`는 `[release-check] FAIL · V13.99 battle.js sends idx with choice and spelling answers and locks the word once sent`로 실패했다. `npm run check:cloudflare`는 종료 코드 0이었으며 `[supabase-sync] revision moved; re-uploading local snapshot { expected: 42, remote: 43 }`을 출력했다.

인형뽑기는 게임 코드(다음 세션)가 생겨야 앱에 나온다.
