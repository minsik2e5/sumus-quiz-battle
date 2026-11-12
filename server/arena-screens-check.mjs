// V13.239 검사: 펫 아레나 전투 밖 화면(입구 · 친구 대전 · 방 · VS · 결과 · 랭킹 · 꾸미기) 디자인 규칙.
//   구성안 docs/arena-ui-vfx-plan.md 3-A(질문 E-1 '정리형'): 남색 뼈대 3 + 금 1 + 속성 8 + 팀 2 토큰, 글자 크기 5단계, 둥근 정도 3단계,
//   화면 이모지 0개, 그라디언트 · 글로우는 그림(배지 · 장면 썸네일 · 배너)에만. 전투 경기장 · 버튼 · HUD · 효과는 이 검사 밖(다른 단계).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ELEMENTS } from '../public/modules/battle-fx.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const EMOJI = /\p{Extended_Pictographic}/u;
const TOKEN_CSS = '../public/v13239.css';
// 옛 아레나 CSS(전투와 화면이 섞인 파일들). 화면 규칙만 골라 센다.
const ARENA_CSS = ['v13226', 'v13228', 'v13229', 'v13230', 'v13231', 'v13232', 'v13234', 'v13235', 'v13236'];
// 화면 칸 선택자(전투 칸 .ar-play · .ar-hud · .ar-btn · .ar-fx · .ar-mon … 은 들어가지 않는다).
export const SCREEN_SEL = /^\.(ar-(lobby|title|card|rules|sub|slots?|pets|pet-pick|recs|words|go|why|vs|el\b|saving|result|res-|review|skill\b|role|tdots?|tree|ttab|floors?|branch|fork|preview|aimset|aimopt|extra|live|lv-|help|entry|build)|ark-|dc-(wins|trophy|next|bar|tabs?|grid|item|lock|on\b|open|note|pv-(tags|play|btns))|ag-arena)/;
// 광택을 허용하는 곳: 배지(티어 방패 · 보석) · 승급 빛살 · 장면 썸네일 · 배너 · VS 그림 · 링.
export const ART_SEL = /ag-big-art|ark-t-(bronze|silver|gold|platinum|diamond)|ark-(badge|wing|shield|gem|shine|div|rays|sparks|claim-badge)|ar-vs-art|ar-res-banner|dc-thumb|ar-ring|has-art|\.ark-(bronze|silver|gold|platinum|diamond)\b(?!.*ark-(card|board|gain|list|claim-card))/;
// 작은 그림 아이콘을 CSS로 그리는 칸(자물쇠 · 재생 세모 · ⓘ)은 둥근 정도 단계에서 뺀다.
const ICON_SEL = /ar-lock|dc-tri|ar-help summary/;
const FS_OK = new Set([12, 14, 17, 22, 32]);
const COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|(?<![\w-])(white|black)(?![\w-])/g;

