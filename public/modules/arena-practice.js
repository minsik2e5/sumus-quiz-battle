// V13.235 펫 아레나 연습장(구성안 docs/pet-arena-v2-plan.md 6장 8번): 내 펫 하나 + 허수아비로 스킬을 마음대로 시험한다.
//   허수아비 3가지: 가만히(움직이지 않음) · 움직임(빙글빙글 걷기) · 반격(쉬운 컴퓨터처럼 맞받아침, 필살기는 쓰지 않음).
//   스킬 ②(기본 고르기) · 스킬트리 3층(①강화/덤 · ②바꾸기/강화 · 필살기/두 번째 필살기 · 역할 강화)을 바꿔 보며 시험.
//   잠긴 층(레벨이 모자람)도 '미리보기'로 시험할 수 있다. 저장은 대기실과 같은 규칙(열린 층만, 이 폰에 기억 → 다음 판 시작 때 서버가 기억).
//   데미지 숫자(판과 같은 칸) · DPS(최근 5초 · 전체) · 가장 센 한 방 · 최고 콤보 · 기술별 피해, 쿨타임 바로 돌리기 · 필살기 채우기 버튼.
// 보상 · 기록 없음, 서버 요청 없음: 전투는 규칙 파일(arena-rules.js createArena)을 그대로 화면에서 돌린다. 다시 보기에도 남기지 않는다.
// 렉: 일반 판과 같은 화면 · 같은 예산(효과 조각 40개 · 저사양 20개, 저사양 단계 그대로). 숫자판은 0.25초마다 바뀐 칸만 쓴다.
import { esc, num, toast } from './ui.js';
import { CHARACTERS } from './core.js';
import { ELEMENTS } from './battle-fx.js';
import { ARENA, ROLE, TREE, petTree, cleanTree, skill2Picks } from './arena-rules.js';
import { DUMMIES, PRACTICE, KIND_KO, practiceFighter, createPractice, newStats, statsView } from './arena-practice-rules.js';
import { ARENA_ART } from './arena-art.js';
import { arenaMatch, arenaUi } from './arena.js';

const $ = id => document.getElementById(id);
const petName = key => CHARACTERS[key]?.ko || key;
const ready = A => (A.data.stats?.pets || []).filter(x => Number(x.form) >= 1).sort((a, b) => b.level - a.level || (b.active ? 1 : 0) - (a.active ? 1 : 0));
let P = null; // 연습장 상태 { key, dummy, s2, tr, run }

