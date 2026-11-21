// V13.243.2 앱 전체 화면 점검 도구. 검사(npm run check)에는 넣지 않는다(playwright가 이 저장소 의존성이 아니다).
// 무엇을 하나: 테스트 데이터(server/test-seed.mjs)로 로컬 서버를 따로 띄우고(운영 · 테스트 서버에 연결하지 않음),
// 폰 크기 브라우저로 학생 · 선생님 화면을 돌면서 화면마다 아래를 자동으로 잰다.
//   넘침(가로 스크롤 · 화면 밖 · 카드 밖), 겹친 글자, 잘린 글자, 대비 부족(4.5:1 미만), 11px 미만 글자,
//   44px 미만 누름 영역, 깨진 그림, 콘솔 오류 · 실패한 요청, 영어 꼬리표 · 이모지, 글자 크기 · 둥근 정도 가짓수
// 사용: node docs/app-audit.mjs [--width 390] [--only 이름조각,이름조각] [--out 폴더] [--shots] [--list]
//   탐색용: node docs/app-audit.mjs --role student --user ts2 --steps "go:arcade;text:상점" --dump
//   playwright 위치: PLAYWRIGHT=/경로/node_modules/playwright (없으면 깔려 있는 것을 찾는다)
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? (process.argv[i + 1]?.startsWith('--') || process.argv[i + 1] === undefined ? true : process.argv[i + 1]) : fallback; };
const WIDTH = Number(arg('width', 390)), HEIGHT = Number(arg('height', WIDTH >= 700 ? 1024 : WIDTH <= 320 ? 568 : 844));
const OUT = resolve(arg('out', resolve(here, 'docs/screenshots/app-audit')));
const ONLY = String(arg('only', '') === true ? '' : arg('only', '')).split(',').filter(Boolean);
const SHOTS = !!arg('shots', false), DUMP = !!arg('dump', false), LIST = !!arg('list', false);
const PORT = Number(arg('port', 4391));
const BASE = `http://127.0.0.1:${PORT}`;

