# SUMUS VOCA 디자인 리뉴얼 참고 조사 (2026-11)

> 과감한 시안 3가지(① 게임 로비형 ② 모험 지도형 ③ 큰 글자 미니멀)의 근거 자료입니다. **시안과 스크린샷, 규칙 요약, 실제로 입히는 순서는 8~10장에 있습니다.** 바쁘시면 8장의 그림부터 보시면 됩니다.
>
> **베끼지 않습니다.** 다른 게임·앱의 그림, 캐릭터, 로고, 화면, 전용 글꼴은 가져오지 않습니다. "왜 좋아 보이는지"라는 **원리만** 가져옵니다. 이미지도 내려받지 않았습니다.
>
> **표시 읽는 법** (모든 표에 붙였습니다)
> - **[확인]** 이번 조사에서 그 페이지를 직접 열어 읽었습니다.
> - **[검색]** 검색 결과 요약으로만 봤습니다. 원문 페이지는 열지 못했습니다.
> - **[통념]** 널리 알려진 내용입니다. 이번에 직접 확인하지 못했습니다. 시안 전에 실제 화면으로 다시 봐야 합니다.
> - **[제안]** 관찰이 아니라 우리 앱에 쓰자는 제안값입니다.
>
> **중요한 한계:** 이 작업 환경은 GitHub와 npm 저장소만 직접 열 수 있었습니다. 그 밖의 사이트(Duolingo 디자인 가이드, 토스, 눈누, 게임 UI 자료 사이트 등)는 모두 접속이 막혔습니다. 자세한 목록은 7장에 있습니다.

## 선생님이 읽을 요약

- **지금 앱이 "AI 슬롭" 같은 이유는 "기본값"만 쓰였기 때문입니다.** 둥근 흰 카드, 연한 그라디언트, 이모지 아이콘, 영어 꼬리표가 모두 AI가 아무 지시 없을 때 고르는 것들입니다. 6장 표에 증상 14가지와 우리 규칙을 적었습니다.
- **색·여백만 고쳐서는 달라 보이지 않습니다.** 달라 보이게 하는 것은 ① 제목 글꼴 ② 버튼 모양(두꺼운 아랫단) ③ 화면 뼈대(카드 목록 대신 무대·지도·큰 글자) 세 가지입니다.
- **게임들은 한 화면에 "가장 큰 버튼 하나"만 둡니다.** 가운데에 캐릭터, 아래에 큰 버튼, 나머지는 가장자리 작은 아이콘입니다. 우리 홈도 "오늘 할 일 하나"가 가장 커야 합니다.
- **버튼은 "눌리는 물건"처럼 만듭니다.** 아래쪽에 진한 단을 두고, 누르면 그만큼 내려갑니다. CSS만으로 가능하고 가볍습니다.
- **글꼴은 2개만 씁니다.** 제목용 1개 + 본문용 1개. 본문은 Pretendard, 제목은 주아(Jua)·Bagel Fat One·검은고딕 중에서 고르기를 추천합니다. 모두 무료이고 웹에 올려 써도 됩니다(5장).
- **쿠키런 글꼴은 쓰면 안 됩니다.** 라이선스에 "게임 산업(PC/모바일) 사용 금지"가 있습니다. 우리 앱은 게임 요소가 커서 위험합니다.
- **숫자를 정해 두고 그 안에서만 씁니다.** 글자 크기 6단계, 색 12개 안팎, 둥근 정도 3가지. 지금의 189가지·2,388가지·150가지를 이 숫자로 줄이는 것이 리뉴얼의 실제 작업입니다.

## 1. 게임 UI에서 가져올 원리

이 장은 대부분 **[통념]** 과 **[검색]** 입니다. 게임 화면 자료 사이트(Game UI Database, Interface In Game)가 막혀서 화면을 직접 보지 못했습니다. 시안을 만들기 전에 선생님이나 제가 실제 게임 화면을 한 번 보고 확인해야 합니다.

### 1-1. Supercell (Brawl Stars · Clash Royale · Squad Busters)

| 항목 | 관찰한 것 | 가져올 원리 |
|---|---|---|
| 화면 뼈대 | 메뉴에 버튼이 많아도 위계와 묶음이 분명해서 가운데가 비어 보입니다 [검색]. 가운데에는 캐릭터가 섭니다 [통념]. | 홈 가운데는 펫의 무대로 비웁니다. 메뉴는 가장자리로 보냅니다. |
| 가장 큰 버튼 | Clash Royale은 가장 중요한 버튼에 노란색을 씁니다 [검색]. "전투" 버튼이 가장 눈에 띕니다 [검색]. | 화면마다 주 버튼은 1개, 색도 1가지로 고정합니다. 다른 곳에 그 색을 쓰지 않습니다. |
| 버튼 구조 | 굵은 글자 + 진한 외곽선 + 아래쪽 진한 단. 누르면 내려갑니다 [통념]. 정확한 px는 확인 못 함. | 아랫단 4~6px [제안]. 누르면 그만큼 내려가고 단이 사라집니다. |
| 버튼 신호 | 버튼이 "누를 수 있는 것"으로 분명히 보입니다 [검색]. | 누를 수 있는 것만 입체로 만듭니다. 정보 칸은 평평하게 둡니다. |
| 탭 바 | 아래에 화면 이동 바가 있고, 옆으로 밀어 탭을 넘깁니다 [검색]. 가운데 탭이 전투입니다 [통념]. 탭 개수는 확인 못 함. | 탭은 5개 이하. 가운데 탭을 "오늘 학습/대결"로 두고 조금 크게 합니다. |
| 팝업 | 전체 화면 대신 팝업을 써서 뒤 화면이 보입니다. 지금 어디 있는지 알기 쉽습니다 [검색]. | 보상·확인은 팝업으로. 뒤 배경은 어둡게만 합니다. |
| 보상 | 이기면 상자를 받고, 열리는 시간이 보입니다. 기다림 자체가 기대가 됩니다 [검색]. | 보상은 "받는 순간"과 "여는 순간"을 나눕니다. |
| 글꼴 | Clash 계열은 전용 글꼴(Supercell-Magic), Squad Busters는 맞춤 글꼴 "Squad"(한글 포함)를 씁니다 [검색]. 공개된 글꼴이 아닙니다. | 전용 글꼴은 쓸 수 없습니다. "굵고 둥근 제목 글꼴 1개"라는 원리만 가져옵니다. |

### 1-2. Royal Match · Monopoly GO · Mob Control

| 항목 | 관찰한 것 | 가져올 원리 |
|---|---|---|
| 할 일의 수 | Royal Match는 할 수 있는 일이 사실상 둘뿐입니다(꾸미기, 다음 판) [검색]. | 홈에서 고를 것을 2~3개로 줄입니다. |
| 움직임의 역할 | 움직임으로 "보상이 어디서 와서 어디로 가는지"를 알려 줍니다. 그래서 설명 글이 줄어듭니다 [검색]. | 코인·경험치는 얻은 곳에서 위쪽 숫자로 날아가게 합니다. 설명 문장을 지웁니다. |
| 보상 크기 | Monopoly GO는 큰 상 UI가 항상 가장 크고 눈에 띕니다 [검색]. 긴 이벤트는 지금 구간만 보여 줍니다 [검색]. | 진행 막대는 "다음 보상까지"만 보여 줍니다. 다음 보상 그림을 크게 둡니다. |
| 무거운 연출 | 화면에 그림이 너무 많으면 버벅인다는 리뷰가 있습니다 [검색]. | 연출은 짧게, 한 번에 하나만. 우리 렉 방지 규칙과 같은 방향입니다. |
| 연출 겹치기 | 흔들림 + 입자 + 숫자 올라가기 + 소리를 한순간에 겹치면 입체감이 납니다(Balatro 분석 글) [검색]. | 큰 보상에만 3가지를 겹칩니다. 작은 보상은 숫자만 올립니다. |
| Mob Control | 자료를 찾지 못했습니다. 큰 숫자와 단순한 색 덩어리가 특징입니다 [통념]. | 점수·연속 정답 숫자를 화면에서 가장 큰 글자로 씁니다. |

