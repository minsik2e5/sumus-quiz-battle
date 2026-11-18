// V13.243.2 검사: 앱 전체 점검(docs/app-audit-2026-11.md)에서 고친 분명한 버그가 다시 생기지 않게 한다.
//   ① 야차전 대결 범위 칩 넘침 ② 몬스터 레벨 숫자 칸 글자 ③ 놀이터 영어 꼬리표 · 펫 대행진 ④ 인라인 이벤트(CSP 콘솔 오류)
//   ⑤ 선생님 폰 머리줄 · 아래 메뉴 ⑥ 글자 대비(펫 도감 · 랭킹 메달) ⑦ 펫 대행진 제목 ⑧ 작은 누름 영역 ⑨ 점검 도구
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { playgroundHtml } from '../public/modules/playground-menu.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
// WCAG 대비(4.5:1이면 보통 글자 통과).
const lum = hex => { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (a, b, share) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * share + parseInt(b.slice(i, i + 2), 16) * (1 - share)).toString(16).padStart(2, '0')).join('');
const rule = (css, selector) => { const at = css.indexOf(selector + '{'); return at < 0 ? '' : css.slice(at + selector.length + 1, css.indexOf('}', at)); };

export async function runAppAuditFixChecks(assert) {
  const css = source('../public/v13243.css'), bundle = source('../public/app.bundle.css');
  assert(bundle.includes('.ms-hero .mh-stats span{') && bundle.indexOf('.ms-hero .mh-stats span{') > bundle.indexOf('.mh-stats span{display:flex'),
    'V13.243.2 점검 수정 CSS(v13243.css 뒤쪽)는 묶음에 들어가고, 덮어쓰던 옛 규칙보다 뒤에 온다');

  // ① 대결 범위 칩: 카드 너비 안에서 줄을 바꾸고, 긴 칩은 말줄임표.
  {
    const row = rule(css, '.yl-chips'), chip = rule(css, '.yl-chips i');
    assert(row.includes('max-width:100%') && row.includes('flex-wrap:wrap') && chip.includes('max-width:100%') && chip.includes('overflow:hidden') && chip.includes('text-overflow:ellipsis')
      && rule(css, '.yl-rm>button:first-child').includes('min-width:0'),
      'V13.243.2 야차전 대결: 범위 칩은 카드 밖으로 나가지 않는다(줄 바꿈 + 말줄임표)');
  }

  // ② 몬스터 레벨 카드 숫자 칸: 결과 화면용 .mh-stats(흰 알약)가 덮어쓰지 않는다. 라벨 · 숫자는 어두운 카드 위에서 잘 보이는 색.
  {
    const battle = source('../public/modules/battle.js'), label = rule(css, '.ms-hero .mh-stats span'), number = rule(css, '.ms-hero .mh-stats b');
    const labelColor = label.match(/color:(#[0-9a-f]{6})/)?.[1] || '#000000';
    assert(battle.includes('<div class="mh-stats"><div><b>') && battle.includes('<span>깬 레벨</span>') && label.includes('background:none') && number.includes('color:#fff')
      && contrast(labelColor, '#4a2f6b') >= 4.5 && rule(css, '.ms-hero .mh-stats .hard b').includes('var(--mh-ember)'),
      'V13.243.2 몬스터 레벨 카드: 숫자 칸 라벨 · 숫자가 어두운 카드 위에서 보인다(흰 알약 없음)');
    assert(!battle.includes('MONSTER LEVEL') && battle.includes('<h2>몬스터 레벨 <b class="ms-now">'), 'V13.243.2 몬스터 레벨 카드: 뜻 없는 영어 꼬리표(MONSTER LEVEL)를 뺐다');
  }

  // ③ 놀이터 첫 화면: 카드 위 영어 꼬리표 없음, 미니게임 설명에 펫 대행진.
  {
    const A = { data: { rewards: { market_open: true }, stats: { points_balance: 100 } } };
    const o = { balance: 100, yabawi: true, art: new Set(), games: () => '', party: () => '', market: () => '', shop: () => '', collection: () => '', rps: () => '', yabawiGame: () => '' };
    const hub = playgroundHtml(A, { view: 'hub' }, o), cards = hub.slice(hub.indexOf('pg-hub'));
    assert(!/<span class="pill">\s*(ARCADE|TAJJA|SHOP|RECORD|MARKET)?\s*<\/span>/.test(cards) && !cards.includes('class="pill"')
      && ['미니게임', '코인 승부', '상점', '기록', '증권거래소'].every(t => cards.includes(`<h2>${t}</h2>`)),
      'V13.243.2 놀이터 첫 화면: 카드에 영어 꼬리표(ARCADE · TAJJA · SHOP · RECORD · MARKET)가 없다(빈 꼬리표도 없다)');
    assert(cards.includes('10초 맞추기 · 펫 대행진') && source('../public/modules/arcade-games.js').includes('runner-open'),
      'V13.243.2 놀이터 미니게임 카드 설명에 펫 대행진이 들어 있다');
  }

  // ④ 인라인 이벤트 속성 금지: 보안 정책(script-src 'self')에 막혀 콘솔 오류가 나고 동작하지 않는다.
  {
    const dir = fileURLToPath(new URL('../public/modules/', import.meta.url));
    const files = [...readdirSync(dir).filter(f => f.endsWith('.js')).map(f => ['modules/' + f, readFileSync(dir + f, 'utf8')]),
      ...['app.js', 'student-enhancements.js', 'teacher-enhancements.js', 'practice-enhancements.js', 'index.html'].map(f => [f, source('../public/' + f)])];
    const bad = files.filter(([, text]) => /<[a-z][^<>`]*\son(click|submit|error|load|input|change|keydown|keyup|focus|blur)\s*=\s*["'\\]/i.test(text)).map(([f]) => f);
    const app = source('../public/app.js');
    assert(!bad.length, `V13.243.2 화면 HTML에 인라인 이벤트 속성(onclick · onsubmit 등)을 쓰지 않는다: ${bad.join(', ')}`);
    assert(source('../public/modules/arcade-games.js').includes('<form class="ag-join">') && app.includes("document.addEventListener('submit'") && app.includes("closest?.('.ag-join')") && app.includes('event.preventDefault()'),
      'V13.243.2 교실 게임 방 번호 칸: Enter는 새로고침이 아니라 들어가기(문서 submit 리스너)');
  }

  // ⑤ 선생님 폰 화면: 머리줄은 줄을 바꾸고(학교 이름이 세로로 꺾이지 않음), 학교 · 반 띠도 줄을 바꾸고, 아래 메뉴 글자는 잘리지 않는다.
  {
    const mobile = css.slice(css.indexOf('@media (max-width:760px){'), css.indexOf('/* ④'));
    assert(/\.tv2-top\{flex-wrap:wrap/.test(mobile) && /\.tv2-title\{flex:1 0 auto\}/.test(mobile) && /\.tv2-title \.eyebrow\{white-space:nowrap\}/.test(mobile)
      && /\.tv2-context\{flex-wrap:wrap;overflow-x:visible/.test(mobile) && /\.tv2-tab span\{white-space:normal;overflow:visible;text-overflow:clip;word-break:keep-all/.test(mobile),
      'V13.243.2 선생님 폰 화면: 머리줄 · 학교 띠는 줄을 바꾸고 아래 메뉴 글자는 말줄임 없이 두 줄까지');
  }

  // ⑥ 글자 대비: 펫 도감 번호 · 종류 · 레벨(펫 색에 먹색을 섞음), 못 만난 모습 설명, 홈 랭킹 메달 숫자.
  {
    const chip = rule(css, '.pb-no,.pb-type,.pb-lv'), share = Number(chip.match(/var\(--pc\) (\d+)%/)?.[1] || 100) / 100, ink = chip.match(/,(#[0-9a-f]{6})\)/)?.[1] || '#ffffff';
    // 점검에서 가장 흐렸던 펫 색 → 그 카드의 연한 바탕.
    const worst = [['#f3a7a8', '#fff1f0'], ['#e9b92e', '#fffbea'], ['#77c9b2', '#fff7fc'], ['#71c96e', '#f0f9e8'], ['#f09aae', '#fff1f4'], ['#7ba7e8', '#f3f7fe']];
    assert(share > 0.2 && share <= 0.45 && worst.every(([pet, bg]) => contrast(mix(pet, ink, share), bg) >= 4.5), 'V13.243.2 펫 도감: 번호 · 종류 · 레벨 글자가 연한 바탕 위에서 4.5:1을 넘는다');
    const caption = rule(css, '.pb-form figcaption').match(/color:(#[0-9a-f]{6})/)?.[1] || '#ffffff';
    assert(contrast(caption, '#ffffff') >= 4.5 && contrast(caption, '#f3f7fe') >= 4.5, 'V13.243.2 펫 도감: 못 만난 모습 설명 글자도 4.5:1을 넘는다');
    const medal = (name, stops) => { const color = rule(css, `.hr-medal.${name}`).match(/color:(#[0-9a-f]{6})/)?.[1] || '#ffffff'; return stops.every(bg => contrast(color, bg) >= 4.5); };
    assert(medal('m1', ['#ffd35a', '#f0a400']) && medal('m2', ['#d9e1ea', '#9aa8b8']) && medal('m3', ['#f3b58a', '#c7773f']), 'V13.243.2 홈 랭킹 메달: 금 · 은 · 동 위 숫자가 4.5:1을 넘는다');
  }

  // ⑦ 펫 대행진 지도 제목: 밝은 하늘 위에서도 보이게 남색 그림자.  ⑧ 작은 누름 영역: 모양은 그대로, 누르는 자리만 넓힌다.
  assert(rule(css, '.rn-top strong').includes('text-shadow:') && rule(css, '.rn-top strong').includes('var(--rn-ink)'), 'V13.243.2 펫 대행진 지도 제목: 밝은 바탕에서도 보이는 남색 그림자');
  assert(rule(css, '.yl-q::after').includes('inset:-12px') && rule(css, '.study-back::after,.page-back-v1368::after').includes('inset:-11px') && rule(css, '.study-back,.page-back-v1368').includes('position:relative'),
    'V13.243.2 야차전 도움말 "?" · 뒤로 가기 글자 버튼: 누르는 자리가 44px 안팎');

  // 가로 밀림: 펫 도감 카드는 격자 칸을 넘지 않고(머리줄은 줄 바꿈), 작은 폰의 야차전 안내 줄은 줄을 바꾼다.
  assert(rule(css, '.pb-grid>.pb-card').includes('min-width:0') && rule(css, '.pb-card header').includes('flex-wrap:wrap')
    && /@media \(max-width:360px\)\{\s*\.yl-hint\{margin-left:0;white-space:normal;flex-wrap:wrap\}/.test(css),
    'V13.243.2 펫 도감(폭 320px · 아이패드) · 야차전 대결(폭 360px 아래)은 화면이 가로로 밀리지 않는다');

  // 선생님 폰: 카드로 안 바뀌는 넓은 표(단어 데이터 등)는 옆으로 밀어 볼 수 있다. 펫 대행진 지도 머리줄은 내려가도 뒤가 하늘색.
  assert(css.includes('.teacher-app.tv2 .table-scroll:not(:has(.student-ops-table,.tv2-results-table)){overflow-x:auto') && source('../public/v1364.css').includes('.teacher-app.tv2 .table-scroll{overflow:visible}'),
    'V13.243.2 선생님 폰 화면: 카드형이 아닌 표는 가로로 밀어 볼 수 있다(허용 뜻 · 관리 칸이 잘리지 않는다)');
  assert(rule(css, '.rn-app>.rn-top').includes('var(--rn-sky1)') && rule(css, '.rn-app>.rn-top').includes('transparent'), 'V13.243.2 펫 대행진 지도 머리줄: 내려가도 제목 뒤가 하늘색');

  // ⑨ 점검 도구: 테스트 데이터로 따로 띄운 로컬 서버만 본다(운영 · Supabase 연결 없음), 검사(npm run check)에는 넣지 않는다.
  {
    const tool = source('../docs/app-audit.mjs');
    assert(tool.includes("testSeedState") && tool.includes("delete process.env[k]") && tool.includes("'SUPABASE_URL'") && tool.includes('127.0.0.1') && !/workers\.dev|supabase\.co/.test(tool)
      && !source('../package.json').includes('app-audit.mjs'),
      'V13.243.2 점검 도구(docs/app-audit.mjs)는 테스트 데이터 로컬 서버만 쓰고 운영에 연결하지 않는다');
  }
}