function loadPlaywright() {
  for (const name of [process.env.PLAYWRIGHT, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) { try { return require(name); } catch {} }
  throw Error('playwright를 찾지 못했어요. PLAYWRIGHT=/경로/node_modules/playwright 로 알려 주세요.');
}

/* ---------- 돌아볼 화면 ----------
   steps: go:탭(data-go) · act:이름(data-action) · text:글자(보이는 버튼 · 카드) · sel:CSS · wait:밀리초 · close(창 닫기) · scroll:px
   모든 장면은 새로 불러온 첫 화면에서 시작한다(앞 장면의 영향이 없다). */
const S = (name, user, steps, note = '') => ({ name, user, steps: steps.split(';').filter(Boolean), note });
export const SCENES = [
  // 학생: 홈 · 나
  S('s-home', 'ts2', ''),
  S('s-home-new', 'ts6', ''),
  S('s-coins', 'ts2', 'act:coins'),
  S('s-account', 'ts2', 'act:account'),
  S('s-egg-shop', 'ts2', 'act:egg-shop'),
  S('s-attend', 'ts4', 'act:attend;wait:1500'),
  S('s-ranking', 'ts2', 'go:ranking'),
  S('s-me', 'ts2', 'go:me'),
  S('s-me-stars', 'ts2', 'go:me;act:me-stars'),
  S('s-me-notify', 'ts2', 'go:me;act:me-notify'),
  S('s-studio', 'ts2', 'go:studio'),
  S('s-studio-special', 'ts3', 'go:studio'),
  S('s-studio-accessory', 'ts2', 'go:studio;sel:[data-studio-tab=accessory]'),
  S('s-studio-frame', 'ts2', 'go:studio;sel:[data-studio-tab=frame]'),
  S('s-studio-title', 'ts2', 'go:studio;sel:[data-studio-tab=title]'),
  S('s-titles', 'ts2', 'go:titles'),
  S('s-petbook', 'ts2', 'go:me;go:petbook'),
  // 학생: 학습 · 시험 · 기록
  S('s-practice', 'ts2', 'go:practice'),
  S('s-vocab', 'ts2', 'go:practice;sel:[data-study=vocab]'),
  S('s-vocab-textbook', 'ts2', 'go:practice;sel:[data-study=vocab];sel:[data-memorize-range-type=textbook]'),
  S('s-flashcards', 'ts2', 'go:practice;sel:[data-study=vocab];sel:[data-flashcards]'),
  S('s-quick-practice', 'ts4', 'go:practice;sel:[data-quick-practice]'),
  S('s-grammar', 'ts2', 'go:practice;sel:[data-study=grammar]'),
  S('s-grammar-set', 'ts2', 'go:practice;sel:[data-study=grammar];sel:[data-grammar-id=danwon-ybm2-1-1]'),
  S('s-exam', 'ts2', 'go:practice;go:exam'),
  S('s-records', 'ts2', 'go:practice;go:records'),
  // 학생: 야차전
  S('s-yacha-battle', 'ts2', 'go:yacha'),
  S('s-yacha-battle-long-range', 'ts2', 'go:yacha;sel:[data-yb=range-sheet];sel:[data-rs-code=L3];sel:[data-rs-code=L4];sel:[data-rs-code="9월 41~42"];sel:[data-rs-code="9월 21"];sel:[data-rs-done]', '범위 이름이 길 때(운영의 "외부 45 · 외부 46"과 같은 길이)'),
  S('s-yacha-range-sheet', 'ts2', 'go:yacha;sel:[data-yb=range-sheet]'),
  S('s-yacha-join-sheet', 'ts2', 'go:yacha;sel:[data-yb=join-sheet]'),
  S('s-yacha-help', 'ts2', 'go:yacha;sel:[data-yb=help][data-key=mode]'),
  S('s-yacha-bot-play', 'ts5', 'go:yacha;sel:[data-yb=bot];wait:6000'),
  S('s-yacha-monster', 'ts2', 'go:yacha;sel:[data-tab=monster]'),
  S('s-yacha-monster-play', 'ts5', 'go:yacha;sel:[data-tab=monster];sel:[data-yb=monster-go][data-level=easy];wait:5000'),
  S('s-yacha-dungeon', 'ts2', 'go:yacha;sel:[data-tab=dungeon]'),
  S('s-dungeon-lobby', 'ts2', 'go:yacha;sel:[data-tab=dungeon];sel:[data-yb=dungeon];wait:1500'),
  S('s-yacha-league', 'ts2', 'go:yacha;sel:[data-tab=record]'),
  S('s-yacha-record-me', 'ts2', 'go:yacha;sel:[data-tab=record];sel:[data-sub=me]'),
  // 학생: 놀이터
  S('s-arcade', 'ts2', 'go:arcade'),
  S('s-arcade-games', 'ts2', 'go:arcade;sel:[data-pg=arcade]'),
  S('s-arcade-tajja', 'ts2', 'go:arcade;sel:[data-pg=tajja]'),
  S('s-arcade-shop', 'ts2', 'go:arcade;sel:[data-pg=shop]'),
  S('s-arcade-shop-odds', 'ts2', 'go:arcade;sel:[data-pg=shop];sel:[data-ga=odds]'),
  S('s-arcade-records', 'ts2', 'go:arcade;sel:[data-pg=records]'),
  S('s-rps', 'ts2', 'go:arcade;sel:[data-pg=tajja];sel:[data-pg=rps];wait:800'),
  S('s-yabawi', 'ts2', 'go:arcade;sel:[data-pg=tajja];sel:[data-pg=yabawi];wait:800'),
  S('s-game-reel', 'ts2', 'go:arcade;sel:[data-pg=arcade];act:reel-open;wait:1500'),
  S('s-game-match', 'ts2', 'go:arcade;sel:[data-pg=arcade];act:arcade-match;wait:1500'),
  S('s-game-words', 'ts2', 'go:arcade;sel:[data-pg=arcade];act:arcade-words;wait:600'),
  S('s-game-wall', 'ts2', 'go:arcade;sel:[data-pg=arcade];act:wall-open;wait:1500'),
  S('s-game-arena', 'ts2', 'go:arcade;sel:[data-pg=arcade];act:arena-open;wait:1500'),
  S('s-game-hunt', 'ts2', 'go:arcade;sel:[data-pg=arcade];act:hunt-open;wait:1500'),
  S('s-game-claw', 'ts2', 'go:arcade;sel:[data-pg=arcade];act:claw-open;wait:1500'),
  S('s-game-timing', 'ts2', 'go:arcade;sel:[data-pg=arcade];act:timing-open;wait:1500'),
  S('s-game-runner', 'ts2', 'go:arcade;sel:[data-pg=arcade];act:runner-open;wait:1500'),
  // 선생님
  S('t-dashboard', 'tteacher', ''),
  S('t-notice', 'tteacher', 'act:notice'),
  S('t-gift', 'tteacher', 'act:gift'),
  S('t-account', 'tteacher', 'act:account'),
  S('t-reward-events', 'tteacher', 'act:reward-events'),
  S('t-timing-daily', 'tteacher', 'act:timing-daily'),
  S('t-student-detail', 'tteacher', 'sel:[data-student=test-s2]'),
  S('t-class-tv', 'tteacher', 'act:class-tv;wait:1200'),
  S('t-party-new', 'tteacher', 'act:party-new'),
  S('t-students', 'tteacher', 'go:students'),
  S('t-books', 'tteacher', 'go:books'),
  S('t-results', 'tteacher', 'go:results;wait:1200'),
  S('t-petdex', 'tteacher', 'go:petdex'),
  S('t-tournaments', 'tteacher', 'go:tournaments'),
  S('t-disputes', 'tteacher', 'go:disputes'),
  S('t-preview', 'tteacher', 'act:student-preview;wait:1500'),
];

/* ---------- 페이지 안에서 도는 검사 ---------- */
function auditInPage() {
  const vw = innerWidth, out = { overflowX: 0, offscreen: [], outOfCard: [], overlap: [], clipped: [], contrast: [], tiny: [], tap: [], images: [], english: [], emoji: [], fonts: {}, radii: {}, shadows: 0 };
  const scope = [...document.querySelectorAll('#modal-root > *, .modal, [role=dialog]')].filter(e => e.getBoundingClientRect().height > 40).pop() || document.querySelector('#app') || document.body;
  const doc = document.documentElement;
  out.overflowX = Math.max(0, doc.scrollWidth - doc.clientWidth);
  out.scope = scope.id || scope.className?.toString().slice(0, 40) || scope.tagName;
  const path = el => { const parts = []; for (let e = el; e && e !== document.body && parts.length < 3; e = e.parentElement) parts.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : '')); return parts.join(' > '); };
  const txt = el => (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  // 글자 뒤 바탕색들: 가까운 조상부터 불투명한 색이 나올 때까지. 그라디언트면 색 멈춤을 모두 본다. 그림이면 모름(null).
  function backdrops(el) {
    let layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        if (cs.backgroundImage.includes('url(')) return null;
        const stops = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
        if (stops.length && stops.every(s => s.a > 0.9)) return stops.map(s => layers.reduceRight((under, top) => over(top, under), { ...s, a: 1 }));
        if (stops.length) return null;
      }
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) { if (bg.a >= 0.99) return [layers.reduceRight((under, top) => over(top, under), bg)]; layers.push(bg); }
    }
    return [layers.reduceRight((under, top) => over(top, under), { r: 255, g: 255, b: 255, a: 1 })];
  }
  const visible = el => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; if (el.checkVisibility && !el.checkVisibility({ contentVisibilityAuto: true })) return false; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) return false; } return true; };
  const layerRoot = el => { for (let e = el; e && e !== scope; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky' || p === 'absolute') return e; } return scope; };
  const scrollsX = el => { for (let e = el.parentElement; e; e = e.parentElement) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1) return true; } return false; };
  const texts = [];
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const value = n.nodeValue.trim(); if (!value) continue;
    const el = n.parentElement; if (!el || ['SCRIPT', 'STYLE', 'OPTION'].includes(el.tagName) || !visible(el)) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter(r => r.width > 1 && r.height > 1); if (!rects.length) continue;
    const cs = getComputedStyle(el), size = parseFloat(cs.fontSize), label = value.replace(/\s+/g, ' ').slice(0, 30);
    texts.push({ el, rects, label, root: layerRoot(el) });
    if (seen.has(el)) continue; seen.add(el);
    out.fonts[Math.round(size * 10) / 10] = (out.fonts[Math.round(size * 10) / 10] || 0) + 1;
    if (size < 11) out.tiny.push({ text: label, px: Math.round(size * 10) / 10, at: path(el) });
    // 대비
    let fg = parse(cs.color), alpha = 1;
    for (let e = el; e; e = e.parentElement) alpha *= Number(getComputedStyle(e).opacity);
    const clipText = cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text';
    const bgs = clipText ? null : backdrops(el);
    if (fg && bgs) {
      // 그라디언트 바탕은 색 멈춤 중 가장 잘 보이는 쪽으로도 모자랄 때만 센다(확실한 것만). 꺼진 버튼은 빼고 센다.
      let best = 0, bestBg = null;
      for (const bg of bgs) { const c = over({ ...fg, a: fg.a * alpha }, bg), r = ratio(c, bg); if (r > best) { best = r; bestBg = bg; } }
      const big = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700), need = big ? 3 : 4.5;
      if (best < need && !el.closest(':disabled, [aria-disabled=true], .disabled, .locked, .lock')) out.contrast.push({ text: label, ratio: Math.round(best * 100) / 100, need, fg: hex(over({ ...fg, a: fg.a * alpha }, bestBg)), bg: hex(bestBg), px: Math.round(size), at: path(el), approx: bgs.length > 1 });
    }
    // 화면 밖
    const r = el.getBoundingClientRect();
    if ((rects.some(q => q.right > vw + 1 || q.left < -1)) && !scrollsX(el)) out.offscreen.push({ text: label, left: Math.round(r.left), right: Math.round(r.right), at: path(el) });
    // 잘림(말줄임표가 아닌데 숨김)
    for (let e = el, depth = 0; e && depth < 3; e = e.parentElement, depth++) {
      const es = getComputedStyle(e); if (es.display === 'inline') continue;
      const hid = es.overflowX === 'hidden' || es.overflowX === 'clip', clamp = es.webkitLineClamp && es.webkitLineClamp !== 'none';
      if (hid && e.scrollWidth > e.clientWidth + 1 && es.textOverflow !== 'ellipsis' && !clamp) { const er = e.getBoundingClientRect(); if (rects.some(q => q.right > er.right + 1 || q.left < er.left - 1)) { out.clipped.push({ text: label, by: Math.round(e.scrollWidth - e.clientWidth), dir: 'x', at: path(e) }); break; } }
      const hidY = es.overflowY === 'hidden' || es.overflowY === 'clip';
      if (hidY && e.scrollHeight > e.clientHeight + 2 && !clamp) { const er = e.getBoundingClientRect(); if (rects.some(q => q.bottom > er.bottom + 2 && q.top < er.bottom)) { out.clipped.push({ text: label, by: Math.round(e.scrollHeight - e.clientHeight), dir: 'y', at: path(e) }); break; } }
    }
    // 카드 밖: 바탕 · 테두리가 있는 가장 가까운 조상 상자를 2px 넘게 벗어남
    for (let e = el.parentElement, depth = 0; e && e !== scope && depth < 6; e = e.parentElement, depth++) {
      const es = getComputedStyle(e), boxy = (parse(es.backgroundColor)?.a > 0.05) || es.backgroundImage !== 'none' || parseFloat(es.borderTopWidth) > 0;
      if (!boxy || es.display === 'inline') continue;
      if (getComputedStyle(el).position === 'absolute' || layerRoot(el) !== layerRoot(e)) break;
      const er = e.getBoundingClientRect();
      const dx = Math.max(...rects.map(q => q.right - er.right), ...rects.map(q => er.left - q.left)), dy = Math.max(...rects.map(q => q.bottom - er.bottom));
      if ((dx > 2 || dy > 3) && !/(hidden|clip|auto|scroll)/.test(es.overflowX) && !scrollsX(el)) out.outOfCard.push({ text: label, dx: Math.round(dx), dy: Math.round(dy), at: path(el), card: path(e) });
      break;
    }
    if (/^[A-Z][A-Z0-9 &·\-!']{2,}$/.test(value) && /[A-Z]{3}/.test(value)) out.english.push({ text: label, px: Math.round(size), at: path(el) });
    if (/\p{Extended_Pictographic}/u.test(value.replace(/[✓✕×→←▲▼▶◀★☆♥·]/g, ''))) out.emoji.push({ text: label, at: path(el) });
  }
  // 겹친 글자: 같은 층(고정 · 절대 위치 뿌리가 같은 것)에서 서로 조상이 아닌 두 글자 상자가 4px 넘게 겹침
  const pairs = new Set();
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    if (a.el === b.el || a.root !== b.root || a.el.contains(b.el) || b.el.contains(a.el)) continue;
    let hit = 0;
    for (const p of a.rects) for (const q of b.rects) { const w = Math.min(p.right, q.right) - Math.max(p.left, q.left), h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top); if (w > 4 && h > 4) hit = Math.max(hit, Math.round(w * h)); }
    if (hit) { const key = a.label + '|' + b.label; if (!pairs.has(key)) { pairs.add(key); out.overlap.push({ a: a.label, b: b.label, area: hit, at: path(a.el), with: path(b.el) }); } }
  }
  // 누름 영역
  for (const el of scope.querySelectorAll('button, a[href], [role=button], input:not([type=hidden]), select, textarea, [data-action], [data-go]')) {
    if (!visible(el) || el.disabled) continue;
    const box = el.getBoundingClientRect(), r = { width: box.width, height: box.height };
    if (el.closest('button, a[href]') !== el && el.closest('button, a[href]')) continue;
    // 모양은 작아도 ::before · ::after로 누르는 자리를 넓힌 것은 넓힌 크기로 센다.
    for (const pseudo of ['::before', '::after']) { const ps = getComputedStyle(el, pseudo); if (ps.content === 'none' || ps.position !== 'absolute') continue; const grow = k => Math.max(0, -parseFloat(ps[k]) || 0); r.width = Math.max(r.width, box.width + grow('left') + grow('right')); r.height = Math.max(r.height, box.height + grow('top') + grow('bottom')); }
    if (r.width < 44 || r.height < 44) out.tap.push({ text: txt(el) || el.getAttribute('aria-label') || el.tagName, w: Math.round(r.width), h: Math.round(r.height), at: path(el) });
  }
  for (const img of scope.querySelectorAll('img')) if (visible(img) && img.complete && !img.naturalWidth) out.images.push({ src: (img.getAttribute('src') || '').slice(0, 80), at: path(img) });
  for (const el of scope.querySelectorAll('*')) {
    if (!visible(el)) continue; const cs = getComputedStyle(el);
    const rad = parseFloat(cs.borderTopLeftRadius); const boxy = (parse(cs.backgroundColor)?.a > 0.05) || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0;
    if (boxy && rad > 0 && !cs.borderTopLeftRadius.includes('%')) { const k = rad > 100 ? '알약' : Math.round(rad); out.radii[k] = (out.radii[k] || 0) + 1; }
    if (cs.boxShadow !== 'none') out.shadows++;
  }
  return out;
}