// CSS 규칙 [선택자, 본문] (주석 · @keyframes 칸 제외, @media 안 규칙 포함).
function rules(css) {
  const out = [];
  for (const [, sel, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}@;]+)\{([^{}]*)\}/g)) {
    const s = sel.trim();
    if (!s || /^(from|to|\d+%)/.test(s) || /%$/.test(s)) continue;
    out.push([s, body]);
  }
  return out;
}
const isScreen = sel => sel.split(',').map(x => x.trim().replace(/^\.ar-lite\s+|^\.ar-app(\.[\w-]+|:not\([^)]*\))*\s+|^\.ar-stage[^ ]*~\.ar-main\s+|^:is\([^)]*\)\s+/, '')).every(x => SCREEN_SEL.test(x) || /^:is\(/.test(x)) && !ART_SEL.test(sel);
// 함수 본문(이름부터 다음 맨 앞 function/const/export까지).
function fnBody(src, name) {
  const at = src.search(new RegExp(`(^|\\n)(export )?(async )?function ${name}\\(`));
  if (at < 0) return '';
  const next = src.slice(at + 10).search(/\n(export |async |function |const |let |\/\* -)/);
  return src.slice(at, next < 0 ? undefined : at + 10 + next);
}
export function screenStats() {
  let colors = 0, grads = 0, shadows = 0, badFs = [], badR = [];
  for (const f of ARENA_CSS) for (const [sel, body] of rules(source(`../public/${f}.css`))) {
    if (!isScreen(sel)) continue;
    colors += (body.match(COLOR) || []).length;
    grads += (body.match(/gradient\(/g) || []).length;
    shadows += (body.match(/(box|text)-shadow\s*:|drop-shadow\(/g) || []).length;
    for (const [, n] of body.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) if (!FS_OK.has(Number(n))) badFs.push(`${f} ${sel} ${n}px`);
    for (const [, v] of body.matchAll(/border-radius:\s*([^;}]+)/g)) for (const [, n] of v.matchAll(/(\d+(?:\.\d+)?)px/g)) if (![0, 8, 16, 999].includes(Number(n))) badR.push(`${f} ${sel} ${n}px`);
  }
  return { colors, grads, shadows, badFs, badR };
}

export async function runArenaScreensChecks(assert) {
  // 1) 토큰: 남색 뼈대 3 · 금 1 · 팀 2 · 속성 8(battle-fx.js ELEMENTS와 같은 색) · 글자 크기 5 · 둥근 정도 3.
  const css = source(TOKEN_CSS), root = css.match(/:root\{([\s\S]*?)\n\}/)?.[1] || '';
  const tok = name => root.match(new RegExp(`--${name}:([^;]+);`))?.[1]?.trim();
  assert(['a-bg', 'a-surface', 'a-line', 'a-gold', 'a-me', 'a-foe'].every(t => /^#[0-9a-f]{6}$/i.test(tok(t) || ''))
    && Object.entries(ELEMENTS).every(([k, v]) => tok(`a-el-${k}`)?.toLowerCase() === v.c1.toLowerCase()) && Object.keys(ELEMENTS).length === 8
    && ['12px', '14px', '17px', '22px', '32px'].every((v, i) => tok(`a-fs-${i + 1}`) === v) && !tok('a-fs-6')
    && tok('a-r-1') === '8px' && tok('a-r-2') === '16px' && tok('a-r-3') === '999px' && !tok('a-r-4'),
    'V13.239 아레나 토큰: 남색 뼈대 3단계(바탕 · 면 · 선) · 금 하나 · 팀 2색 · 속성 8색(전투 효과 색과 같음) · 글자 크기 5단계 · 둥근 정도 3단계');
  // 2) 토큰 파일: 색 글자는 :root 칸에만. 밖은 var(--a-…) · transparent · currentColor · color-mix(토큰끼리)만.
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/:root\{[\s\S]*?\n\}/, '');
  const stray = body.match(COLOR) || [];
  assert(stray.length === 0, `V13.239 토큰 파일(v13239.css)에 토큰 밖 색이 없다(지금 ${stray.length}개: ${stray.slice(0, 3).join(' ')})`);
  const fsBad = [...body.matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g)].filter(([, n]) => !FS_OK.has(Number(n)));
  const rBad = rules(css).filter(([sel]) => !ICON_SEL.test(sel)).flatMap(([sel, b]) => [...b.matchAll(/border-radius:\s*([^;}]+)/g)].map(m => m[1].trim()).filter(v => !/^((var\(--a-r-[123]\)|0)\s*)+$/.test(v)).map(v => `${sel} ${v}`));
  assert(fsBad.length === 0 && rBad.length === 0, `V13.239 토큰 파일 글자 크기는 5단계 · 둥근 정도는 3단계 토큰만(어긋남: ${[...fsBad.map(x => x[0]), ...rBad].slice(0, 4).join(' | ')})`);
  // 3) 옛 아레나 CSS의 화면 규칙: 색 · 그라디언트 · 글로우를 걷어 냈다(그림 칸 제외). 상한은 이번 정리 뒤 값(늘어나면 실패).
  const st = screenStats();
  assert(st.colors === 0 && st.grads === 0 && st.shadows === 0, `V13.239 옛 아레나 CSS 화면 규칙에 토큰 밖 색 0 · 그라디언트 0 · 그림자 0(지금 색 ${st.colors} · 그라디언트 ${st.grads} · 그림자 ${st.shadows})`);
  assert(st.badFs.length === 0 && st.badR.length === 0, `V13.239 옛 아레나 CSS 화면 규칙도 글자 크기 5단계 · 둥근 정도 3단계(어긋남: ${[...st.badFs, ...st.badR].slice(0, 4).join(' | ')})`);
  // 4) 묶음 CSS: 토큰 파일은 아레나 CSS 다음(덮어쓰기 순서).
  const build = source('./build-assets.mjs');
  assert(build.indexOf('"v13239.css"') > build.indexOf('"v13236.css"') && build.indexOf('"v13236.css"') > 0, 'V13.239 토큰 파일이 묶음 CSS에서 아레나 CSS 다음에 온다');

  // 5) 화면 이모지 0개 · 규칙 파일의 이모지 아이콘(icon)을 화면에 쓰지 않는다. 규칙 파일(arena-*-rules.js)은 그대로.
  const arena = source('../public/modules/arena.js'), live = source('../public/modules/arena-live.js');
  const parts = {
    'arena.js 입구 · 결과': ['skillLine', 'treePanel', 'lobby', 'result', 'multiTitle', 'rankRows'].map(n => fnBody(arena, n)).join('\n'),
    'arena-live.js 친구 대전 · 방': ['home', 'liveTreeLine', 'lobbyView', 'seatsN'].map(n => fnBody(live, n)).join('\n'),
    'arena-rank-ui.js': source('../public/modules/arena-rank-ui.js'),
    'arena-deco.js': source('../public/modules/arena-deco.js'),
    'arcade-games.js 입구 카드 그림 자리': fnBody(source('../public/modules/arcade-games.js'), 'arenaCard').split('ag-big-body')[0]
  };
  assert(Object.values(parts).every(t => t.length > 200), 'V13.239 검사가 화면 함수 본문을 찾는다');
  const emo = Object.entries(parts).filter(([, t]) => EMOJI.test(t)).map(([k]) => k);
  assert(emo.length === 0, `V13.239 아레나 전투 밖 화면 이모지 0개(남은 곳: ${emo.join(', ')})`);
  const icons = Object.entries(parts).filter(([, t]) => /\.icon\b/.test(t)).map(([k]) => k);
  assert(icons.length === 0, `V13.239 규칙 파일의 이모지 아이콘(.icon)을 화면에 그리지 않는다(남은 곳: ${icons.join(', ')})`);
  // 6) 입구: 큰 금 버튼 하나(대전 시작) + 같은 카드 3장(친구 대전 · 연습장 · 꾸미기) · 규칙 · 조준은 접는 칸 안.
  const lobby = fnBody(arena, 'lobby');
  assert((lobby.match(/yl-cta/g) || []).length === 1 && (lobby.match(/class="ar-extra-btn /g) || []).length === 3 && /data-ar="live"/.test(lobby) && /data-ar="pr-open"/.test(lobby) && /data-ar="dc-open"/.test(lobby)
    && /<details class="ar-card ar-help"[\s\S]*class="ar-rules"[\s\S]*class="ar-aimset"[\s\S]*<\/details>/.test(lobby) && /data-ar="start"/.test(lobby) && /treePanel\(pets\)/.test(lobby) && /data-ar="pet"/.test(lobby),
    'V13.239 입구: 큰 금 버튼 1개 · 같은 크기 카드 3장 · 방법과 조준은 접기 칸 · 팀 고르기 · 스킬트리는 그대로');
  // 7) 전투 쪽은 이 단계에서 바꾸지 않는다(버튼 그림 · HUD 함수는 그대로 있다).
  assert(['field', 'hudHtml', 'drawPad', 'drawHud', 'dmgNum', 'cutin'].every(n => fnBody(arena, n).length > 40), 'V13.239 전투 화면 함수(field · hudHtml · drawPad · drawHud · dmgNum · cutin)는 그대로');
}
