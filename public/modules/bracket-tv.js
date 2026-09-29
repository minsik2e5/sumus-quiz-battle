import { api, esc, num } from './ui.js';
import { avatar } from './character.js';
import { trophy, coin } from './emblems.js';

// V13.69 교실 TV 대진표: a teacher shows an academy tournament on the classroom screen. The
// bracket opens from both sides toward the final in the middle, pets and names in every match,
// gold lines along each winner's way. It reloads every few seconds: a match just decided lights
// up with a banner, and the champion gets the trophy and confetti.

const POLL_MS = 5000;
let TV = null;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function openBracketTv(A, id, exit) {
  closeTv();
  const root = document.getElementById('app');
  TV = { A, id, exit, t: null, seen: null, timer: null, scale: 1, toastTimer: null };
  root.innerHTML = `<div class="btv" id="btv">
    <header class="btv-top">
      <div class="btv-title"><small>SUMUS 학원 야차 대회</small><h1 id="btv-name">대진표를 불러오고 있어요…</h1><p id="btv-meta"></p></div>
      <div class="btv-tools"><span class="btv-live"><i></i>실시간</span><button type="button" data-btv="full">전체 화면</button><button type="button" data-btv="exit">나가기</button></div>
    </header>
    <main class="btv-stage" id="btv-stage"><div class="btv-board" id="btv-board"></div></main>
    <div class="btv-toast" id="btv-toast" role="status" aria-live="polite" hidden></div>
  </div>`;
  root.onclick = event => {
    const b = event.target.closest('[data-btv]');
    if (!b) return;
    if (b.dataset.btv === 'exit') return leave();
    if (b.dataset.btv === 'full') toggleFull();
  };
  TV.onKey = event => { if (event.key === 'f' || event.key === 'F') toggleFull(); };
  TV.onResize = () => fit();
  window.addEventListener('keydown', TV.onKey);
  window.addEventListener('resize', TV.onResize);
  document.addEventListener('fullscreenchange', TV.onResize);
  load();
  TV.timer = setInterval(load, POLL_MS);
}
function closeTv() {
  if (!TV) return;
  clearInterval(TV.timer); clearTimeout(TV.toastTimer);
  window.removeEventListener('keydown', TV.onKey);
  window.removeEventListener('resize', TV.onResize);
  document.removeEventListener('fullscreenchange', TV.onResize);
  TV = null;
}
function leave() {
  const exit = TV?.exit;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  document.getElementById('app').onclick = null;
  closeTv();
  exit?.();
}
function toggleFull() {
  const el = document.getElementById('btv');
  if (!el) return;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  else el.requestFullscreen?.().catch(() => {});
}

async function load() {
  const cur = TV;
  if (!cur || document.visibilityState === 'hidden' && cur.t) return;
  try {
    const { tournament } = await api(`/teacher/tournaments/${encodeURIComponent(cur.id)}`);
    if (TV !== cur) return;
    const before = cur.seen, now = new Map();
    for (const round of tournament.rounds) for (const m of round.matches) now.set(m.id, m.winner || null);
    const fresh = before ? tournament.rounds.flatMap((round, r) => round.matches.map(m => ({ m, r, round }))).filter(x => x.m.winner && x.m.by !== 'bye' && !before.get(x.m.id)) : [];
    const crowned = before && tournament.champion && !cur.t?.champion;
    cur.t = tournament; cur.seen = now;
    draw(fresh.map(x => x.m.id));
    if (crowned) celebrate(tournament);
    else if (fresh.length) announce(fresh.at(-1), tournament);
  } catch (err) {
    const name = document.getElementById('btv-name');
    if (name && !cur.t) name.textContent = err.message || '대진표를 불러오지 못했어요.';
  }
}