/* ---------- 고르기 화면 ---------- */
export function openPractice() {
  const R = arenaUi.R(); if (!R) return;
  arenaUi.stop(); arenaUi.bg('plaza');
  const pets = ready(R.A);
  const key = P?.key && pets.some(x => x.key === P.key) ? P.key : R.focus && pets.some(x => x.key === R.focus) ? R.focus : pets[0]?.key;
  P = { key, dummy: P?.dummy || 'still', s2: {}, tr: {}, ...(P?.key === key ? { s2: P.s2, tr: P.tr } : {}) };
  draw();
}
export const closePractice = () => { if (P) P.run = null; };
const s2Of = k => P.s2[k] ?? arenaUi.R()?.picks?.[k] ?? null;
const trOf = k => cleanTree(P.tr[k] ?? arenaUi.R()?.trees?.[k]);
function draw() {
  const R = arenaUi.R(), pets = ready(R.A), p = pets.find(x => x.key === P.key);
  if (!p) return arenaUi.main(`<section class="ar-lobby"><div class="ar-card"><p class="ar-why">알에서 깬 펫이 있어야 연습할 수 있어요.</p><button type="button" class="btn full" data-ar="pr-back">대기실로</button></div></section>`);
  const lv = Number(p.level), tr = trOf(p.key), s2 = s2Of(p.key), f = practiceFighter({ key: p.key, form: p.form, level: lv, s2, tr });
  const t = petTree(p.key, TREE.LEVELS[2], tr, s2), P2 = ELEMENTS[f.el] || ELEMENTS.star, picks = skill2Picks(p.key);
  const branch = (x, i, n) => { const k = n ? x.b : x.a, lock = lv < x.lv; return `<button type="button" class="ar-branch b${n}${Number(tr[i]) === n ? ' on' : ''}${lock ? ' pv' : ''}" data-ar="pr-tree" data-l="${i}" data-b="${n}" aria-pressed="${Number(tr[i]) === n}"><i>${esc(k.icon)}</i><span><b><u>${n ? 'B' : 'A'}</u>${esc(k.name)}</b><small>${esc(k.desc)}</small></span></button>`; };
  const saved = cleanTree(R.trees?.[p.key]), savedS2 = R.picks?.[p.key] ?? null;
  const dirty = TREE.LEVELS.some((L, i) => lv >= L && tr[i] !== saved[i]) || (P.s2[p.key] != null && P.s2[p.key] !== savedS2);
  arenaUi.main(`<section class="ar-lobby ar-prac">
    <div class="ar-title"><small>보상 · 기록 없음 · 마음껏 시험</small><h1>연습장</h1></div>
    <div class="ar-card">
      <h3 class="ar-sub">내 펫 <small>한 마리로 연습해요</small></h3>
      <div class="ar-pets">${pets.map(x => `<button type="button" class="ar-pet-pick${x.key === p.key ? ' on' : ''}" data-ar="pr-pet" data-key="${esc(x.key)}" aria-pressed="${x.key === p.key}">${arenaUi.petImg(x.key, x.form)}<small>Lv.${x.level}</small></button>`).join('')}</div>
      <h3 class="ar-sub">허수아비 <small>3가지 중에서 골라요</small></h3>
      <div class="pr-dummies" role="group" aria-label="허수아비">${DUMMIES.map(d => `<button type="button" class="pr-dummy${P.dummy === d.k ? ' on' : ''}" data-ar="pr-dummy" data-k="${d.k}" aria-pressed="${P.dummy === d.k}"><span class="pr-dummy-ico d-${d.k}">${dummyArt('pr-dummy-img')}<em>${d.icon}</em></span><b>${esc(d.n)}</b><small>${esc(d.d)}</small></button>`).join('')}</div>
      <h3 class="ar-sub">기본 스킬 ② <small>${esc(ELEMENTS[f.el]?.name || '')} 속성 스킬 2개 중 하나</small></h3>
      <div class="pr-s2" role="group" aria-label="기본 스킬 ②">${picks.map((k, i) => `<button type="button" class="ar-branch b${i}${(s2 ?? f.s2) === i ? ' on' : ''}" data-ar="pr-s2" data-i="${i}" aria-pressed="${(s2 ?? f.s2) === i}"><i>${esc(k.icon)}</i><span><b>${esc(k.name)}</b><small>${esc(k.desc)}</small></span></button>`).join('')}</div>
      <div class="ar-tree pr-tree" style="--c1:${P2.c1};--c2:${P2.c2};--c3:${P2.c3}">
        <div class="ar-tree-h">${arenaUi.petImg(p.key, p.form, 'ar-tree-pet')}<div><small>스킬트리 · ${esc(ROLE[f.role].name)}</small><b>${esc(p.name || petName(p.key))} <em>Lv.${lv}</em></b></div></div>
        <ol class="ar-floors">${[2, 1, 0].map(i => { const x = t[i], lock = lv < x.lv; return `<li class="ar-floor${lock ? ' pvw' : ''}" style="--i:${i}"><div class="ar-floor-h"><b>${['1층', '2층', '3층'][i]}</b><small>Lv.${x.lv} · ${['스킬 ①', '스킬 ②', '필살기 · 역할'][i]}</small>${lock ? `<em>👀 미리보기 · Lv.${x.lv}에 열려요</em>` : '<em class="open">열림</em>'}</div><div class="ar-branches">${branch(x, i, 0)}<span class="ar-fork" aria-hidden="true"></span>${branch(x, i, 1)}</div></li>`; }).join('')}</ol>
        <div class="ar-preview"><b>지금 설정</b><span><small>① ${esc(f.skill.name)}</small>${(f.skillCd * ARENA.TICK_MS / 1000).toFixed(1)}초</span><span><small>② ${esc(f.skill2.icon)} ${esc(f.skill2.name)}</small>${(f.skill2Cd * ARENA.TICK_MS / 1000).toFixed(1)}초</span><span class="ult"><small>필살기</small>${esc(f.ult)}${f.ult2 ? `<i class="up">${f.ult2 === 'ring' ? '둘레 큰 원' : '긴 일직선'}</i>` : ''}</span></div>
      </div>
      ${f.preview && TREE.LEVELS.some((L, i) => lv < L) ? '<p class="ar-words">👀 잠긴 층은 연습장에서만 미리 써 볼 수 있어요. 저장은 열린 층만 돼요.</p>' : ''}
      <button type="button" class="btn full pr-save" data-ar="pr-save" ${dirty ? '' : 'disabled'}>💾 ${dirty ? '이 설정을 대기실에 저장(열린 층만)' : '대기실 설정과 같아요'}</button>
      <button type="button" class="yl-cta ar-go" data-ar="pr-go">연습 시작!</button>
      <button type="button" class="btn full" data-ar="pr-back">대기실로</button>
    </div>
  </section>`);
}
const dummyArt = cls => ARENA_ART.has('dummy') ? `<i class="${cls} art" style="--art:url(/assets/arena/dummy.webp)"></i>` : `<i class="${cls}"><b></b><b></b><b></b></i>`;