### 1-3. Pokémon 모바일 (TCG Pocket 등) · 쿠키런 킹덤

| 항목 | 관찰한 것 | 가져올 원리 |
|---|---|---|
| 손맛 | TCG Pocket은 "실물 카드의 느낌"을 목표로 했습니다. 팩을 밀어서 뜯고, 카드를 한 장씩 넘깁니다 [검색]. | 뽑기·알 부화는 "탭 한 번"이 아니라 "밀기/문지르기" 한 동작을 넣습니다. |
| 희귀 신호 | 좋은 카드가 나올 때 소리와 빛이 먼저 나옵니다 [검색]. | 희귀 펫은 열기 전에 색·빛으로 미리 알립니다. |
| 건너뛰기 | 연출을 건너뛸 수 없어 여러 번 열 때 귀찮다는 불만이 큽니다 [검색]. | 모든 연출에 "건너뛰기"를 둡니다. 두 번째부터는 짧은 판을 씁니다. |
| 쿠키런 킹덤 | UI를 분석한 글을 찾지 못했습니다. 굵은 둥근 글자, 진한 갈색 외곽선, 나무·천 느낌 판이 특징입니다 [통념]. | 판(패널)에 "재질"을 하나 정합니다. 흰 카드 대신 종이·나무·천 중 하나로 통일합니다. |
| 포켓몬 메뉴 | 큰 색 덩어리 버튼, 흰 굵은 글자, 아이콘 한 종류 [통념]. Pokémon Sleep/Café 자료는 찾지 못했습니다. | 메뉴 버튼마다 고유 색 1개. 아이콘은 한 가지 그림체로만 그립니다. |

### 1-4. 여러 게임에 공통인 "눌리는 느낌" 숫자

| 항목 | 값 | 표시 |
|---|---|---|
| 누름 반응이 시작되는 시간 | 50~100ms 안 | [검색] |
| 누를 때 줄어드는 크기 | 0.95~0.98배, 떼면 튕겨 돌아옴 | [검색] |
| 흔한 동작(버튼, 탭) | 100~150ms | [확인] GitHub 금지 목록 |
| 큰 전환(화면 이동, 팝업) | 200~300ms | [확인] 같은 곳 |
| 움직일 속성 | transform과 opacity만. 너비·높이는 움직이지 않음 | [확인] 같은 곳 |
| 끝없이 도는·깜박이는 것 | 금지. 뭔가 바뀔 때만 움직임 | [확인] 같은 곳 |

## 2. 학습 앱에서 가져올 원리

### 2-1. Duolingo

공식 디자인 가이드(design.duolingo.com)는 접속이 막혔습니다. 아래는 검색 요약입니다.

| 항목 | 관찰한 것 | 가져올 원리 |
|---|---|---|
| 색 이름 | 색마다 이름이 있습니다. Feather Green이 중심색, Eel이 글자색, Snow가 배경색입니다 [검색, 공식 사이트 요약]. | 색에 쉬운 이름을 붙이고 역할을 하나씩만 줍니다. |
| 중심색 값 | Feather Green은 #58CC02라고 여러 2차 자료가 같게 적습니다 [검색]. | 값은 베끼지 않습니다. "중심색 1개가 앱 전체를 대표"만 가져옵니다. |
| 버튼 | 아래쪽에 더 진한 색 단을 둬서 눌리는 물건처럼 보입니다. 이 단이 없으면 Duolingo처럼 보이지 않는다고 합니다 [검색, 2차 자료]. 정확한 px는 자료마다 달라 확인 못 함. | 1-1의 버튼 규칙과 같습니다. 모든 주 버튼에 같은 두께의 아랫단. |
| 글꼴 | 제목은 Feather Bold, 본문은 DIN 계열 둥근 글꼴. 둘을 한 문장에 섞지 않습니다 [검색]. 둘 다 공개 글꼴이 아닙니다. | 제목 글꼴과 본문 글꼴을 한 문장에 섞지 않습니다. |
| 홈 = 길 | 2022년에 홈을 "한 줄로 따라가는 길"로 바꿨습니다. 어디를 할지 고르지 않게 하려는 것입니다 [검색, 공식 블로그 요약]. | ② 모험 지도형의 근거입니다. 단원을 길 위의 동그라미로 놓습니다. |
| 길의 단점 | 순서를 못 고른다는 불만이 컸습니다 [검색]. | 시험 범위는 직접 고를 수 있게 지름길을 둡니다. |
| 캐릭터 | 길 옆에서 캐릭터가 응원합니다 [검색]. 단순한 도형으로 그리고, 입 모양·자세에도 규칙이 있습니다 [검색]. "외곽선 없음" 같은 세부 규칙은 확인 못 함. | 펫 그림체 규칙을 한 장으로 정합니다(도형, 외곽선 유무, 그림자 방식). |

### 2-2. Kahoot · Blooket · Gimkit · Prodigy · Quizlet

