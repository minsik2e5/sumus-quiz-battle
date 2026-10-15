# Codex 작업 지시: 그림 28 (바다 펫 3종 · 19시트)

## 목표
낚시 진주 교환소에서만 얻는 **바다 펫 3종**의 그림을 만들고 `public/assets/pets/`에 넣은 뒤 PR을 만든다. **그림 파일만 넣는다. 앱 코드는 고치지 않는다**(펫 등록 · 특기는 Claude가 한다).

| 펫(이름은 임시) | key | 모습 |
|---|---|---|
| 퐁당 · 돌고래 | `dolphin` | 하늘색 아기 돌고래, 꼬리로 물보라 위에 선다 |
| 살랑 · 해마 | `seahorse` | 산호 분홍 해마, 꼬리를 말고 떠 있다 |
| 집게 · 소라게 | `hermitcrab` | 복숭아색 소라게, 파스텔 소라 껍데기를 지고 있다 |

- 28a 설정 시트 3장(알 · 아기 · 성장 · 최종) → 28b 표정 9장 + 알 반응 2장 → 28c 공격 · 맞음 자세 5장. 칸마다 넣을 파일은 `slice-map.csv`의 `list` 열이 `28a-` · `28b-` · `28c-`로 시작하는 줄을 본다(빈 칸은 줄이 없다).
- 이미 있는 펫(해달 달이 · 펭귄 펭이 · 상어 파도 · 물범 동글 · 문어 말랑 · 별고래)과 달라 보여야 한다.

## 꼭 지킬 것
- **그리기 전에 Drive의 기존 그림을 열어 그림체를 맞춘다.**
  - 28a: 펫 폴더 "SUMUS_PET_SPRITES_ALL_20261002/original_1254"(MONG · NABI · PINKY · BAMBOO의 01_baby · 02_grown · 03_final)
  - 28b · 28c: 같은 펫의 **28a 설정 시트**(Drive 폴더 "SUMUS 바다 펫 28 (Runner용)")를 열어 얼굴 · 색 · 무늬 · 크기를 맞춘다. 28c는 "SUMUS 전투 자세 20 (Runner용)"의 `20-1.png`도 열어 자세의 세기를 맞춘다.
- **결과는 정해진 Drive 폴더 "SUMUS 바다 펫 28 (Runner용)"에 정확한 파일 이름(`28a-1.png` ~ `28a-3.png`, `28b-1.png` ~ `28b-11.png`, `28c-1.png` ~ `28c-5.png`)으로 저장한다.** 채팅에 보여 주는 것만으로는 안 된다.
- 순서: **28a를 먼저 다 끝낸다** → 28b → 28c.
- 브랜치는 `sumus-voca-prod-deploy`에서 새로 만든다. 예: `codex/art-28`. 그 브랜치에 `docs/asset-requests/runner/28a-sea-pets-design.txt`가 없으면 `claude/zen-knuth-m0c31z`에서 시작한다.
- **PR까지만 만든다. 머지하지 않는다.** **운영 Supabase에 연결하지 않는다.** Codex 내장 그림 생성 기능으로 만든다.
- `public/assets/pets/` 아래 새 그림, `DONE_28.md`, `public/sw.js` 말고는 고치지 않는다. 기존 펫 그림은 지우거나 덮어쓰지 않는다.

## 자르고 넣기 (24번 새 펫과 같은 방식)
- 28a: 펫 기본 그림처럼 `--stand`(칸마다 512px 바닥에 세우기), 작은 그림 `-s`도 같이.
- 28b · 28c: 같은 펫 · 단계의 기본 그림에 맞춰 `--base pets/<key>-<단계>`.
- 미리보기를 한 장으로 합쳐 PR에 코멘트. `DONE_28.md`(한국어)에 넣은 그림 표, 다시 만든 횟수, "눈으로 확인 필요".
- `npm ci && npm run build:assets && npm run check && npm run check:cloudflare`. PR 대상 `sumus-voca-prod-deploy`, 제목 `그림 28: 바다 펫 3종`, 마지막 줄 `> ⚠️ 머지하면 운영에 바로 배포됩니다.` **머지하지 않는다.**