/* ---------- 판 ---------- */
function start() {
  const R = arenaUi.R(), p = ready(R.A).find(x => x.key === P.key); if (!p) return;
  const me = practiceFighter({ key: p.key, form: p.form, level: p.level, s2: s2Of(p.key), tr: trOf(p.key) });
  const run = P.run = createPractice({ me, dummy: P.dummy, seed: 1 + Math.floor(Math.random() * 2147483646), onPop: (text, s) => requestAnimationFrame(() => arenaUi.pop(text, s.x, s.y - 26, 'enter')) });
  const sim = run.sim, foe = run.foe;
  Object.assign(run, { t0: 0, drawAt: 0 });
  const r = { id: 'practice', seed: 1, practice: true, me: [{ key: me.key, form: me.form, level: me.level, s2: me.s2, tr: me.tr }], foe: { name: `허수아비 · ${DUMMIES.find(d => d.k === P.dummy)?.n || ''}`, bot: true, team: [{ key: foe.key, form: foe.form, level: foe.level }] }, foe_level: 0, deco: null };
  arenaMatch(r, {
    sim, practice: true, late: true,
    want: now => run.t0 ? (now - run.t0 - (arenaUi.R()?.pausedMs || 0)) / ARENA.TICK_MS : 0,
    mounted: () => mounted(run, me, foe),
    finish: async () => ({ paid: false, reason: 'practice', winner: sim.S.winner || 'draw', ko: 0, dealt: run.stats.total, ults: sim.S.ults.me }),
    why: () => '연습장은 보상 · 기록이 없어요. 마음껏 시험해 보세요!',
    buttons: () => '<button type="button" class="yl-cta" data-ar="pr-open">연습장으로</button><button type="button" class="btn full" data-ar="again">대기실로</button>',
    done: () => done(run, me),
    quitText: '연습장을 나갈까요?',
    quit: () => { if (P) P.run = null; }
  });
}

