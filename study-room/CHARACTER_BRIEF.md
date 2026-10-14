# SUMUS 공부방 캐릭터 에셋 브리프 (Codex용)

공부방 앱의 캐릭터를 이미지 에셋으로 만든다. 학생은 이 중 하나를 골라 쓰고, 앱은 학생 상태에 따라 자세 이미지를 바꿔 보여 준다.

## 1. 그림체

말랑하고 동글동글한 일본/한국풍 손그림 귀요미 스타일.

- **선**: 굵기 일정한 부드러운 갈색 손그림 선 (#5a3b2b 근처), 끝이 둥근 선
- **색**: 그림자 거의 없는 평면 파스텔 채색, 아주 옅은 음영 한 단계까지만
- **몸**: 머리와 몸이 하나로 이어진 찹쌀떡 같은 둥근 덩어리, 2~2.5등신, 짧고 뭉툭한 팔
- **얼굴**: 작은 점 눈(하이라이트 한 점), 아주 작은 입(ω, ㅅ 모양), **볼에 분홍 동그라미 + 빗금 3줄**
- **느낌**: 순하고 약간 어리바리한 표정, 귀엽지만 유치하지 않게 (고등학생이 써도 괜찮게)

### 하면 안 되는 것
- 기존 캐릭터(치이카와, 하치와레, 우사기, 산리오, 포켓몬, 카카오프렌즈, 라인프렌즈, 잔망루피 등)를 따라 그리거나 닮게 만들지 말 것. **완전히 새 캐릭터**여야 함.
- 특히 "흰 몸 + 작은 곰귀", "흰 고양이 + 파란 머리 무늬", "노란 몸 + 긴 귀 토끼" 조합은 피할 것.
- 글자, 로고, 워터마크 넣지 말 것.

## 2. 파일 규격

- 캐릭터 1개당 **스프라이트 시트 PNG 1장**: 3열 × 2행 격자, 칸마다 **512 × 512px** (전체 1536 × 1024px)
- **배경 투명** (책상, 벽 없음 — 앱이 따로 그림)
- 모든 칸에서 캐릭터의 **크기와 위치가 똑같아야 함**. 자세만 바뀜
- 칸 안 배치: 캐릭터는 가운데, **아래쪽 20%(y 410~512px)에 펼친 책과 두 손**이 오게. 책상 윗면이 y≈420px 높이라고 생각하고 그 위에 책이 놓인 모습. 캐릭터 몸 아래는 칸 아래 끝에서 잘려도 됨
- 파일 이름: `characters/<영문id>.png` (예: `characters/bear.png`)

### 칸 순서 (왼쪽 위부터)

| 칸 | 자세 | 설명 |
|---|---|---|
| 1 | study | 고개 숙이고 책 읽기 (눈은 아래를 봄) |
| 2 | look | 고개 들고 정면 보기, 책은 펼친 채, 입 다문 무표정 |
| 3 | rest | 쉬는 중: 정면, 활짝 웃는 얼굴, 손은 책 위에 |
| 4 | yawn | 하품: 눈 감고 입 크게 벌림 |
| 5 | sleep | 고개 숙이고 꾸벅 졸기: 눈 감음 (선택: 작은 z 표시 없이 — 앱이 💤를 따로 띄움) |
| 6 | cheer | 한 손 들고 반갑게 인사 / 화이팅 (목표 달성, 확인 창에서 씀) |

같은 캐릭터 6장이 **같은 캐릭터처럼 보이는 것**이 제일 중요하다. 한 번에 시트 한 장으로 생성할 것.

## 3. 프롬프트 템플릿

```
A character sprite sheet, 3 columns x 2 rows, each cell 512x512, transparent background.
The SAME original character in every cell, identical size and position, only the pose changes.
Style: soft hand-drawn kawaii doodle, consistent rounded brown outline, flat pastel colors,
round mochi-shaped body where head and body are one blob, tiny dot eyes with one highlight,
tiny mouth, pink round blush with three small diagonal hatch lines, short stubby arms.
Upper body only, sitting behind an open book at the bottom of each cell, front view.
Character: {설명}.
Cells: 1) head down reading the book, eyes looking down  2) looking up at the viewer, book open, neutral
3) happy big smile, resting  4) yawning, eyes closed, mouth wide open
5) dozing off with head down, eyes closed  6) raising one paw, cheering "you can do it"
Original character, not resembling any existing franchise character. No text, no logo, no background.
```

`{설명}` 자리에 아래 캐릭터 설명을 넣는다.

## 4. 캐릭터 목록

**1차 (먼저 만들 8종)** — 동물 위주로 고르기 쉽게

| id | 이름 | {설명} | 공부 성격 |
|---|---|---|---|
| bear | 콩떡곰 | a chubby light-brown bear with round ears and a cream belly, wearing a small green scarf | 꾸준히 매일 하는 타입 |
| bunny | 말랑토끼 | a white lop-eared bunny with long droopy pink-lined ears that hang down beside its face | 필기·형광펜 덕후 |
| cat | 치즈냥 | an orange cheese-tabby cat with three stripes on its forehead and pointy ears | 공부하다 자주 조는 타입 |
| penguin | 펭펭 | a navy-blue baby penguin with a white face and belly and a tiny yellow beak | 새벽 공부파 |
| puppy | 누렁멍 | a cream puppy with floppy caramel-brown ears and a tiny red collar | 친구 응원 담당 |
| owl | 부엉박사 | a round brown owl with big round glasses and little ear tufts | 밤샘 공부파 |
| squirrel | 도토리 | an orange squirrel with a big fluffy tail behind it and an acorn-shaped hairpin | 벼락치기 장인 |
| otter | 해달이 | a sea otter, grayish brown, holding a small clam like a notebook | 문제집 수집가 |

**2차 (나중에 레벨업 보상으로 해금할 캐릭터)** — 다양하게

| id | 이름 | {설명} | 테마 |
|---|---|---|---|
| seal | 물범떡 | a fluffy white baby seal with gray spots and flipper hands | 바다 |
| octopus | 문어쌤 | a pink baby octopus wearing tiny glasses, holding pens in several tentacles | 바다 |
| mochi | 찰떡이 | a soft rice-cake creature dusted with yellow bean powder | 한국 간식 |
| potato | 감자꾼 | a little potato creature with tiny sprout on its head | 한국 간식 |
| riceball | 주먹밥 | a triangle rice ball creature with a seaweed wrap belly | 한국 간식 |
| tofu | 두부 | a soft white cube-ish tofu creature, wobbly | 한국 간식 |
| ghost | 꼬마유령 | a small white ghost with a wavy bottom, carrying a tiny lantern | 밤 |
| dino | 아기공룡 | a mint-green baby dinosaur with soft back spikes | 판타지 |
| cloud | 구름이 | a fluffy cloud creature, sleepy, with a little raindrop | 판타지 |
| star | 별똥이 | a pale yellow star-shaped creature with rounded points | 판타지 |

## 5. 받은 뒤 앱 연결

- `study-room/public/characters/<id>.png` 에 넣으면 앱이 칸을 잘라 자세별로 쓴다.
- 얼굴 아이콘(순위, 친구 목록)은 3번 칸(rest)의 위쪽을 잘라 쓴다.
- 빈자리(자리 비움)는 앱이 빈 의자로 그린다.
