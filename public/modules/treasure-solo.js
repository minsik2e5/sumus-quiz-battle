import { api, esc, num, icon, toast, buttonBusy } from './ui.js';
import { avatar } from './character.js';
import { coin } from './emblems.js';
import { playSound, unlockSound, soundOn } from './sound.js';
import { coinShower, countUp } from './celebrate.js';
import { iconize, gi, treasureArt } from './game-icons.js';
import { playerView, tick } from './party-engine.js';
import { SOLO, soloRoom, soloStep, soloRng } from './treasure-solo-rules.js';
import { openPartySolo, partyMain } from './party.js';

// V13.150 혼자 보물 사냥(반 친구 금고): 시작 화면(내 금고 · 털린 알림 · 반 금고 순위) → 3분 판(교실 게임 화면을 폰 안의 엔진에 이어 씀)
// → 끝(서버가 기록으로 다시 돌려 확인한 금화 · 코인 · 턴 친구). 친구 금고는 줄지 않고 알림 · 되갚기만 남는다.

let S = null;
const root = () => document.getElementById('app');
const sfx = (key, opts) => { if (soundOn()) playSound(key, opts); };
const main = html => { const el = document.getElementById('ts-main'); if (el) el.innerHTML = iconize(html); };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// opts: { codes: 범위 번호, label }
export async function openTreasureSolo(A, exit, opts = {}) {
  S = { A, exit, codes: opts.codes || [], label: opts.label || '' };
  A.screen = 'treasure-solo';
  root().innerHTML = iconize(`<div class="session-app pt-app treasure solo-intro${treasureArt('bg-phone') ? ' art-bg' : ''}"><header class="pt-top"><button type="button" class="yb-back" data-ts="exit" aria-label="나가기">${icon('back')}</button><strong>혼자 보물 사냥</strong><span class="pt-clock ts-label">${esc(S.label)}</span></header><main id="ts-main" class="pt-main"><div class="yb-loading">금고를 불러오는 중…</div></main></div>`);
  root().onclick = onClick;
  window.scrollTo(0, 0);
  let r;
  try { r = await api('/games/treasure/board'); } catch (err) { toast(err.message); r = { rows: [], view: A.data.rewards?.treasure || {} }; }
  if (S?.A !== A) return;
  S.board = r;
  intro();
}
async function leave() { const exit = S?.exit; root().onclick = null; S = null; await exit?.(); }
function onClick(event) {
  const b = event.target.closest('[data-ts]');
  if (!b || b.disabled || !S) return;
  unlockSound();
  const act = b.dataset.ts;
  if (act === 'exit') return leave();
  if (act === 'start') return start(b);
  if (act === 'again') return openTreasureSolo(S.A, S.exit, { codes: S.codes, label: S.label });
}
const when = at => { const m = Math.max(0, Math.round((Date.now() - at) / 60000)); return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 1440)}일 전`; };
// 털린 알림: 털어 간 친구는 한 줄씩(되갚기 대상), 방패로 막은 건 한 줄로 묶는다.
function robbedHtml(robbed) {
  const took = robbed.filter(x => x.kind !== 'block'), blocked = robbed.filter(x => x.kind === 'block');
  const names = [...new Set(blocked.map(x => x.name))];
  return `<div class="ts-robbed"><h3>🚨 내 금고를 노린 친구 ${took.length ? '<small>다음 판에 되갚기!</small>' : ''}</h3><ul>
    ${took.slice(0, 5).map(x => `<li class="${x.kind}"><b>${esc(x.name)}</b><span>${x.kind === 'swap' ? '금고 바꿔치기' : `${num(x.pct)}% 털어 감`}</span>${x.kind === 'swap' ? '' : `<em>${coin()}${num(x.amount)}</em>`}<small>${when(x.at)}</small></li>`).join('')}
    ${blocked.length ? `<li class="block">🛡️ <span>방패가 <b>${num(blocked.length)}번</b> 막았어요</span><small>${names.slice(0, 3).map(esc).join(' · ')}${names.length > 3 ? ` 외 ${names.length - 3}명` : ''}</small></li>` : ''}
  </ul><p class="ts-note">친구가 털어도 내 금고 · 순위는 줄지 않아요.</p></div>`;
}
function intro() {
  const v = S.board.view || {}, rows = S.board.rows || [];
  const robbed = [...(v.robbed || [])].reverse();
  main(`<section class="ts-intro">
    <div class="ts-vault">${gi('vault', 'ts-vault-ico')}<div><small>이번 주 내 금고</small><b>${coin()}${num(v.best || 0)}</b><span>${v.best ? `방패 ${num(v.shield || 0)}개로 지키는 중` : '아직 비었어요. 한 판 해서 채워요!'}</span></div></div>
    ${robbed.length ? robbedHtml(robbed) : ''}
    <ul class="pt-rules ts-rules">
      <li>혼자 <b>3분</b>! 맞히면 상자를 열어 금화를 모아요.</li>
      <li><b>훔치기</b> 상자가 나오면 <b>반 친구 금고</b>를 골라 <b>금고 털이(연속 3문제)</b>! 친구 금고에 방패가 있으면 막혀요.</li>
      <li>친구는 <b>알림</b>을 받고 다음 판에 <b>되갚기</b>할 수 있어요. 친구 금고는 줄지 않아요.</li>
      <li>이번 주 가장 많이 모은 판이 <b>내 금고</b>가 돼요. 상자 엿보기 · 아이템 · 황금 시간도 그대로!</li>
    </ul>
    <div class="ts-left">오늘 코인 판 <b>${num(v.left ?? 3)}</b> / ${num(v.daily || 3)} <small>교실 게임과 함께 세요</small></div>
    <button type="button" class="yl-cta ts-go" data-ts="start">보물 사냥 시작! (3분)</button>
    <div class="ts-board"><h3>🏆 이번 주 우리 반 금고</h3>${rows.length ? `<ol>${rows.map(x => `<li class="${x.me ? 'me' : ''}${x.rank <= 3 ? ` top${x.rank}` : ''}"><i>${x.rank <= 3 ? ['🥇', '🥈', '🥉'][x.rank - 1] : num(x.rank)}</i>${avatar(x.pet, { size: 'mini', form: 1 })}<b>${esc(x.name)}</b><em>${coin()}${num(x.gold)}</em></li>`).join('')}</ol>` : '<p class="ts-note">아직 이번 주 금고가 없어요. 첫 금고의 주인공이 되어 봐요!</p>'}</div>
  </section>`);
}
async function start(button) {
  buttonBusy(button);
  let r;
  try { r = await api('/games/treasure/start', { range_codes: S.codes }); }
  catch (err) { buttonBusy(button, false); return toast(err.message); }
  if (!S) return;
  const { A, exit, codes, label } = S, back = () => openTreasureSolo(A, exit, { codes, label });
  openPartySolo(A, back, soloLink(r.start, { A, codes, label, exit }));
}
// 폰 안의 엔진: 교실 게임 방(cloudflare/party-room.mjs)이 하던 일을 그대로 하고, 행동을 기록한다.
function soloLink(start, ctx) {
  const t0p = performance.now(), t0 = 1e12, rng = soloRng(start.seed), room = soloRoom(start, t0), me = start.me.id, log = [];
  const now = () => t0 + Math.round(performance.now() - t0p);
  let hook = null, timer = null, done = false, lastA = -Infinity;
  // 화면의 시계는 Date.now()로 돈다: 엔진 시간과 맞춘다.
  const push = (events, res) => {
    if (!hook) return;
    const at = Date.now(), shift = at - now();
    const mine = events.filter(e => e.pid === me || e.vid === me || ['event', 'start', 'end'].includes(e.kind));
    const out = res?.me && res.me.pid === me ? [...mine, res.me] : mine;
    if (out.length) hook({ type: 'events', events: out });
    hook({ type: 'view', view: shiftView(playerView(room, me, now()), shift), now: at });
  };
  return {
    attach(h) {
      hook = h; push([], null);
      timer = setInterval(() => { const t = tick(room, now()); push(t.events, null); if (room.phase === 'ended') clearInterval(timer); }, 500);
    },
    send(msg) {
      if (room.phase !== 'play' || done) return;
      const map = { answer: ['a', msg.choice], pick: ['p', msg.i], target: ['g', msg.pid], peek: ['k', 0], item: ['i', msg.item] }, m = map[msg.type];
      if (!m || log.length >= SOLO.LOG_MAX - 5) return push([], null);
      const t = Math.round(performance.now() - t0p);
      if (m[0] === 'a' && t - lastA < SOLO.MIN_GAP_MS + 30) return push([], null); // 너무 빠른 두 번째 답은 받지 않는다(서버 기준)
      if (m[0] === 'a') lastA = t;
      const entry = [t, m[0], m[1]];
      log.push(entry);
      const { events, res } = soloStep(room, me, entry, t0, rng);
      push(events, res);
    },
    ended(v) {
      clearInterval(timer);
      if (done) return;
      done = true;
      finish(start, log, v, ctx);
    },
    stop() { clearInterval(timer); }
  };
}
// 엔진은 1e12부터 센 시간을 쓴다: 화면이 쓰는 시각(Date.now)으로 옮긴다.
function shiftView(v, shift) {
  if (!v) return v;
  const keys = ['end_at', 'start_at', 'now'];
  for (const k of keys) if (typeof v[k] === 'number') v[k] += shift;
  if (v.q?.wait_until) v.q.wait_until += shift;
  if (v.pending?.until) v.pending.until += shift;
  if (v.heist?.until) v.heist.until += shift;
  if (v.alarm?.until) v.alarm.until += shift;
  if (v.event?.until) v.event.until += shift;
  if (v.frenzy_until) v.frenzy_until += shift;
  return v;
}
async function finish(start, log, v, ctx) {
  partyMain('<div class="yb-loading">금고에 넣는 중…</div>');
  let res;
  for (let k = 0; k < 3; k++) {
    try { res = await api('/games/treasure/finish', { id: start.id, log }); break; }
    catch (err) { res = { paid: false, reason: 'error', error: err.message }; if (!err.transient) break; await new Promise(r => setTimeout(r, 1200)); }
  }
  if (res?.stats) Object.assign(ctx.A.data.stats, res.stats);
  if (typeof res?.points_balance === 'number') ctx.A.data.stats.points_balance = res.points_balance;
  if (res?.best !== undefined) { ctx.A.data.rewards ||= {}; ctx.A.data.rewards.treasure = { ...(ctx.A.data.rewards.treasure || {}), best: res.best, left: res.left ?? ctx.A.data.rewards.treasure?.left, robbed: res.robbed ?? ctx.A.data.rewards.treasure?.robbed }; }
  const ok = !!res && res.reason !== 'bad' && res.reason !== 'short' && res.reason !== 'error';
  const hits = (res?.hits || []).filter(h => h.kind !== 'block'), blocks = (res?.hits || []).filter(h => h.kind === 'block');
  const why = !ok ? (res?.reason === 'error' ? esc(res.error || '저장하지 못했어요.') : '이번 판은 기록하지 못했어요.') : res.reason === 'daily' ? '오늘 코인 판(3판)을 다 썼어요. 금고 기록은 남아요!' : res.reason === 'few' ? '5문제 이상 맞히면 코인을 받아요.' : '';
  partyMain(iconize(`<section class="pt-end ts-end">
    <div class="ts-end-head">${gi('chestOpen', 'ts-end-ico')}<div><small>이번 판 금화</small><b id="ts-gold">0</b></div></div>
    ${ok ? `<div class="ts-vault${res.record ? ' record' : ''}">${gi('vault', 'ts-vault-ico')}<div><small>이번 주 내 금고</small><b>${coin()}${num(res.best || 0)}</b><span>${res.record ? '신기록! 이번 판이 내 금고가 됐어요' : '이번 주 최고 판이 금고로 남아요'}</span></div>${res.record ? '<span class="mt-stamp in ts-stamp">신기록</span>' : ''}</div>` : ''}
    <div class="mg-result-facts"><span>맞힌 문제 <b>${num(res?.right ?? v?.me?.right ?? 0)}</b></span><span>틀림 <b>${num(res?.wrong ?? v?.me?.wrong ?? 0)}</b></span></div>
    ${res?.coins ? `<div class="mg-result-coins">${coin()}<b>+${num(res.coins)}</b><small>경험치 +${num(res.xp || 0)}${res.record ? ' · 금고 기록 +3 포함' : ''}</small></div>` : why ? `<p class="mg-result-why">${why}</p>` : ''}
    ${hits.length || blocks.length ? `<div class="ts-hits"><h3>🦹 이번 판에 턴 금고</h3><ul>${hits.map(h => `<li><b>${esc(h.name)}</b>${h.kind === 'swap' ? ' 금고와 바꿨어요' : ` ${num(h.pct)}% <em>${coin()}+${num(h.amount)}</em>${h.bounty ? ` · 📜 현상금 +${num(h.bounty)}` : ''}`}${h.bot ? '' : '<small>알림이 가요</small>'}</li>`).join('')}${blocks.map(h => `<li class="block"><b>${esc(h.name)}</b> 🛡️ 방패에 막혔어요</li>`).join('')}</ul></div>` : ''}
    <div class="ts-actions"><button type="button" class="yl-cta" data-pt="exit">다시 하기 · 금고 보기</button></div>
  </section>`));
  const g = document.getElementById('ts-gold'), gold = ok ? res.gold : (v?.me?.gold || 0);
  if (g) { if (reduced()) g.textContent = num(gold); else countUp(g, gold, 900); }
  if (res?.record) { sfx('fanfare-epic', { at: .3 }); coinShower(document.querySelector('.ts-end'), 20); } else if (res?.coins) sfx('coins', { at: .3 }); else sfx('clear');
}
