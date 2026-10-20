// 메모장 위젯의 글 서식: 체크박스 줄과 글씨색.
// 저장은 두 가지로 한다 — note.html(화면용, 아래 규칙대로만 만든 것)과 note.text(예전과 같은 글자만, 체크박스 줄은 ☐ / ☑ 로 시작).
// 화면에는 note.html 이 규칙에 맞을 때만 쓰고, 아니면 note.text 로 다시 만든다 (다른 기기에서 온 글도 같은 규칙으로 걸러짐).

export const NOTE_BASE = '#333d4b';
export const NOTE_COLORS = [['기본', NOTE_BASE], ['빨강', '#e5484d'], ['주황', '#f08c00'], ['초록', '#0ca678'], ['파랑', '#3182f6'], ['보라', '#7048e8'], ['회색', '#8b95a1']];
const COLOR_SET = new Set(NOTE_COLORS.map(c => c[1]));

export const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 줄 하나: { ck: 체크박스 줄인지, on: 체크됐는지, runs: [{ t: 글자, c: 색(''=기본) }] }
const runsText = runs => runs.map(r => r.t).join('');
export function linesToText(lines) {
  return lines.map(l => (l.ck ? (l.on ? '☑ ' : '☐ ') : '') + runsText(l.runs)).join('\n').replace(/\s+$/, '');
}
export function textToLines(text) {
  return String(text ?? '').split('\n').map(raw => {
    const m = /^([☐☑])\s?/.exec(raw);
    return { ck: !!m, on: m?.[1] === '☑', runs: [{ t: m ? raw.slice(m[0].length) : raw, c: '' }].filter(r => r.t) };
  });
}
export function linesToHtml(lines) {
  const list = lines.length ? lines : [{ ck: false, on: false, runs: [] }];
  return list.map(l => {
    const body = l.runs.filter(r => r.t).map(r => r.c ? `<span style="color:${r.c}">${escHtml(r.t)}</span>` : escHtml(r.t)).join('');
    return `<div${l.ck ? ` class="ck${l.on ? ' on' : ''}"` : ''}>${body || '<br>'}</div>`;
  }).join('');
}
// 저장해 둔 html 이 우리가 만든 모양 그대로인지 (그 밖의 태그·속성·색은 모두 거부)
const HTML_OK = /^(<div( class="ck( on)?")?>(<br>|(<span style="color:#[0-9a-f]{6}">(?:[^<>"&]|&(?:amp|lt|gt|quot);)+<\/span>|[^<>"&]|&(?:amp|lt|gt|quot);)+)<\/div>)+$/;
export function noteHtml(n) {
  const html = typeof n?.html === 'string' ? n.html : '';
  if (html && HTML_OK.test(html) && [...html.matchAll(/color:(#[0-9a-f]{6})/g)].every(m => COLOR_SET.has(m[1]))) return html;
  return linesToHtml(textToLines(n?.text));
}

// 편집 중인 화면(contenteditable)에서 줄을 읽어 온다. DOM 노드만 쓰므로 어느 DOM 에서든 동작.
function normColor(v) {
  v = String(v || '').trim().toLowerCase();
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v);
  if (m) v = '#' + [m[1], m[2], m[3]].map(x => Math.min(255, +x).toString(16).padStart(2, '0')).join('');
  else if (/^#[0-9a-f]{3}$/.test(v)) v = '#' + [...v.slice(1)].map(x => x + x).join('');
  return v === NOTE_BASE || !COLOR_SET.has(v) ? '' : v;
}
function colorOf(node) {
  if (node.tagName === 'FONT' && node.getAttribute('color')) return normColor(node.getAttribute('color'));
  const c = node.style?.color;
  return c ? normColor(c) : undefined;
}
const isBlock = node => node.nodeType === 1 && (node.tagName === 'DIV' || node.tagName === 'P');
const hasBlock = node => [...node.childNodes].some(isBlock);
function pushRuns(node, color, out) {
  if (node.nodeType === 3) { const t = node.nodeValue.replace(/[​\r\n]/g, ''); if (t) out.push({ t, c: color }); return; }
  if (node.nodeType !== 1 || node.tagName === 'BR') return;
  const c = colorOf(node);
  for (const k of node.childNodes) pushRuns(k, c === undefined ? color : c, out);
}
const mergeRuns = runs => runs.reduce((a, r) => { const p = a[a.length - 1]; if (p && p.c === r.c) p.t += r.t; else a.push({ ...r }); return a; }, []);
export function readLines(root) {
  const lines = []; let loose = null;
  const flush = () => { if (loose) { lines.push({ ck: false, on: false, runs: mergeRuns(loose) }); loose = null; } };
  const block = node => {
    if (hasBlock(node)) {
      flush();
      for (const k of node.childNodes) { if (isBlock(k)) block(k); else { loose ||= []; pushRuns(k, '', loose); } }
      flush(); return;
    }
    flush();
    const runs = []; pushRuns(node, '', runs);
    lines.push({ ck: node.classList?.contains('ck') || false, on: node.classList?.contains('on') || false, runs: mergeRuns(runs) });
  };
  for (const node of root.childNodes) {
    if (isBlock(node)) block(node);
    else if (node.nodeType === 1 && node.tagName === 'BR') { if (loose) flush(); else lines.push({ ck: false, on: false, runs: [] }); }
    else { loose ||= []; pushRuns(node, '', loose); }
  }
  flush();
  while (lines.length > 1 && !lines[lines.length - 1].ck && !lines[lines.length - 1].runs.length) lines.pop();
  return lines.length ? lines : [{ ck: false, on: false, runs: [] }];
}
