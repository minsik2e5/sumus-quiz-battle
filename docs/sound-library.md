# 효과음 라이브러리 (V13.116)

앱의 효과음 파일은 `public/assets/sfx/<key>.mp3`이고, 재생은 `public/modules/sound.js`의 `playSound(key)`가 한다. 파일을 아직 받지 못했으면 `playSound`가 false를 돌려주고, 부른 곳이 예전 신호음을 낸다.

| key | 쓰는 곳 | 출처 | 길이 |
|---|---|---|---:|
| `correct` | 정답(학습·야차전 콤보는 단계마다 높아짐) | 우리가 합성(`docs/sound/synth.mjs`의 `correct_bell`) | 1.22초 |
| `wrong` | 오답·시간 초과 | 우리가 합성(`docs/sound/synth.mjs`의 `wrong_soft`) | 1.1초 |
| `combo` | 콤보 단계 업, 학습 이정표, 야차전 시작·피버, 진화 시작 | 우리가 합성(`docs/sound/synth.mjs`의 `combo_rise`) | 1.18초 |
| `tick` | 남은 시간 째깍, 코인 뽑기 다이얼, 진화 깜빡임 | 우리가 합성(`docs/sound/synth.mjs`의 `tick_wood`) | 0.09초 |
| `tap` | 이모트(버튼 터치용) | 우리가 합성(`docs/sound/synth.mjs`의 `tap_pop`) | 0.12초 |
| `coin` | 코인 넣기, 코인 조금 받기 | 우리가 합성(`docs/sound/synth.mjs`의 `coin_ding`) | 1.13초 |
| `coins` | 코인 많이 받기 | 우리가 합성(`docs/sound/synth.mjs`의 `coin_shower`) | 1.36초 |
| `wiggle` | 알·캡슐 흔들림, 알 두드리기, 두근 박동 | 우리가 합성(`docs/sound/synth.mjs`의 `wiggle_tok`) | 0.41초 |
| `crack` | 알에 금 가기 | 우리가 합성(`docs/sound/synth.mjs`의 `crack_glass`) | 0.75초 |
| `burst` | 전설 알 폭발, KO, 진화 완료 | 우리가 합성(`docs/sound/synth.mjs`의 `burst_magic`) | 2.28초 |
| `pop` | 알·캡슐 열림 | 우리가 합성(`docs/sound/synth.mjs`의 `burst_pop`) | 1.44초 |
| `fanfare-basic` | 기본 알 부화 | 우리가 합성(`docs/sound/synth.mjs`의 `fanfare_basic`) | 1.84초 |
| `fanfare-epic` | 영웅 펫 등장, 코인 뽑기 대박(×3) | 우리가 합성(`docs/sound/synth.mjs`의 `fanfare_epic`) | 2.6초 |
| `fanfare-legend` | 전설 펫 등장 | 우리가 합성(`docs/sound/synth.mjs`의 `fanfare_legend`) | 3.92초 |
| `fanfare-mythic` | 신화 펫 등장(신화 연출 세션에서 연결) | 우리가 합성(`docs/sound/synth.mjs`의 `fanfare_mythic`) | 5.68초 |
| `clear` | 야차전·몬스터전 승리, 던전 클리어 | 우리가 합성(`docs/sound/synth.mjs`의 `fanfare_clear`) | 2.88초 |
| `levelup` | 코인 뽑기 ×2, 진화 완료 | 우리가 합성(`docs/sound/synth.mjs`의 `small_levelup`) | 1.54초 |
| `fail` | 패배, 코인 뽑기 꽝 | 우리가 합성(`docs/sound/synth.mjs`의 `fail_sigh`) | 2.61초 |
| `hit` | 정답으로 때리기 | 우리가 합성(`docs/sound/synth.mjs`의 `hit_snap`) | 0.45초 |
| `slash` | 크리티컬에 겹치는 베기 | 우리가 합성(`docs/sound/synth.mjs`의 `hit_slash`) | 0.7초 |
| `smash` | 큰 피해·크리티컬·KO | 우리가 합성(`docs/sound/synth.mjs`의 `hit_smash`) | 1.24초 |
| `hurt` | 내 펫이 맞음 | 우리가 합성(`docs/sound/synth.mjs`의 `hurt_oof`) | 0.9초 |
| `skill` | 특기·미니게임 성공 | 우리가 합성(`docs/sound/synth.mjs`의 `skill_cast`) | 2.04초 |
| `boss` | 전설 연출의 낮은 울림(앞 1.5초), 던전 보스 등장(던전 세션에서 연결) | 우리가 합성(`docs/sound/synth.mjs`의 `boss_enter`) | 4.78초 |
| `door` | 던전 문(던전 세션에서 연결) | Kenney rpg-audio 팩 `doorOpen_1` (CC0) | |
| `step` | 던전 층 이동(던전 세션에서 연결) | Kenney rpg-audio 팩 `footstep00` (CC0) | |
| `atk-star` | 던전: 별빛 · 불꽃 · 얼음 펫의 발사 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `atk-star`) | |
| `atk-leaf` | 던전: 풀 · 바위 펫의 발사(잎 네 발) | 우리가 합성(`docs/sound/battle-synth.mjs`의 `atk-leaf`) | |
| `atk-wind` | 던전: 바람 · 물 · 독 펫의 발사 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `atk-wind`) | |
| `hit-star` | 던전: 별빛 계열이 맞힘 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `hit-star`) | |
| `hit-leaf` | 던전: 풀 계열이 맞힘 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `hit-leaf`) | |
| `hit-wind` | 던전: 바람 계열이 맞힘 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `hit-wind`) | |
| `dmg-tick` | 던전: 피해 숫자가 한 줄씩 쌓일 때(줄마다 높아짐) | 우리가 합성(`docs/sound/battle-synth.mjs`의 `dmg-tick`) | |
| `crit` | 던전: 영어 쓰기 정답 · 브레이크 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `crit`) | |
| `boss-charge` | 던전: 보스가 빨간펜 채점을 준비함 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `boss-charge`) | |
| `warn-beep` | 던전: 내가 채점 표적이 됨 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `warn-beep`) | |
| `boss-slam` | 던전: 보스가 내려찍음 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `boss-slam`) | |
| `shield-block` | 던전: 채점 방어(3연속 정답) | 우리가 합성(`docs/sound/battle-synth.mjs`의 `shield-block`) | |
| `ult-riser` | 던전: 합동 필살 컷인 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `ult-riser`) | |
| `ult-impact` | 던전: 합동 필살 · 브레이크가 터짐 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `ult-impact`) | |
| `boss-roar` | 던전: 보스 등장 · 페이즈 바뀜 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `boss-roar`) | |
| `type-key` | 던전: 영어 쓰기 글자 칸 누름 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `type-key`) | |
| `type-ok` | 던전: 맞는 글자(칸마다 높아짐) | 우리가 합성(`docs/sound/battle-synth.mjs`의 `type-ok`) | |
| `type-wrong` | 던전: 틀린 글자 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `type-wrong`) | |
| `spell-done` | 던전: 단어를 다 씀 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `spell-done`) | |
| `faint` | 던전: 펫 기절 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `faint`) | |
| `revive` | 던전: 펫 부활 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `revive`) | |
| `combo-10` | 던전: 10콤보마다 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `combo-10`) | |
| `boss-down` | 던전: 보스가 쓰러짐 | 우리가 합성(`docs/sound/battle-synth.mjs`의 `boss-down`) | |
| `card-flip` | 짝 맞추기: 카드가 뒤집힘(GO에 물결처럼) | 우리가 합성(`docs/sound/match-synth.mjs`의 `card-flip`) | || `swoosh` | 짝 맞추기: 맞힌 두 카드 · +1초 · 코인이 날아감 | 우리가 합성(`docs/sound/match-synth.mjs`의 `swoosh`) | || `stamp` | 짝 맞추기: 결과의 별 · 신기록 도장이 쾅 찍힘 | 우리가 합성(`docs/sound/match-synth.mjs`의 `stamp`) | |
| `reel-cast` | 낚시: 던지기 휙(낚싯대 바람 + 줄 풀림 + 스풀 촤르르) | 우리가 합성(`docs/sound/reel-synth.mjs`의 `reel-cast`) | |
| `reel-plop` | 낚시: 찌가 물에 퐁당, 놓친 마무리 | 우리가 합성(`docs/sound/reel-synth.mjs`의 `reel-plop`) | |
| `reel-nibble` | 낚시: 가짜 입질 톡톡, 리듬 퍼펙트 | 우리가 합성(`docs/sound/reel-synth.mjs`의 `reel-nibble`) | |
| `reel-bite` | 낚시: 진짜 입질 쑥 | 우리가 합성(`docs/sound/reel-synth.mjs`의 `reel-bite`) | |
| `reel-hook` | 낚시: 챔질(묵직한 쿵 + 줄 팅), 특기 · 마무리 성공 | 우리가 합성(`docs/sound/reel-synth.mjs`의 `reel-hook`) | |
| `reel-click` | 낚시: 릴 딸깍(감는 속도만큼 잦고 높게), 탈출 연타 · 리듬 버튼 | 우리가 합성(`docs/sound/reel-synth.mjs`의 `reel-click`) | |
| `reel-strain` | 낚시: 줄 텐션 끼익(이어지는 소리, 0.8초 주기를 되풀이, 텐션만큼 크고 높게) | 우리가 합성(`docs/sound/reel-synth.mjs`의 `reel-strain`) | |
| `reel-creak` | 낚시: 빨간 칸 끼익, 던지기 젖힘, 날뜀 · 실패 | 우리가 합성(`docs/sound/reel-synth.mjs`의 `reel-creak`) | |
| `reel-snap` | 낚시: 줄 끊김 | 우리가 합성(`docs/sound/reel-synth.mjs`의 `reel-snap`) | |
| `reel-run` | 낚시: 돌진 · 잠수 · 리듬 시작(드래그가 끼이이잉) | 우리가 합성(`docs/sound/reel-synth.mjs`의 `reel-run`) | |
| `reel-jump` | 낚시: 마무리 점프 첨벙, 날뜀 | 우리가 합성(`docs/sound/reel-synth.mjs`의 `reel-jump`) | |
| `reel-splash` | 낚시: 끌어올림 물보라(공개), 특기 · 큰 성공 | 우리가 합성(`docs/sound/reel-synth.mjs`의 `reel-splash`) | |
| `reel-sparkle` | 낚시: 퍼펙트 캐스팅 · 마무리, 기술 성공 | 우리가 합성(`docs/sound/reel-synth.mjs`의 `reel-sparkle`) | |
| `tm-count` | 10초 맞추기: 3 · 2 · 1 카운트다운 삑 | 우리가 합성(`docs/sound/timing-synth.mjs`의 `tm-count`) | |
| `tm-go` | 10초 맞추기: 시작 | 우리가 합성(`docs/sound/timing-synth.mjs`의 `tm-go`) | |
| `tm-hide` | 10초 맞추기: 숫자판이 꺼질 때 | 우리가 합성(`docs/sound/timing-synth.mjs`의 `tm-hide`) | |
| `tm-tick` | 10초 맞추기: 숨김 중 아주 작은 째깍(설정으로 끔) | 우리가 합성(`docs/sound/timing-synth.mjs`의 `tm-tick`) | |
| `tm-press` | 10초 맞추기: 큰 버튼 누름 딸깍 | 우리가 합성(`docs/sound/timing-synth.mjs`의 `tm-press`) | |
| `tm-reveal` | 10초 맞추기: 숫자 공개 띠링 | 우리가 합성(`docs/sound/timing-synth.mjs`의 `tm-reveal`) | |
| `tm-perfect` | 10초 맞추기: 완벽 | 우리가 합성(`docs/sound/timing-synth.mjs`의 `tm-perfect`) | |
| `tm-great` | 10초 맞추기: 훌륭 | 우리가 합성(`docs/sound/timing-synth.mjs`의 `tm-great`) | |
| `tm-good` | 10초 맞추기: 좋음 | 우리가 합성(`docs/sound/timing-synth.mjs`의 `tm-good`) | |
| `tm-miss` | 10초 맞추기: 아쉬움(격려 톤) | 우리가 합성(`docs/sound/timing-synth.mjs`의 `tm-miss`) | |
| `tm-record` | 10초 맞추기: 내 최고 기록 갱신 팡파르 | 우리가 합성(`docs/sound/timing-synth.mjs`의 `tm-record`) | |
| `fish-turn` | 낚시: 참치 몸부림 · 긴 돌진 중 방향 한 번 꺾기(촥 + 지잉) | 우리가 합성(`docs/sound/feel-synth.mjs`의 `fish-turn`) | 0.99초 · 8KB |
| `fish-ink` | 낚시: 대왕오징어 먹물 뿜기(퓨슉 + 꿀렁), 오징어 몸 분사(높게 작게) | 우리가 합성(`docs/sound/feel-synth.mjs`의 `fish-ink`) | 1.34초 · 10KB |
| `fish-glide` | 낚시: 가오리 · 대왕쥐가오리 좌우 미끄러짐(쉬이익) | 우리가 합성(`docs/sound/feel-synth.mjs`의 `fish-glide`) | 1.35초 · 10KB |
| `fish-lure` | 낚시: 아귀 발광 미끼 깜빡(띠링) | 우리가 합성(`docs/sound/feel-synth.mjs`의 `fish-lure`) | 1.33초 · 9KB |
| `fish-thump` | 낚시: 상어 · 고래상어 · 주름상어 치고 빠짐(쿵 + 촥) | 우리가 합성(`docs/sound/feel-synth.mjs`의 `fish-thump`) | 1.10초 · 9KB |
| `rod-tick` | 낚시: 새싹 · 은빛 낚싯대 릴(가벼운 톡) | 우리가 합성(`docs/sound/feel-synth.mjs`의 `rod-tick`) | 0.05초 · 1KB |
| `rod-ratchet` | 낚시: 보석 · 전설 낚싯대 릴(묵직한 드르륵) | 우리가 합성(`docs/sound/feel-synth.mjs`의 `rod-ratchet`) | 0.09초 · 1KB |
| `rod-drag` | 낚시: 줄 풀리는 소리(단계마다 높낮이가 다름), 감촉 미리듣기 | 우리가 합성(`docs/sound/feel-synth.mjs`의 `rod-drag`) | 0.92초 · 8KB |
| `rod-shimmer` | 낚시: 보석 · 전설 낚싯대 반짝이(감기 · 챔질) | 우리가 합성(`docs/sound/feel-synth.mjs`의 `rod-shimmer`) | 1.12초 · 8KB |
| `rod-snap-heavy` | 낚시: 보석 · 전설 낚싯대 줄 끊김(쩌억 + 쿵) | 우리가 합성(`docs/sound/feel-synth.mjs`의 `rod-snap-heavy`) | 1.28초 · 10KB |
| `trophy-boom` | 낚시: 월척 순간(쿠웅 + 물보라 + 금빛 종) | 우리가 합성(`docs/sound/feel-synth.mjs`의 `trophy-boom`) | 2.13초 · 17KB |
| `deep-hum` | 낚시: 깊은 바다 낮은 울림(이어지는 소리, 1.2초 주기) | 우리가 합성(`docs/sound/feel-synth.mjs`의 `deep-hum`) | 3.60초 · 22KB |
| `deep-bubble` | 낚시: 깊은 바다 물방울 보글 | 우리가 합성(`docs/sound/feel-synth.mjs`의 `deep-bubble`) | 1.05초 · 7KB |
| `deep-pass` | 낚시: 깊은 바다 입질 직전 큰 그림자(우우웅) | 우리가 합성(`docs/sound/feel-synth.mjs`의 `deep-pass`) | 2.60초 · 16KB |

