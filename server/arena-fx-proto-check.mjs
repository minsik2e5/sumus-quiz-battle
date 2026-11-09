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
  const appFiles = ['../public/app.js', '../public/index.html', ...readdirSync(path('../public/modules')).filter(n => n.endsWith('.js')).map(n => '../public/modules/' + n)];
  assert(appFiles.every(f => !source(f).includes('/proto/')), '앱 화면 코드는 시험 페이지(/proto/)를 부르지 않는다');
  assert(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html) && !/\son[a-z]+=/.test(html) && html.includes('src="/proto/arena-fx.js"'), '시험 페이지는 인라인 스크립트 없이(CSP script-src self) 별도 파일로 돈다');
  assert(/const DMAX = \d+, SMAX = \d+, KMAX = \d+;/.test(js) && js.includes('if (D.n >= T.debris) return;') && js.includes('if (M.n >= T.smoke) return;') && js.includes('if (K.n >= T.sparks) return;'), '파편 · 연기 · 불꽃은 정해진 크기의 풀(상한)에서만 쓴다');
  assert(/const SCAR_CAP = \d+;/.test(js) && js.includes('if (scars > SCAR_CAP) healField();'), '바닥 자국은 경기장 그림 한 장에 구워 넣고, 상한이 넘으면 아물게 한다(목록이 끝없이 쌓이지 않음)');
  assert(js.includes('const TICK = 50;') && js.includes('render(dt, acc / TICK)'), '고정 틱(50ms, 규칙과 같은 간격) + 그리기 보간');
}
