# SUMUS 공부방 캐릭터 에셋 브리프 (Codex용)

공부방 앱의 캐릭터를 이미지 에셋으로 만든다. 학생은 이 중 하나를 골라 쓰고, 앱은 학생 상태에 따라 자세 이미지를 바꿔 보여 준다.

## 1. 그림체

**치이카와 같은 손그림 귀요미 그림체**를 기준으로 한다. 그림체(선, 비율, 표정 느낌)는 최대한 비슷하게, **캐릭터 자체는 새로 만든 오리지널**로.

- **선**: 진한 갈색(#5a3b2b 근처)의 부드럽고 살짝 떨리는 손그림 선, 굵기 거의 일정, 끝이 둥글다
- **색**: 그림자 없는 평면 파스텔 채색. 몸은 흰색/크림/연한 색 위주, 포인트 색은 1~2개만
- **몸**: 머리와 몸이 하나로 이어진 작고 동글한 찹쌀떡 모양. **머리가 몸의 절반 이상**, 약 1.5~2등신. 팔다리는 아주 짧고 뭉툭한 동그라미
- **얼굴**: 얼굴 아래쪽에 작게 모인 이목구비. **작은 점 눈 + 흰 하이라이트 한 점**, 눈 사이가 조금 넓게. 아주 작은 입(ω, ㅅ, 동그란 o). **볼에 분홍 타원 + 빗금 3~4줄**
- **표정**: 순하고 약간 어리바리, 쉽게 울먹이거나 놀라는 느낌. 웃을 땐 입을 크게 벌려 활짝
- **동작**: 손발을 쫙 펴거나 몸을 작게 웅크리는 등 과장되고 귀여운 몸짓

### 하면 안 되는 것
- 치이카와·하치와레·우사기 등 **기존 캐릭터 그 자체를 그리거나 똑같이 만들지 말 것**. 그림체만 참고하고 캐릭터는 새로.
- 글자, 로고, 워터마크 넣지 말 것.

## 2. 파일 규격

- 캐릭터 1개당 **스프라이트 시트 PNG 1장**: 3열 × 2행 격자, 칸마다 **512 × 512px** (전체 1536 × 1024px)
- **배경 투명** (책상, 벽 없음 — 앱이 따로 그림)
- 모든 칸에서 캐릭터의 **크기와 위치가 똑같아야 함**. 자세만 바뀜
- 칸 안 배치: 캐릭터는 가운데, **아래쪽 20%(y 410~512px)에 펼친 책과 두 손**이 오게. 책상 윗면이 y≈420px 높이라고 생각하고 그 위에 책이 놓인 모습. 캐릭터 몸 아래는 칸 아래 끝에서 잘려도 됨
- 파일 이름: `characters/<영문id>.webp` (권장, 용량이 작음) 또는 `.png` (예: `characters/bear.webp`)

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
Art style: Chiikawa-like hand-drawn kawaii doodle — soft slightly wobbly dark-brown outline,
flat pastel colors with no shading, tiny round mochi body where the head is bigger than the body
(about 1.5 heads tall), very short stubby round arms, small dot eyes with one white highlight set
a little far apart low on the face, tiny mouth, pink oval blush with 3 small diagonal hatch lines,
innocent slightly clumsy expression.
Upper body only, sitting behind an open book at the bottom of each cell, front view.
Character: {설명}.
Cells: 1) head down reading the book, eyes looking down  2) looking up at the viewer, book open, neutral
3) happy wide open-mouth smile, resting  4) yawning, eyes closed, mouth wide open, little tear
5) dozing off with head down, eyes closed  6) raising both stubby arms, cheering "you can do it!"
A brand-new original character (do not draw Chiikawa, Hachiware, Usagi or any existing character).
No text, no logo, no background.
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

**1-2차 (기본 캐릭터 추가 16종)** — 한 반에서 캐릭터가 겹치지 않게 하려면 기본 캐릭터가 반 인원보다 많아야 해서 추가한다. 1차 8종과 같은 크기·위치·그림체로, **책 색은 캐릭터마다 다르게**, 귀·꼬리가 칸 밖으로 나가지 않게 좌우 여백을 둔다. 결과는 `.webp`로.

| id | 이름 | {설명} | 공부 성격 |
|---|---|---|---|
| hamster | 볼빵빵 | a round golden hamster with stuffed puffy cheeks and a sunflower seed hairpin | 간식 먹으며 공부 |
| fox | 여우비 | a small orange fox with a white-tipped fluffy tail and big pointy ears | 요령 좋은 정리왕 |
| panda | 판다곰 | a chubby panda with black eye patches shaped like teardrops and a bamboo pencil | 느긋하지만 꾸준 |
| koala | 코코알라 | a gray koala with big fluffy round ears and a leaf on its head | 졸음과 싸우는 중 |
| pig | 꿀꿀이 | a pink piglet with a round snout and a tiny curly tail, wearing a yellow headband | 먹고 공부하고 반복 |
| sheep | 몽글양 | a fluffy cream sheep with cloud-like wool and small curled horns | 포근한 모범생 |
| duck | 꽥꽥이 | a yellow duckling with an orange bill and a small blue sailor hat | 시끄럽지만 열정적 |
| frog | 개굴이 | a green frog with big round eyes on top and a tiny lily pad hat | 점프하듯 진도 빠름 |
| lion | 사자후 | a little lion cub with a soft fluffy orange mane like a flower | 기세로 밀어붙임 |
| tiger | 호랭이 | a baby tiger with orange and dark stripes and a white muzzle | 한국의 기상 |
| hedgehog | 고슴 | a small hedgehog with soft brown spikes and a cream face, holding a highlighter | 예민한 완벽주의 |
| raccoon | 너굴 | a gray raccoon with a black eye mask and a striped ringed tail | 밤에 몰래 공부 |
| redpanda | 레서 | a red panda with reddish fur, white cheek marks and a ringed fluffy tail | 귀여움으로 버팀 |
| alpaca | 파카 | a cream alpaca with a fluffy wool top-knot and a long neck scarf | 침착한 멘탈갑 |
| chick | 삐약이 | a tiny fluffy yellow chick with a bit of eggshell on its head | 이제 막 시작한 신입 |
| turtle | 거북선 | a green baby turtle with a hexagon-patterned shell | 느려도 끝까지 |

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

- `study-room/public/characters/<id>.webp`(또는 `.png`)에 넣으면 앱이 칸을 잘라 자세별로 쓴다.
- 얼굴 아이콘(순위, 친구 목록)은 3번 칸(rest)의 위쪽을 잘라 쓴다.
- 빈자리(자리 비움)는 앱이 빈 의자로 그린다.