function mounted(run, me, foe) {
  const R = arenaUi.R(); if (!R) return;
  // 화면 칸도 연습용 능력치로(쿨타임 막대 · 스킬 이름).
  R.teams = { me: [me], foe: [foe] };
  arenaUi.redrawMe?.();
  const play = $('ar-play'), mon = $('ar-foe'), body = $('ar-foe-body');
  play?.classList.add('practice');
  if (mon) mon.classList.add('ar-dummy', `d-${P.dummy}`);
  if (body) body.innerHTML = `<span class="pr-scare">${dummyArt('pr-dummy-img')}</span>`;
  const dot = $('ar-dot-foe-0'); if (dot) dot.innerHTML = '<b class="pr-dot">🎯</b>';
  play?.insertAdjacentHTML('beforeend', `<div class="pr-panel" id="pr-panel" aria-live="off">
      <div class="pr-big"><span><small>DPS</small><b id="pr-dps">0</b><em id="pr-dps-all">평균 0</em></span><span><small>준 피해</small><b id="pr-total">0</b><em id="pr-hits">0번 맞힘</em></span><span><small>가장 센 한 방</small><b id="pr-best">0</b><em id="pr-combo">최고 콤보 0</em></span></div>
      <div class="pr-by" id="pr-by"></div>
    </div>
    <div class="pr-tools"><button type="button" class="pr-tool" data-ar="pr-cd">⏱️<small>쿨타임 바로</small></button><button type="button" class="pr-tool" data-ar="pr-ult">🔥<small>필살기 채우기</small></button><button type="button" class="pr-tool" data-ar="pr-reset">🔄<small>숫자 지우기</small></button><button type="button" class="pr-tool" data-ar="pr-setup">⚙️<small>스킬 바꾸기</small></button></div>`);
  run.t0 = performance.now();
  R.pausedMs = 0;
  panelLoop(run);
}
function panelLoop(run) {
  if (!P || P.run !== run) return;
  const R = arenaUi.R(); if (!R?.playing) return;
  const now = performance.now();
  if (now - run.drawAt >= PRACTICE.PANEL_MS) { run.drawAt = now; panel(run); }
  requestAnimationFrame(() => panelLoop(run));
}
const put = (id, v) => { const el = $(id); if (el && el._v !== v) { el._v = v; el.textContent = v; } };
function panel(run) {
  const st = run.stats, v = statsView(st, run.sim.S.t, ARENA.TICK_MS);
  put('pr-dps', num(v.dps)); put('pr-dps-all', `평균 ${num(v.avg)}`);
  put('pr-total', num(v.total)); put('pr-hits', `${num(v.n)}번 맞힘`);
  put('pr-best', num(v.best)); put('pr-combo', `최고 콤보 ${num(v.combo)}`);
  const by = Object.entries(st.by).sort((a, b) => b[1] - a[1]), key = by.map(([k, n]) => `${k}${n}`).join();
  const el = $('pr-by');
  if (el && el._k !== key) { el._k = key; el.innerHTML = by.map(([k, n]) => `<span class="k-${k}"><small>${KIND_KO[k]}</small><i style="--w:${Math.round(n / Math.max(1, st.total) * 100)}%"></i><b>${num(n)}</b></span>`).join(''); }
}

