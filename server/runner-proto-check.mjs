// 펫 대행진(크라우드 러너) 연출 시험 페이지(public/proto/runner-fx.*) · 구성안(docs/pet-runner-plan.md) 검사. 측정용이라 앱에 들이지 않는다.
//   - 미리 받기(sw.js PRECACHE)에 없다 · 서비스 워커가 /proto/를 거치지 않는다 · 앱 화면 코드 어디에서도 부르지 않는다.
//   - CSP(script-src 'self')에서 돌도록 인라인 스크립트가 없다.
//   - 그리는 정령은 150마리 상한(나머지는 숫자), 효과 저장소는 정해진 크기의 풀이라 판이 길어져도 늘지 않는다.
//   - 규칙(무리 = 숫자 하나)은 판 씨앗 난수만 쓴다 → 서버가 조종 기록으로 같은 결과를 다시 낼 수 있다.
//   - 구성안에 렉 방지 점검 · 새 데이터 묶음 예산 · 그림 주문서 74의 Drive 규칙 두 가지가 들어 있다.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = p => fileURLToPath(new URL(p, import.meta.url));
const source = p => readFileSync(path(p), 'utf8');
const body = (js, name) => { const i = js.indexOf(`function ${name}(`); if (i < 0) return ''; let d = 0, j = js.indexOf('{', i); for (let k = j; k < js.length; k++) { if (js[k] === '{') d++; else if (js[k] === '}' && --d === 0) return js.slice(j, k + 1); } return ''; };