/* ---------- drawing ---------- */
const pet = p => p?.pet ? avatar(p.pet.key, { size: 'mini', form: Math.max(1, p.pet.form) }) : '<span class="btv-nopet">?</span>';
function slot(p, m) {
  if (!p) return `<div class="btv-p empty"><span class="btv-pet"></span><b>${m.winner && m.by === 'bye' ? '부전승' : '?'}</b></div>`;
  const win = m.winner && m.winner === p.id, lose = m.winner && m.winner !== p.id;
  return `<div class="btv-p${win ? ' win' : ''}${lose ? ' lose' : ''}"><span class="btv-pet">${pet(p)}</span><b>${esc(p.name)}</b>${win ? '<i class="btv-win">승</i>' : ''}</div>`;
}
function box(m, side, r, i, just) {
  const state = m.winner ? 'done' : m.live === 'active' ? 'live' : m.live ? 'wait' : m.a && m.b ? 'ready' : 'empty';
  const tag = m.live === 'active' ? '<span class="btv-tag live"><i></i>경기 중</span>' : m.live ? '<span class="btv-tag wait">입장 대기</span>' : m.draws ? `<span class="btv-tag">무승부 ${m.draws}번 · 재경기</span>` : m.winner && m.by === 'teacher' ? '<span class="btv-tag">선생님 판정</span>' : '';
  return `<div class="btv-m ${state}${just.includes(m.id) ? ' just' : ''}" data-side="${side}" data-r="${r}" data-i="${i}" data-id="${esc(m.id)}">${slot(m.a, m)}${slot(m.b, m)}${tag}</div>`;
}
function draw(just = []) {
  const t = TV?.t, board = document.getElementById('btv-board');
  if (!t || !board) return;
  const players = t.players, rounds = t.rounds;
  document.getElementById('btv-name').textContent = t.name;
  document.getElementById('btv-meta').innerHTML = `${esc(t.class_name || t.grade || '')} · ${num(players)}명 · ${t.mode === 'skill' ? '실력전' : '스피드전'} · 판돈 없는 대결${t.prize ? ` · ${coin()} 우승 ${num(t.prize)} · 준우승 ${num(Math.floor(t.prize / 2))}` : ''}`;
  const R = rounds.length, final = rounds[R - 1].matches[0];
  const column = (round, r, side) => {
    const half = round.matches.length / 2;
    const list = side === 'left' ? round.matches.slice(0, half) : round.matches.slice(half);
    return `<div class="btv-col"><h3>${esc(round.label)}</h3><div class="btv-list">${list.map((m, i) => box(m, side, r, i, just)).join('')}</div></div>`;
  };
  const sides = R > 1 ? rounds.slice(0, R - 1) : [];
  const champ = t.champion;
  board.innerHTML = `<div class="btv-side btv-left">${sides.map((round, r) => column(round, r, 'left')).join('')}</div>
    <div class="btv-col final"><h3>결승</h3><div class="btv-list"><div class="btv-final-wrap">
      <div class="btv-champ${champ ? ' on' : ''}">${trophy('xl')}<small>${champ ? '우승' : '우승은 누구?'}</small>${champ ? `<b>${esc(champ.name)}</b>` : ''}${t.runner_up ? `<em>준우승 ${esc(t.runner_up.name)}</em>` : ''}</div>
      <span class="btv-final-label">결승</span>${box(final, 'center', R - 1, 0, just)}
    </div></div></div>
    <div class="btv-side btv-right">${sides.map((round, r) => column(round, r, 'right')).reverse().join('')}</div>
    <svg class="btv-lines" id="btv-lines" aria-hidden="true"></svg>`;
  requestAnimationFrame(() => { fit(); lines(); });
}
// Elbow lines from each pair of matches to the match their winners meet in; gold once decided.
function lines() {
  const board = document.getElementById('btv-board'), svg = document.getElementById('btv-lines');
  const t = TV?.t;
  if (!board || !svg || !t) return;
  const scale = TV.scale || 1, origin = board.getBoundingClientRect();
  const rect = el => { const r = el.getBoundingClientRect(); return { l: (r.left - origin.left) / scale, r: (r.right - origin.left) / scale, y: (r.top + r.height / 2 - origin.top) / scale }; };
  const find = (side, r, i) => board.querySelector(`.btv-m[data-side="${side}"][data-r="${r}"][data-i="${i}"]`);
  const R = t.rounds.length, paths = [];
  const link = (child, parent, dir, gold) => {
    if (!child || !parent) return;
    const c = rect(child), p = rect(parent);
    const x1 = dir > 0 ? c.r : c.l, x2 = dir > 0 ? p.l : p.r, mid = (x1 + x2) / 2;
    paths.push(`<path class="${gold ? 'gold' : ''}" d="M${x1} ${c.y}H${mid}V${p.y}H${x2}"/>`);
  };
  const decided = el => el?.classList.contains('done');
  for (const side of ['left', 'right']) {
    const dir = side === 'left' ? 1 : -1;
    for (let r = 1; r < R - 1; r++) {
      const count = t.rounds[r].matches.length / 2;
      for (let i = 0; i < count; i++) {
        const parent = find(side, r, i);
        for (const k of [0, 1]) { const child = find(side, r - 1, i * 2 + k); link(child, parent, dir, decided(child)); }
      }
    }
    if (R > 1) { const child = find(side, R - 2, 0); link(child, find('center', R - 1, 0), dir, decided(child)); }
  }
  svg.setAttribute('width', board.scrollWidth);
  svg.setAttribute('height', board.scrollHeight);
  svg.innerHTML = paths.join('');
}
// The whole bracket fits the screen (a TV, a projector or a laptop).
function fit() {
  const stage = document.getElementById('btv-stage'), board = document.getElementById('btv-board');
  if (!stage || !board || !TV) return;
  board.style.transform = 'none';
  const w = board.scrollWidth, h = board.scrollHeight;
  const scale = Math.max(.15, Math.min(stage.clientWidth / w, stage.clientHeight / h, 1.9));
  TV.scale = scale;
  board.style.transform = `scale(${scale})`;
  board.style.left = `${Math.max(0, (stage.clientWidth - w * scale) / 2)}px`;
  board.style.top = `${Math.max(0, (stage.clientHeight - h * scale) / 2)}px`;
}