// 2분이 다 되면(1:1 판 길이 그대로): 승패 없이 연습 결과만. 서버 요청 · 다시 보기 없음.
function done(run, me) {
  if (P?.run !== run) return;
  const st = run.stats, v = statsView(st, run.sim.S.t, ARENA.TICK_MS), by = Object.entries(st.by).sort((a, b) => b[1] - a[1]);
  arenaUi.sfx('fanfare-epic', { volume: .5 });
  arenaUi.main(`<section class="ar-result win pr-done"><div class="ar-res-card">
    <div class="ar-res-head"><h2>연습 끝!</h2><p>${esc(petName(me.key))} · 허수아비 ${esc(DUMMIES.find(d => d.k === P.dummy)?.n || '')} · 2분</p></div>
    <div class="ar-res-rows"><span><small>평균 DPS</small><b>${num(v.avg)}</b></span><span><small>준 피해</small><b>${num(v.total)}</b></span><span><small>가장 센 한 방</small><b>${num(v.best)}</b></span><span><small>최고 콤보</small><b>${num(v.combo)}</b></span></div>
    <div class="pr-by big">${by.map(([k, n]) => `<span class="k-${k}"><small>${KIND_KO[k]}</small><i style="--w:${Math.round(n / Math.max(1, st.total) * 100)}%"></i><b>${num(n)}</b></span>`).join('') || '<small>맞힌 공격이 없어요</small>'}</div>
    <p class="ar-why">연습장은 보상 · 기록이 없어요. 가지를 바꿔 숫자를 비교해 보세요!</p>
    <div class="ar-res-btns"><button type="button" class="yl-cta" data-ar="pr-go">한 번 더(같은 설정)</button><button type="button" class="btn full" data-ar="pr-setup">⚙️ 스킬 바꾸기</button><button type="button" class="btn full" data-ar="pr-back">대기실로</button></div>
  </div></section>`);
}

/* ---------- 버튼 ---------- */
export function practiceClick(act, b) {
  const R = arenaUi.R(); if (!R) return;
  if (act === 'pr-open') { arenaUi.sfx('tap'); P = P || null; return openPractice(); }
  if (!P) return;
  const S = P.run?.sim?.S;
  if (act === 'pr-cd') { if (!S) return; P.run.resetCd(); arenaUi.sfx('skill', { rate: 1.5, volume: .6 }); return void arenaUi.pop('쿨타임 끝!', S.me.x, S.me.y - 26, 'skill me'); }
  if (act === 'pr-ult') { if (!S) return; P.run.fillUlt(); arenaUi.sfx('ult-riser', { rate: 1.5, volume: .5 }); return void arenaUi.pop('필살기 준비!', S.me.x, S.me.y - 26, 'skill me'); }
  if (act === 'pr-reset') { if (!S) return; P.run.stats = newStats(S.t); arenaUi.sfx('tap'); return panel(P.run); }
  if (act === 'pr-setup') { P.run = null; arenaUi.stop(); arenaUi.sfx('tap'); return draw(); }
  if (act === 'pr-back') { P.run = null; arenaUi.sfx('tap'); return arenaUi.lobby(); }
  if (act === 'pr-go') { arenaUi.sfx('tap'); return start(); }
  if (act === 'pr-pet') { P.key = b.dataset.key; arenaUi.sfx('tap'); return draw(); }
  if (act === 'pr-dummy') { P.dummy = DUMMIES.some(d => d.k === b.dataset.k) ? b.dataset.k : 'still'; arenaUi.sfx('tap'); return draw(); }
  if (act === 'pr-s2') { P.s2[P.key] = Number(b.dataset.i) === 1 ? 1 : 0; arenaUi.sfx('tap'); return draw(); }
  if (act === 'pr-tree') {
    const l = Number(b.dataset.l), n = Number(b.dataset.b) ? 1 : 0; if (!(l >= 0 && l <= 2)) return;
    const t = trOf(P.key).split(''); t[l] = String(n); P.tr[P.key] = t.join('');
    arenaUi.sfx('skill', { rate: 1.3, volume: .6 }); return draw();
  }
  if (act === 'pr-save') {
    // 대기실과 같은 규칙: 열린 층만 바꾸고, 이 폰에 기억(다음 판 시작 때 서버가 기억한다).
    const p = ready(R.A).find(x => x.key === P.key); if (!p) return;
    const lv = Number(p.level), want = trOf(P.key), cur = cleanTree(R.trees?.[P.key]).split('');
    TREE.LEVELS.forEach((L, i) => { if (lv >= L) cur[i] = want[i]; });
    arenaUi.keep(P.key, { tr: cur.join(''), s2: P.s2[P.key] });
    arenaUi.sfx('coins', { volume: .5 }); toast('대기실에 저장했어요! 다음 판부터 이 설정으로 싸워요.');
    return draw();
  }
}
