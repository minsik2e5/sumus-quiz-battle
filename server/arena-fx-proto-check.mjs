// 펫 아레나 캔버스 연출 시험 페이지(public/proto/arena-fx.*) 검사: 측정용이라 앱에 들이지 않는다.
//   - 미리 받기(sw.js PRECACHE)에 없다 · 앱 화면 코드 어디에서도 부르지 않는다.
//   - CSP(script-src 'self')에서 돌도록 인라인 스크립트가 없다.
//   - 연출 저장소는 정해진 크기(풀)라 판이 길어져도 늘지 않고, 바닥 자국은 상한이 넘으면 아문다.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = p => fileURLToPath(new URL(p, import.meta.url));
const source = p => readFileSync(path(p), 'utf8');

export async function runArenaFxProtoChecks(assert) {
  if (!existsSync(path('../public/proto/arena-fx.html'))) return;
  const html = source('../public/proto/arena-fx.html'), js = source('../public/proto/arena-fx.js'), sw = source('../public/sw.js');
  const precache = JSON.parse(sw.match(/const PRECACHE = (\[.*\]);/)[1]);
  assert(!precache.some(u => u.startsWith('/proto/')), '아레나 연출 시험 페이지는 미리 받기에 넣지 않는다');
  // 서비스 워커는 /proto/를 거치지 않는다(fetch 핸들러에서 navigate 처리 · 캐시보다 먼저 돌아감) → 폰에 옛 시험 페이지가 남지 않는다
  const handler = sw.slice(sw.indexOf("addEventListener('fetch'"));
  const skip = handler.indexOf("if (url.pathname.startsWith('/proto/')) return;");
  assert(skip > 0 && skip < handler.indexOf("req.mode === 'navigate'") && skip < handler.indexOf('caches.match(req'), '서비스 워커 fetch 핸들러는 /proto/ 요청을 navigate · 캐시 처리보다 먼저 그냥 보낸다');
  assert(js.includes("w.postMessage({ type: 'SKIP_WAITING' })") && js.includes("from '/proto/arena-fx-sound.js?v="), '시험 페이지는 기다리는 새 서비스 워커를 넘기고, 스크립트를 ?v=로 불러 옛 캐시를 넘긴다');
  const appFiles = ['../public/app.js', '../public/index.html', ...readdirSync(path('../public/modules')).filter(n => n.endsWith('.js')).map(n => '../public/modules/' + n)];
  assert(appFiles.every(f => !source(f).includes('/proto/')), '앱 화면 코드는 시험 페이지(/proto/)를 부르지 않는다');
  assert(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html) && !/\son[a-z]+=/.test(html) && /src="\/proto\/arena-fx\.js\?v=[\w.]+"/.test(html), '시험 페이지는 인라인 스크립트 없이(CSP script-src self) 별도 파일로 돈다');
  assert(/const DMAX = \d+, SMAX = \d+, KMAX = \d+, GMAX = \d+;/.test(js) && ['if (D.n >= T.debris) return;', 'if (M.n >= T.smoke) return;', 'if (K.n >= T.sparks) return;', 'if (G.n >= T.glows) return;'].every(x => js.includes(x)), '파편 · 연기 · 불꽃 · 빛 알갱이는 정해진 크기의 풀(상한)에서만 쓴다');
  assert(/const SCAR_CAP = \d+;/.test(js) && js.includes('if (scars > SCAR_CAP) healField();'), '바닥 자국은 경기장 그림 한 장에 구워 넣고, 상한이 넘으면 아물게 한다(목록이 끝없이 쌓이지 않음)');
  assert(js.includes('const TICK = 50;') && js.includes('render(dt, acc / TICK)'), '고정 틱(50ms, 규칙과 같은 간격) + 그리기 보간');
  // 2판: 재료 칸 = 그림 주문서 71의 칸 이름과 1:1, 그림은 ARENA_ART에 있을 때만 불러온다(없는 그림을 요청하지 않음)
  const { ITEMS } = await import('../docs/asset-requests/runner/build-71.mjs');
  const matKeys = [...js.matchAll(/^  '?([a-z-]+)'?: \['(add|luma|key|mul)', /gm)].map(m => [m[1], m[2]]);
  assert(matKeys.length === ITEMS.length && ITEMS.every(it => matKeys.some(([k, kind]) => k === it.key && kind === it.kind)), `시험 페이지 재료 칸(${matKeys.length})이 그림 주문서 71의 재료(${ITEMS.length})와 이름 · 처리 방법이 1:1`);
  assert(js.includes("ARENA_ART.has('mat-' + k)") && js.includes('/assets/arena/mat-${k}.webp'), '재료 그림은 public/assets/arena/mat-<이름>.webp, build:assets가 적은 것만 불러온다');
  // 빛 번짐은 미리 번지게 그린 그림으로(프레임마다 blur 필터 없음, 사파리), 소리는 파일 없이 합성 · 첫 터치 뒤에만
  assert(!/ctx\.filter\s*=/.test(js) && !/\.filter\s*=\s*['`"]blur/.test(js), '캔버스 ctx.filter(blur)를 쓰지 않는다');
  const snd = source('../public/proto/arena-fx-sound.js');
  assert(!/new Audio\(|\.mp3|\.ogg|fetch\(/.test(snd) && /const MAX_VOICES = ([1-9]|10),/.test(snd) && js.includes("addEventListener('pointerdown', unlockSound"), '소리는 WebAudio 합성(파일 없음) · 동시 10개 이하 상한 · 첫 터치 뒤에만 켜짐');
  assert(html.includes('data-act="mute"'), '시험 페이지에 음소거 버튼이 있다');
}