/* ---------- moments ---------- */
function announce({ m, round }, t) {
  const toast = document.getElementById('btv-toast');
  if (!toast) return;
  const winner = [m.a, m.b].find(p => p?.id === m.winner);
  const next = t.rounds[t.rounds.indexOf(round) + 1];
  toast.innerHTML = `<span class="btv-toast-pet">${pet(winner)}</span><span><small>${esc(round.label)} 결과</small><b>${esc(winner?.name || '')} 승리!</b><em>${next ? `${esc(next.label)} 진출` : '결승 승리'}</em></span>`;
  toast.hidden = false;
  toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
  clearTimeout(TV.toastTimer);
  TV.toastTimer = setTimeout(() => { toast.hidden = true; }, 6000);
}
function celebrate(t) {
  const stage = document.getElementById('btv');
  if (!stage || !t.champion) return;
  const toast = document.getElementById('btv-toast');
  if (toast) toast.hidden = true;
  const colors = ['#ffd35a', '#ff6b8a', '#5ac8fa', '#6ee7a8', '#a78bfa', '#ff9f43'];
  const confetti = reduced() ? '' : Array.from({ length: 90 }, (_, i) => `<i style="left:${(i * 37) % 100}%;--c:${colors[i % colors.length]};--d:${(2.4 + (i % 7) * .3).toFixed(2)}s;--delay:${((i % 11) * .12).toFixed(2)}s;--r:${(i * 53) % 360}deg"></i>`).join('');
  const box = document.createElement('div');
  box.className = 'btv-crown';
  box.innerHTML = `<div class="btv-confetti" aria-hidden="true">${confetti}</div>
    <div class="btv-crown-card">${trophy('xl')}<small>${esc(t.name)}</small><h2>우승 ${esc(t.champion.name)}!</h2>${t.champion.pet ? `<span class="btv-crown-pet">${avatar(t.champion.pet.key, { form: Math.max(1, t.champion.pet.form) })}</span>` : ''}<p>SUMUS 챔피언 칭호${t.prize ? ` · ${coin()} ${num(t.prize)}코인` : ''}${t.runner_up ? ` · 준우승 ${esc(t.runner_up.name)}` : ''}</p><button type="button" class="btv-crown-close">대진표 보기</button></div>`;
  box.onclick = event => { if (event.target.closest('.btv-crown-close')) box.remove(); };
  stage.appendChild(box);
}
