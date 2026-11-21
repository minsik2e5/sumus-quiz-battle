# 썸어스 마케팅

학원 마케팅 운영표(정적 사이트)와 인스타 카드뉴스·릴스 생성기입니다. 퀴즈배틀·공부방과는 따로 동작합니다.

## 폴더

| 경로 | 내용 |
|---|---|
| `site/index.html` | 마케팅 운영표: 이번 주 할 일, 매주 루틴, 플랫폼별 계획, 12월·1월 달력, 카드뉴스, 블로그 |
| `site/platforms.html` | 플랫폼별 매일·매주·매달·1년 할 일과 3개월·1년 목표 |
| `site/cards/` | 카드뉴스 PNG 6장, 릴스 영상 |
| `cardnews/cards.html` | 카드뉴스 틀. 맨 아래 `SLIDES`만 바꾸면 새 카드뉴스 |
| `cardnews/render.js` | 카드 → PNG (1080x1350) |
| `cardnews/render-reel.js` | 카드 → 릴스 영상 (1080x1920, 30fps MP4) |
| `wrangler.jsonc` | Cloudflare Workers 정적 사이트 설정 |

## 카드뉴스 만들기

Playwright(Chromium)와 ffmpeg가 필요합니다. 폰트는 Google Fonts에서 받습니다.

```text
cd marketing/cardnews
node render.js cards.html out            # out/card-01.png ~ card-06.png
node render-reel.js cards.html reel.mp4  # 23초 세로 영상, 음악 없음
```

릴스 음악은 인스타 앱에서 넣습니다(앱 음악은 저작권 걱정이 없습니다).

## Cloudflare 배포

서버 코드 없이 `site/` 폴더만 올리는 Workers 정적 사이트입니다.

**GitHub 연결로 자동 배포 (Workers Builds)**
1. Cloudflare 대시보드 → Workers & Pages → Create → **Import a repository** → 이 저장소 선택
2. Project name: `sumus-marketing` (wrangler.jsonc의 `name`과 같아야 함)
3. Branch: 배포할 브랜치 / **Root directory**: `marketing`
4. **Build command**: 비워 두기 / **Deploy command**: `npx wrangler deploy`

**내 컴퓨터에서 배포**
```text
cd marketing
npx wrangler login
npx wrangler deploy
```