/* ---------- 서버 ---------- */
async function startServer() {
  const dir = resolve(tmpdir(), `sumus-audit-${process.pid}`), db = resolve(dir, 'audit.sqlite');
  await mkdir(dir, { recursive: true });
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'STATE_BRIDGE_URL', 'STATE_BRIDGE_SECRET']) delete process.env[k];
  const { repository } = await import('../server/repository.mjs');
  const { testSeedState } = await import('../server/test-seed.mjs');
  const repo = await repository(db), { revision } = await repo.read();
  await repo.commit(await testSeedState(), revision); repo.close();
  const child = spawn(process.execPath, ['--no-warnings', resolve(here, 'server/index.mjs')], { env: { ...process.env, DATA_PATH: db, PORT: String(PORT), HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; child.stdout.on('data', d => log += d); child.stderr.on('data', d => log += d);
  for (let i = 0; i < 80; i++) { try { const r = await fetch(`${BASE}/api/health`); if (r.ok) return { child, dir }; } catch {} await new Promise(r => setTimeout(r, 250)); }
  child.kill(); throw Error('서버가 뜨지 않았어요.\n' + log.slice(-800));
}

/* ---------- 브라우저 ---------- */
const TEACHERS = new Set(['tteacher', 'tteacher2']);
async function login(browser, user) {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: Number(arg('scale', SHOTS ? 2 : 1)), hasTouch: true, isMobile: WIDTH < 700, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  await page.waitForSelector('input[name=username]');
  if (TEACHERS.has(user)) await page.click('.teacher-login-link');
  await page.fill('input[name=username]', user); await page.fill('input[name=password]', 'test1234');
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-go]', { timeout: 15000, state: 'attached' });
  await page.close();
  return ctx;
}
// 처음 뜨는 창(알 · 칭호 · 앱 설치 안내 등)을 닫는다.
async function closePopups(page, rounds = 8) {
  for (let i = 0; i < rounds; i++) {
    const did = await page.evaluate(() => {
      const shown = e => e && e.getBoundingClientRect().height > 0;
      const roots = [...document.querySelectorAll('#modal-root > *, .modal, .pet-moment, [class*=moment], [class*=install], [class*=overlay]')].filter(shown);
      for (const root of roots.reverse()) {
        const btn = [...root.querySelectorAll('button')].filter(shown).find(b => /^(×|✕|닫기|확인|나중에|자동으로 보기|좋아요|알겠어요|다음|계속|받기|건너뛰기)/.test(b.textContent.trim()) || /close|dismiss|skip/i.test(b.className + (b.dataset.action || '') + (b.getAttribute('aria-label') || '')));
        if (btn) { btn.click(); return true; }
      }
      return false;
    });
    await page.waitForTimeout(did ? 600 : 250);
    if (!did && i > 1) break;
  }
}
async function step(page, s) {
  const [kind, ...rest] = s.split(':'), value = rest.join(':');
  if (kind === 'go') { const el = page.locator(`[data-go="${value}"]:visible`).first(); if (await el.count()) await el.click({ timeout: 2500 }).catch(() => el.evaluate(e => e.click())); else await page.locator(`[data-go="${value}"]`).first().evaluate(e => e.click()); }
  else if (kind === 'act') await page.locator(`[data-action="${value}"]:visible`).first().click();
  else if (kind === 'sel') await page.locator(value).locator('visible=true').first().click();
  else if (kind === 'text') await page.locator('button:visible, a:visible, [role=button]:visible, [data-action]:visible, summary:visible, label:visible').filter({ hasText: value }).first().click();
  else if (kind === 'wait') await page.waitForTimeout(Number(value));
  else if (kind === 'close') await closePopups(page);
  else if (kind === 'scroll') await page.evaluate(y => scrollTo(0, y), Number(value));
  else if (kind === 'fill') { const [sel, v] = value.split('='); await page.fill(sel, v); }
  else throw Error('모르는 단계: ' + s);
  await page.waitForTimeout(kind === 'wait' ? 0 : 700);
}

async function runScene(ctx, scene) {
  const page = await ctx.newPage(), errors = [];
  page.setDefaultTimeout(6000);
  // 앞 장면에서 저장된 화면 위치(놀이터 하위 화면 등)가 남지 않게 한다. 로그인은 쿠키라 그대로다.
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('audit-cleared')) { localStorage.clear(); sessionStorage.setItem('audit-cleared', '1'); } } catch {} });
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push('error: ' + e.message.slice(0, 160)));
  page.on('requestfailed', r => { if (!/ERR_ABORTED/.test(r.failure()?.errorText || '')) errors.push('요청 실패: ' + r.url().replace(BASE, '').slice(0, 80)); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()}: ` + r.url().replace(BASE, '').slice(0, 80)); });
  let failed = '';
  try {
    await page.goto(BASE + '/');
    await page.waitForSelector('[data-go]', { timeout: 15000, state: 'attached' });
    await page.waitForTimeout(900);
    await closePopups(page);
    for (const s of scene.steps) await step(page, s);
    await page.waitForTimeout(400);
  } catch (e) { failed = e.message.split('\n')[0].slice(0, 160) + ' | 화면: ' + (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 140)).catch(() => '')); }
  const audit = await page.evaluate(auditInPage).catch(e => ({ crashed: e.message }));
  if (DUMP) {
    console.log(`\n===== ${scene.name}: ${scene.steps.join(';')}${failed ? ' ⚠ ' + failed : ''}`);
    console.log(await page.evaluate(failedNow => {
      const scope = [...document.querySelectorAll('#modal-root > *, .modal')].filter(e => e.getBoundingClientRect().height > 40).pop() || document.body;
      const items = [...scope.querySelectorAll('button, a[href], [data-action], [data-go], summary, select, input')].filter(e => e.getBoundingClientRect().height > 0 && !e.closest('.bottom-nav, header.app-header')).slice(0, failedNow ? 0 : 45).map(e => `${e.tagName === 'BUTTON' ? '' : e.tagName.toLowerCase()}${e.classList[0] ? '.' + e.classList[0] : ''} ${[...e.attributes].filter(a => a.name.startsWith('data-')).map(a => a.name.slice(5) + '=' + a.value.slice(0, 20)).join(' ')} | ${(e.innerText || e.value || e.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 28)}`);
      return `--- 제목들: ${[...scope.querySelectorAll('h1,h2,h3')].map(h => h.innerText.trim().slice(0, 20)).slice(0, 14).join(' / ')}\n` + items.join('\n');
    }, !!failed));
  }
  let shot = '';
  if (SHOTS || DUMP) { await mkdir(OUT, { recursive: true }); shot = resolve(OUT, `${scene.name}-${WIDTH}.png`); await page.screenshot({ path: shot, fullPage: !!arg('full', false) }).catch(() => { shot = ''; }); }
  await page.close();
  return { name: scene.name, user: scene.user, steps: scene.steps, failed, errors: [...new Set(errors)], audit, shot };
}

const COUNT_KEYS = ['offscreen', 'outOfCard', 'overlap', 'clipped', 'contrast', 'tiny', 'tap', 'images', 'english', 'emoji'];
function summarize(results) {
  const head = '| 화면 | 가로 넘침 | 화면 밖 | 카드 밖 | 겹침 | 잘림 | 대비 | 작은 글자 | 작은 누름 | 깨진 그림 | 영어 꼬리표 | 이모지 | 글자 크기 수 | 둥근 정도 수 | 오류 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|';
  const rows = results.map(r => { const a = r.audit; if (a.crashed) return `| ${r.name} | 검사 실패: ${a.crashed} |`; return `| ${r.name}${r.failed ? ' ⚠' : ''} | ${a.overflowX || ''} | ${COUNT_KEYS.map(k => a[k].length || '').join(' | ')} | ${Object.keys(a.fonts).length} | ${Object.keys(a.radii).length} | ${r.errors.length || ''} |`; });
  return [head, ...rows].join('\n');
}

async function main() {
  if (LIST) { console.log(SCENES.map(s => `${s.name}\t${s.user}\t${s.steps.join(';')}`).join('\n')); return; }
  const { chromium } = loadPlaywright();
  const { child, dir } = await startServer();
  const browser = await chromium.launch({ args: ['--mute-audio'] });
  const contexts = new Map(), results = [];
  try {
    const custom = arg('steps', null);
    const scenes = custom !== null ? String(custom === true ? '' : custom).split('|').map((c, i) => S(`${arg('name', 'custom')}${i ? i + 1 : ''}`, String(arg('user', 'ts2')), c)) : SCENES.filter(s => !ONLY.length || ONLY.some(o => s.name.includes(o)));
    for (const scene of scenes) {
      if (!contexts.has(scene.user)) contexts.set(scene.user, await login(browser, scene.user));
      const r = await runScene(contexts.get(scene.user), scene);
      results.push(r);
      if (r.failed) console.log(`⚠ ${scene.name}: ${r.failed} ${r.errors.slice(0, 3).join(' / ')}`);
    }
  } finally { await browser.close(); child.kill(); await rm(dir, { recursive: true, force: true }).catch(() => {}); }
  await mkdir(OUT, { recursive: true });
  const file = resolve(OUT, `audit-${WIDTH}${arg('steps', null) !== null ? '-custom' : ''}.json`);
  await writeFile(file, JSON.stringify(results, null, 1));
  console.log(summarize(results));
  if (DUMP) for (const r of results) { for (const k of [...COUNT_KEYS, 'errors']) { const list = k === 'errors' ? r.errors : r.audit[k]; if (list?.length && k !== 'tap') console.log(`[${k}]`, JSON.stringify(list.slice(0, 12))); } }
  console.log(`자세한 결과: ${file}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