## 출처와 라이선스
- **우리가 합성한 소리**: `docs/sound/synth.mjs`로 만든다(종소리 배음 · 마림바 · 쓸어올리는 바람 소리 · 저음 울림 · 반짝이 · 리버브를 겹침). 다시 만들 때: `npm i --no-save @breezystack/lamejs` 후 `node docs/sound/synth.mjs <출력 폴더>` → 원하는 파일을 `public/assets/sfx/<key>.mp3`로 복사. 우리가 만든 것이라 제약이 없다.
- **낚시 소리(V13.164)**: `docs/sound/reel-synth.mjs`. 물소리는 크고 작은 물방울(민나르트 공명: 울리며 높아지는 사인)을 촘촘히 흩뿌리고, 끼익은 마찰이 붙었다 미끄러지는 톡을 낚싯대 · 줄 공명으로 거른다. `reel-strain`은 같은 0.8초를 세 번 이어 붙인 파일이고, 앱은 가운데 0.8초만 되풀이한다(`sound.js`의 `SOUND_LOOP`와 주기를 같게 둔다).
- **10초 맞추기 소리(V13.180)**: `docs/sound/timing-synth.mjs`. 전자 시계 삑(사인 + 약한 홀수 배음) · 째깍(좁은 대역 잡음 톡) · 플라스틱 버튼 딸깍(쿵 + 스위치 똑)에 종 · 마림바 · 금관 · 반짝이를 겹쳤다. 모두 2초 이하 · 64~96kbps로 작게(11개 합 약 120KB).
- **Kenney**(kenney.nl, CC0): 출처 표기 없이 써도 된다.
- **Mixkit**(mixkit.co): 시청 페이지에 후보로 들어 있다. 앱·게임·교육·상업용은 무료이고 출처 표기도 필요 없지만, **파일 자체를 따로 재배포하면 안 된다.** 이 저장소는 공개(PUBLIC)라서 Mixkit 원본 파일은 저장소에 넣지 않는다. 쓰려면 저장소를 비공개로 바꾸거나, 배포 단계에서만 넣는 방법을 먼저 정한다.

## 소리를 바꾸는 법
1. 같은 key 이름으로 `public/assets/sfx/<key>.mp3`를 바꾼다(모노, 96~192kbps, 200KB 이하, 음량은 최고점 -1dB 정도).
2. 크기가 다른 소리끼리는 `sound.js`의 `SOUND_GAIN`으로 맞춘다.
3. `npm run build:assets`(효과음도 배포 해시에 들어가서 설치된 앱이 새로 받는다), `npm run check`.
