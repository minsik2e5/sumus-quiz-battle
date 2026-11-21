# 썸어스 마케팅 센터

학원 마케팅을 관리하는 사이트입니다. 할 일, 숫자 기록, 문의 기록부, 콘텐츠 달력과 운영 자료를 한곳에서 봅니다.
퀴즈배틀·공부방과는 따로 동작합니다.

## 화면

| 주소 | 내용 |
|---|---|
| `/` | 마케팅 센터: 홈, 할 일, 숫자, 문의, 콘텐츠, 자료실 (비밀번호 필요) |
| `/plan` | 마케팅 운영표: 매주 루틴, 플랫폼별 계획, 달력, 카드뉴스, 블로그 방법 |
| `/platforms` | 플랫폼별 매일·매주·매달·1년 할 일과 목표 |

할 일·숫자·문의·콘텐츠 기록은 Durable Object 하나(내장 SQLite)에 저장되고, 비밀번호를 아는 사람만 읽고 쓸 수 있습니다.
처음 배포하면 11월 말~1월 할 일 42개와 12월 콘텐츠 계획 25개가 들어갑니다(`seed.js`).
저장소가 공개라 경쟁 학원 이름·교습비 같은 내부 조사는 넣지 않았습니다.

## 폴더

| 경로 | 내용 |
|---|---|
| `worker.js` | /api 요청: 비밀번호 확인 후 Durable Object에 저장 |
| `seed.js` | 처음 한 번 넣는 기본 할 일·콘텐츠 계획 |
| `site/` | 화면 파일 (index = 마케팅 센터, plan, platforms, cards) |
| `cardnews/cards.html` | 카드뉴스 틀. 맨 아래 `SLIDES`만 바꾸면 새 카드뉴스 |
| `cardnews/render.js` | 카드 → PNG (1080x1350) |
| `cardnews/render-reel.js` | 카드 → 릴스 영상 (1080x1920, 30fps MP4) |
| `wrangler.jsonc` | Cloudflare 배포 설정 |

## 비밀번호

`wrangler.jsonc`의 `ADMIN_KEY_HASH`(비밀번호의 SHA-256 해시)로 확인합니다. 저장소가 공개라 비밀번호 자체는 넣지 않습니다.
바꾸려면 Cloudflare 대시보드 → 이 Worker → Settings → Variables and Secrets에서 `ADMIN_KEY`를 **Secret**으로 추가하세요. `ADMIN_KEY`가 있으면 그것이 우선합니다.

## Cloudflare 배포

**GitHub 연결로 자동 배포 (Workers Builds)**
1. Cloudflare 대시보드 → Workers & Pages → Create → **Import a repository** → 이 저장소 선택
2. Project name: `sumus-marketing` (wrangler.jsonc의 `name`과 같아야 함)
3. Branch: 배포할 브랜치 / **Root directory**: `marketing`
4. **Build command**: 비워 두기 / **Deploy command**: `npx wrangler deploy`

배포가 끝나면 `https://sumus-marketing.<계정 이름>.workers.dev` 주소가 생깁니다.

**내 컴퓨터에서 배포**
```text
cd marketing
npx wrangler login
npx wrangler deploy
```

로컬 테스트: `npx wrangler dev` (http://localhost:8787)

## 카드뉴스 만들기

Playwright(Chromium)와 ffmpeg가 필요합니다. 폰트는 Google Fonts에서 받습니다.

```text
cd marketing/cardnews
node render.js cards.html out            # out/card-01.png ~ card-06.png
node render-reel.js cards.html reel.mp4  # 23초 세로 영상, 음악 없음
```