export async function runRunnerProtoChecks(assert) {
  if (!existsSync(path('../public/proto/runner-fx.html'))) return;
  const html = source('../public/proto/runner-fx.html'), js = source('../public/proto/runner-fx.js'), snd = source('../public/proto/runner-fx-sound.js'), sw = source('../public/sw.js');
  const precache = JSON.parse(sw.match(/const PRECACHE = (\[.*\]);/)[1]);
  assert(!precache.some(u => u.startsWith('/proto/')), '펫 대행진 시험 페이지는 미리 받기에 넣지 않는다');
  const handler = sw.slice(sw.indexOf("addEventListener('fetch'"));
  const skip = handler.indexOf("if (url.pathname.startsWith('/proto/')) return;");
  assert(skip > 0 && skip < handler.indexOf("req.mode === 'navigate'") && skip < handler.indexOf('caches.match(req'), '서비스 워커 fetch 핸들러는 /proto/ 요청을 navigate · 캐시 처리보다 먼저 그냥 보낸다');
  assert(js.includes("w.postMessage({ type: 'SKIP_WAITING' })") && /from '\/proto\/runner-fx-sound\.js\?v=[\w.]+'/.test(js), '러너 시험 페이지는 기다리는 새 서비스 워커를 넘기고, 소리 파일을 ?v=로 불러 옛 캐시를 넘긴다');
  const appFiles = ['../public/app.js', '../public/index.html', ...readdirSync(path('../public/modules')).filter(n => n.endsWith('.js')).map(n => '../public/modules/' + n)];
  assert(appFiles.every(f => !source(f).includes('runner-fx')), '앱 화면 코드는 펫 대행진 시험 페이지를 부르지 않는다');
  assert(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html) && !/\son[a-z]+=/.test(html) && /src="\/proto\/runner-fx\.js\?v=[\w.]+"/.test(html), '러너 시험 페이지는 인라인 스크립트 없이(CSP script-src self) 별도 파일로 돈다');

  // 정령: 그리는 칸 150 상한, 품질 단계마다 그 안, 그리기 고리는 지금 그리는 수(shown)까지만
  const DRAW_MAX = Number(js.match(/const DRAW_MAX = (\d+);/)?.[1]);
  const draws = [...js.matchAll(/\{ name: '[^']+', scale: [\d.]+, draw: (\d+),/g)].map(m => Number(m[1]));
  assert(DRAW_MAX === 150 && draws.length === 4 && draws.every((d, i) => d <= DRAW_MAX && (!i || d > draws[i - 1])), `그리는 정령은 최대 150(품질 4단계: ${draws.join(' · ')}), 나머지는 숫자로`);
  assert(js.includes('const visCount = () => Math.min(S0.n, T.draw);') && js.includes('if (i >= shown) continue;'), '무리 수가 몇이든 그리는 정령은 품질 상한까지만');
  // 효과 풀: 정해진 크기, 넣을 때 품질 상한을 넘으면 버림
  assert(/const DMAX = \d+, SMAX = \d+, KMAX = \d+, GMAX = \d+, FMAX = \d+, BMAX = \d+;/.test(js)
    && ['if (D.n >= T.debris) return;', 'if (M.n >= T.smoke) return;', 'if (K.n >= T.sparks) return;', 'if (G.n >= T.glows) return;', 'if (FL.n >= T.fly) return;', 'if (B.n >= T.shots) return;'].every(x => js.includes(x)),
  '파편 · 연기 · 불꽃 · 빛 · 날아가는 정령 · 탄은 정해진 크기의 풀(상한)에서만 쓴다');
  assert(/const MAX_RINGS = \d+, MAX_FLASH = \d+, MAX_TEXTS = \d+, MAX_POPS = \d+, MAX_FX = \d+;/.test(js), '고리 · 빛 · 글자 · 숫자 목록도 상한이 있다');
  // 규칙: 고정 틱 50ms, 무리는 숫자 하나, 규칙 쪽은 판 씨앗 난수(simRnd)만 — 연출 난수(rnd)를 쓰면 서버 다시 돌리기가 어긋난다
  assert(js.includes('const TICK = 50, DT = TICK / 1000;') && js.includes('render(dt, Math.min(1, acc / TICK))'), '고정 틱(50ms) + 그리기 보간');
  const rules = body(js, 'simTick') + body(js, 'makeTrack') + body(js, 'applyCard');
  assert(rules.length > 500 && !/\brnd\(|\brr\(|Math\.random/.test(rules), '규칙(simTick · makeTrack · applyCard)은 연출 난수를 쓰지 않는다(판 씨앗만)');
  assert(js.includes('const crowdR = n =>') && !/T\.draw|shown/.test(body(js, 'simTick')), '무리 폭 · 판정은 숫자 N으로만(그리는 정령 수 · 품질과 무관)');
  // 재료: 아레나 그림 71과 같은 칸 이름 · 같은 처리, 있는 그림만 불러온다
  const { ITEMS } = await import('../docs/asset-requests/runner/build-71.mjs');
  const matKeys = [...js.matchAll(/^  '?([a-z-]+)'?: \['(add|luma|key|mul)', /gm)].map(m => [m[1], m[2]]);
  assert(matKeys.length >= 8 && matKeys.every(([k, kind]) => ITEMS.some(it => it.key === k && it.kind === kind)), `러너 재료 칸(${matKeys.length})은 아레나 그림 주문서 71의 칸과 이름 · 처리 방법이 같다(재사용)`);
  assert(js.includes("ARENA_ART.has('mat-' + k)") && js.includes('/assets/arena/mat-${k}.webp'), '재료 그림은 build:assets가 적은 것만 불러온다');
  assert(!/ctx\.filter\s*=/.test(js) && !/\.filter\s*=\s*['`"]blur/.test(js), '캔버스 ctx.filter(blur)를 쓰지 않는다');
  assert(!/new Audio\(|\.mp3|\.ogg|fetch\(/.test(snd) && /const MAX_VOICES = ([1-9]|10),/.test(snd) && js.includes("addEventListener('pointerdown', unlockSound"), '소리는 WebAudio 합성(파일 없음) · 동시 10개 이하 · 첫 터치 뒤에만');
  assert(html.includes('data-act="mute"'), '러너 시험 페이지에 음소거 버튼이 있다');

  // 구성안
  const plan = source('../docs/pet-runner-plan.md');
  for (const h of ['## 6. 서버 다시 계산 방식', '## 7. 데이터 묶음과 예산', '## 8. 렉 방지 점검', '## 10. 그림 주문서 74 목록', '## 11. 진행 단계', '### 9-1. 측정'])
    assert(plan.includes(h), `구성안에 "${h}" 칸이 있다`);
  assert(/runnerRaid: \d+,/.test(plan) && plan.includes('쌓이는 목록 없음'), '구성안: 새 묶음(runnerRaid) 예산과 정리 방법, 학생 데이터는 목록 없이');
  assert(plan.includes('Drive의 기존 그림을 열어 그림체를 맞추라') && plan.includes('정확한 파일 이름'), '그림 주문서 74: Drive 기존 그림으로 그림체 맞추기 · 정해진 폴더에 정확한 파일 이름으로 저장(CLAUDE.md)');
  assert(plan.includes('| 4× | 자동 |'), '구성안 측정 표에 CPU 4× · 자동 줄이 있다');
}
