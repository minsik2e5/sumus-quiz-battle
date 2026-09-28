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
  - 이미지 도구를 쓰려면 먼저 이 폴더에서 `npm install`을 실행하세요(sharp).

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
