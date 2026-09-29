# SUMUS VOCA 개발 도구 · 시안 (dev-tools 브랜치 전용)

운영 앱(`sumus-voca-prod-deploy`)에는 포함되지 않는 작업 파일입니다. 다른 컴퓨터에서 이어서 작업하려고 올려 둔 것입니다.

## 폴더
- `pet-art.js`, `hatch.js`, `evolve.js`, `characters-extra.js`, `*.template.html`, `build.mjs`: 펫 도감과 야차전 시안 페이지를 만드는 파일입니다. 앱에 반영된 버전은 `public/modules/`에 있습니다.
- `assets-raw/`: GPT로 만든 펫 진화 모음 원본입니다. `*-alpha.png`는 흰 배경을 지운 결과이고, `_check-dark.png`는 확인용입니다.
- `assets/pets/`: 모음 그림을 잘라 만든 512px 스프라이트입니다(시안용 복사본). 앱에서 쓰는 파일은 `public/assets/pets/`에 있습니다.
- `tools/`:
  - `slice-sheet.mjs`: 모음 그림(투명 배경)에서 캐릭터를 하나씩 떼어 512px WebP로 저장합니다.
    예: `node slice-sheet.mjs ../assets-raw/dog-sheet.png ../assets/pets dog-0,dog-1,dog-2,dog-3 4x1`
  - `remove-white-bg.mjs`: 흰 배경 그림을 투명 PNG로 바꿉니다. 캐릭터 외곽선 안쪽의 흰 털은 지우지 않습니다.
  - `mock-supabase.mjs`: 로컬 `wrangler dev`용 가짜 Supabase입니다. 운영 Supabase에 절대 연결하지 않고 테스트하기 위한 것입니다.
  - `seed-local.mjs`: 로컬 테스트 DB(`var/sumus.sqlite`)에 테스트 학생 두 명을 만듭니다. 비밀번호는 `var/local-test-login.txt`에 저장됩니다.
  - `gen-pet-art.mjs`: OpenAI 이미지 API로 펫 그림을 만듭니다. 원장님 PC에서만 실행하고 설치할 것은 없습니다. 아래 "GPT 이미지로 펫 그림 만들기"를 참고하세요.
  - 이미지 도구를 쓰려면 먼저 이 폴더에서 `npm install`을 실행하세요(sharp).

## GPT 이미지로 펫 그림 만들기 (원장님 PC에서 실행)
`tools/gen-pet-art.mjs`는 OpenAI 이미지 API를 불러 지금 펫 그림을 기준으로 새 그림(달리기 6장, 성장 단계, 표정)을 만듭니다. **API 키는 원장님 PC에만 둡니다.** 클라우드 작업 환경이나 채팅에는 넣지 않습니다.

1. **준비(한 번만)**
   - Node.js 20 이상을 설치하고, 저장소를 받은 뒤 `dev-tools` 브랜치로 바꿉니다.
   - OpenAI 사이트(platform.openai.com)에서 API 키를 만듭니다. **Billing에서 월 사용 한도를 꼭 걸어 두세요.**
   - `prototypes/tools/.env` 파일을 만들고 `OPENAI_API_KEY=발급받은키` 한 줄을 적습니다. `.env`는 git에 올라가지 않습니다.
2. **작업 목록 만들기:** `pet-art-jobs.example.json`을 복사해 `my-jobs.json`으로 만들고 고칩니다.
   - 템플릿: `run`(달리기 6장 한 줄), `redraw`(단계 다시 그리기), `evolution`(알→최종 4단계), `happy`(웃는 표정)
   - `pet`: `dog pig cat dragon panda snake rabbit fox`
   - `form`: 0 알, 1 아기, 2 성장, 3 최종
   - `notes`에 추가 요청을 적을 수 있습니다(예: "몸이 자라 보이게").
   - 기준 그림은 `public/assets/pets/<pet>-<form>.webp`가 기본이고, `refs`로 바꿀 수 있습니다.
3. **미리보기(요금 없음):** `cd prototypes/tools` → `node gen-pet-art.mjs my-jobs.json --dry-run`
   - 만들 장수, 기준 그림, 요청문을 보여 주기만 하고 요청은 보내지 않습니다.
4. **만들기:** `node gen-pet-art.mjs my-jobs.json`
   - "그림 N장을 만들어요. 계속할까요? (y/N)"에 `y`를 눌러야 시작합니다.
   - 한 번에 최대 8장이고, `--max`로 바꿀 수 있습니다. 작업 몇 개만 하려면 `--only fox-1-run,pig-2-redraw`를 씁니다.
   - 모델은 기본 `gpt-image-1`입니다. 더 새 모델이 있으면 `--model 이름`으로 바꿉니다.
5. **고르기:** `prototypes/tools/out/<시간>/index.html`을 열어 비교합니다.
   - 그림 옆 `.json`에 쓴 요청문이 그대로 남아 있어서, 마음에 드는 그림을 다시 만들 때 씁니다.
   - `out/`은 git에 올라가지 않습니다.
6. **앱에 넣기:** 고른 PNG를 Claude 작업 세션에 올리거나 `assets-raw/`에 커밋하면 됩니다. 이어서 아래 "새 펫 그림 넣는 순서"대로 합니다.
   - 배경이 투명하게 나오면 흰 배경 지우기는 건너뜁니다.
   - 달리기 6장은 v13.63의 몽이처럼 눈·발 위치를 맞춰 스프라이트로 만듭니다.

## 새 펫 그림 넣는 순서 (예: 몽이·핑키 다시 그리기)
1. 새 모음 그림을 `assets-raw/`에 둡니다. 흰 배경이면 `remove-white-bg.mjs`를 먼저 실행합니다.
2. `slice-sheet.mjs`로 `<pet>-0..3.webp`를 만들어 `public/assets/pets/`에 같은 이름으로 덮어씁니다.
3. 160px 작은 파일(`-s.webp`)도 다시 만듭니다. `sharp(...).resize(160,160)`을 쓰며, 방법은 커밋 이력을 참고하세요.
4. `npm run build:assets && npm run check`를 실행한 뒤 PR을 엽니다.

## 로컬에서 야차전 테스트 (운영 데이터와 분리)
```
node prototypes/tools/seed-local.mjs
node prototypes/tools/mock-supabase.mjs        # 따로 실행해 두기
npx wrangler dev --port 8787 --ip 127.0.0.1 --var SUPABASE_URL:http://127.0.0.1:54321 --var VOCA_STATE_SECRET:local-test --var SUPABASE_ANON_KEY:local-anon
```
두 학생을 동시에 로그인하려면 `http://127.0.0.1:8787`과 `http://localhost:8787`을 각각 다른 탭에서 엽니다.