| 앱 | 관찰한 것 | 가져올 원리 |
|---|---|---|
| Kahoot | 중심색은 보라(#46178f). 색은 2개, 많아야 3개만 쓰라고 가이드에 적혀 있습니다 [검색, 브랜드 가이드 요약]. | 한 화면에 강한 색은 2개까지. |
| Kahoot | 답 4개가 색 + 도형으로 구분됩니다 [검색]. | 4지선다 보기에 색과 도형(또는 번호)을 같이 줍니다. 색만으로 구분하지 않습니다. |
| Gimkit | 맞히면 돈을 벌고, 그 돈으로 강화합니다 [검색]. 게임 방식이 여러 가지입니다 [검색]. | 보상이 "쓸 곳"과 바로 이어져 보여야 합니다. |
| Blooket | 학생이 게임 방식을 고르는 것을 좋아합니다 [검색]. 화면 디자인 자료는 찾지 못했습니다. | 대결 방식 선택 화면을 "포스터 고르기"처럼 크게 만듭니다. |
| Prodigy | 공부를 판타지 전투로 감쌉니다 [검색]. | 대결 화면은 공부 화면이 아니라 전투 화면처럼 보이게 합니다. |
| 공통 주의 | **고등학생은 이런 화면을 "유치하다"고 느끼는 경우가 많습니다** [검색]. | 고등학생용이므로 아기 같은 파스텔·동글동글은 줄입니다. 게임 로비 쪽(진한 색, 굵은 글자)이 더 맞습니다. |
| Quizlet | 자료를 찾지 못했습니다. 단어 카드 한 장이 화면 가운데 크게 있습니다 [통념]. | 단어 학습 화면은 단어 하나만 크게. ③ 큰 글자형의 근거입니다. |

### 2-3. 말해보카 · 클래스카드

| 앱 | 관찰한 것 | 가져올 원리 |
|---|---|---|
| 말해보카 | "퀴즈만 풀어도" 진행되는 방식이라고 소개합니다 [검색, 앱 소개 문구]. 화면 분석 글은 찾지 못했습니다. | 설명 없이 바로 문제부터 시작합니다. |
| 클래스카드 | 검색 결과가 없었습니다. 확인 못 함. | (비워 둡니다. 선생님이 쓰는 화면을 보고 채웁니다.) |

## 3. 한국 앱 감각

토스·당근·카카오 공식 디자인 문서는 모두 접속이 막혔습니다.

| 앱 | 관찰한 것 | 가져올 원리 |
|---|---|---|
| 토스 | 단순함을 "설명 없이 본능적으로 이해할 수 있는 상태"라고 정의합니다 [검색, 토스 블로그 요약]. | 화면마다 "설명 글이 없어도 되는가"를 확인합니다. |
| 토스 | 문구를 모두 "해요체"로 통일합니다. 필요 없는 글자를 지우는 "잡초 뽑기" 원칙이 있습니다 [검색]. | 문구는 해요체 하나로. 영어 꼬리표(PLAYGROUND 등)는 잡초로 보고 뽑습니다. |
| 토스 | 한 화면에 할 일 하나 [검색, 2차 자료. 공식 문서는 확인 못 함]. | 1-1의 "주 버튼 1개"와 같은 원리입니다. |
| 토스 | 전용 글꼴(Toss Product Sans)을 모든 곳에 씁니다 [검색]. 글자 크기 단계표는 찾지 못했습니다. | 글꼴 하나를 끝까지 씁니다. 글자 단계는 5장 뒤 제안값을 씁니다. |
| 토스 | 무거운 주제를 가볍게 하려고 작은 움직임을 씁니다 [검색]. | 움직임은 "가볍게 해 주는 용도"로만. |
| 당근 | 디자인 시스템 SEED를 공개했습니다. 색·글자 같은 값을 한 곳(토큰)에 두고 모든 화면이 가져다 씁니다 [확인, GitHub]. | 색·글자·둥근 정도를 변수 한 파일에 모읍니다. 그 밖의 값은 못 쓰게 검사합니다. |
| 카카오 계열 | 자료를 찾지 못했습니다. 노랑 한 색 + 캐릭터(이모티콘)가 감정을 담당합니다 [통념]. | 감정 표현은 펫에게 맡깁니다. 이모지는 쓰지 않습니다. |
| 한국 모바일 게임 톤 | 굵은 글자 + 진한 외곽선, 등급별 색(일반→희귀→영웅→전설), 빨간 점 알림 [통념]. | 펫 등급 색을 5개로 고정합니다. 다른 곳에는 그 색을 쓰지 않습니다. |

## 4. GitHub · 공개 자료

별 수는 2026년 11월에 본 숫자입니다.

| 이름 | 주소 | 라이선스 | 별 | 쓸모 |
|---|---|---|---|---|
| NES.css | https://github.com/nostalgic-css/NES.css | MIT [확인] | 21.9k | 8비트 게임풍 CSS. 기본 글꼴은 영어만 됩니다. 한글은 둥근모꼴을 권합니다. 테두리 만드는 방식만 참고합니다. |
| RPGUI | https://github.com/RonenNess/RPGUI | zlib [확인] | 964 | 옛 RPG풍 창·버튼·막대. 그림 테두리를 늘려 쓰는 판(9-slice로 보임)의 예시입니다. |
| Kenney UI Pack | https://kenney.nl/assets/ui-pack | CC0 [검색] | - | 버튼·판·슬라이더 그림 약 430개. 출처 표시 없이 상업 사용 가능하다고 합니다. 사이트는 열지 못했습니다. |
| canvas-confetti | https://github.com/catdad/canvas-confetti | ISC [확인] | 12.9k | 색종이 연출. "움직임 줄이기" 설정을 따르는 옵션(disableForReducedMotion)이 있습니다. 워커로 돌릴 수 있어 가볍습니다. |
| lottie-web | https://github.com/airbnb/lottie-web | MIT [확인] | 32.5k | 디자이너가 만든 움직임 파일을 재생합니다. 보상 연출에 쓸 수 있지만 무겁습니다. 큰 보상에만. |
| Tabler Icons | https://github.com/tabler/tabler-icons | MIT [확인] | 22.7k | 선 아이콘 6,545개. 24칸, 2px 선. 아이콘을 한 종류로 통일할 때 후보입니다. |
| Phosphor Icons | https://github.com/phosphor-icons/core | MIT [확인] | 402 | 아이콘 약 1,250개. 굵기별로 나뉘어 있습니다(채움 종류는 이번에 확인 못 함). |
| Fluent Emoji | https://github.com/microsoft/fluentui-emoji | MIT [확인] | 10.2k | 한 그림체로 통일된 이모지 그림. 이모지를 꼭 써야 하면 기기 이모지 대신 이것 하나로 맞춥니다. |
| SEED Design | https://github.com/daangn/seed-design | Apache-2.0 [확인] | 1.2k | 당근의 디자인 시스템. 값을 한 곳에 모으는 구조를 참고합니다. |
| Fontsource | https://github.com/fontsource/fontsource | MIT(도구), 글꼴은 각자 [확인] | 6.3k | 글꼴을 npm으로 받아 우리 서버에서 직접 내보냅니다. 버전이 고정되고 외부 서버에 의존하지 않습니다. |
| impeccable | https://github.com/pbakaus/impeccable | Apache-2.0 [확인] | 약 113k | AI 슬롭 증상을 찾아 주는 규칙 62개. 6장의 근거입니다. |
| ux-skill 위키 | https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list | 확인 못 함 | - | AI 슬롭 금지 목록과 대신 쓸 것. 6장의 근거입니다. |
| Mojang ore-ui | https://github.com/Mojang/ore-ui | 확인 못 함 | 628 | 웹 기술로 게임 UI를 만드는 부품. 구조 참고용입니다. |

### CSS로 게임 UI를 만드는 방법

| 방법 | 내용 | 표시 |
|---|---|---|
| 눌리는 3D 버튼 | Josh Comeau의 글. 뒤쪽 층은 가만히 두고 앞쪽 층만 위아래로 밉니다. 손을 떼고 돌아올 때는 600ms로 느긋하게 돌아옵니다. | [검색] 원문은 막힘 |
| 같은 글의 세부 값 | 평소 4px 떠 있음, 누르면 2px로 내려감, 누를 때는 34ms로 아주 빠르게. | [통념] 원문에서 확인 못 함. 비슷한 값이 다른 사이트 예시에 있음 [검색] |
| 가장 가벼운 방법 | `box-shadow: 0 4px 0 진한색` + 누를 때 `transform: translateY(4px)`와 그림자 0. 층을 나누지 않아도 됩니다. | [검색] 여러 예시가 같은 방식 |
| 외곽선 글자 | `-webkit-text-stroke`는 글자 안쪽을 파먹습니다. `paint-order: stroke fill`을 같이 쓰면 선을 먼저 칠해서 글자가 온전히 보입니다. 2024년 3월부터 주요 브라우저에서 됩니다. | [검색] |
| 외곽선 글자(옛 방법) | `text-shadow`를 여러 방향으로 겹칩니다. 1px보다 두꺼우면 선이 끊겨 보입니다. | [검색] |
| 9-slice 판 | `border-image`로 그림의 네 모서리는 그대로 두고 변만 늘립니다. 판 그림 한 장으로 모든 크기를 만듭니다. | [통념] 설명 문서(MDN)는 막힘 |

## 5. 무료 한글 글꼴

**읽기 전에 꼭 알아 둘 것**

- 눈누(noonnu.cc)와 산돌구름은 **2차 출처**입니다. 눈누는 접속이 막혔고, 산돌구름은 검색 요약으로만 봤습니다.
- "사본"은 GitHub의 fonts-archive 저장소가 옮겨 적은 라이선스 글입니다. 원문과 같아 보이지만 **공식 페이지가 아닙니다.** 그 저장소도 "라이선스는 언제든 바뀔 수 있다"고 적어 둡니다.
- 공식 배포 사이트는 한 곳도 직접 열지 못했습니다. **배포 전에 공식 페이지를 한 번 열어 확인해야 합니다.**
- SIL OFL 글꼴은 웹에 올려 쓰기, 고쳐 쓰기, 다시 나눠 주기가 모두 됩니다. 글꼴 파일만 따로 파는 것만 안 됩니다. 라이선스 글 파일을 함께 둡니다 [통념, OFL 일반 조건].
- "수정 금지" 글꼴은 **글자 수를 줄인 파일(서브셋)을 만드는 것도 수정으로 볼 수 있습니다.** 한글 웹폰트는 보통 서브셋을 만들기 때문에 이 점이 걸립니다. 그래서 OFL 글꼴을 우선 추천합니다.

| 글꼴 | 만든 곳 | 라이선스 | 상업적 사용 | 웹 임베딩(직접 호스팅) | 굵기 | 받는 곳 | 쓰임새 | 출처 |
|---|---|---|---|---|---|---|---|---|
| **Pretendard** | 길형진(orioncactus) | SIL OFL 1.1 | 가능 | 가능. 서브셋 CSS도 제공 | 9종, 가변 글꼴 있음 | npm `pretendard` / github.com/orioncactus/pretendard | 본문 | [확인] GitHub, npm |
| **SUIT** | SUNN | SIL OFL 1.1 | 가능 | 가능 | 9종 [통념], 가변 있음 [확인] | npm `@sun-typeface/suit` / github.com/sun-typeface/SUIT | 본문 | [확인] GitHub, npm |
| **Noto Sans KR** | Google · Adobe | SIL OFL 1.1 | 가능 | 가능 | 가변(굵기 축) | npm `@fontsource/noto-sans-kr`, `@fontsource-variable/noto-sans-kr` | 본문 | [확인] google/fonts 정보 파일, npm |
| Wanted Sans | 원티드랩 | SIL OFL 1.1 | 가능 | 가능 | 확인 못 함 | npm `wanted-sans` | 본문 | [확인] npm만 |
| **주아 (Jua)** | 우아한형제들 | SIL OFL 1.1 (Google Fonts 판) | 가능 | 가능 | 1종 | npm `@fontsource/jua` | 제목(둥글고 친근) | [확인] google/fonts OFL.txt, npm |
| 도현 (Do Hyeon) | 우아한형제들 | SIL OFL 1.1 (Google Fonts 판) | 가능 | 가능 | 1종 | npm `@fontsource/do-hyeon` | 제목(각지고 단단) | [확인] google/fonts 정보 파일, npm |
| 한나체 계열 | 우아한형제들 | 배민 자체 조건 | 가능 | 가능. "웹페이지·게임 UI·앱 UI" 명시, 수정도 허용 | 한나 11년체 1종, Pro, Air | woowahan.com/fonts (못 엶) | 제목 | [사본] fonts-archive. Google Fonts에는 없음 [확인] |
| **검은고딕 (Black Han Sans)** | 제스타입(Zess Type) | SIL OFL 1.1 | 가능 | 가능 | 1종 | npm `@fontsource/black-han-sans` / github.com/zesstype/Black-Han-Sans | 제목(굵고 네모남) | [확인] google/fonts 정보 파일, GitHub, npm |
| **Bagel Fat One** | JAMO(김경원) | SIL OFL 1.1 | 가능 | 가능 | 1종 | npm `@fontsource/bagel-fat-one` / github.com/JAMO-TYPEFACE/BagelFat | 제목(아주 굵고 둥긂, 빵·과자 느낌) | [확인] GitHub, npm |
| Gasoek One | JAMO | SIL OFL 1.1 | 가능 | 가능 | 1종 | npm `@fontsource/gasoek-one` | 제목(아주 굵고 각짐) | [확인] google/fonts 정보 파일, npm |
| Gugi | TAE System & Typefaces | SIL OFL 1.1 | 가능 | 가능 | 1종 | npm `@fontsource/gugi` | 제목(둥근 기계 느낌) | [확인] google/fonts 정보 파일, npm |
| Sunflower | JIKJISOFT | SIL OFL 1.1 | 가능 | 가능 | 3종(300·500·700) | npm `@fontsource/sunflower` | 소제목 | [확인] google/fonts 정보 파일, npm |
| Dongle | 류양희 | SIL OFL 1.1 | 가능 | 가능 | 3종(300·400·700) | npm `@fontsource/dongle` | 말풍선 | [확인] google/fonts 정보 파일, npm |
| **Gmarket Sans** | G마켓 | "누구나 제약 없이 수정·재배포 가능"(사본). 산돌구름은 OFL로 분류 | 가능 | 가능으로 보임 | 3종(Light·Medium·Bold) | corp.gmarket.com/fonts (못 엶) / npm 공식 패키지는 확인 못 함 | 제목(깔끔, 큰 글자형에 맞음) | [사본] fonts-archive, [검색] 산돌구름 |
| **Paperlogy** | 이주임 · 김도균 | SIL OFL | 가능 | 가능 | 9종(100~900), 가변은 확인 못 함 | freesentation.blog/paperlogyfont (못 엶) / github.com/fonts-archive/Paperlogy (미러) / npm `paperlogy`는 없음 [확인] | 제목 + 본문 겸용 | [확인] 미러 README, [검색] 산돌구름 |
| **카페24 써라운드** | 카페24 | 카페24 자체 조건 | 가능 | **가능. "웹폰트, 프로그램 임베드" 명시.** 수정본에는 OFL 적용 | 1종(+ 가는 "에어" 1종) | fonts.cafe24.com (못 엶) | 제목(굵고 둥긂) | [사본] fonts-archive, [검색] 산돌구름 |
| 여기어때 잘난체 | 여기어때컴퍼니 | 자체 조건 | 가능 | 가능으로 보임. "저작권 안내와 라이선스 전문을 포함해 소프트웨어에 임베딩 가능". **수정·개작 재배포 금지** | 잘난체 1종, 잘난체 고딕 1종 | gccompany.co.kr/font (못 엶) | 제목(아주 굵음) | [사본] fonts-archive |
| ONE 모바일 POP | 원스토어 | 자체 조건 | 가능 | 가능이라고 산돌구름 표에 있음. **수정·재배포 금지** | 확인 못 함 | 공식 페이지 확인 못 함 | 제목(굵고 둥긂) | [검색] 산돌구름만. 사본도 못 찾음 |
| 넥슨 Lv.1 고딕 | 넥슨코리아 | 자체 조건 | 가능 | 가능. "임베디드 폰트로 사용 가능". **수정·편집 금지** | 3종(Light·Regular·Bold) | levelup.nexon.com/font (못 엶) | 본문·소제목 | [사본] fonts-archive |
| 넥슨 Lv.2 고딕 | 넥슨코리아 | 위와 같음 | 가능 | 위와 같음 | 4종(300·400·500·700) | 위와 같음 | 본문·소제목 | [사본] fonts-archive |
| 메이플스토리체 | 넥슨코리아 | 위와 같음 | 가능 | 위와 같음 | 2종(Light·Bold) | 위와 같음 | 제목(둥글고 게임 느낌) | [사본] fonts-archive |
| 티머니 둥근바람 | 티머니 | 자체 조건 | 가능 | 원문에는 임베딩 글이 없음. 산돌구름 표에는 "가능". **수정 금지**, 로고(BI/CI)는 안 됨 | 2종(Regular·ExtraBold) | tmoney.co.kr (못 엶) | 제목(둥긂) | [사본] fonts-archive, [검색] 산돌구름 |
| **쿠키런체 — 쓰지 않음** | 데브시스터즈 | 자체 조건 | 일반 용도는 가능 | **게임 산업(PC/모바일)은 상업·비상업 모두 금지. 임베딩도 금지** (2020-11부터) | 3종(Regular·Bold·Black) | cookierunfont.com (못 엶) | - | [사본] fonts-archive, [검색] 산돌구름 공지 |

### 글꼴 추천

| 시안 | 제목 글꼴 | 본문 글꼴 | 이유 |
|---|---|---|---|
| ① 게임 로비형 | Bagel Fat One (대안: 검은고딕) | Pretendard | 아주 굵어서 외곽선·그림자를 입혀도 버팁니다. 둘 다 OFL입니다. |
| ② 모험 지도형 | 주아 (대안: 카페24 써라운드) | Pretendard | 둥글고 친근합니다. 주아는 OFL, 써라운드는 웹폰트 사용이 글로 적혀 있습니다. |
| ③ 큰 글자 미니멀 | Pretendard 900 하나로 (대안: Gmarket Sans Bold · Paperlogy Black) | Pretendard | 시안은 Pretendard 하나만 썼습니다. Gmarket Sans · Paperlogy는 공식 라이선스 페이지를 직접 열지 못해 대안으로만 둡니다. |

**주의할 점**

- 제목용 글꼴은 대부분 굵기가 1종입니다. 제목과 큰 숫자에만 씁니다. 20px 아래 글자에는 쓰지 않습니다.
- 검은고딕은 한글이 2,580자 또는 2,780자만 들어 있습니다(저장소 설명이 영문·한글에서 서로 다름) [확인]. 흔하지 않은 글자는 다른 글꼴로 바뀌어 보일 수 있습니다. 다른 제목용 글꼴도 글자 수를 확인해야 합니다(이번에 확인 못 함).
- 한글 글꼴 파일은 큽니다. 글꼴은 2개까지만 싣고, 본문용은 서브셋 CSS를 씁니다(Pretendard가 제공) [확인].
- 영어 단어는 본문 글꼴(Pretendard)의 영문으로 통일합니다. 영어 전용 글꼴을 따로 더하지 않습니다 [제안].

### 글자 크기 단계 [제안]

지금 189가지를 아래 6단계로 줄이자는 제안입니다. 관찰값이 아닙니다.

| 이름 | 크기 | 글꼴 | 쓰는 곳 |
|---|---|---|---|
| 아주 큼 | 40px | 제목용 | 점수, 학습 단어, 보상 숫자 |
| 큼 | 28px | 제목용 | 화면 제목 |
| 조금 큼 | 20px | 제목용 | 버튼, 묶음 제목 |
| 보통 | 16px | 본문용 굵게 | 강조 문장 |
| 본문 | 14px | 본문용 | 설명 |
| 작음 | 12px | 본문용 | 날짜, 보조 숫자 |

## 6. "AI 슬롭"처럼 보이는 이유와 피하는 규칙

**왜 다 비슷해지나** [검색]: AI는 지시가 없으면 학습한 자료의 "한가운데"를 고릅니다. 보라색은 Tailwind UI가 모든 버튼에 쓴 기본색(indigo-500)에서 왔다고 합니다. Inter는 거의 모든 디자인 도구의 기본 글꼴입니다. 그래서 고르지 않은 것들이 모이면 "AI가 만든 것"처럼 보입니다. 해결은 하나입니다. **기본값 대신 직접 고른 값을 쓰는 것.**

근거는 GitHub의 금지 목록 두 곳 [확인]과 검색으로 본 글들 [검색]입니다. "우리 규칙"은 [제안]입니다.

| 증상 | 왜 슬롭 같나 | 우리 규칙 |
|---|---|---|
| 모든 것이 둥근 흰 카드 | 카드가 다 싸고 있으면 "묶음"이라는 뜻이 사라집니다 [확인]. 카드 안에 카드도 대표 증상입니다 [확인]. | 카드는 한 화면에 한 종류, 한 겹만. 나머지는 배경색 띠, 줄 목록, 무대로 나눕니다. |
| 둥근 정도가 다 같음(또는 150가지) | 역할을 무시한 값입니다 [확인]. | 3가지만. 버튼(알약), 판(16px), 입력칸(8px). |
| 연한 그라디언트 1,437번 | 보라~파랑 그라디언트는 가장 알아보기 쉬운 AI 기본값입니다 [확인]. 모든 그라디언트가 같은 각도면 틀로 찍은 것 같습니다 [확인]. | 기본은 단색. 그라디언트는 화면에 1곳만(무대 배경). |
| 색 2,388가지 | 중심색이 3곳 넘게 쓰이면 강조가 사라집니다 [확인]. | 색 12개 안팎. 중심색 1, 주 버튼색 1, 등급색 5, 회색 4, 경고 1. 변수 밖 색은 검사에서 막습니다. |
| 그림자 + 테두리 + 연한 배경을 한 카드에 | 세 가지를 다 쓰는 것이 AI 카드의 지문입니다 [확인]. | 셋 중 하나만. 입체는 "누를 수 있는 것"에만 씁니다. |
| 뜻 없는 영어 꼬리표(PLAYGROUND 등) | 대문자 작은 글자는 짧은 표시에만 써야 합니다 [확인]. 뜻 없는 말은 어느 앱에나 붙일 수 있는 말입니다 [확인]. | 꼬리표 전부 삭제. 필요하면 한국어 제목 하나로. |
| 이모지를 아이콘으로 씀 | 기기마다 다르게 보이고 성의 없어 보입니다 [확인]. | 이모지 아이콘 금지. 아이콘 세트 1개만. |
| 이모지 + 3D 그림 + 선 아이콘 혼용 | 그림체가 여러 개면 체계가 없는 것입니다 [확인]. 만화 그림과 선 아이콘을 섞는 것도 금지 목록에 있습니다 [확인]. | 그림체 2개만. 펫·보상은 3D 그림, 메뉴는 한 종류 아이콘. |
| 글자 크기 189가지, 굵기 구분 없음 | 굵기가 하나면 위계가 납작해집니다 [확인]. 12/14/16/18/24/30/36/48 기본 단계도 지문입니다 [확인]. | 5장의 6단계만. 제목은 제목용 글꼴, 본문은 본문용 글꼴. |
| 본문·제목이 같은 기본 글꼴(Inter 등) | 가장 많이 쓰이는 AI 기본값입니다 [확인]. | 성격 있는 제목 글꼴 1개를 정합니다. 제목용 글꼴은 24px 아래로 쓰지 않습니다 [확인]. |
| 전부 가운데 정렬, 같은 크기 카드 3개 | 리듬과 위계가 없습니다 [확인]. | 큰 것 1개 + 작은 것 2개. 크기에 차이를 둡니다. |
| 같은 무게의 버튼 2개 | 눈이 갈 곳이 나뉩니다 [확인]. 버튼 모양이 여러 가지인 것도 문제입니다 [확인]. | 주 버튼 1개만 입체. 둘째 버튼은 평평하거나 글자만. 버튼 종류는 3가지까지. |
| 뜻 없는 움직임(계속 깜박임, 전부 떠오르기) | 상태와 상관없는 움직임은 잡음입니다 [확인]. | 뭔가 바뀔 때만 움직입니다. 버튼 100~150ms, 화면 200~300ms. "움직임 줄이기" 설정을 따릅니다. |
| 누름·비활성·빈 화면 모양이 없음 | 상태 디자인이 빠진 것이 AI 결과물의 흔한 빈틈입니다 [확인]. | 버튼마다 평소·누름·못 누름 3가지. 목록마다 빈 화면 그림. 터치 영역은 44px 이상. |

**한 번에 확인하는 질문 3개** [제안]

1. 이 화면에서 가장 큰 것이 하나인가?
2. 제목 글꼴을 가리면 우리 앱인지 알 수 있는가? (가려도 버튼 모양과 펫 무대로 알 수 있어야 합니다.)
3. 변수 파일에 없는 색·크기·둥근 정도가 하나라도 있는가?

## 7. 막혀서 못 본 곳

이 작업 환경의 네트워크 설정 때문에 아래 사이트는 주소 자체가 열리지 않았습니다. 사이트가 없는 것이 아니라 **이 세션에서 허용되지 않은 것**입니다. 보려면 세션 네트워크 설정에서 허용해야 합니다.

| 못 본 곳 | 그래서 빠진 것 |
|---|---|
| design.duolingo.com, blog.duolingo.com | 색·버튼·글자·캐릭터의 공식 규칙과 정확한 값 |
| www.gameuidatabase.com, Interface In Game | 게임 화면 자체. 1장의 "관찰"이 대부분 [통념]인 이유입니다 |
| www.joshwcomeau.com | 3D 버튼 글의 정확한 px와 시간 |
| toss.tech, toss.im, 앱인토스 개발자 문서 | 토스 글자 크기 단계, 인터랙션 원칙 원문 |
| seed-design.io | 당근 색·글자 단계 값 |
| noonnu.cc | 눈누의 글꼴별 허용 범위 표 |
| www.sandollcloud.com | 산돌구름의 라이선스 표(검색 요약으로만 봄) |
| fonts.google.com | Google Fonts 글꼴 페이지(대신 google/fonts 저장소 파일로 확인) |
| 글꼴 공식 사이트 전부 (woowahan.com, corp.gmarket.com, fonts.cafe24.com, levelup.nexon.com, cookierunfont.com, gccompany.co.kr, tmoney.co.kr, freesentation.blog, 원스토어) | **공식 라이선스 원문.** 5장이 사본·검색에 기대는 이유입니다 |
| kenney.nl, opengameart.org, itch.io | Kenney UI Pack 내용과 CC0 원문 |
| discover.therookies.co, ixd.prattsi.org, pixune.com, medium.com | Supercell UI 분석 글 본문 |
| www.925studios.co, noqta.tn, dev.to, adriankrebs.ch | AI 슬롭 글 본문(검색 요약으로만 봄) |
| developer.mozilla.org, web.dev, css-tricks.com, codepen.io | border-image, paint-order 설명과 예시 |
| api.github.com, github.com 직접 요청 | 별 수 자동 수집. 저장소 페이지를 한 곳씩 읽어 대신했습니다 |

**자료를 아예 못 찾은 것:** 클래스카드, Quizlet, Mob Control, Pokémon Sleep/Café, 카카오 계열 디자인 원칙, 쿠키런 킹덤 UI 분석, ONE 모바일 POP 공식 라이선스.

**다음에 할 일**

1. 선생님이 고른 제목 글꼴 1~2개의 공식 라이선스 페이지를 직접 열어 확인합니다.
2. 실제 게임 화면 3~4개를 보고 1장의 [통념] 칸을 고칩니다. 그림은 저장하지 않습니다.
3. 변수 파일(색·글자·둥근 정도)과 "변수 밖 값 금지" 검사를 먼저 만듭니다.

## 출처

### 직접 열어 읽은 곳

- https://github.com/orioncactus/pretendard
- https://github.com/sun-typeface/SUIT
- https://github.com/zesstype/Black-Han-Sans
- https://github.com/JAMO-TYPEFACE/BagelFat
- https://github.com/fonts-archive/Paperlogy
- https://raw.githubusercontent.com/google/fonts/main/ofl/jua/OFL.txt
- https://raw.githubusercontent.com/google/fonts/main/ofl/jua/METADATA.pb (같은 방식으로 dohyeon, blackhansans, notosanskr, bagelfatone, gasoekone, gugi, sunflower, dongle도 확인. hanna는 없음)
- https://raw.githubusercontent.com/fonts-archive/GmarketSans/main/README.md (같은 방식으로 Cafe24Ssurround, Jalnan, JalnanGothic, NexonLv1Gothic, NexonLv2Gothic, Maplestory, CookieRun, TmoneyRoundWind, BMJUA, BMHANNA, BMHANNAPro, BMDOHYEON도 확인)
- https://registry.npmjs.org/pretendard/latest (같은 방식으로 @sun-typeface/suit, @fontsource/jua, @fontsource/do-hyeon, @fontsource/black-han-sans, @fontsource/bagel-fat-one, @fontsource/gasoek-one, @fontsource/noto-sans-kr, @fontsource-variable/noto-sans-kr, @fontsource/gugi, @fontsource/dongle, @fontsource/sunflower, wanted-sans, nes.css, rpgui, canvas-confetti도 확인)
- https://github.com/nostalgic-css/NES.css
- https://github.com/RonenNess/RPGUI
- https://github.com/catdad/canvas-confetti
- https://github.com/airbnb/lottie-web
- https://github.com/tabler/tabler-icons
- https://github.com/phosphor-icons/core
- https://github.com/microsoft/fluentui-emoji
- https://github.com/daangn/seed-design
- https://github.com/fontsource/fontsource
- https://github.com/pbakaus/impeccable
- https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list
- https://github.com/Laith0003/ux-skill/wiki/How-to-detect-AI-slop-in-your-design
- https://github.com/topics/game-ui

### 검색 요약으로만 본 곳 (본문은 열지 못함)

- https://design.duolingo.com/identity/color
- https://design.duolingo.com/illustration/characters
- https://blog.duolingo.com/new-duolingo-home-screen-design
- https://www.creativebloq.com/news/feather-bold
- https://www.joshwcomeau.com/animation/3d-button/
- https://superdesign.dev/library/pressable-a-3d-button-system-cobalt
- https://medium.com/swlh/brawl-stars-what-makes-it-great-3861dfb169fb
- https://ixd.prattsi.org/2025/02/design-critique-brawl-stars/
- https://discover.therookies.co/2020/02/24/game-design-ux-best-practices-detailed-breakdown-of-clash-royale/
- https://www.gamegrin.com/articles/what-can-online-apps-learn-from-clash-royales-user-interface
- https://www.fontsinuse.com/uses/66357/clash-royale-mobile-game
- https://www.vasava.es/en/portfolio/squad-busters-typography
- https://blog.userwise.io/blog/5-simple-ux-lessons-from-royal-match
- https://www.gcores.com/articles/217903
- https://www.androidcentral.com/gaming/android-games/monopoly-go-review
- https://blakecrosley.com/guides/design/balatro
- https://corporate.pokemon.co.jp/en/topics/detail/t-28/
- https://ixd.prattsi.org/2025/09/design-critique-pokemon-tcg-pocket-android-app/
- https://kahoot.com/files/2017/08/Kahoot-BrandGuide-July2019.pdf
- https://kahoot.com/accessibility/
- https://prodigygame.com/main-en/blog/educational-games-vs-blooket
- https://toss.im/tossfeed/article/importance-simplicity
- https://toss.im/tossfeed/article/beginning-of-tps
- https://www.oppadu.com/tools/design-systems-site/brand/toss.html
- https://kenney.nl/assets/ui-pack
- https://kenney-assets.itch.io/ui-pack
- https://blog.logrocket.com/create-beautiful-stroked-text-css
- https://www.sandollcloud.com/free-font/15744/Gmarket-Sans
- https://www.sandollcloud.com/free-font/16954/ONE-Mobile-POP-OTF
- https://www.sandollcloud.com/free-font/19492/Jalnan-2
- https://www.sandollcloud.com/free-font/16262/Cafe24-Ssurround-TTF
- https://www.sandollcloud.com/free-font/16183/NEXON-Lv1-Gothic-OTF
- https://www.sandollcloud.com/free-font/17911/CookieRun
- https://www.sandollcloud.com/support/notice/view?curPage=1&id=183
- https://www.sandollcloud.com/free-font/16847/Tmoney-RoundWind
- https://www.sandollcloud.com/free-font/21071/Paperlogy
- https://geekyants.com/blog/why-everything-your-ai-builds-looks-the-same
- https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p
- https://www.925studios.co/blog/ai-slop-design-tells
- https://adriankrebs.ch/blog/design-slop/

## 8. 시안 3방향 (이번에 만든 것)

- 시안 HTML: `docs/design-renewal-mock/index.html` (브라우저로 열면 됩니다. 버튼 · 칩을 눌러 볼 수 있고, 학습 화면의 "정답 확인"을 누르면 정답 연출이 나옵니다.)
- 방향마다 화면 5개: 홈 · 학습(단어 연습 문제) · 야차전 대결 준비 · 놀이터 첫 화면 · 연습 결과
- 그림은 모두 저장소에 있는 것(펫 · 3D 아이콘 · 게임 입구 그림 · 코인)만 썼습니다. 새로 그린 그림은 없습니다.
- 선생님 화면과 게임 안쪽 화면(아레나 전투 · 펫 대행진 판 등)은 시안에 넣지 않았습니다. 그대로 둡니다.
- 시안에 적힌 숫자(950코인 · 7일 · 85점 등)와 "오늘의 퀘스트" · "오늘의 길" 같은 구성은 예시입니다. 실제 규칙(보상 · 판 수)은 바꾸지 않았습니다.

| | 시안 1 · 게임 로비형 | 시안 2 · 모험 지도형 | 시안 3 · 큰 글자 미니멀 |
|---|---|---|---|
| 한 줄 설명 | 홈 가운데에 내 펫이 크게 서 있는 게임 로비. 공부는 "오늘의 퀘스트" | 홈이 "오늘의 길". 펫이 정거장(단어 → 복습 → 야차전 → 보물)을 따라감 | 카드 · 테두리 · 그림자 없이 아주 큰 글자와 숫자. 색은 펫과 그림만 |
| 한 장 그림 | `docs/screenshots/design-renewal/dir1.png` | `docs/screenshots/design-renewal/dir2.png` | `docs/screenshots/design-renewal/dir3.png` |
| 바탕 | 파란 로비 + 남색 테두리. 공부 화면만 밝은 하늘색 | 따뜻한 종이색 + 먹색 테두리 | 종이색. 야차전만 검은 면 |
| 주 버튼 | 노랑, 아래 단 5px, 누르면 4px 내려감 | 귤색, 아래로 5px 밀린 단 | 먹색 알약, 누르면 96%로 줄어듦 |
| 제목 글꼴 | Bagel Fat One + 남색 외곽선 | 주아(Jua, 이미 저장소에 있음) | Pretendard 900 |
| 카드 대신 | 흰 패널 1~2개 + 그림 타일 | 길과 정거장, 가게가 선 마을 | 줄 목록 + 큰 숫자 |
| 탭 바 | 남색 띠, 가운데 홈이 솟음(탭 순서가 바뀜) | 흰 띠, 고른 탭은 레몬 스티커 | 아이콘 없이 글자만 |
| 색 수 | 13개 | 14개 | 10개 |
| 좋은 점 | 가장 게임답고 지금 그림(3D 아이콘 · 게임 입구 그림)과 가장 잘 맞음. 아레나 · 대행진과 한 벌 | 오늘 할 일의 순서가 한눈에 보임. 학습 앱다움. 글꼴을 새로 받지 않음 | 가장 가볍고 빠름. 어른스럽고 고급스러움 |
| 걱정 | 색이 강해서 긴 글(어법 지문 · 시험)은 밝은 면을 따로 써야 함 | 귀여운 쪽이라 고등학생에게 유치할 수 있음. 지도에 올릴 정거장 규칙을 정해야 함 | 3D 아이콘을 거의 안 씀(탭 바 · 메뉴). 게임 같은 재미는 가장 적음 |

화면별 비교 그림(지금 화면 vs 시안 1 · 2 · 3): `docs/screenshots/design-renewal/compare-home.jpg` · `compare-study.jpg` · `compare-yacha.jpg` · `compare-arcade.jpg` · `compare-result.jpg`
("지금" 화면은 테스트 데이터로 띄운 로컬 서버에서 찍었습니다. 결과 화면의 "지금"은 일부러 다 틀리고 찍어서 0점입니다.)

방향별 규칙표(색 이름 · 글자 크기 단계 · 둥근 정도 · 버튼 · 칩 · 탭 바 · 아이콘 · 움직임)는 각 시안 HTML 아래쪽에 붙어 있습니다.

### 추천: 시안 1(게임 로비형)

- 선생님이 "한눈에 다르게"를 원하셨고, 세 시안 가운데 지금 화면과 가장 다릅니다.
- 이미 그려 둔 그림(민트 3D 아이콘 · 게임 입구 그림 · 펫)이 파란 바탕과 남색 테두리 위에서 가장 잘 삽니다. 새 그림 주문이 없어도 됩니다.
- 가장 정돈된 펫 아레나 · 펫 대행진(남색 + 금)과 톤이 이어져서 "탭마다 다른 앱" 문제가 풀립니다.
- 조사에서 "고등학생은 아기 같은 화면을 유치하게 느낀다"는 지적이 있었습니다(검색 요약). 시안 2보다 시안 1이 그 걱정이 적습니다.
- 섞어 쓰는 안도 됩니다: 시안 1을 바탕으로, 시안 3의 "큰 숫자" 결과 화면이나 시안 2의 "오늘의 길"을 학습 탭에 넣는 식입니다.

### 글꼴 무게 (직접 재 봄)

자주 쓰는 한글 2,350자 + 영문 · 숫자 · 기호로 줄인(서브셋) woff2 크기입니다. 모두 SIL OFL 1.1이고 직접 호스팅(CSP `font-src 'self'`)할 수 있습니다. 라이선스 글은 `docs/design-renewal-mock/fonts/`에 같이 넣었습니다.

| 글꼴 | 크기 | 쓰는 시안 |
|---|---|---|
| Bagel Fat One | 358KB | 시안 1 제목 · 버튼 |
| 주아(Jua) 한글 + 영문 | 368KB + 17KB (이미 `public/assets/fonts`에 있음 → 추가 0) | 시안 2 제목 · 버튼 |
| Pretendard 굵기 1개 | 약 170KB (500 · 700 · 800 모두 비슷) | 모든 시안 본문 |
| Pretendard 가변(모든 굵기) | 432KB | 굵기를 3개 넘게 쓰면 이쪽이 작음 |
| 검은고딕 · 도현 | 169KB · 161KB | 대안(시안에는 안 씀) |

- 지금 앱은 `font-family`에 Pretendard를 적어 두었지만 **파일은 싣지 않습니다.** 그래서 폰마다 기본 글꼴(아이폰 Apple SD 산돌고딕, 갤럭시 기본 글꼴)로 보입니다. 글꼴을 실으면 그만큼 첫 방문 무게가 늘어납니다.
- 줄이는 방법: ① 첫 화면에는 본문 굵기 1개만(170KB), 제목용은 `font-display: swap`으로 뒤에 받기 ② 서비스 워커 미리 받기에 넣어 두 번째 방문부터 0 ③ 본문은 폰 기본 글꼴을 그대로 쓰고 제목용만 싣기(시안 1 · 2는 이렇게 해도 인상이 거의 같음, +358KB 또는 +0).
- 느린 폰: 세 시안 모두 blur · backdrop-filter · 끝없이 도는 애니메이션을 쓰지 않았습니다. 움직임은 `transform` · `opacity`만, 한 번 돌고 멈춥니다. 바탕 무늬는 CSS 그라디언트 한 장입니다.

## 9. 실제로 입히는 순서

고른 방향 하나로 아래 순서대로 갑니다. 묶음마다 PR 하나, 새 세션 하나입니다. 서버 요청 · 데이터 · 자동 새로고침은 건드리지 않으므로 렉 방지 규칙에는 영향이 없습니다(글꼴 무게만 확인).

| 순서 | 묶음 | 하는 일 | 크기 |
|---|---|---|---|
| 0 | 글꼴 | 서브셋 글꼴을 `public/assets/fonts`에 싣고 `@font-face` · 미리 받기 목록 정리. 화면은 아직 안 바뀜 | 작음 (반나절) |
| 1 | 공통 토큰 · 부품 | 새 CSS 파일 하나(`ui.css`)에 색 · 글자 크기 · 둥근 정도 토큰과 버튼 · 패널 · 칩 · 탭 바 · 위 띠(코인 · 연속일). 부품 견본 화면으로 확인. `server/*-check.mjs`에 "토큰 밖 값 금지" 검사 추가 | 중간 (1세션) |
| 2 | 홈 + 탭 바 | 홈을 새 뼈대로. 탭 바가 바뀌므로 모든 화면이 함께 달라 보이기 시작함 | 큼 (1~2세션) |
| 3 | 학습 | 학습 목록 → 단어 연습 문제 → 결과(보상) → 카드 외우기 · 어법 · 시험. 긴 글 화면은 밝은 면 | 큼 (2세션) |
| 4 | 야차전 | 대결 준비 → 몬스터 · 던전 · 기록 탭의 입구 화면. 전투 화면은 그대로 | 중간 (1~2세션) |
| 5 | 놀이터 | 첫 화면 → 미니게임 · 코인 승부 · 상점 · 기록 목록. 게임 안쪽은 그대로 | 중간 (1~2세션) |
| 6 | 나머지 | 나 · 내 펫 · 펫 도감 · 칭호 도감 · 랭킹 · 출석 · 알 상점 · 로그인 · 창(모달) | 큼 (2세션) |
| 7 | 옛 CSS 걷어내기 | 아래 "버전별 CSS 정리" | 큼 (2세션, 눈에 보이는 변화 없음) |

모두 합쳐 **10~13세션** 정도입니다. 2번(홈 + 탭 바)까지만 해도 "다른 앱" 느낌이 납니다.

### 버전별 CSS 137개를 어떻게 정리하나

지금은 `server/build-assets.mjs`가 `styles.css` + 버전별 CSS 137개(모두 141개 파일, 합쳐 1.2MB)를 순서대로 이어 붙입니다. 뒤 파일이 앞 파일을 덮어쓰는 구조라, 한 번에 지우면 어디가 깨질지 알 수 없습니다. 그래서 **새 층을 위에 얹고, 화면 묶음이 끝날 때마다 아래층을 걷어 냅니다.**

1. **새 층은 맨 뒤에 붙입니다.** `ui.css`(토큰 · 부품)와 화면별 파일(`screen-home.css` · `screen-study.css` · `screen-yacha.css` · `screen-arcade.css` · `screen-me.css`)을 묶음 맨 끝에 넣습니다. 새 화면은 새 클래스 이름(`ui-` 머리말)만 써서 옛 규칙과 부딪히지 않게 합니다.
2. **화면을 옮길 때 옛 클래스를 화면 코드에서 뺍니다.** 그러면 옛 CSS 규칙은 "아무도 안 쓰는 규칙"이 됩니다.
3. **안 쓰는 규칙을 기계로 찾습니다.** 점검 도구(`docs/app-audit.mjs`)가 71개 화면을 돌 때 브라우저의 CSS 사용 기록(coverage)을 모아, 한 번도 안 쓰인 규칙 목록을 뽑습니다. 게임 안쪽 화면(전투 · 부화 · 대행진)도 꼭 돌려서 "퀄리티 높게" 연출의 CSS가 지워지지 않게 합니다.
4. **걷어 낸 뒤 전 · 후 그림을 비교합니다.** 71개 화면 스크린샷을 지우기 전 · 후로 찍어 픽셀이 달라진 화면만 눈으로 봅니다.
5. **게임 안쪽 CSS는 게임별 파일로만 모읍니다**(아레나 · 대행진 · 낚시 · 던전 …). 모양은 건드리지 않습니다.
6. **끝 모습**: `ui.css` + 화면별 5~6개 + 게임별 10개 안팎 + 선생님 1개. 1.2MB → 400KB 안팎을 목표로 합니다(추정). `!important` 1,516번은 덮어쓰기가 없어지면 대부분 필요 없어집니다.
7. **다시 늘지 않게**: 릴리스 검사에 ① 색 · 글자 크기 · 둥근 정도는 토큰만 ② 새 `v숫자.css` 파일 금지 ③ `!important` 수 상한을 넣습니다.

## 10. 선생님께 여쭐 것

1. 방향: **시안 1(추천)** · 2 · 3 가운데 어느 쪽인가요? 섞고 싶은 부분이 있으면 화면 이름으로 말씀해 주세요(예: "홈은 1, 결과는 3").
2. 시안 1은 탭 순서가 바뀝니다(학습 · 야차전 · **홈** · 놀이터 · 나, 가운데 홈이 솟음). 괜찮을까요? 지금 순서(홈이 맨 왼쪽)를 지키고 모양만 바꿀 수도 있습니다.
3. 홈의 "오늘의 퀘스트"(시안 1) · "오늘의 길"(시안 2)은 지금 있는 것(출석 · 오늘 단어 · 복습 · 야차전)을 묶어 보여 주는 화면입니다. 다 하면 주는 보상(+30코인)은 예시입니다. 새 보상을 만들까요, 보상 없이 표시만 할까요?
4. 글꼴을 실으면 첫 방문 무게가 늘어납니다(제목용 358KB, 본문 굵기마다 170KB). 본문은 폰 기본 글꼴 그대로 두고 **제목용만** 실을까요(추천), 본문까지 Pretendard로 맞출까요?
5. 홈에 있던 것 가운데 시안에서 뺀 것(펫 카드의 "쓰다듬기 · 밥 주기", 내 펫 22/94, 칭호 12/172)은 펫을 누르면 나오는 화면으로 옮기려고 합니다. 괜찮을까요?
6. 방향을 고르시면 먼저 **글꼴 + 공통 부품 + 홈**까지 한 번에 보여 드릴까요, 아니면 나머지 화면(나 · 펫 도감 · 야차전 몬스터 등) 시안을 더 보고 정하시겠어요?
