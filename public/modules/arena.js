import { api, esc, num, icon, toast, buttonBusy } from './ui.js';
import { CHARACTERS } from './core.js';
import { petKey, expressionSrc } from './character.js';
import { coin } from './emblems.js';
import { playSound, unlockSound, soundOn, preloadSound } from './sound.js';
import { coinShower, countUp } from './celebrate.js';
import { ELEMENTS, fxImpact, fxPunch, fxSpeedLines, fxRecoil, fxLite } from './battle-fx.js';
import { ARENA, BEATS, INPUT, ROLE, DIR16, SK2, ZONES_MAX, createArena, fighter, dirCode, aimCode, skill2Picks } from './arena-rules.js';
import { ARENA_ART } from './arena-art.js';
import { LIVE, LiveSim, replaySim } from './arena-live.js';

// V13.225 펫 아레나 2(놀이터): 전체 화면. 위에서 비스듬히 내려다보는 경기장에서 내 펫을 직접 조종해 상대 펫과 싸운다.
//   왼쪽 아래 조이스틱으로 움직이고, 오른쪽 버튼: 공격(누르고 있으면 계속) · 스킬 1 · 스킬 2(펫마다 다르다) · 필살기(게이지) · 회피 · 교체.
//   컴퓨터(키보드): 방향키 · WASD 움직이기, J 공격, K 스킬 1, I 스킬 2, L 필살기, 스페이스 회피, Q 교체.
// V13.226 렉 방지: 기본 공격 맞힘은 가벼운 불꽃 하나(스킬 · 필살기만 큰 효과), 자세 그림은 미리 받아 두고, 긴 프레임이 이어지는 폰은
//   자동으로 가벼운 연출(.ar-lite, 7일 기억)로 간다. 펫 · 효과는 바뀔 때만 다시 쓴다.
// 전투 계산은 arena-rules.js(서버와 같은 함수), 판 · 확인 · 보상은 서버(server/arena.mjs). 화면은 조작 기록 [틱, 코드]만 보낸다. 클래스는 ar-.
// V13.228 (2탄 ①단계) 조준 직접 조작: 움직이는 쪽을 바라보고, 공격은 그쪽으로(±25° 보정). 스킬 · 필살기 버튼을 끌면 경기장에
//   화살표 · 부채꼴 · 원이 보이고 놓으면 그 방향(16방향)으로, 톡 누르면 바라보는 방향. 대기실에서 쉬운 조준(±40°) · 자동 조준(예전 방식)을 고른다.
//   타격감: 히트스톱(화면만 잠깐 멈춤) · 넉백 · 피격 섬광 · 큰 데미지 숫자(칸 8개 다시 쓰기) · 크리티컬 · 경기장만 흔들림 · 카메라 줌 ·
//   마지막 한 방 슬로 · 소리 겹치기(같은 소리 0.05초에 1번) · 진동 · 콤보.
//   렉 방지: 필살기 컷인 · 물들이기는 미리 만든 칸을 다시 쓰고 흔들림 · 멈춤 표시는 경기장(#ar-field)에만 붙인다. 필살기 조각은 3프레임에 나눠 만든다.
//   지진 표시는 transform scale로, 펫 겹침 순서(zIndex)는 바뀔 때만, 숨은 칸은 애니메이션을 멈추고, 글자 · 숫자는 translate로 자리 잡는다.
//   위 막대(HUD) 펫 점은 한 번만 만들고 클래스만 바꾼다.
// V13.229 (2탄 ②단계) 스킬 다양화: 모양 6가지(부채꼴 지속 · 굵은 줄기 · 원 폭발 · 장판 · 돌진 · 소환)와 속성 스킬 16개.
//   대기실에서 펫마다 스킬 ②를 속성 스킬 2개 중 하나로 고른다(무료, 서버에 기억). 필살기도 속성마다 새 연출.
//   렉 예산(구성안 4장): 효과 조각 한 번에 40개(저사양 20) · 스킬 하나 8개(저사양 4) · 장판 칸 4개 · 줄기 칸 2개 · 부채꼴 칸 2개 ·
//   분신 칸 2개를 미리 만들어 다시 쓴다. 줄기 · 부채꼴 · 장판은 transform(scale)만, 움직임은 transform · opacity만, 빛 번짐 필터는
//   스킬 · 필살기 칸만(저사양 끔). 그림 66(public/assets/arena/fx-*.webp)이 오면 ARENA_ART로 같은 칸이 그림으로 바뀐다.
// V13.230 (2탄 ③단계) 실시간 1:1 친구 대전(arena-live.js · cloudflare/arena-room.mjs): 같은 학년 친구 초대 · 방 번호 4자리 · 대기실(팀 · 스킬 ② ·
//   조준 · 준비) · 입력만 주고받고 각 폰이 같은 전투를 돌린다(롤백). 친구 화면은 위아래를 뒤집어 늘 내 펫이 아래. 끊기면 3초 뒤 컴퓨터가 대신 조종하고
//   다시 들어오면 이어서. 이모트 8개(1.5초에 1번) · 신호 막대 · 다시 보기(혼자 판도). 판 도중 조작은 메인 서버를 거치지 않는다(렉 방지 규칙 6).
// 그림: 주문서 65(public/assets/arena/) 경기장 · VS · 승패 배너 · 필살기 아이콘 · 쓰러짐 별. 경기장 그림이 없으면 지금 있는 전투 광장(battle/bg-arena), 작은 그림이 없으면 그 자리를 비운다.

const BG = { plaza: ['arena/bg-plaza', 'battle/bg-arena'], forest: ['arena/bg-forest', 'battle/bg-forest'], night: ['arena/bg-night', 'battle/bg-boss'] };
const KIND_KO = { burst: '공격', boost: '강화', poison: '중독', guard: '지키기' };
const SHOTS_MAX = 14, WARN_MAX = 6, MINE_MAX = 2, FX_MAX = 40, FX_MAX_LITE = 20, SKILL_FX = 8, SKILL_FX_LITE = 4;
const LINE_MAX = 3, STREAM_MAX = 2, LINE_BASE = 100, CONE_BASE = 200, ZONE_BASE = 100;
const PICK_KEY = () => `sumus-arena-s2:${R?.A?.data?.profile?.id || ''}`;
// 그림 66 이름(있으면 칸에 그림을 깐다). 없으면 CSS 연출 그대로.
const ART = { breath: 'fx-flame-breath', meteor: 'fx-meteor', jet: 'fx-water-jet', bubble: 'fx-bubble', vine: 'fx-vine', petal: 'fx-petal-field', boulder: 'fx-boulder', crack: 'fx-crack-field',
  tornado: 'fx-tornado', icefield: 'fx-ice-field', spear: 'fx-ice-spear', cloud: 'fx-poison-cloud', chain: 'fx-lightning', clone: 'fx-clone', crit: 'fx-crit' };
const artOf = id => ART[id] && ARENA_ART.has(ART[id]) ? `url(/assets/arena/${ART[id]}.webp)` : '';
const LITE_KEY = 'sumus-arena-lite', LITE_LONG_MS = 50, LITE_WINDOW_MS = 3000, LITE_LONG_COUNT = 8, LITE_DAYS = 7;
const DMG_MAX = 8, WARN_BASE = 100;
const HITSTOP = { atk: 40, skill: 70, skill2: 70, ult: 120 };
const AIM_KEY = 'sumus-arena-aim';
const AIM_MODES = [['free', '직접 조준', '움직이는 쪽 · 버튼 끌기'], ['easy', '쉬운 조준', '보정이 넓어요'], ['auto', '자동 조준', '늘 상대 쪽']];
const DRAG_PX = 16;
let R = null;
const root = () => document.getElementById('app');
const $ = id => document.getElementById(id);
let REDUCED = null;
const reduced = () => (REDUCED ||= matchMedia('(prefers-reduced-motion: reduce)')).matches;
// 같은 소리는 0.05초에 1번까지(겹쳐 울리면 시끄럽고 무겁다).
const sfxAt = new Map();
const sfx = (key, opts) => { if (!soundOn()) return; const now = performance.now(); if (now - (sfxAt.get(key) || -1e9) < 50) return; sfxAt.set(key, now); playSound(key, opts); };
const buzz = p => { try { if (soundOn()) navigator.vibrate?.(p); } catch {} };
function later(fn, ms) { const cur = R; const t = setTimeout(() => { if (R === cur && !cur.closing) fn(); }, ms); cur.timers.push(t); }
const wait = ms => new Promise(res => later(res, reduced() ? Math.min(ms, 250) : ms));
const petName = key => CHARACTERS[key]?.ko || key;
const petSrc = (key, form) => `/assets/pets/${petKey(key)}-${Math.max(1, Math.min(3, form))}.webp`;
const petImg = (key, form, cls = '') => `<img class="${cls}" src="${petSrc(key, form)}" alt="${esc(petName(key))}" draggable="false" decoding="async">`;
const elTag = el => `<i class="ar-el" style="--c1:${ELEMENTS[el]?.c1};--c2:${ELEMENTS[el]?.c2}">${esc(ELEMENTS[el]?.name || '')}</i>`;
const pal = el => ELEMENTS[el] || ELEMENTS.star;

const TEAM_KEY = () => `sumus-arena-team:${R?.A?.data?.profile?.id || ''}`;
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// 싸울 수 있는 내 펫(알이 아닌 펫): 레벨 순.
const readyPets = A => (A.data.stats?.pets || []).filter(x => Number(x.form) >= 1).sort((a, b) => b.level - a.level || (b.active ? 1 : 0) - (a.active ? 1 : 0));

export function openArena(A, exit, opts = {}) {
  closeAll();
  R = { A, exit, timers: [], view: A.data.rewards?.arena || null };
  A.screen = 'arena';
  const ready = readyPets(A).map(x => x.key);
  const saved = load(TEAM_KEY(), []).filter(k => ready.includes(k));
  R.team = (saved.length ? saved : ready).slice(0, ARENA.TEAM);
  R.aim = AIM_MODES.some(m => m[0] === load(AIM_KEY, 'free')) ? load(AIM_KEY, 'free') : 'free';
  // 스킬 ② 고르기: 서버에 기억한 것(R.view.s2) 위에 이 폰에서 방금 고른 것.
  R.picks = { ...(R.view?.s2 || {}), ...load(PICK_KEY(), {}) };
  root().innerHTML = `<div class="session-app ar-app" id="ar-app">
    <div class="ar-stage" id="ar-stage"><img class="ar-bg" id="ar-bg" alt="" draggable="false"><div class="ar-shade"></div></div>
    <header class="ar-top"><button type="button" class="yb-back" data-ar="exit" aria-label="나가기">${icon('back')}</button><strong>펫 아레나</strong><span class="ar-wallet">${coin()}<b id="ar-coins">${num(A.data.stats?.points_balance || 0)}</b></span></header>
    <main class="ar-main" id="ar-main"></main>
  </div>`;
  setBg('plaza');
  root().onclick = onClick;
  R.keys = onKey; R.keysUp = onKeyUp; R.vis = onVisibility;
  document.addEventListener('keydown', R.keys);
  document.addEventListener('keyup', R.keysUp);
  document.addEventListener('visibilitychange', R.vis);
  window.scrollTo(0, 0);
  preloadSound(['tm-count', 'tm-go', 'hit', 'hit-star', 'hit-leaf', 'hit-wind', 'atk-star', 'atk-leaf', 'atk-wind', 'skill', 'ult-riser', 'ult-impact', 'faint', 'combo', 'crit', 'fanfare-epic', 'fail', 'coins', 'smash', 'swoosh', 'tap']);
  // 홈 화면 초대에서 '받기'를 누르고 왔으면 바로 친구 방으로.
  if (opts.join) return liveJoin({ id: opts.join.id });
  lobby();
}
function setBg(name) {
  const el = $('ar-bg'); if (!el) return;
  const [want, backup] = BG[name] || BG.plaza;
  const stage = $('ar-stage');
  el.onload = () => stage?.classList.toggle('art', el.src.includes('/assets/arena/'));
  el.onerror = () => { el.onerror = null; stage?.classList.remove('art'); el.src = `/assets/${backup}.webp`; };
  el.src = `/assets/${want}.webp`;
}
const artImg = (name, cls) => `<img class="${cls}" data-ar-art src="/assets/arena/${name}.webp" alt="" draggable="false" decoding="async">`;
function artGuard() { root()?.querySelectorAll('img[data-ar-art]').forEach(img => { img.removeAttribute('data-ar-art'); img.onerror = () => img.remove(); if (img.complete && !img.naturalWidth) img.remove(); }); }
function closeAll() {
  if (!R) return;
  R.closing = true;
  R.timers.forEach(clearTimeout);
  cancelAnimationFrame(R.raf);
  if (R.keys) document.removeEventListener('keydown', R.keys);
  if (R.keysUp) document.removeEventListener('keyup', R.keysUp);
  if (R.vis) document.removeEventListener('visibilitychange', R.vis);
  if (R.resize) window.removeEventListener('resize', R.resize);
  liveClose();
}
async function leave() {
  const exit = R?.exit;
  closeAll();
  root().onclick = null;
  R = null;
  await exit?.();
}
const main = html => { const el = $('ar-main'); if (el) el.innerHTML = html; };
const app = () => $('ar-app');

/* ---------- 버튼 · 키보드 ---------- */
function onClick(event) {
  const b = event.target.closest('[data-ar]');
  if (!b || b.disabled || !R) return;
  unlockSound();
  const act = b.dataset.ar;
  if (act === 'exit') return R.playing && !R.replay ? confirmQuit() : R.replay ? stopReplay() : inLiveLobby() ? liveLeave() : leave();
  const live = inLiveLobby();
  if (act === 'pet') return live ? liveTogglePet(b.dataset.key) : togglePet(b.dataset.key);
  if (act === 'pick2') { const v = Number(b.dataset.i) === 1 ? 1 : 0; sfx('tap'); if (live) return liveSet({ s2: { [b.dataset.key]: v } }); R.picks[b.dataset.key] = v; save(PICK_KEY(), R.picks); return lobby(false, true); }
  if (act === 'aim') { R.aim = b.dataset.aim; save(AIM_KEY, R.aim); sfx('tap'); return live ? liveSet({ aim: R.aim }) : lobby(false, true); }
  if (act === 'start') return start(b);
  if (act === 'again') { if (!R.live?.done) return lobby(true); const id = R.live.go?.ids?.[1 - R.live.side]; buttonBusy(b); return id ? liveCreate(id, b) : liveMenu(); }
  if (act === 'live') { sfx('tap'); return liveMenu(); }
  if (act === 'live-room') { buttonBusy(b); return liveCreate(null, b); }
  if (act === 'live-invite') { buttonBusy(b); return liveCreate(b.dataset.id, b); }
  if (act === 'live-code') { const v = ($('ar-code')?.value || '').replace(/\D/g, ''); if (v.length !== 4) return toast('방 번호 4자리를 넣어 주세요.'); buttonBusy(b); return liveJoin({ code: v }, b); }
  if (act === 'live-rejoin') { buttonBusy(b); return liveRejoin(b); }
  if (act === 'live-accept') { buttonBusy(b); return liveJoin({ id: b.dataset.id }, b); }
  if (act === 'live-ready') { sfx('tap'); return liveSet({ ready: b.dataset.on !== '1' }); }
  if (act === 'live-start') { sfx('tap'); return liveSend({ type: 'start' }); }
  if (act === 'back-lobby') { liveClose(); return lobby(false, true); }
  if (act === 'emote') { $('ar-emo-tray')?.classList.toggle('on'); return; }
  if (act === 'emote-i') { $('ar-emo-tray')?.classList.remove('on'); return sendEmote(Number(b.dataset.i)); }
  if (act === 'replay') return startReplay();
  if (act === 'replay-speed') { if (R.replay) { R.replay.speed = R.replay.speed === 1 ? 2 : 1; b.textContent = `${R.replay.speed}배`; } return; }
  if (act === 'quit-yes') { if (R.live) R.live.quit = true; return leave(); }
  if (act === 'quit-no') { document.querySelector('.ar-quit')?.remove(); resume(); return; }
}
const KEY_DIR = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
const KEY_BTN = { KeyJ: 'atk', KeyK: 'skill', KeyI: 'skill2', KeyL: 'ult', Space: 'dodge', KeyQ: 'swap' };
function onKey(event) {
  if (!R?.playing || event.repeat) { if (R?.playing && (KEY_DIR[event.code] || KEY_BTN[event.code])) event.preventDefault(); return; }
  if (KEY_DIR[event.code]) { event.preventDefault(); R.keyDown.add(event.code); keyDir(); }
  else if (KEY_BTN[event.code]) { event.preventDefault(); press(KEY_BTN[event.code], true); }
}
function onKeyUp(event) {
  if (!R?.playing) return;
  if (KEY_DIR[event.code]) { R.keyDown.delete(event.code); keyDir(); }
  if (KEY_BTN[event.code] === 'atk') press('atk', false);
}
function keyDir() {
  let x = 0, y = 0;
  for (const k of R.keyDown) { x += KEY_DIR[k][0]; y += KEY_DIR[k][1]; }
  R.dir = dirCode(x, y, 0.1);
  drawStick(x * 0.7, y * 0.7);
}
// 버튼 누르기: 다음 틱에 조작 기록으로 들어간다. 공격은 누르고 있는 동안 쿨타임마다 계속.
// V13.228 code: 끌어서 조준한 16방향(0~15), 없으면 -1(바라보는 방향).
function press(btn, down = true, code = -1) {
  if (!R?.playing || R.paused) return;
  if (btn === 'atk') { R.holdAtk = down; if (down) R.queue.push(INPUT.ATK); return; }
  if (!down) return;
  const c = { skill: INPUT.SKILL, skill2: INPUT.SKILL2, ult: INPUT.ULT, dodge: INPUT.DODGE, swap: INPUT.SWAP }[btn];
  R.queue.push(code >= 0 && c !== INPUT.DODGE && c !== INPUT.SWAP ? [c, code] : c);
  if (btn === 'ult' && R.cur.me.gauge < ARENA.GAUGE_MAX) toastOnce('필살기 게이지가 아직 다 안 찼어요');
  buzz(8);
}
function toastOnce(text) { const now = performance.now(); if (now - (R.toastAt || 0) > 2000) { R.toastAt = now; pop(text, 50, 92, 'hint'); } }
function confirmQuit() {
  if (document.querySelector('.ar-quit')) return;
  pause();
  const box = document.createElement('div');
  box.className = 'ar-quit';
  box.innerHTML = `<div><b>그만할까요?</b><p>${R.live ? '나가면 남은 시간은 컴퓨터가 대신 싸워요. 절반 넘게 대신 싸우면 보상이 없어요.' : '이번 대전은 기록되지 않아요.'}</p><button type="button" class="btn" data-ar="quit-no">계속하기</button><button type="button" class="btn primary" data-ar="quit-yes">그만하기</button></div>`;
  app()?.appendChild(box);
}

/* ---------- 대기실: 팀 고르기 ---------- */
function togglePet(key) {
  const i = R.team.indexOf(key);
  if (i >= 0) { if (R.team.length > 1) R.team.splice(i, 1); }
  else if (R.team.length < ARENA.TEAM) R.team.push(key);
  else { R.team.shift(); R.team.push(key); }
  save(TEAM_KEY(), R.team);
  sfx('tap');
  lobby(false, true);
}
// V13.229 스킬 ②: 속성 스킬 2개 중 하나를 고른다(톡 누르면 바뀐다, 무료).
function skillLine(key, form, level) {
  const pick = R.picks?.[key] === 1 ? 1 : 0, f = fighter({ key, form, level, s2: pick }), k = f.skill, r = ROLE[f.role];
  const opts = skill2Picks(key).map((k2, i) => `<button type="button" class="ar-pick2${i === pick ? ' on' : ''}" data-ar="pick2" data-key="${esc(key)}" data-i="${i}" aria-pressed="${i === pick}" title="${esc(k2.desc)}"><i>${k2.icon}</i><b>${esc(k2.name)}</b></button>`).join('');
  return `<span class="ar-skill" style="--c1:${pal(f.el).c1};--c2:${pal(f.el).c2}"><i class="ar-role">${esc(r.name)} · ${f.melee ? '근접' : '원거리'}<small>${esc(r.desc)}</small></i><b>① ${esc(k.name)}</b><small>${esc(KIND_KO[k.kind])} · ${esc(k.desc)}</small><b class="ar-pick-h">② 고르기</b><span class="ar-picks" role="group" aria-label="스킬 2 고르기">${opts}</span><small class="ar-pick-desc">${esc(f.skill2.desc)}</small><em>필살기 ${esc(f.ult)}</em></span>`;
}
function lobby(again = false, keep = false) {
  R.playing = false;
  cancelAnimationFrame(R.raf);
  app()?.classList.remove('playing');
  setBg('plaza');
  const v = R.view || {}, pets = readyPets(R.A);
  const tickets = Number(v.tickets || 0), left = Number(v.left ?? ARENA.DAILY), paid = tickets > 0 && left > 0;
  const slot = n => { const key = R.team[n], p = pets.find(x => x.key === key); return p ? `<span class="ar-slot on"><b>${n + 1}</b>${petImg(p.key, p.form)}<div><small>${esc(p.name || petName(p.key))} · Lv.${p.level}</small>${skillLine(p.key, p.form, p.level)}</div></span>` : `<span class="ar-slot"><b>${n + 1}</b><i>?</i><div><small>비어 있음</small></div></span>`; };
  main(`<section class="ar-lobby${again ? ' again' : ''}${keep ? ' keep' : ''}">
    <div class="ar-title"><small>3 대 3 펫 대전</small><h1>펫 아레나</h1></div>
    ${liveEntry()}
    <div class="ar-card">
      <ul class="ar-rules">
        <li><b>🕹️</b><span>왼쪽 <em>조이스틱</em>으로 움직이면 그쪽을 바라봐요. <em>공격</em>은 바라보는 쪽으로!</span></li>
        <li><b>🎯</b><span><em>스킬 · 필살기 버튼을 끌면</em> 원하는 쪽으로 조준, 톡 누르면 바라보는 쪽. 등 뒤 · 기절한 상대는 <em>치명타</em></span></li>
        <li><b>💨</b><span>날아오는 공격은 <em>회피</em>로 피해요(잠깐 무적). 바닥에 빨간 표시가 뜨면 피하기!</span></li>
        <li><b>🔥</b><span>때리고 맞으면 <em>필살기 게이지</em>가 차요. 꽉 차면 필살기! 위험하면 <em>교체</em></span></li>
      </ul>
      <div class="ar-aimset" role="group" aria-label="조준 방식">${AIM_MODES.map(([k, n, d]) => `<button type="button" class="ar-aimopt${R.aim === k ? ' on' : ''}" data-ar="aim" data-aim="${k}" aria-pressed="${R.aim === k}"><b>${n}</b><small>${d}</small></button>`).join('')}</div>
      <h3 class="ar-sub">내 팀 <small>순서대로 나가요 · 펫마다 특징 · 스킬 2개가 달라요</small></h3>
      <div class="ar-slots">${[0, 1, 2].map(slot).join('')}</div>
      ${pets.length ? `<div class="ar-pets">${pets.map(p => `<button type="button" class="ar-pet-pick${R.team.includes(p.key) ? ' on' : ''}" data-ar="pet" data-key="${esc(p.key)}" aria-pressed="${R.team.includes(p.key)}">${petImg(p.key, p.form)}<small>Lv.${p.level}</small>${R.team.includes(p.key) ? `<b>${R.team.indexOf(p.key) + 1}</b>` : ''}</button>`).join('')}</div>`
        : '<p class="ar-why">알에서 깬 펫이 없어요. 공부해서 펫을 키우면 싸울 수 있어요!</p>'}
      <div class="ar-recs"><div><small>승리</small><b>${num(v.wins || 0)}</b></div><div><small>연승</small><b>${num(v.streak || 0)}<small> / 최고 ${num(v.best_streak || 0)}</small></b></div><div><small>입장권</small><b>🎟️ ${num(tickets)}<small> / ${num(ARENA.TICKETS_MAX)}</small></b></div></div>
      <p class="ar-words">${paid ? `코인 판 · 이기면 ${coin()}${ARENA.COINS.win} · 오늘 ${num(left)}판 남음 · 입장권 1장을 써요` : left <= 0 ? `오늘 코인 판(${ARENA.DAILY}판)을 다 썼어요. 연습 판은 계속 할 수 있어요` : `입장권이 없어서 연습 판이에요(코인 없음). <b>단어 연습을 끝까지 풀면 입장권</b>을 받아요`}</p>
      <button type="button" class="yl-cta ar-go" data-ar="start" ${pets.length ? '' : 'disabled'}>${!pets.length ? '펫을 먼저 키워 주세요' : paid ? '대전 시작!' : '연습 판 시작'}</button>
    </div>
  </section>`);
}

async function start(button) {
  buttonBusy(button);
  let r;
  // 스킬 ② 고르기는 내 팀 펫 것만 보낸다(서버가 기억한다).
  const picks = Object.fromEntries(R.team.filter(k => R.picks[k] != null).map(k => [k, R.picks[k]]));
  try { r = await api('/games/arena/start', { team: R.team, picks }); }
  catch (err) { if (!R) return; buttonBusy(button, false); return toast(err.message || '대전을 시작하지 못했어요.'); }
  if (!R) return;
  R.view = { ...R.view, left: r.left, tickets: r.tickets, wins: r.wins, streak: r.streak, best_streak: r.best_streak, s2: r.s2 || R.view?.s2 };
  await vs(r);
  if (R) play(r);
}

/* ---------- V13.230 친구 대전(실시간 1:1) ---------- */
// 혼자 대전 대기실 위의 입구: 진행 중인 방 · 온 초대 · 친구 대전 열기.
function liveEntry() {
  const inv = R.A.data.arena_invite && R.A.data.arena_invite.expires_at > Date.now() ? R.A.data.arena_invite : null;
  return `<div class="ar-live-entry">
    ${R.view?.live_room ? '<button type="button" class="yl-cta ar-go live" data-ar="live-rejoin">진행 중인 친구 대전으로 돌아가기</button>' : ''}
    ${inv ? `<div class="ar-invite"><b>⚔️ ${esc(inv.host)}의 친구 대전 초대!</b><button type="button" class="btn primary" data-ar="live-accept" data-id="${esc(inv.id)}">받기</button></div>` : ''}
    <button type="button" class="ar-live-btn" data-ar="live"><i aria-hidden="true">⚔️</i><span><b>친구와 실시간 대전</b><small>같은 학년 친구 · 1 대 1 · 방 번호로도 들어가요</small></span><em>${num(R.view?.live_wins || 0)}승</em></button>
  </div>`;
}
const inLiveLobby = () => !!R?.live && !R.playing && !R.live.go && R.live.view?.phase === 'lobby';
async function liveMenu() {
  liveClose();
  R.playing = false; R.replay = null;
  app()?.classList.remove('playing', 'ar-replaying');
  setBg('night');
  const pairs = R.view?.pairs || {};
  main(`<section class="ar-lobby ar-live-menu keep">
    <div class="ar-title"><small>같은 학년 친구와 1 대 1</small><h1>친구 대전</h1></div>
    <div class="ar-card">
      <ul class="ar-rules">
        <li><b>📱</b><span>친구 폰과 <em>실시간</em>으로 싸워요. 내 펫은 늘 아래, 친구 펫은 위!</span></li>
        <li><b>🏫</b><span><em>같은 학교 · 같은 학년</em> 친구만 초대하고 들어올 수 있어요(반은 달라도 돼요)</span></li>
        <li><b>🪙</b><span>코인은 혼자 대전과 같아요(하루 ${ARENA.DAILY}판 · 입장권). <em>같은 친구와는 하루 2판</em>까지 코인, 그다음은 연습 판</span></li>
      </ul>
      <h3 class="ar-sub">방 번호로 들어가기</h3>
      <div class="ar-code-row"><input id="ar-code" class="ar-code-in" inputmode="numeric" maxlength="4" pattern="[0-9]*" autocomplete="off" placeholder="0000" aria-label="방 번호 4자리"><button type="button" class="btn primary" data-ar="live-code">들어가기</button></div>
      <button type="button" class="yl-cta ar-go" data-ar="live-room">방 만들고 번호 알려 주기</button>
      <h3 class="ar-sub">친구 초대 <small>같은 학교 · 같은 학년</small></h3>
      <div class="ar-friends" id="ar-friends"><p class="ar-why">친구 목록을 불러오는 중…</p></div>
      <button type="button" class="btn full" data-ar="back-lobby">혼자 대전으로</button>
    </div>
  </section>`);
  let out;
  try { out = await api('/games/arena/live/friends'); } catch (err) { const el = $('ar-friends'); if (el) el.innerHTML = `<p class="ar-why">${esc(err.message || '친구 목록을 불러오지 못했어요.')}</p>`; return; }
  const el = $('ar-friends'); if (!el || !R) return;
  if (out.current) el.insertAdjacentHTML('beforebegin', '<button type="button" class="yl-cta ar-go live" data-ar="live-rejoin">진행 중인 친구 대전으로 돌아가기</button>');
  el.innerHTML = out.friends.length ? out.friends.map(f => `<button type="button" class="ar-friend" data-ar="live-invite" data-id="${esc(f.id)}" ${f.busy ? 'disabled' : ''}><b>${esc(f.name)}</b><small>${esc(f.class_name)}${pairs[f.id] ? ` · 오늘 코인 판 ${Math.min(2, pairs[f.id])}/2` : ''}</small><em>${f.busy ? '대전 중' : '초대'}</em></button>`).join('')
    : '<p class="ar-why">초대할 수 있는 같은 학년 친구가 아직 없어요. 방 번호로 불러 보세요!</p>';
}
async function liveCreate(friendId, button) {
  let out;
  try { out = await api('/games/arena/live/create', friendId ? { friend_id: friendId } : {}); }
  catch (err) { if (R) { buttonBusy(button, false); toast(err.message || '방을 만들지 못했어요.'); } return; }
  if (R) liveConnect(out.room);
}
async function liveJoin(q, button) {
  let out;
  try { out = await api('/games/arena/live/join', q); }
  catch (err) { if (!R) return; if (button) buttonBusy(button, false); toast(err.message || '방에 들어가지 못했어요.'); if (!button) lobby(); return; }
  if (R) { R.A.data.arena_invite = null; liveConnect(out.room); }
}
async function liveRejoin(button) {
  let out;
  try { out = await api('/games/arena/live/current'); } catch (err) { buttonBusy(button, false); return toast(err.message || '다시 들어가지 못했어요.'); }
  if (!R) return;
  if (!out.room) { if (R.view) R.view.live_room = null; toast('친구 대전이 끝났어요.'); return lobby(false, true); }
  liveConnect(out.room);
}
// 방 소켓: 끊기면 0.5 · 1 · 2 · 4초 뒤 다시(8번까지). 다시 들어오면 방이 씨앗 + 확정 조작을 다시 준다.
function liveConnect(room) {
  liveClose();
  R.live = { room, side: room.host ? 0 : 1, offset: 0, rtt: 0, ai: [false, false], res: null, alive: true, tries: 0, next: 1, emoteAt: 0 };
  main('<div class="ar-saving">친구 대전 방에 들어가는 중…</div>');
  openSocket();
  const L = R.live;
  L.timer = setInterval(() => liveTick(L), LIVE.SEND_MS);
}
function openSocket() {
  const L = R?.live; if (!L?.alive) return;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  let ws;
  try { ws = new WebSocket(`${proto}://${location.host}/api/arena/ws/${encodeURIComponent(L.room.id)}?ticket=${encodeURIComponent(L.room.ticket)}`); } catch { return; }
  L.ws = ws;
  ws.onopen = () => { L.tries = 0; L.next = L.sim?.pending[0]?.[0] || (L.sim ? L.sim.seq + 1 : 1); L.lastMsg = Date.now(); drawNet(); };
  ws.onmessage = ev => { if (R?.live !== L) return; let m; try { m = JSON.parse(ev.data); } catch { return; } L.lastMsg = Date.now(); onLive(L, m); };
  ws.onclose = ev => {
    if (R?.live !== L || !L.alive || L.ws !== ws) return;
    L.ws = null; drawNet();
    if (ev.code === 1000 || ev.code === 4000) return;
    if (L.tries >= 8) { if (!L.go) liveGone('친구 대전 방에 들어가지 못했어요. 방이 닫혔을 수 있어요.'); return; }
    const t = setTimeout(openSocket, Math.min(4000, 500 * 2 ** L.tries++)); R.timers.push(t);
  };
}
function liveClose() {
  const L = R?.live; if (!L) return;
  L.alive = false;
  clearInterval(L.timer); clearInterval(L.invitePoll);
  try { L.ws?.close(1000, 'bye'); } catch {}
  R.live = null;
}
const liveSend = msg => { const ws = R?.live?.ws; if (ws?.readyState === 1) { try { ws.send(JSON.stringify(msg)); } catch {} return true; } return false; };
function liveSet(patch) {
  const L = R.live, me = L?.view?.seats?.[L.side]; if (!me) return;
  // 바로 보이게 내 자리를 먼저 고치고(준비는 풀린다), 방이 확인해 다시 보낸다.
  if (patch.team) { me.team = patch.team.map(k => { const p = me.pets.find(x => x[0] === k); return [k, p[1], p[2], me.s2[k] === 1 ? 1 : 0]; }); me.ready = false; }
  if (patch.s2) { me.s2 = { ...me.s2, ...patch.s2 }; me.team = me.team.map(x => [x[0], x[1], x[2], me.s2[x[0]] === 1 ? 1 : 0]); me.ready = false; }
  if (patch.aim) me.aim = patch.aim;
  if (typeof patch.ready === 'boolean') me.ready = patch.ready;
  liveSend({ type: 'set', ...patch });
  liveLobby(true);
}
function liveTogglePet(key) {
  const me = R.live.view.seats[R.live.side], team = me.team.map(x => x[0]), i = team.indexOf(key);
  if (i >= 0) { if (team.length > 1) team.splice(i, 1); }
  else if (team.length < ARENA.TEAM) team.push(key);
  else { team.shift(); team.push(key); }
  sfx('tap');
  liveSet({ team });
}
function liveLeave() { liveSend({ type: 'leave' }); liveClose(); toast('친구 대전 방에서 나왔어요.'); liveMenu(); }
function liveGone(text) { liveClose(); main(`<section class="ar-lobby keep"><div class="ar-card"><p class="ar-why">${esc(text)}</p><button type="button" class="yl-cta ar-go" data-ar="live">친구 대전으로</button><button type="button" class="btn full" data-ar="back-lobby">혼자 대전으로</button></div></section>`); }

// 방이 보낸 것.
function onLive(L, m) {
  if (typeof m.now === 'number' && !L.rtt) L.offset = m.now - Date.now();
  if (m.type === 'pong') { const rtt = Math.max(1, Date.now() - m.c); L.rtt = L.rtt ? Math.round(L.rtt * 0.7 + rtt * 0.3) : rtt; L.offset = m.now + rtt / 2 - Date.now(); return drawNet(); }
  if (m.type === 'lobby') { L.view = m.view; if (m.view.phase === 'closed' && !L.go) return liveGone(m.view.reason === 'timeout' ? '5분 동안 시작하지 않아서 방이 닫혔어요.' : m.view.reason === 'replaced' ? '새 방을 만들어서 이 방은 닫혔어요.' : '방장이 방을 닫았어요.'); if (!L.go && m.view.phase === 'lobby') { liveLobby(!!L.shown); L.shown = true; } return; }
  if (m.type === 'go') { if (!L.go) { L.go = m; liveStart(L); } return; }
  if (m.type === 'full') { L.ai = m.ai || L.ai; if (L.sim) L.sim.full(m); else L.full = m; drawNet(); return; }
  if (m.type === 'b') { if (!L.sim) return; L.sim.confirm(m); if (L.sim.bad) { L.sim.bad = false; liveSend({ type: 'sync' }); } return; }
  if (m.type === 'net') { L.ai = m.ai; drawNet(); if (R.playing && m.ai[1 - L.side]) toastOnce('친구 연결이 끊겨서 컴퓨터가 대신 싸워요'); return; }
  if (m.type === 'emote') return showEmote(m.side === L.side ? 'me' : 'foe', m.i);
  if (m.type === 'end') { L.ended = m.result; if ('res' in m) L.res = m.res; if (L.sim && !L.sim.S.over) liveSend({ type: 'sync' }); return; }
  if (m.type === 'done') { L.res = m.res; return; }
  if (m.type === 'error') toast(m.error || '잠시 후 다시 해 주세요.');
}
// 0.1초마다: 확정 안 된 내 조작을 묶어 보내고, 1초마다 신호(왕복 시간 · 시계 맞추기).
function liveTick(L) {
  if (!L.alive) return;
  const now = Date.now();
  if (L.ws?.readyState === 1) {
    if (L.sim) {
      const list = L.sim.pending.filter(([seq]) => seq >= L.next).slice(0, LIVE.BATCH_MAX);
      if (list.length) { liveSend({ type: 'in', s: list[0][0], l: list.map(([, x]) => x) }); L.next = list[list.length - 1][0] + 1; }
    }
    if (now - (L.pingAt || 0) >= LIVE.PING_MS && !document.hidden) { L.pingAt = now; liveSend({ type: 'ping', c: now }); }
  }
  // 소식이 4초 넘게 없으면 연결을 새로 연다(폰이 잠깐 잠들었다 깬 경우).
  if (L.go && L.ws && !L.ended && !L.done && now - (L.lastMsg || now) > 4000) { try { L.ws.close(4001, 'stale'); } catch {} L.ws = null; openSocket(); }
}
function drawNet() {
  const L = R?.live, el = $('ar-net'); if (!L || !el) return;
  const cls = !L.ws || L.ws.readyState !== 1 ? 'off' : L.rtt > 400 ? 'bad' : L.rtt > 200 ? 'mid' : 'good';
  if (el._c !== cls) { el._c = cls; el.className = `ar-net ${cls}`; el.title = cls === 'off' ? '연결 중…' : `신호 ${L.rtt}ms`; }
  const note = $('ar-ai-note'), ai = L.ai[1 - L.side], mine = L.ai[L.side];
  if (note) { const t = mine ? '연결이 끊겨 컴퓨터가 대신 싸우는 중… 다시 연결하고 있어요' : ai ? '친구 연결이 끊겨 컴퓨터가 대신 싸우는 중' : ''; if (note._t !== t) { note._t = t; note.textContent = t; note.classList.toggle('on', !!t); } }
}
// 대기실(방 안): 방 번호 · 두 자리 · 내 팀 고르기 · 스킬 ② · 조준 · 준비 · 시작.
function liveLobby(keep = false) {
  const L = R.live, v = L?.view; if (!v || R.playing) return;
  const me = v.seats[v.side], fr = v.seats[1 - v.side];
  const pets = (me.pets || []).map(([key, form, level]) => ({ key, form, level }));
  R.team = me.team.map(x => x[0]); R.picks = { ...me.s2 }; R.aim = me.aim;
  const left = Math.max(0, Math.ceil((v.expires_at - (Date.now() + L.offset)) / 60000));
  const seat = (p, mine) => p ? `<div class="ar-seat${mine ? ' me' : ''}${p.ready ? ' ready' : ''}"><span class="ar-emo" id="ar-emo-seat-${mine ? 'me' : 'foe'}" aria-hidden="true"></span><b>${esc(mine ? '나' : p.name)}${p.host ? ' <i>방장</i>' : ''}</b><span>${p.team.map(([key, form]) => petImg(key, form)).join('')}</span><em>${p.ready ? '준비 완료!' : '고르는 중…'}</em></div>`
    : `<div class="ar-seat empty"><b>친구를 기다려요</b><span><i>?</i></span><em>방 번호 <strong>${esc(v.code)}</strong>를 알려 주세요</em></div>`;
  const slot = n => { const key = R.team[n], p = pets.find(x => x.key === key); return p ? `<span class="ar-slot on"><b>${n + 1}</b>${petImg(p.key, p.form)}<div><small>${esc(petName(p.key))} · Lv.${p.level}</small>${skillLine(p.key, p.form, p.level)}</div></span>` : `<span class="ar-slot"><b>${n + 1}</b><i>?</i><div><small>비어 있음</small></div></span>`; };
  const both = !!fr && me.ready && fr.ready;
  main(`<section class="ar-lobby ar-live-lobby${keep ? ' keep' : ''}">
    <div class="ar-title"><small>친구 대전 · 1 대 1 · ${left}분 안에 시작</small><h1>방 ${esc(v.code)}</h1></div>
    <div class="ar-card">
      <div class="ar-seats">${seat(me, true)}<i class="ar-seat-vs">VS</i>${seat(fr, false)}</div>
      <div class="ar-emo-row" role="group" aria-label="이모트">${LIVE.EMOTES.map((e, i) => `<button type="button" data-ar="emote-i" data-i="${i}" aria-label="이모트 ${esc(e)}">${esc(e)}</button>`).join('')}</div>
      <div class="ar-aimset" role="group" aria-label="조준 방식">${AIM_MODES.map(([k, n, d]) => `<button type="button" class="ar-aimopt${R.aim === k ? ' on' : ''}" data-ar="aim" data-aim="${k}" aria-pressed="${R.aim === k}"><b>${n}</b><small>${d}</small></button>`).join('')}</div>
      <h3 class="ar-sub">내 팀 <small>순서대로 나가요 · 스킬 ②를 골라요</small></h3>
      <div class="ar-slots">${[0, 1, 2].map(slot).join('')}</div>
      <div class="ar-pets">${pets.map(p => `<button type="button" class="ar-pet-pick${R.team.includes(p.key) ? ' on' : ''}" data-ar="pet" data-key="${esc(p.key)}" aria-pressed="${R.team.includes(p.key)}">${petImg(p.key, p.form)}<small>Lv.${p.level}</small>${R.team.includes(p.key) ? `<b>${R.team.indexOf(p.key) + 1}</b>` : ''}</button>`).join('')}</div>
      <button type="button" class="yl-cta ar-go${me.ready ? ' on' : ''}" data-ar="live-ready" data-on="${me.ready ? 1 : 0}">${me.ready ? '준비 완료! (누르면 취소)' : '준비'}</button>
      ${me.host ? `<button type="button" class="yl-cta ar-go start" data-ar="live-start" ${both ? '' : 'disabled'}>${!fr ? '친구가 들어오면 시작할 수 있어요' : both ? '대전 시작!' : '둘 다 준비하면 시작'}</button>` : `<p class="ar-words">${both ? '방장이 곧 시작해요!' : '준비를 누르고 방장이 시작하길 기다려요'}</p>`}
      <button type="button" class="btn full" data-ar="exit">방에서 나가기</button>
    </div>
  </section>`);
}
// 시작: 같은 전투(방장 = me 쪽)를 만들고, VS → 방 시계에 맞춘 카운트다운 → 판.
async function liveStart(L) {
  const g = L.go, fs = list => list.map(([key, form, level, s2]) => fighter({ key, form, level, s2 }));
  L.side = g.side;
  L.sim = new LiveSim({ seed: g.seed, a: fs(g.teams[0]), b: fs(g.teams[1]), side: g.side });
  if (L.full) { L.sim.full(L.full); L.full = null; }
  const mine = g.teams[g.side], theirs = g.teams[1 - g.side];
  const brief = list => list.map(([key, form, level, s2]) => { const f = fighter({ key, form, level, s2 }); return { key, form, level, s2, el: f.el }; });
  const r = { id: L.room.id, seed: g.seed, live: true, me: brief(mine), foe: { name: g.names[1 - g.side], bot: false, team: brief(theirs) }, foe_level: 1, coin_play: true };
  const lead = g.start_at - (Date.now() + L.offset);
  if (lead > 3400) await vs(r, lead - 3200);
  if (!R || R.live !== L) return;
  play(r, L);
}

/* ---------- 이모트 ---------- */
function sendEmote(i) {
  const L = R?.live; if (!L) return;
  const now = Date.now();
  if (now - L.emoteAt < LIVE.EMOTE_GAP_MS) return toastOnce('이모트는 잠깐 뒤에 다시');
  L.emoteAt = now;
  liveSend({ type: 'emote', i });
}
function showEmote(who, i) {
  const text = LIVE.EMOTES[i]; if (!text) return;
  sfx('tap', { rate: who === 'me' ? 1.3 : 1.6 });
  // 판: 펫 머리 위 · 대기실: 자리 위 · 결과 화면: 이모트 줄 위(칸 하나씩 다시 쓴다).
  const el = $(`ar-emo-${who}`) || $(`ar-emo-seat-${who}`);
  if (!el) return;
  // 애니메이션 다시 시작: 두 이름을 번갈아 쓴다(배치를 억지로 다시 하지 않는다).
  el.textContent = text;
  el.className = `ar-emo on ${el.classList.contains('a') ? 'b' : 'a'}`;
  clearTimeout(el._t); el._t = setTimeout(() => { el.className = 'ar-emo'; }, 2200);
}

/* ---------- 다시 보기 ---------- */
// 씨앗 + 두 쪽 조작 기록으로 처음부터 다시 돈다(혼자 판은 상대 컴퓨터도 같은 씨앗대로 똑같이 움직인다).
function keepReplay() {
  const L = R.live;
  R.replayData = L ? { seed: L.go.seed, a: L.sim.a, b: L.sim.b, ia: L.sim.all[0], ib: L.sim.all[1], side: L.side }
    : { seed: R.r.seed, a: R.teams.me, b: R.teams.foe, ia: R.inputs.slice(), ib: null, side: 0, foeLevel: R.r.foe_level };
  R.replayData.r = R.r;
}
function startReplay() {
  const d = R?.replayData; if (!d) return;
  sfx('tap');
  R.replay = { speed: 1, ms: 0, last: 0 };
  play(d.r, null, replaySim(d));
}
function stopReplay() {
  if (!R?.replay) return;
  R.playing = false; R.replay = null;
  cancelAnimationFrame(R.raf);
  app()?.classList.remove('playing', 'ar-replaying');
  if (R.lastResult) result(...R.lastResult);
}

/* ---------- VS ---------- */
async function vs(r, ms = 2300) {
  setBg(['plaza', 'forest', 'night'][r.seed % 3]);
  const side = (who, name, team) => `<div class="ar-vs-side ${who}"><b>${esc(name)}</b><div>${team.map((f, n) => `<span style="--i:${n}">${petImg(f.key, f.form)}<small>Lv.${f.level}</small>${elTag(f.el)}</span>`).join('')}</div></div>`;
  main(`<section class="ar-vs" id="ar-vs"><div class="ar-vs-bg"></div><div class="ar-vs-art"></div>
    ${side('foe', r.foe.name + (r.foe.bot ? '' : '의 팀'), r.foe.team)}
    <div class="ar-vs-mark">VS</div>
    ${side('me', '내 팀', r.me)}
    <p class="ar-vs-lv">${r.live ? '친구 대전 · 실시간' : `${['쉬움', '보통', '어려움'][r.foe_level] || '보통'} 상대${r.coin_play ? '' : ' · 연습 판'}`}</p>
  </section>`);
  sfx('swoosh'); later(() => { sfx('smash'); buzz(30); }, 450);
  await wait(ms);
}

/* ---------- 전투 화면 ---------- */
function field() {
  const shots = Array.from({ length: SHOTS_MAX }, (_, i) => `<i class="ar-shot" id="ar-shot-${i}"></i>`).join('');
  const warns = Array.from({ length: WARN_MAX }, (_, i) => `<i class="ar-warn" id="ar-warn-${i}"></i>`).join('') + Array.from({ length: MINE_MAX }, (_, i) => `<i class="ar-mine" id="ar-mine-${i}"></i>`).join('');
  const nums = Array.from({ length: DMG_MAX }, (_, i) => `<b class="ar-num" id="ar-num-${i}"></b>`).join('');
  // V13.229 미리 만든 칸: 장판 4 · 줄기 표시 3 · 줄기 2 · 부채꼴(쪽마다) · 분신(쪽마다). 다시 쓰기만 하고 새로 만들지 않는다.
  const zones = Array.from({ length: ZONES_MAX }, (_, i) => `<i class="ar-zone" id="ar-zone-${i}"><b></b><em></em></i>`).join('');
  const lines = Array.from({ length: LINE_MAX }, (_, i) => `<i class="ar-line" id="ar-line-${i}"></i>`).join('') + Array.from({ length: STREAM_MAX }, (_, i) => `<i class="ar-stream" id="ar-stream-${i}"><b></b><em></em></i>`).join('');
  const cones = ['me', 'foe'].map(w => `<i class="ar-cone ${w}" id="ar-cone-${w}"><b></b><b></b><b></b></i>`).join('');
  const clones = ['me', 'foe'].map(w => `<span class="ar-clone ${w}" id="ar-clone-${w}"><span class="ar-clone-body"></span></span>`).join('');
  // 필살기 컷인 · 물들이기 · 반짝이는 미리 만들어 두고 다시 쓴다(필살기 순간에 조각을 새로 만들지 않는다).
  const cut = `<div class="fx2 fx2-cut ar-cut" id="ar-cut" aria-hidden="true"><div class="fx2-cut-dim"></div><div class="fx2-cut-band"><div class="fx2-cut-lines"></div><div class="fx2-cut-pet" id="ar-cut-pet"></div><div class="fx2-cut-text"><small id="ar-cut-who"></small><b id="ar-cut-name"></b><em></em></div></div>${Array.from({ length: 7 }, (_, i) => `<i class="ar-cut-star" style="left:${12 + i * 12}%;top:${26 + (i * 37) % 44}%">✦</i>`).join('')}</div><div class="fx2 fx2-wash ar-wash" id="ar-wash" aria-hidden="true"></div>`;
  return `<section class="ar-play" id="ar-play">
    <div class="ar-hud">
      <div class="ar-bar foe" id="ar-hud-foe"></div>
      <div class="ar-bar me" id="ar-hud-me"></div>
      <span class="ar-clock" id="ar-clock">2:00</span>
      ${R.live ? `<span class="ar-net off" id="ar-net" aria-label="신호"><i></i><i></i><i></i></span><button type="button" class="ar-emo-btn" data-ar="emote" aria-label="이모트">😀</button>
      <div class="ar-emo-tray" id="ar-emo-tray" role="group" aria-label="이모트">${LIVE.EMOTES.map((e, i) => `<button type="button" data-ar="emote-i" data-i="${i}">${esc(e)}</button>`).join('')}</div>` : ''}
    </div>
    ${R.live ? '<p class="ar-ai-note" id="ar-ai-note" aria-live="polite"></p>' : ''}
    ${R.replay ? '<div class="ar-replay-bar"><b>🎬 다시 보기</b><button type="button" class="btn" data-ar="replay-speed">1배</button><button type="button" class="btn primary" data-ar="exit">끝내기</button></div>' : ''}
    <div class="ar-field yb-arena" id="ar-field">
      <div class="ar-ring" aria-hidden="true"></div>
      ${zones}${warns}${lines}<div class="ar-aim" id="ar-aim" aria-hidden="true"><i></i></div><div class="ar-aim-spot" id="ar-aim-spot" aria-hidden="true"></div>${cones}${clones}${shots}${nums}${cut}
      <div class="ar-mon foe" id="ar-foe"><span class="ar-shadow"></span><span class="ar-aura"></span><span class="ar-body" id="ar-foe-body"></span><span class="ar-status" aria-hidden="true"><i class="bub"></i><i class="vines"></i><i class="burnf"></i></span><span class="ar-hp"><i id="ar-foe-hp"></i><b id="ar-foe-sh"></b></span><span class="ar-emo" id="ar-emo-foe" aria-hidden="true"></span></div>
      <div class="ar-mon me" id="ar-me"><span class="ar-shadow"></span><span class="ar-aura"></span><span class="ar-body" id="ar-me-body"></span><span class="ar-status" aria-hidden="true"><i class="bub"></i><i class="vines"></i><i class="burnf"></i></span><span class="ar-hp"><i id="ar-me-hp"></i><b id="ar-me-sh"></b></span><span class="ar-face" id="ar-face"><i></i></span><span class="ar-emo" id="ar-emo-me" aria-hidden="true"></span></div>
    </div>
    <div class="ar-combo" id="ar-combo" aria-hidden="true"><b id="ar-combo-n"></b><small>콤보!</small></div>
    <div class="ar-pad" id="ar-pad">
      <div class="ar-stick" id="ar-stick" aria-label="움직이기"><i id="ar-knob"></i></div>
      <div class="ar-btns">
        <button type="button" class="ar-btn swap" data-btn="swap" aria-label="교체"><b>🔄</b><small>교체</small><i class="cd" id="ar-cd-swap"></i></button>
        <button type="button" class="ar-btn dodge" data-btn="dodge" aria-label="회피"><b>💨</b><small>회피</small><i class="cd" id="ar-cd-dodge"></i></button>
        <button type="button" class="ar-btn ult" data-btn="ult" id="ar-ult" aria-label="필살기">${artImg('ult-icon', 'ar-ult-ico')}<b class="ar-ult-txt">필살</b><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16" pathLength="100" id="ar-ult-ring"/></svg></button>
        <button type="button" class="ar-btn skill2" data-btn="skill2" id="ar-skill2" aria-label="스킬 2"><b id="ar-skill2-ico">🌀</b><small id="ar-skill2-name">스킬 2</small><i class="cd" id="ar-cd-skill2"></i></button>
        <button type="button" class="ar-btn skill" data-btn="skill" id="ar-skill" aria-label="스킬 1"><b id="ar-skill-ico">✨</b><small id="ar-skill-name">스킬</small><i class="cd" id="ar-cd-skill"></i></button>
        <button type="button" class="ar-btn atk" data-btn="atk" aria-label="공격"><b>👊</b><small>공격</small></button>
      </div>
    </div>
  </section>`;
}
// 위 막대: 이름 · 펫 점(그림)은 판 시작에 한 번만 만든다. 그 뒤로는 drawHud가 점의 클래스만 바꾼다.
function hudHtml(who, name, team) {
  return `<b>${esc(name)}</b><span class="ar-dots">${team.map((f, n) => `<i id="ar-dot-${who}-${n}">${petImg(f.key, R.forms[who][n])}</i>`).join('')}</span>`;
}
// live: 친구 대전(R.live, 전투는 LiveSim) · rep: 다시 보기(replaySim, 조작 없음).
function play(r, live = null, rep = null) {
  // 서버와 똑같이 key · form · level로 능력치를 다시 만든다(server/arena.mjs unpack과 같다).
  const fighters = list => list.map(f => fighter({ key: f.key, form: f.form, level: f.level, s2: f.s2 }));
  R.r = r;
  R.forms = { me: r.me.map(f => f.form), foe: r.foe.team.map(f => f.form) };
  R.teams = { me: fighters(r.me), foe: fighters(r.foe.team) };
  R.sim = rep || (live ? live.sim : createArena({ seed: r.seed, me: R.teams.me, foe: R.teams.foe, foeLevel: r.foe_level }));
  Object.assign(R, { queue: [], dir: 0, sentDir: 0, holdAtk: false, keyDown: new Set(), playing: true, paused: false, pausedMs: 0, started: false });
  if (!rep) R.inputs = [];
  app()?.classList.add('playing');
  app()?.classList.toggle('ar-replaying', !!rep);
  app()?.classList.toggle('ar-living', !!live);
  main(field()); artGuard();
  R.slots = null; R.skillsOn = true;
  preloadPoses();
  applyLite();
  R.fxN = 0; R.lag = { last: 0, longs: [] };
  R.geo = null;
  R.resize = () => { R.geo = null; };
  window.addEventListener('resize', R.resize);
  bindPad();
  R.prev = R.sim.view(); R.cur = R.prev;
  // 조준 방식(대기실에서 고른 것)은 첫 틱 조작으로 넣는다: 서버도 같은 조작 기록으로 다시 돌린다(친구 대전은 방이 넣는다).
  const mode = { easy: INPUT.AIM_EASY, auto: INPUT.AIM_AUTO }[R.aim];
  if (mode && !live && !rep) { const x = [0, mode]; R.inputs.push(x); R.sim.push(x); }
  Object.assign(R, { stopUntil: 0, z: '', faceCode: -9, drag: null, numN: 0, finale: false });
  const a = $('ar-hud-foe'), b = $('ar-hud-me');
  if (a) a.innerHTML = hudHtml('foe', R.r.foe.name, R.cur.foe.team);
  if (b) b.innerHTML = hudHtml('me', '나', R.cur.me.team);
  if (live) drawNet();
  // 쓰러짐 별 그림도 미리 받아 둔다.
  const star = new Image(); star.decoding = 'async'; star.src = '/assets/arena/fx-faint.webp';
  drawMon('me'); drawMon('foe'); drawHud(); drawPad();
  place(0);
  countIn();
}
async function countIn() {
  if (R.replay) { pop('다시 보기', 50, 45, 'count go'); R.t0 = performance.now(); R.started = true; R.raf = requestAnimationFrame(loop); return; }
  // 친구 대전: 두 폰이 방 시계에 맞춰 같이 센다(늦게 들어왔으면 바로 시작).
  const L = R.live, left = () => L ? L.go.start_at - (Date.now() + L.offset) : 0;
  for (const n of ['3', '2', '1']) {
    if (L && left() < (Number(n) - 1) * 1000) continue;
    if (L) { await wait(Math.max(0, left() - Number(n) * 1000)); if (!R?.playing) return; }
    pop(n, 50, 45, 'count'); sfx('tm-count');
    await wait(L ? Math.max(0, left() - (Number(n) - 1) * 1000) : 1000);
    if (!R?.playing) return;
  }
  if (!L || left() > -1500) { pop('FIGHT!', 50, 45, 'count go'); sfx('tm-go'); buzz(40); }
  R.t0 = performance.now(); R.started = true;
  R.raf = requestAnimationFrame(loop);
}

// 공격 · 맞는 자세 그림을 미리 받아 둔다(처음 바뀔 때 끊기지 않게). 없는 자세는 expressionSrc가 null.
function preloadPoses() {
  R.poses = new Map();
  for (const who of ['me', 'foe']) R.teams[who].forEach((f, i) => {
    for (const pose of ['attack', 'hurt']) {
      const src = expressionSrc(f.key, R.forms[who][i], pose); if (!src) continue;
      const img = new Image(); img.decoding = 'async'; img.src = src;
      img.decode?.().then(() => R?.poses?.set(src, true)).catch(() => {});
    }
  });
}
const poseReady = src => !!src && R.poses?.get(src) === true;
// 저사양 자동 단계(야차전과 같은 기준): 3초 안에 50ms 넘는 프레임이 8번을 넘으면 가벼운 연출로, 7일 기억.
const pref = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const liteOn = () => { const at = Number(pref(LITE_KEY, 0)); return at > 0 && Date.now() - at < LITE_DAYS * 86400000; };
function applyLite() { const on = liteOn(); app()?.classList.toggle('ar-lite', on); fxLite(on); if (R) R.lite = on; }
function lagWatch(t) {
  const L = R.lag;
  if (L.last && !document.hidden) {
    const d = t - L.last;
    if (d > LITE_LONG_MS && d < 1000) {
      L.longs.push(t);
      while (L.longs[0] < t - LITE_WINDOW_MS) L.longs.shift();
      if (L.longs.length > LITE_LONG_COUNT && pref(LITE_KEY, '') !== 'off' && !liteOn()) { try { localStorage.setItem(LITE_KEY, String(Date.now())); } catch {} applyLite(); }
    }
  }
  L.last = t;
}

/* 조이스틱 · 버튼(누르는 순간 반응하도록 pointerdown) */
function bindPad() {
  const stick = $('ar-stick'), pad = $('ar-pad');
  if (!stick || !pad) return;
  let id = null, cx = 0, cy = 0, rad = 50;
  const move = e => {
    const dx = (e.clientX - cx) / rad, dy = (e.clientY - cy) / rad, l = Math.sqrt(dx * dx + dy * dy), k = l > 1 ? 1 / l : 1;
    R.dir = dirCode(dx, dy, 0.28);
    drawStick(dx * k, dy * k);
  };
  stick.addEventListener('pointerdown', e => {
    if (!R?.playing) return;
    e.preventDefault(); unlockSound();
    const b = stick.getBoundingClientRect(); cx = b.left + b.width / 2; cy = b.top + b.height / 2; rad = b.width * 0.42;
    id = e.pointerId; try { stick.setPointerCapture(id); } catch {}
    move(e);
  });
  stick.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
  const up = e => { if (e.pointerId !== id) return; id = null; R.dir = 0; drawStick(0, 0); };
  stick.addEventListener('pointerup', up); stick.addEventListener('pointercancel', up);
  // 스킬 · 필살기: 누른 채 끌면 조준(경기장에 화살표 · 부채꼴 · 원), 놓으면 나간다. 톡 누르면 바라보는 방향.
  //   조준이 필요 없는 스킬(순간이동 · 폭발 · 함정 · 치유 · 지키기 · 강화)과 자동 조준은 누르는 순간 나간다.
  pad.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-btn]'); if (!b) return;
    e.preventDefault(); unlockSound();
    b.classList.add('down');
    try { b.setPointerCapture(e.pointerId); } catch {}
    const btn = b.dataset.btn;
    if (R?.playing && R.aim !== 'auto' && aimShape(btn)) { const r = b.getBoundingClientRect(); R.drag = { id: e.pointerId, btn, x: r.left + r.width / 2, y: r.top + r.height / 2, code: -1, on: false }; return; }
    press(btn, true);
  });
  pad.addEventListener('pointermove', e => {
    const d = R?.drag; if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.sqrt(dx * dx + dy * dy) < DRAG_PX) { if (d.on) { d.on = false; d.code = -1; hideAim(); } return; }
    // 화면 방향 → 경기장 % 방향(가로 · 세로 크기가 달라서 나눠 준다).
    const g = geo(), code = aimCode(dx / g.w, dy / g.h);
    if (!d.on) buzz(6);
    d.on = true; if (d.code !== code) { d.code = code; drawAim(); }
  });
  const release = e => {
    const b = e.target.closest('[data-btn]'); if (!b) return;
    b.classList.remove('down');
    if (b.dataset.btn === 'atk') press('atk', false);
    const d = R?.drag;
    if (d && d.id === e.pointerId) { R.drag = null; hideAim(); if (e.type === 'pointerup') press(d.btn, true, d.on ? d.code : -1); }
  };
  pad.addEventListener('pointerup', release); pad.addEventListener('pointercancel', release);
  pad.addEventListener('contextmenu', e => e.preventDefault());
}
// 이 버튼은 조준할 수 있나: 'arrow' 화살표 · 'fan' 부채꼴 · 'circle' 원, 조준이 필요 없으면 null.
function aimShape(btn) {
  const f = R?.teams?.me?.[R.cur?.me?.idx]; if (!f) return null;
  if (btn === 'ult') return 'fan';
  if (btn === 'skill') return ['guard', 'boost'].includes(f.skill.kind) ? null : f.shape === 'quake' ? 'circle' : f.shape === 'orb' ? 'fan' : 'arrow';
  if (btn === 'skill2') return { breath: 'fan', spear: 'fan', meteor: 'circle', crack: 'circle', icefield: 'circle', cloud: 'circle', jet: 'arrow', vine: 'arrow', chain: 'arrow', tornado: 'arrow', boulder: 'arrow', gale: 'arrow', darts: 'arrow' }[f.skill2.id] || null;
  return null;
}
// 조준 표시: 내 펫 발밑에서 끈 방향으로. 원은 놓일 자리(상대 쪽이면 상대 발밑, 아니면 그 방향으로 상대 거리만큼 12~40).
function drawAim() {
  const d = R?.drag, box = $('ar-aim'), spot = $('ar-aim-spot'); if (!d || !box || !spot) return;
  const shape = aimShape(d.btn); if (!shape || d.code < 0) return hideAim();
  const m = R.cur.me, o = R.cur.foe, [ax, ay] = DIR16[d.code], g = geo(), p = px(m.x, m.y);
  const ang = Math.atan2(ay * g.h, ax * g.w) * 180 / Math.PI + 90;
  if (box._shape !== shape) { box._shape = shape; box.className = `ar-aim on ${shape}`; }
  box.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) rotate(${ang.toFixed(1)}deg)`;
  if (shape === 'circle') {
    const dx = o.x - m.x, dy = o.y - m.y, dist = Math.sqrt(dx * dx + dy * dy) || 1, on = (ax * dx + ay * dy) / dist >= ARENA.AIM_DRAG;
    const r = Math.max(12, Math.min(ARENA.QUAKE_RANGE, dist)), q = on ? { x: o.x, y: o.y } : { x: Math.max(8, Math.min(92, m.x + ax * r)), y: Math.max(14, Math.min(86, m.y + ay * r)) }, sp = px(q.x, q.y);
    spot.className = 'ar-aim-spot on'; spot.style.transform = `translate(${Math.round(sp.x)}px, ${Math.round(sp.y)}px) translate(-50%, -50%) scale(1, .55)`;
  } else if (spot._on !== false) { spot._on = false; spot.className = 'ar-aim-spot'; }
  spot._on = shape === 'circle';
}
function hideAim() { const box = $('ar-aim'), spot = $('ar-aim-spot'); if (box) { box.className = 'ar-aim'; box._shape = ''; } if (spot) { spot.className = 'ar-aim-spot'; spot._on = false; } }
function drawStick(x, y) {
  const k = $('ar-knob'); if (k) k.style.transform = `translate(${x * 34}px, ${y * 34}px)`;
}

function drawMon(who) {
  const s = R.cur[who], f = s.team[s.idx], el = $(`ar-${who}-body`);
  // 피격 섬광: 같은 그림을 하얗게 한 장 더 겹쳐 두고 opacity만 바꾼다.
  if (el) el.innerHTML = petImg(f.key, R.forms[who][s.idx], 'ar-pet-img') + `<img class="ar-flash" src="${petSrc(f.key, R.forms[who][s.idx])}" alt="" draggable="false" decoding="async">`;
  $(`ar-${who}`)?.classList.remove('down');
  if (who === 'me') {
    const k = R.teams.me[s.idx].skill, n = $('ar-skill-name'), ico = $('ar-skill-ico');
    if (n) n.textContent = k.name;
    if (ico) ico.textContent = { burst: '✨', boost: '💪', poison: '☠️', guard: '🛡️' }[k.kind] || '✨';
    $('ar-skill')?.style.setProperty('--c1', pal(R.teams.me[s.idx].el).c1);
    const k2 = R.teams.me[s.idx].skill2, n2 = $('ar-skill2-name'), i2 = $('ar-skill2-ico');
    if (n2) n2.textContent = k2.name;
    if (i2) i2.textContent = k2.icon || '🌀';
    $('ar-skill2')?.style.setProperty('--c1', pal(R.teams.me[s.idx].el).c2);
  }
}
function drawHud() {
  const v = R.cur;
  for (const who of ['me', 'foe']) v[who].team.forEach((f, n) => {
    const el = $(`ar-dot-${who}-${n}`), cls = f.cur <= 0 ? 'down' : n === v[who].idx ? 'now' : '';
    if (el && el.className !== cls) el.className = cls;
  });
  drawHp();
}
function drawHp() {
  for (const who of ['me', 'foe']) {
    const s = R.cur[who], f = s.team[s.idx], el = $(`ar-${who}-hp`), sh = $(`ar-${who}-sh`);
    if (el) { const p = Math.max(0, f.cur / f.hp); el.style.transform = `scaleX(${p})`; el.classList.toggle('low', p < .3); }
    if (sh) sh.style.transform = `scaleX(${Math.min(1, s.shield / f.hp * 2)})`;
  }
}
// 버튼 쿨타임 · 필살기 링(바뀔 때만 쓴다).
function drawPad() {
  const m = R.cur.me, set = (id, frac) => { const el = slot(id); if (!el) return; const v = Math.round(frac * 100); if (el._v !== v) { el._v = v; el.style.transform = `scaleY(${frac})`; el.parentElement?.classList.toggle('wait', frac > 0); } };
  const f = R.teams.me[m.idx];
  set('ar-cd-skill', Math.max(0, m.skill) / (f.skillCd || ARENA.SKILL_TICKS));
  set('ar-cd-skill2', Math.max(0, m.skill2) / (f.skill2Cd || ARENA.SKILL2_TICKS));
  set('ar-cd-dodge', Math.max(0, m.dodgeCd) / (f.dodgeCd || ARENA.DODGE_CD));
  const alive = m.team.filter((f, i) => f.cur > 0 && i !== m.idx).length;
  set('ar-cd-swap', alive ? Math.max(0, m.swapCd) / ARENA.SWAP_CD : 1);
  const g = Math.floor(m.gauge), ring = slot('ar-ult-ring');
  if (ring && ring._g !== g) { ring._g = g; ring.style.strokeDashoffset = String(100 - g); $('ar-ult')?.classList.toggle('full', g >= ARENA.GAUGE_MAX); }
}
// 경기장 좌표(%) → 픽셀(화면 크기가 바뀔 때만 다시 잰다).
const geo = () => R.geo ||= (() => { const el = $('ar-field'); return el ? { w: el.clientWidth, h: el.clientHeight } : { w: 360, h: 400 }; })();
const px = (x, y) => { const g = geo(); return { x: x / 100 * g.w, y: y / 100 * g.h }; };
function place(frac) {
  const at = {};
  for (const who of ['me', 'foe']) {
    const a = R.prev[who], b = R.cur[who], el = slot(`ar-${who}`); if (!el) continue;
    const jump = a.idx !== b.idx || Math.abs(b.x - a.x) > 12; // 교체 · 밀쳐내기는 한 번에
    const x = jump ? b.x : a.x + (b.x - a.x) * frac, y = jump ? b.y : a.y + (b.y - a.y) * frac;
    const p = px(x, y);
    el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -80%)`;
    at[who] = { x, y };
    const flags = [b.fx < -0.1 || (Math.abs(b.fx) <= 0.1 && R.cur[who === 'me' ? 'foe' : 'me'].x < x) ? 'flip' : '', b.enter > 0 ? 'hidden' : '', b.stun > 0 ? 'stun' : '', b.slow > 0 ? 'slow' : '',
      b.boost > 0 ? 'boost' : '', b.shield > 0 ? 'shield' : '', b.poison > 0 ? 'poison' : '', b.inv > 0 && b.dash > 0 ? 'inv' : '', b.power2 > 0 ? 'charged' : '',
      b.bubble > 0 ? 'bubble' : '', b.root > 0 ? 'root' : '', b.burn > 0 ? 'burn' : '', b.slide > 0 ? 'slide' : '', b.chan > 0 ? 'casting' : ''].join(' ');
    if (el._flags !== flags) {
      el._flags = flags;
      const cls = el.classList;
      for (const [k, on] of [['flip', flags.includes('flip')], ['hidden', b.enter > 0], ['stun', b.stun > 0], ['slow', b.slow > 0], ['boost', b.boost > 0], ['shield', b.shield > 0], ['poison', b.poison > 0], ['inv', b.inv > 0 && b.dash > 0], ['charged', b.power2 > 0],
        ['bubble', b.bubble > 0], ['root', b.root > 0], ['burn', b.burn > 0], ['slide', b.slide > 0], ['casting', b.chan > 0]]) cls.toggle(k, on);
    }
  }
  // 겹침 순서: 아래쪽(앞) 펫이 위로. 순서가 바뀔 때만 쓴다(매 프레임 zIndex를 쓰지 않는다).
  const z = at.me && at.foe && at.me.y >= at.foe.y ? 'me' : 'foe';
  if (R.z !== z) { R.z = z; const m = slot('ar-me'), f = slot('ar-foe'); if (m) m.style.zIndex = z === 'me' ? '12' : '11'; if (f) f.style.zIndex = z === 'me' ? '11' : '12'; }
  // 내 펫이 바라보는 쪽 화살표(16방향 칸이 바뀔 때만 돌린다).
  const fc = aimCode(R.cur.me.fx, R.cur.me.fy);
  if (fc !== R.faceCode) { R.faceCode = fc; const f = slot('ar-face'), g = geo(); if (f) f.style.transform = `rotate(${(Math.atan2(R.cur.me.fy * g.h, R.cur.me.fx * g.w) * 180 / Math.PI + 90).toFixed(1)}deg)`; }
  if (R.drag?.on) drawAim();
  // 날아가는 공격 · 지진 표시(정해진 개수의 칸을 다시 쓴다).
  const shots = R.cur.shots;
  for (let i = 0; i < SHOTS_MAX; i++) {
    const el = slot(`ar-shot-${i}`), s = shots[i]; if (!el) continue;
    if (!s) { if (el._on) { el._on = false; el.style.opacity = '0'; } continue; }
    // V13.229 새 스킬 탄(바위 · 얼음 창 · 독침 · 분신 별): 종류 · 방향이 바뀔 때만 클래스 · 각도를 다시 쓴다.
    const p = px(s.x, s.y), P = pal(s.el), ang = s.id ? Math.round(angOf(s.vx, s.vy) / 5) * 5 : 0, key = `${s.el}${s.kind}${s.r}${s.id}${ang}`;
    if (el._key !== key) { el._key = key; el._rot = s.id && s.id !== 'boulder' && s.id !== 'clone' ? ` rotate(${ang}deg)` : ''; el.style.setProperty('--c1', P.c1); el.style.setProperty('--c2', P.c2); el.style.setProperty('--sz', `${Math.round(s.r * 2 / 100 * geo().w + 6)}px`); const art = artOf(s.id); el.style.setProperty('--art', art || 'none'); el.className = `ar-shot ${s.kind} ${s.from}${s.id ? ` sk ${s.id}` : ''}${art ? ' art' : ''}`; }
    el._on = true; el.style.opacity = '1';
    el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)${el._rot}`;
  }
  const qs = R.cur.quakes;
  for (let i = 0; i < WARN_MAX; i++) {
    const el = slot(`ar-warn-${i}`), q = qs[i]; if (!el) continue;
    if (!q) { if (el._on) { el._on = false; el.style.opacity = '0'; el.className = 'ar-warn'; el._from = null; } continue; }
    // 크기는 transform scale로만(너비 · 높이를 바꾸면 배치를 다시 한다). 기본 칸은 WARN_BASE px 원.
    const p = px(q.x, q.y), k = q.r * 2 / 100 * geo().w / WARN_BASE * (1.15 - Math.max(0, q.left) / (q.warn || 14) * 0.3);
    if (!el._on) { el._on = true; el.style.opacity = '1'; el._from = null; }
    if (el._from !== q.from + q.id) { el._from = q.from + q.id; el.className = `ar-warn on ${q.from}${q.id ? ` ${q.id}` : ''}`; }
    el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${k.toFixed(3)}, ${(k * 0.55).toFixed(3)})`;
  }
  const ms = R.cur.mines || [];
  for (let i = 0; i < MINE_MAX; i++) {
    const el = slot(`ar-mine-${i}`), m = ms[i]; if (!el) continue;
    if (!m) { if (el._on) { el._on = false; el.style.opacity = '0'; el.className = 'ar-mine'; } continue; }
    const p = px(m.x, m.y);
    if (!el._on) { el._on = true; el.style.opacity = '1'; el.className = `ar-mine on ${m.from}`; el.style.setProperty('--c1', pal(m.el).c1); }
    el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
  }
  drawSkills(at);
}
// V13.229 새 스킬 칸 그리기(장판 · 줄기 표시 · 부채꼴 · 분신). 크기 · 방향은 transform만, 종류(클래스)는 바뀔 때만 쓴다.
const angOf = (nx, ny) => { const g = geo(); return Math.atan2(ny * g.h, nx * g.w) * 180 / Math.PI; };
function slotClass(el, cls, art) {
  if (el._cls === cls) return;
  el._cls = cls; el.className = cls;
  if (el._art !== art) { el._art = art; el.style.setProperty('--art', art || 'none'); }
}
// 칸 찾기는 판마다 한 번(매 프레임 getElementById를 하지 않는다).
const slot = id => (R.slots ||= new Map()).get(id) || (() => { const el = $(id); if (el) R.slots.set(id, el); return el; })();
function drawSkills(at) {
  const v = R.cur, g = geo();
  // 새 스킬 칸이 하나도 없고 지난 프레임에도 없었으면 바로 끝(대부분의 프레임).
  const busy = (v.zones?.length || 0) + (v.lines?.length || 0) + (v.minions?.length || 0) + (v.me.chan > 0) + (v.foe.chan > 0);
  if (!busy && !R.skillsOn) return;
  R.skillsOn = busy > 0;
  // 장판: 장판 번호(n) % 4 칸. 한 판에 4개까지라 늘 다른 칸이다.
  const used = new Set();
  for (const z of v.zones || []) {
    const i = z.n % ZONES_MAX, el = slot(`ar-zone-${i}`); if (!el) continue;
    used.add(i);
    const p = px(z.x, z.y), k = z.r * 2 / 100 * g.w / ZONE_BASE, fade = z.left < 10 ? ' fading' : '', P = pal(z.el);
    if (el._n !== z.n) { el._n = z.n; el.style.setProperty('--c1', P.c1); el.style.setProperty('--c2', P.c2); try { el.animate([{ opacity: 0, scale: '.3' }, { opacity: 1, scale: '1.08', offset: .6 }, { opacity: 1, scale: '1' }], { duration: 320, easing: 'ease-out' }); } catch {} }
    slotClass(el, `ar-zone on ${z.id} ${z.from}${fade}${artOf(z.id) ? ' art' : ''}`, artOf(z.id));
    el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -50%) scale(${k.toFixed(3)})`;
  }
  for (let i = 0; i < ZONES_MAX; i++) if (!used.has(i)) { const el = slot(`ar-zone-${i}`); if (el && el._cls !== 'ar-zone') { el._n = -1; slotClass(el, 'ar-zone', ''); } }
  // 줄기 표시(모으는 동안): 쏜 펫 자리에서 조준 방향으로 가는 얇은 띠(길이 · 굵기는 scale).
  const ls = v.lines || [];
  for (let i = 0; i < LINE_MAX; i++) {
    const el = slot(`ar-line-${i}`), L = ls[i]; if (!el) continue;
    if (!L) { if (el._on) { el._on = false; el.className = 'ar-line'; } continue; }
    const p = px(L.x, L.y), len = L.len / 100 * g.w, wide = Math.max(0.4, L.w * 2 / 100 * g.w / 10);
    if (!el._on || el._id !== L.id + L.from) { el._on = true; el._id = L.id + L.from; el.className = `ar-line on ${L.id} ${L.from}`; el.style.setProperty('--c1', pal(L.el).c1); }
    el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) rotate(${angOf(L.nx, L.ny).toFixed(1)}deg) scale(${(len / LINE_BASE).toFixed(3)}, ${wide.toFixed(2)})`;
  }
  // 부채꼴 지속(불 뿜기): 쪽마다 칸 하나. 펫 입에서 조준 방향으로.
  for (const who of ['me', 'foe']) {
    const el = slot(`ar-cone-${who}`), s = v[who]; if (!el) continue;
    if (!(s.chan > 0)) { if (el._on) { el._on = false; el.className = `ar-cone ${who}`; } continue; }
    const p = at[who] ? px(at[who].x, at[who].y) : px(s.x, s.y), len = (SK2.breath.range + ARENA.BODY) / 100 * g.w;
    if (!el._on) { el._on = true; const art = artOf('breath'); el.style.setProperty('--art', art || 'none'); el.className = `ar-cone ${who} on${art ? ' art' : ''}`; }
    el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y - 14)}px) rotate(${angOf(s.cnx, s.cny).toFixed(1)}deg) scale(${(len / CONE_BASE).toFixed(3)})`;
  }
  // 분신: 쪽마다 칸 하나(반투명 펫 그림 + 별가루 테두리).
  const ms = v.minions || [];
  for (const who of ['me', 'foe']) {
    const el = slot(`ar-clone-${who}`), m = ms.find(q => q.from === who); if (!el) continue;
    if (!m) { if (el._on) { el._on = false; el.className = `ar-clone ${who}`; } continue; }
    if (el._key !== m.key) { el._key = m.key; const b = el.querySelector('.ar-clone-body'); if (b) b.innerHTML = petImg(m.key, R.forms[who][R.cur[who].idx] || 2, 'ar-pet-img'); }
    if (!el._on) { el._on = true; const art = artOf('clone'); el.style.setProperty('--art', art || 'none'); el.style.setProperty('--c1', pal(m.el).c1); el.className = `ar-clone ${who} on${art ? ' art' : ''}`; }
    const p = px(m.x, m.y);
    el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -80%)${m.x > v[who === 'me' ? 'foe' : 'me'].x ? ' scaleX(-1)' : ''}`;
  }
}
function loop(now) {
  if (!R?.playing) return;
  R.frameNow = now;
  lagWatch(now);
  if (R.paused) { R.raf = requestAnimationFrame(loop); return; }
  // 히트스톱: 화면만 잠깐 멈춘다(전투 시계를 그만큼 늦출 뿐, 전투 계산은 같다).
  // 다시 보기: 화면 시간 × 빠르기. 히트스톱 동안은 멈춘다.
  if (R.replay) { const r = R.replay; if (now >= R.stopUntil && r.last) r.ms += Math.min(100, now - r.last) * r.speed; r.last = now; }
  if (now < R.stopUntil) { R.raf = requestAnimationFrame(loop); return; }
  // 전투 시계: 친구 대전은 방 시계(두 폰이 같다), 다시 보기는 위, 혼자 판은 이 폰 시계(멈춤 · 히트스톱만큼 늦춘다).
  const ms = R.replay ? R.replay.ms : R.live ? Date.now() + R.live.offset - R.live.go.start_at : now - R.t0 - R.pausedMs;
  const want = Math.floor(ms / ARENA.TICK_MS);
  let n = 0;
  const behind = want - R.sim.S.t > 12; // 많이 밀렸으면(다른 탭) 효과 없이 따라잡는다
  const can = () => !R.sim.canStep || R.sim.canStep();
  while (R.sim.S.t < want && !R.sim.S.over && can() && n++ < 60 && !(now < R.stopUntil)) tickOnce(!behind);
  if (R.sim.S.over) return end();
  if (now < R.stopUntil) { R.raf = requestAnimationFrame(loop); return; }
  if (R.live && !R.replay) drawNet();
  const frac = Math.max(0, Math.min(1, ms / ARENA.TICK_MS - R.sim.S.t + 1));
  place(frac);
  drawPad();
  clock();
  R.raf = requestAnimationFrame(loop);
}
function clock() {
  const s = Math.max(0, Math.ceil((ARENA.MAX_TICKS - R.sim.S.t) * ARENA.TICK_MS / 1000)), el = slot('ar-clock');
  if (el && el._s !== s) { el._s = s; el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; el.classList.toggle('low', s <= 15); }
}
// 한 틱: 이번 틱의 조작을 기록 · 전투에 넣고 → 한 걸음 → 사건 그리기.
function tickOnce(show) {
  // 친구 대전: 내 조작은 LiveSim이 받아 바로 돌리고(방에는 0.1초마다 묶어서), 다시 보기는 조작이 없다.
  const t = R.sim.S.t, add = c => { const x = Array.isArray(c) ? [t, ...c] : [t, c]; R.inputs.push(x); if (R.sim.local) R.sim.local(x); else R.sim.push(x); };
  if (!R.replay) {
    if (R.dir !== R.sentDir) { R.sentDir = R.dir; add(R.dir); }
    const q = R.queue.splice(0);
    if (R.holdAtk && R.cur.me.cd <= 1 && !q.includes(INPUT.ATK)) q.push(INPUT.ATK);
    for (const c of q) if (R.inputs.length < ARENA.INPUT_MAX - 2) add(c);
  }
  R.prev = R.cur;
  const ev = R.sim.step();
  R.cur = R.sim.view();
  for (const e of ev) onEvent(e, show);
}
function onEvent(e, show) {
  if (e.e === 'enter') { if (show) { const s = R.cur[e.who]; pop(`${petName(e.key)} 등장!`, s.x, s.y - 12, 'enter'); sfx('swoosh'); } return; }
  if (e.e === 'swap') { R.prev = R.cur; drawMon(e.who); drawHud(); if (show && !R.fainted?.[e.who]) { pop('교체!', 50, e.who === 'me' ? 80 : 20, 'enter'); sfx('swoosh'); } if (R.fainted) R.fainted[e.who] = false; return; }
  // 쓰러짐: 유령 · 별은 이번 프레임, 배너는 다음 프레임(한 프레임에 몰리지 않게).
  if (e.e === 'faint') { const el = $(`ar-${e.who}`); (R.fainted ||= {})[e.who] = true; drawHud(); if (show) { faintFx(e); nextFrame(() => banner(e.who === 'me' ? `${petName(e.key)} 쓰러짐…` : `${petName(e.key)} 쓰러뜨렸다!`, e.who)); sfx('faint'); buzz([40, 30, 40]); } el?.classList.remove('down'); return; }
  if (e.e === 'over') return;
  if (e.e === 'dmg') { drawHp(); if (show) hurt(e); else if (e.last) R.finale = true; return; }
  if (e.e === 'buff') { drawHp(); if (show) { pop(e.name, R.cur[e.who].x, R.cur[e.who].y - 20, `skill ${e.who}`); sfx('skill'); aura(e.who, e.el); } return; }
  if (e.e === 'heal') { drawHp(); if (show) healFx(e); return; }
  if (!show) return;
  if (e.e === 'cutin') return cutin(e);
  if (e.e === 'ult') return ultFx(e);
  if (e.e === 'skillname') { pop(e.name, R.cur[e.who].x, R.cur[e.who].y - 20, `skill ${e.who}`); sfx('skill'); return; }
  if (e.e === 'skill2' && e.id) return skill2Fx(e);
  if (e.e === 'atk' || e.e === 'skill' || e.e === 'skill2') return attack(e);
  if (e.e === 'stream') return streamFx(e);
  if (e.e === 'gale') { afterimage(e.who); slash(px(e.x, e.y), e.nx, e.ny, e.el); sfx('swoosh', { rate: 1.2 + e.n * 0.1 }); return; }
  if (e.e === 'bubble') { if (e.gone) return void pop('방울이 사라졌어요', e.x, e.y - 22, 'stun'); bits('drop', px(e.x, e.y - 8), 3, 26, 420, 'water'); pop(e.left ? `막음! (${e.left})` : '막음!', e.x, e.y - 24, `skill ${e.who}`); sfx('tap', { rate: 1.6 }); return; }
  if (e.e === 'bubblepop') { ring(px(e.x, e.y), 'water', e.r); bits('drop', px(e.x, e.y - 8), 6, 60, 560, 'water'); sfx('smash', { rate: 1.5 }); buzz(20); return; }
  if (e.e === 'cloneshot') { sfx('atk-star', { rate: 1.5, volume: .5 }); return; }
  if (e.e === 'cloneend') { bits('star', px(e.x, e.y - 10), 4, 30, 520, 'star'); return; }
  if (e.e === 'burn') return void pop('화상!', R.cur[e.who].x, R.cur[e.who].y - 22, 'stun');
  if (e.e === 'root') return void pop('묶임!', R.cur[e.who].x, R.cur[e.who].y - 22, 'stun');
  if (e.e === 'freeze') return void pop('얼어붙음!', R.cur[e.who].x, R.cur[e.who].y - 22, 'stun');
  if (e.e === 'zap') { pop('감전!', R.cur[e.who].x, R.cur[e.who].y - 22, 'stun'); washFlash('star', .45, 160); return; }
  if (e.e === 'pop') { if (e.kind === 'atk') spark(px(e.x, e.y), e.el); else fxImpact($('ar-field'), px(e.x, e.y), e.el, 2); return; }
  if (e.e === 'blink') { afterimage(e.who); sfx('swoosh', { rate: 1.5 }); return; }
  if (e.e === 'blinked') { R.prev = R.cur; pop('다음 공격 2배!', e.x, e.y - 22, `skill ${e.who}`); return; }
  if (e.e === 'pull') return void pop('끌려옴!', R.cur[e.who].x, R.cur[e.who].y - 22, 'stun');
  if (e.e === 'boom' && e.id === 'meteor') { meteorBoom(e); return; }
  if (e.e === 'boom') { quake(px(e.x, e.y), e.el, e.kind !== 'atk'); sfx('smash'); if (R.cur.me && Math.abs(R.cur.me.x - e.x) < e.r + 5 && Math.abs(R.cur.me.y - e.y) < e.r + 5) buzz(25); return; }
  if (e.e === 'dodge') { afterimage(e.who); sfx('swoosh', { rate: 1.3 }); return; }
  if (e.e === 'stun') return void pop('기절!', R.cur[e.who].x, R.cur[e.who].y - 22, 'stun');
  if (e.e === 'slow') return void pop('느려짐', R.cur[e.who].x, R.cur[e.who].y - 22, 'stun');
  if (e.e === 'poison') return void pop('중독!', R.cur[e.who].x, R.cur[e.who].y - 22, 'stun');
  if (e.e === 'knock') return void pop('밀려남!', R.cur[e.who].x, R.cur[e.who].y - 22, 'stun');
}
// 다음 프레임에(한 프레임에 조각을 몰아 만들지 않게). 판이 끝났으면 하지 않는다.
function nextFrame(fn, n = 1) { const cur = R; requestAnimationFrame(() => { if (R !== cur || cur.closing) return; n > 1 ? nextFrame(fn, n - 1) : fn(); }); }
const arenaEl = () => $('ar-field');
// 히트스톱: 화면만 ms 동안 멈춘다. 전투 시계(pausedMs)를 같은 만큼 늦추므로 전투 계산(틱 · 조작 기록)은 그대로다.
function hitStop(ms) {
  if (!ms || reduced() || !R?.playing) return;
  const now = R.frameNow || performance.now(), until = now + ms;
  if (until <= R.stopUntil) return;
  // 친구 대전은 방 시계를 늦출 수 없다: 화면만 멈췄다가 다음 프레임들에 따라잡는다(멈춤이 짧아 2~3틱).
  if (!R.live && !R.replay) R.pausedMs += until - Math.max(now, R.stopUntil);
  R.stopUntil = until;
}
// 경기장만 흔들린다(앱 전체에 클래스를 붙이면 화면 전체 스타일을 다시 계산해서 무겁다). translate 속성이라 줌(scale)과 겹쳐도 된다.
function shakeField(big) {
  const f = arenaEl(); if (!f || reduced()) return;
  if (!big && app()?.classList.contains('ar-lite')) return; // 저사양: 필살기 흔들림만
  const a = big ? 6 : 3;
  try { f.animate([{ translate: '0 0' }, { translate: `${-a}px ${a * 0.6}px` }, { translate: `${a}px ${-a * 0.7}px` }, { translate: `${-a * 0.7}px ${a * 0.4}px` }, { translate: `${a * 0.5}px ${-a * 0.3}px` }, { translate: '0 0' }], { duration: big ? 420 : 220, easing: 'linear' }); } catch {}
}
// 카메라 줌: 경기장이 맞은 자리 쪽으로 살짝 당겨졌다 돌아온다(scale 속성).
function zoomAt(at, amount = 0.08, ms = 520) {
  const f = arenaEl(); if (!f || reduced()) return;
  f.style.transformOrigin = `${Math.round(at.x)}px ${Math.round(at.y)}px`;
  try { f.animate([{ scale: 1 }, { scale: 1 + amount, offset: 0.3 }, { scale: 1 + amount * 0.8, offset: 0.7 }, { scale: 1 }], { duration: ms, easing: 'cubic-bezier(.2,.8,.3,1)' }); } catch {}
}
function cutin(e) {
  const box = $('ar-cut'), wash = $('ar-wash'); if (!box) return;
  const P = pal(e.el);
  for (const [k, v] of [['--c1', P.c1], ['--c2', P.c2], ['--c3', P.c3]]) box.style.setProperty(k, v);
  box.className = `fx2 fx2-cut ar-cut on ${e.who} t${e.rank || 0}`;
  const pet = $('ar-cut-pet'), want = `${e.key}-${e.form}`;
  if (pet && pet._k !== want) { pet._k = want; pet.innerHTML = petImg(e.key, e.form, 'avatar-art'); }
  const who = $('ar-cut-who'), name = $('ar-cut-name');
  if (who) who.textContent = petName(e.key);
  if (name) name.textContent = e.name;
  const run = (el, frames, opts) => { try { el?.animate(frames, { fill: 'forwards', ...opts }); } catch {} };
  const from = e.who === 'me' ? '-110%' : '110%', to = e.who === 'me' ? '110%' : '-110%';
  run(box.querySelector('.fx2-cut-band'), [
    { transform: `translateX(${from}) skewY(-5deg)`, opacity: 0, easing: 'cubic-bezier(.15,.85,.25,1)' },
    { transform: 'translateX(0) skewY(-5deg)', opacity: 1, offset: .2 },
    { transform: 'translateX(0) skewY(-5deg) scale(1.03)', opacity: 1, offset: .78, easing: 'cubic-bezier(.6,0,.9,.35)' },
    { transform: `translateX(${to}) skewY(-5deg)`, opacity: 0 }
  ], { duration: 950, easing: 'linear' });
  run(box.querySelector('.fx2-cut-dim'), [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .78 }, { opacity: 0 }], { duration: 950 });
  run(pet, [{ transform: 'translateX(-30px) scale(.8)' }, { transform: 'translateX(0) scale(1.08)', offset: .25 }, { transform: 'translateX(8px) scale(1.12)' }], { duration: 950, easing: 'ease-out' });
  // 영웅 이상: 반짝이(미리 만든 7개 중 저사양은 2개) · 전설 이상: 경기장이 속성 색으로 물든다.
  const lite = app()?.classList.contains('ar-lite');
  box.querySelectorAll('.ar-cut-star').forEach((st, i) => { if ((e.rank || 0) >= 1 && i < (lite ? 2 : 3 + e.rank * 2)) run(st, [{ transform: 'scale(.1)', opacity: 0 }, { transform: 'translateY(-8px) scale(1) rotate(60deg)', opacity: 1, offset: .4 }, { transform: 'translateY(-22px) scale(.2) rotate(120deg)', opacity: 0 }], { duration: 760, delay: 120 + i * 70 }); });
  if ((e.rank || 0) >= 2 && wash) { wash.style.setProperty('--c1', P.c1); wash.style.setProperty('--c2', P.c2); run(wash, [{ opacity: 0 }, { opacity: 1, offset: .25 }, { opacity: .8, offset: .7 }, { opacity: 0 }], { duration: 920 }); }
  later(() => box.classList.remove('on'), 1000);
  sfx('ult-riser'); buzz(60);
  // 멈춤 표시는 경기장에만(앱 전체 X).
  arenaEl()?.classList.add('ult');
  later(() => arenaEl()?.classList.remove('ult'), ARENA.ULT_FREEZE_TICKS * ARENA.TICK_MS);
  if (e.who === 'foe') later(() => pop('회피하면 피할 수 있어요!', 50, 92, 'hint'), 200);
}
// 필살기가 터질 때: 큰 빔 → (다음 프레임) 터짐 조각 → (그다음) 지진 · 금. 흔들림 · 줌은 경기장만.
function ultFx(e) {
  const fieldEl = arenaEl(), to = px(e.tx, e.ty), from = px(e.x, e.y);
  beam(from, to, e.el, true);
  shakeField(true);
  if (e.hit) zoomAt(to, 0.08, 560); else fxPunch(fieldEl, .04);
  sfx('ult-impact');
  if (e.who === 'me' && e.hit) buzz([30, 20, 60]);
  nextFrame(() => fxImpact(arenaEl(), to, e.el, 3));
  nextFrame(() => quake(to, e.el, true), 2);
  nextFrame(() => ultExtra(e, from, to), 3);
}
function attack(e) {
  const fieldEl = $('ar-field'), from = px(e.x, e.y);
  const s = R.cur[e.who], f = s.team[s.idx];
  const src = expressionSrc(f.key, R.forms[e.who][s.idx], 'attack');
  if (poseReady(src)) swapPose($(`ar-${e.who}-body`), src, 300);
  if (e.shape === 'claw') { slash(from, e.nx, e.ny, e.el); sfx(atkSfx(e.el), { rate: 1.15 }); return; }
  if (e.shape === 'dash') { fxSpeedLines(fieldEl, from, e.el); sfx('swoosh'); return; }
  if (e.shape === 'quake' || e.shape === 'nova') { sfx('smash', { rate: 1.3 }); return; }
  if (e.shape === 'trap') { sfx('stamp'); return; }
  if (e.shape === 'hook') { sfx('swoosh', { rate: .8 }); return; }
  sfx(atkSfx(e.el), { rate: e.e === 'skill' ? .85 : 1.1 });
}
const atkSfx = el => el === 'leaf' ? 'atk-leaf' : el === 'wind' ? 'atk-wind' : 'atk-star';
// 맞는 순간: 히트스톱 → 섬광 · 큰 숫자 · 치명타 · 콤보 · 흔들림 · 소리 겹치기 · 진동.
const HIT_SFX = { leaf: 'hit-leaf', wind: 'hit-wind', star: 'hit-star', ice: 'hit-star', flame: 'hit-star' };
function hurt(e) {
  // V13.229 화상도 중독처럼 섬광 · 멈춤 없이. 여러 번 맞는 스킬(불 뿜기 · 장판)의 한 번은 멈춤을 아주 짧게, 흔들림 없이.
  const poison = e.kind === 'poison' || e.kind === 'burn', body = $(`ar-${e.who}-body`), stop = poison ? 0 : e.tick ? 18 : HITSTOP[e.kind] || 40;
  if (!poison) {
    hitStop(stop);
    flash(body);
    const dir = e.who === 'me' ? 1 : -1;
    // 움찔은 멈춤이 끝난 뒤에(멈춤 동안은 섬광만).
    later(() => fxRecoil($(`ar-${e.who}-body`), dir), stop);
    const s = R.cur[e.who], f = s.team[s.idx];
    if (f) { const src = expressionSrc(f.key, R.forms[e.who][s.idx], 'hurt'); if (poseReady(src)) swapPose(body, src, 300); }
  }
  dmgNum(e);
  if (e.m > 1 && e.kind !== 'atk' && !poison) pop('효과가 굉장해!', e.x, e.y - 27, 'eff');
  else if (e.m < 1 && e.kind !== 'atk' && !poison) pop('효과가 별로…', e.x, e.y - 27, 'eff weak');
  if (!poison) {
    // 소리 겹치기: 때림 + 속성 + (내가 맞으면) 아픔, 높이를 조금씩 다르게.
    sfx(e.kind === 'ult' ? 'crit' : 'hit', { rate: e.kind === 'atk' ? 1.1 : .9 });
    sfx(HIT_SFX[e.el] || 'hit-star', { rate: e.kind === 'atk' ? 1.2 : 1 });
    if (e.who === 'me') sfx('hurt', { rate: 1.05 });
    if (e.crit) sfx('crit', { rate: 1.15 });
    if ((e.kind === 'skill' || e.kind === 'skill2') && !e.tick) shakeField(false);
  }
  if (e.who === 'me' && e.kind !== 'atk' && !poison && !e.tick) buzz(30);
  if (e.crit && !poison) critFx(px(e.x, e.y - 8));
  if (e.who === 'foe' && e.combo >= 2) combo(e.combo);
  if (e.last) finale(e);
}
function flash(body) {
  const img = body?.querySelector('.ar-flash'); if (!img) return;
  try { img.animate([{ opacity: .95 }, { opacity: .95, offset: .5 }, { opacity: 0 }], { duration: 110, easing: 'ease-out' }); } catch {}
}
// 큰 데미지 숫자: 미리 만든 칸 8개를 돌려 쓴다(새 조각을 만들지 않는다). 스킬은 속성 색, 치명타는 노랑 + 💥.
function dmgNum(e) {
  const i = R.numN++ % DMG_MAX, el = $(`ar-num-${i}`); if (!el) return;
  const p = px(e.x + (((R.numN * 37) % 9) - 4), e.y - 16), P = pal(e.el);
  const big = e.kind === 'ult' ? 'ult' : e.kind === 'atk' ? 'atk' : e.kind === 'poison' || e.kind === 'burn' ? 'poison' : e.tick ? 'atk' : 'skill';
  el.className = `ar-num ${big}${e.crit ? ' crit' : ''}${e.who === 'me' ? ' me' : ''}`;
  el.style.setProperty('--c1', P.c1);
  el.textContent = e.blocked && !e.dmg ? '막음!' : `${e.crit ? '💥' : ''}${e.dmg}`;
  el.style.translate = `${Math.round(p.x)}px ${Math.round(p.y)}px`;
  const k = big === 'ult' ? 1.7 : e.crit ? 1.6 : big === 'skill' ? 1.45 : 1.3;
  try { el.animate([{ transform: 'translate(-50%,-30%) scale(.4)', opacity: 0 }, { transform: `translate(-50%,-70%) scale(${k})`, opacity: 1, offset: .14 }, { transform: 'translate(-50%,-80%) scale(1)', opacity: 1, offset: .32 }, { transform: 'translate(-50%,-80%) scale(1)', opacity: 1, offset: .7 }, { transform: 'translate(-50%,-170%) scale(.9)', opacity: 0 }], { duration: big === 'ult' ? 1150 : 900, easing: 'ease-out', fill: 'forwards' }); } catch {}
  if (e.crit) pop('치명타!', e.x, e.y - 30, 'crit');
}
function combo(n) {
  const el = $('ar-combo'), b = $('ar-combo-n'); if (!el || !b) return;
  b.textContent = String(n);
  el.classList.toggle('hot', n >= 5);
  try { el.animate([{ transform: 'scale(1.5)', opacity: 1 }, { transform: 'scale(1)', opacity: 1, offset: .15 }, { transform: 'scale(1)', opacity: 1, offset: .8 }, { transform: 'scale(.9)', opacity: 0 }], { duration: 2000, easing: 'ease-out', fill: 'forwards' }); } catch {}
  if (n >= 3) sfx('combo', { rate: Math.min(1.5, 0.9 + n * 0.05) });
}
// 판을 끝내는 한 방: 0.6초 느리게 + 줌.
function finale(e) {
  if (R.finale) return;
  R.finale = true;
  const at = px(e.x, e.y), f = arenaEl();
  zoomAt(at, 0.1, 900);
  later(() => { try { f?.getAnimations({ subtree: true }).forEach(a => { a.playbackRate = 0.35; }); } catch {} }, 30);
}
function spark(at, el) {
  const P = pal(el);
  fxEl('spark', { left: `${at.x}px`, top: `${at.y}px`, '--c1': P.c1, '--c2': P.c2 }, 320);
}
function swapPose(body, src, ms) {
  const img = body?.querySelector('img'); if (!img || !src) return;
  const still = img._still ||= img.getAttribute('src');
  if (img.getAttribute('src') !== src) img.setAttribute('src', src);
  clearTimeout(img._t);
  img._t = setTimeout(() => img.setAttribute('src', still), ms);
  img.onerror = () => { img.onerror = null; img.setAttribute('src', still); };
}
function fxEl(cls, css, ms, html = '') {
  const f = $('ar-field'); if (!f) return null;
  if (R.fxN >= (R.lite ? FX_MAX_LITE : FX_MAX)) return null; // 효과 조각 상한(렉 방지): 보통 40 · 저사양 20
  R.fxN++;
  const el = document.createElement('div');
  el.className = `ar-fx ${cls}`;
  for (const [k, v] of Object.entries(css)) k.startsWith('--') ? el.style.setProperty(k, v) : (el.style[k] = v);
  el.innerHTML = html;
  f.appendChild(el);
  const cur = R;
  setTimeout(() => { el.remove(); if (cur.fxN > 0) cur.fxN--; }, ms);
  return el;
}
function beam(from, to, el, big) {
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.sqrt(dx * dx + dy * dy), ang = Math.atan2(dy, dx) * 180 / Math.PI, P = pal(el);
  fxEl(`beam${big ? ' big' : ''}`, { left: `${from.x}px`, top: `${from.y}px`, width: `${len}px`, transform: `rotate(${ang}deg)`, '--c1': P.c1, '--c2': P.c2, '--c3': P.c3 }, big ? 700 : 380);
}
function slash(at, nx, ny, el) {
  const P = pal(el), ang = Math.atan2(ny, nx) * 180 / Math.PI;
  fxEl('claw', { left: `${at.x + nx * 30}px`, top: `${at.y + ny * 24 - 20}px`, transform: `translate(-50%,-50%) rotate(${ang}deg)`, '--c1': P.c1, '--c2': P.c2 }, 300);
}
function quake(at, el, big) {
  const P = pal(el);
  fxEl(`quake${big ? ' big' : ''}`, { left: `${at.x}px`, top: `${at.y}px`, '--c1': P.c1, '--c2': P.c2 }, 700);
  fxEl('crack', { left: `${at.x}px`, top: `${at.y}px` }, 900);
}
/* ---------- V13.229 새 스킬 연출(화끈하고 화려하게, 조각 수는 예산 안) ---------- */
// 스킬 하나가 만드는 조각: 보통 8개 · 저사양 4개까지.
const skillCap = n => Math.min(n, R.lite ? SKILL_FX_LITE : SKILL_FX);
// 작은 조각 n개를 둘레로 흩뿌린다(--dx · --dy만 다르고 움직임은 CSS transform · opacity). 방향은 미리 정한 고른 각도.
const SPREAD = Array.from({ length: 8 }, (_, i) => [Math.cos(i * 2.39996), Math.sin(i * 2.39996)]);
function bits(cls, at, n, dist, ms, el) {
  const P = pal(el), k = skillCap(n);
  for (let i = 0; i < k; i++) {
    const [cx, cy] = SPREAD[(i + (R.numN || 0)) % 8], d = dist * (0.6 + (i % 3) * 0.2);
    fxEl(`bit ${cls}`, { left: `${Math.round(at.x)}px`, top: `${Math.round(at.y)}px`, '--dx': `${Math.round(cx * d)}px`, '--dy': `${Math.round(cy * d * 0.7)}px`, '--c1': P.c1, '--c2': P.c2, '--d': `${i * 30}ms` }, ms + i * 30);
  }
}
function ring(at, el, r = 14) {
  const P = pal(el), k = r * 2 / 100 * geo().w / ZONE_BASE;
  fxEl('ring', { left: `${Math.round(at.x)}px`, top: `${Math.round(at.y)}px`, '--c1': P.c1, '--c2': P.c2, '--k': k.toFixed(2) }, 600);
}
function critFx(at) {
  const art = artOf('crit');
  fxEl(`critburst${art ? ' art' : ''}`, { left: `${Math.round(at.x)}px`, top: `${Math.round(at.y)}px`, '--art': art || 'none' }, 520);
}
function healFx(e) {
  const now = performance.now();
  if (now - (R.healAt || 0) < 400) return; R.healAt = now;
  bits('leafbit', px(e.x, e.y - 6), 3, 22, 700, 'leaf');
  pop('+회복', e.x, e.y - 24, 'heal');
}
// 경기장을 잠깐 속성 색으로(미리 만든 물들이기 칸을 다시 쓴다).
function washFlash(el, peak = .5, ms = 220) {
  const wash = $('ar-wash'); if (!wash || reduced()) return;
  const P = pal(el); wash.style.setProperty('--c1', P.c1); wash.style.setProperty('--c2', P.c2);
  try { wash.animate([{ opacity: 0 }, { opacity: peak, offset: .2 }, { opacity: 0 }], { duration: ms }); } catch {}
}
function skill2Fx(e) {
  const at = px(e.x, e.y), s = R.cur[e.who], f = s?.team?.[s.idx];
  const src = f && expressionSrc(f.key, R.forms[e.who][s.idx], 'attack');
  if (poseReady(src)) swapPose($(`ar-${e.who}-body`), src, 400);
  const id = e.id;
  if (id === 'breath') { sfx('ult-riser', { rate: 1.6, volume: .7 }); sfx('atk-star', { rate: .6 }); later(() => { const t = px(e.x + e.nx * 16, e.y + e.ny * 16); fxEl('scorch', { left: `${Math.round(t.x)}px`, top: `${Math.round(t.y)}px` }, 1600); }, 300); return; }
  if (id === 'meteor') { const t = px(e.tx, e.ty), art = artOf('meteor'); fxEl(`meteorfall${art ? ' art' : ''}`, { left: `${Math.round(t.x)}px`, top: `${Math.round(t.y)}px`, '--art': art || 'none', '--fall': `${e.warn * ARENA.TICK_MS}ms` }, e.warn * ARENA.TICK_MS + 60); sfx('swoosh', { rate: .6 }); return; }
  if (id === 'jet' || id === 'vine' || id === 'chain') { bits('charge', at, 4, 14, 260, e.el); sfx(id === 'chain' ? 'hit-star' : 'swoosh', { rate: id === 'jet' ? .7 : 1.3 }); return; }
  if (id === 'bubble') { aura(e.who, e.el); bits('drop', px(e.x, e.y - 10), 5, 26, 520, 'water'); sfx('skill', { rate: 1.3 }); return; }
  if (id === 'petal') { bits('petalbit', px(e.x, e.y), 6, 40, 900, 'leaf'); sfx('skill', { rate: 1.1 }); return; }
  if (id === 'crack' || id === 'icefield' || id === 'cloud') { const t = px(e.tx, e.ty); bits(id === 'crack' ? 'rock' : id === 'icefield' ? 'frost' : 'puff', t, 5, 34, 600, e.el); if (id === 'crack') { shakeField(false); sfx('smash', { rate: .8 }); } else sfx('swoosh', { rate: .9 }); return; }
  if (id === 'tornado') { bits('leafbit', at, 4, 20, 500, 'wind'); sfx('swoosh', { rate: .55 }); return; }
  if (id === 'boulder') { sfx('smash', { rate: .6 }); bits('dust', at, 4, 18, 420, 'earth'); return; }
  if (id === 'gale') { afterimage(e.who); slash(at, e.nx, e.ny, e.el); sfx('swoosh', { rate: 1.2 }); return; }
  if (id === 'spear' || id === 'darts') { bits('charge', at, 3, 12, 220, e.el); sfx(id === 'spear' ? 'hit-star' : 'swoosh', { rate: 1.5 }); return; }
  if (id === 'clone') { bits('star', px(e.x - e.ny * 9, e.y + e.nx * 9), 6, 26, 640, 'star'); sfx('skill', { rate: 1.4 }); return; }
}
// 굵은 줄기(물대포 · 덩굴 · 번개): 미리 만든 칸 2개를 번갈아 쓴다. 자리 · 방향은 translate · rotate, 길이는 scale.
function streamFx(e) {
  const i = (R.streamN = ((R.streamN || 0) + 1) % STREAM_MAX), el = $(`ar-stream-${i}`); if (!el) return;
  const g = geo(), from = px(e.x, e.y), len = e.len / 100 * g.w, wide = Math.max(0.5, e.w * 2 / 100 * g.w / 20), P = pal(e.el), art = artOf(e.id);
  el.className = `ar-stream on ${e.id}${art ? ' art' : ''}`;
  el.style.setProperty('--c1', P.c1); el.style.setProperty('--c2', P.c2); el.style.setProperty('--art', art || 'none');
  el.style.translate = `${Math.round(from.x)}px ${Math.round(from.y - 12)}px`;
  el.style.rotate = `${angOf(e.nx, e.ny).toFixed(1)}deg`;
  el.style.transform = `scale(${(len / LINE_BASE).toFixed(3)}, ${wide.toFixed(2)})`;
  try { el.animate([{ opacity: 0, scale: '.1 1' }, { opacity: 1, scale: '1 1.2', offset: .18 }, { opacity: 1, scale: '1 1', offset: .65 }, { opacity: 0, scale: '1 .4' }], { duration: e.id === 'chain' ? 300 : 460, easing: 'ease-out' }); } catch {}
  const end = e.hit ? px(e.tx, e.ty) : px(e.x + e.nx * e.len, e.y + e.ny * e.len);
  if (e.id === 'jet') { bits('drop', end, 6, 40, 520, 'water'); if (e.hit) fxImpact(arenaEl(), end, 'water', 2); sfx('smash', { rate: 1.2 }); }
  else if (e.id === 'vine') { bits('leafbit', end, 5, 26, 600, 'leaf'); sfx('atk-leaf', { rate: .8 }); }
  else { washFlash('star', .35, 140); bits('spark', end, 4, 24, 320, 'star'); sfx('hit-star', { rate: .7 }); }
  if (e.hit && e.who === 'foe') buzz(25);
}
function meteorBoom(e) {
  const at = px(e.x, e.y);
  quake(at, 'flame', true);
  ring(at, 'flame', e.r);
  nextFrame(() => bits('ember', at, 8, 60, 640, 'flame'));
  shakeField(true); zoomAt(at, 0.06, 480); sfx('ult-impact', { rate: 1.2 }); sfx('smash');
  if (R.cur.me && Math.abs(R.cur.me.x - e.x) < e.r + 5 && Math.abs(R.cur.me.y - e.y) < e.r + 5) buzz([30, 20, 40]);
}
// 필살기 속성 연출(컷인 뒤 터질 때 덧붙인다, 조각은 8개 · 저사양 4개까지). 예: 화염 폭풍 = 불 뿜기 큰 버전 + 운석 3개.
function ultExtra(e, from, to) {
  const el = e.el, P = pal(el);
  const big = cls => fxEl(`ultfx ${cls}`, { left: `${Math.round(to.x)}px`, top: `${Math.round(to.y)}px`, '--c1': P.c1, '--c2': P.c2, '--c3': P.c3, '--art': artOf({ flame: 'breath', water: 'jet', leaf: 'vine', earth: 'crack', wind: 'tornado', ice: 'icefield', toxic: 'cloud', star: 'chain' }[el]) || 'none' }, 1100);
  washFlash(el, .55, 700);
  if (el === 'flame') { big('firestorm'); for (const [dx, dy] of [[-40, -10], [36, -18], [4, 26]].slice(0, R.lite ? 1 : 3)) fxEl('meteorfall mini', { left: `${Math.round(to.x + dx)}px`, top: `${Math.round(to.y + dy)}px`, '--art': artOf('meteor') || 'none', '--fall': '420ms' }, 480); later(() => bits('ember', to, 6, 70, 700, 'flame'), 420); return; }
  if (el === 'water') { big('wave'); bits('drop', to, 8, 80, 760, 'water'); return; }
  if (el === 'leaf') { big('vines'); bits('petalbit', to, 8, 70, 900, 'leaf'); return; }
  if (el === 'earth') { big('cracks'); bits('rock', to, 8, 70, 720, 'earth'); return; }
  if (el === 'wind') { big('twister'); bits('leafbit', to, 8, 60, 800, 'wind'); return; }
  if (el === 'ice') { big('frostburst'); bits('frost', to, 8, 70, 760, 'ice'); return; }
  if (el === 'toxic') { big('miasma'); bits('puff', to, 8, 60, 900, 'toxic'); return; }
  big('starfall'); bits('star', to, 8, 80, 800, 'star'); washFlash('star', .7, 200);
}
function afterimage(who) {
  const mon = $(`ar-${who}`); if (!mon) return;
  const ghost = mon.cloneNode(true);
  ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
  ghost.classList.add('ghost');
  mon.parentElement?.appendChild(ghost);
  setTimeout(() => ghost.remove(), 320);
}
function aura(who, el) {
  const mon = $(`ar-${who}`); if (!mon) return;
  mon.style.setProperty('--c1', pal(el).c1);
  mon.classList.remove('buffing'); requestAnimationFrame(() => mon.classList.add('buffing'));
}
// 글자: left/top 대신 translate로 자리 잡는다(배치를 다시 하지 않게).
function pop(text, x, y, cls = '') {
  const p = px(x, y);
  return fxEl(`pop ${cls}`, { translate: `${Math.round(p.x)}px ${Math.round(p.y)}px` }, cls.includes('count') ? 950 : cls.includes('hint') ? 1800 : 1000, esc(text));
}
function faintFx(e) {
  const fieldEl = $('ar-field'); if (!fieldEl) return;
  const p = px(e.x, e.y);
  const ghost = document.createElement('div');
  ghost.className = 'ar-fx ar-down-ghost';
  ghost.style.left = `${p.x}px`; ghost.style.top = `${p.y}px`;
  ghost.innerHTML = petImg(e.key, R.forms[e.who][e.idx], 'ar-pet-img');
  fieldEl.appendChild(ghost); setTimeout(() => ghost.remove(), 1000);
  const img = document.createElement('img');
  img.className = 'ar-faint'; img.src = '/assets/arena/fx-faint.webp'; img.alt = ''; img.onerror = () => img.remove();
  img.style.left = `${p.x}px`; img.style.top = `${p.y}px`;
  fieldEl.appendChild(img); later(() => img.remove(), 1400);
}
function banner(text, who) {
  const el = document.createElement('div');
  el.className = `ar-banner ${who}`; el.textContent = text;
  $('ar-play')?.appendChild(el);
  later(() => el.remove(), 1500);
}

/* ---------- 잠깐 멈춤 ---------- */
function pause() { if (!R?.playing || R.paused || R.live || R.replay) return; R.paused = true; R.pauseAt = performance.now(); R.holdAtk = false; R.dir = 0; R.drag = null; hideAim(); drawStick(0, 0); }
function resume() { if (!R?.paused) return; R.pausedMs += performance.now() - R.pauseAt; R.paused = false; }
function onVisibility() { if (document.hidden) pause(); else if (!document.querySelector('.ar-quit')) resume(); }

/* ---------- 끝 ---------- */
async function end() {
  R.playing = false; R.holdAtk = false; R.drag = null; hideAim();
  cancelAnimationFrame(R.raf);
  place(1);
  const local = R.sim.S.winner;
  if (R.replay) {
    banner(local === 'me' ? '승리!' : local === 'draw' ? '무승부' : '패배…', local === 'me' ? 'me win' : 'foe');
    await wait(1400);
    return stopReplay();
  }
  if (R.live) return liveEnd(local);
  // 마지막 한 방이면 0.6초 느리게 보여 준 뒤 배너.
  if (R.finale && !reduced()) { await wait(650); if (!R) return; }
  banner(local === 'me' ? '승리!' : local === 'draw' ? '무승부' : '패배…', local === 'me' ? 'me win' : 'foe');
  sfx(local === 'me' ? 'fanfare-epic' : 'fail');
  await wait(1400);
  if (!R) return;
  main('<div class="ar-saving">기록하는 중…</div>');
  let res = null;
  try { res = await api('/games/arena/finish', { id: R.r.id, inputs: R.inputs }); }
  catch (err) { res = { paid: false, reason: 'error', error: err.message }; }
  if (!R) return;
  if (res?.stats) Object.assign(R.A.data.stats, res.stats);
  if (typeof res?.points_balance === 'number') R.A.data.stats.points_balance = res.points_balance;
  R.view = { ...R.view, left: res?.left ?? R.view?.left, tickets: res?.tickets ?? R.view?.tickets, wins: res?.wins ?? R.view?.wins, streak: res?.streak ?? R.view?.streak, best_streak: res?.best_streak ?? R.view?.best_streak };
  R.A.data.rewards ||= {}; R.A.data.rewards.arena = R.view;
  keepReplay();
  result(local, res);
}
// 친구 대전 끝: 배너 → 방이 메인에서 받아 온 정산(두 조작 기록으로 서버가 다시 돌린 결과)을 기다린다(최대 12초).
async function liveEnd(local) {
  const L = R.live;
  if (R.finale && !reduced()) { await wait(650); if (!R) return; }
  banner(local === 'me' ? '승리!' : local === 'draw' ? '무승부' : '패배…', local === 'me' ? 'me win' : 'foe');
  sfx(local === 'me' ? 'fanfare-epic' : 'fail');
  await wait(1400);
  if (!R || R.live !== L) return;
  main('<div class="ar-saving">서버가 두 친구의 조작 기록으로 결과를 확인하는 중…</div>');
  for (let i = 0; i < 48 && R?.live === L && !L.res; i++) await wait(250);
  if (!R || R.live !== L) return;
  const res = L.res || { paid: false, reason: 'pending' };
  L.done = true;
  if (typeof res.points_balance === 'number') R.A.data.stats.points_balance = res.points_balance;
  R.view = { ...R.view, left: res.left ?? R.view?.left, tickets: res.tickets ?? R.view?.tickets, live_wins: res.lw ?? R.view?.live_wins, pairs: res.pairs ?? R.view?.pairs, live_room: null };
  R.A.data.rewards ||= {}; R.A.data.rewards.arena = R.view;
  keepReplay();
  result(local, res);
  // 결과 화면에서 친구의 '한 판 더' 초대를 20초마다 확인한다(3분까지 · 화면이 보일 때만, 기존 홈 확인과 같은 GET).
  let n = 0;
  L.invitePoll = setInterval(async () => {
    if (R?.live !== L || ++n > 9) return clearInterval(L.invitePoll);
    if (document.hidden || R.playing) return;
    try { const { arena_invite: inv } = await api('/battle/invite'); if (inv && R?.live === L && !R.playing) { R.A.data.arena_invite = inv; const box = $('ar-res-invite'); if (box) { box.innerHTML = `<b>⚔️ ${esc(inv.host)}의 한 판 더!</b><button type="button" class="btn primary" data-ar="live-accept" data-id="${esc(inv.id)}">받기</button>`; box.classList.add('on'); sfx('tap'); buzz(60); } } } catch {}
  }, 20000);
}
function result(local, res) {
  R.lastResult = [local, res];
  const winner = res?.winner || local, win = winner === 'me', coins = Number(res?.coins || 0), xp = Number(res?.xp || 0);
  const mine = R.sim.mine ? R.sim.mine() : { ko: R.cur.ko.me, dealt: R.cur.dealt.me, ults: R.cur.ults.me, team: R.cur.me.team.map(f => f.cur) };
  const ko = res?.ko ?? mine.ko, dealt = res?.dealt ?? mine.dealt, live = !!R.live;
  const why = res?.reason === 'daily' ? `오늘 코인 판(${ARENA.DAILY}판)을 다 썼어요. 기록은 남아요!`
    : res?.reason === 'pair' ? '같은 친구와는 하루 2판까지 코인을 받아요. 다른 친구와도 겨뤄 봐요!'
    : res?.reason === 'idle' ? '한쪽이 거의 움직이지 않은 판이라 둘 다 보상이 없어요.'
    : res?.reason === 'away' ? '연결이 끊겨 컴퓨터가 절반 넘게 대신 싸워서 보상이 없어요.'
    : res?.reason === 'grade' ? '같은 학년 친구끼리만 보상을 받아요.'
    : res?.reason === 'pending' ? '결과를 확인하고 있어요. 잠시 뒤 놀이터에서 코인을 확인해 주세요.'
    : res?.reason === 'ticket' ? '입장권이 없어서 연습 판이었어요. 단어 연습을 끝까지 풀면 입장권을 받아요!'
    : res?.reason === 'error' ? esc(res.error || '저장하지 못했어요.')
    : res?.reason === 'short' || res?.reason === 'stale' ? '이번 대전은 기록되지 않았어요.'
    : !win && res?.paid && !coins ? '상대 펫을 한 마리라도 쓰러뜨리면 져도 코인을 받아요.' : '';
  const team = R.r.me;
  main(`<section class="ar-result ${win ? 'win' : 'lose'}">
    <div class="ar-res-card">
      <div class="ar-res-head">${winner === 'draw' ? '' : artImg(win ? 'banner-win' : 'banner-lose', 'ar-res-banner')}<h2>${win ? '승리!' : winner === 'draw' ? '무승부' : '아쉬운 패배'}</h2><p>${live ? '친구 대전 · ' : ''}vs ${esc(R.r.foe.name)}${res?.streak >= 2 && win && !live ? ` · <b>${res.streak}연승!</b>` : ''}</p></div>
      <div class="ar-res-team">${team.map((f, n) => `<span style="--i:${n}" class="${mine.team[n] <= 0 ? 'down' : ''}">${petImg(f.key, f.form)}</span>`).join('')}</div>
      <div class="ar-res-rows"><span><small>쓰러뜨림</small><b>${num(ko)}</b></span><span><small>준 피해</small><b>${num(dealt)}</b></span><span><small>필살기</small><b>${res?.ults ?? mine.ults}</b></span></div>
      ${coins || xp ? `<div class="ar-res-gain">${coins ? `<span class="r coin">${coin()}<b>+${num(coins)}</b>${res?.streak_coins ? `<small>3연승 +${res.streak_coins} 포함</small>` : ''}</span>` : ''}${xp ? `<span class="r xp"><b>+${xp}</b><small>경험치</small></span>` : ''}</div>` : ''}
      ${why ? `<p class="ar-why">${why}</p>` : ''}
      <p class="ar-tip">${live ? (win ? `친구 대전 ${num(res?.lw || 0)}승! 이모트로 인사해요 👋` : '다시 보기로 친구가 어떻게 싸웠는지 살펴봐요!') : win ? '다음 판은 상대가 더 똑똑해질 수 있어요!' : '팁: 빨간 표시가 뜨면 회피! 상성이 좋은 펫으로 교체해 보세요.'}</p>
      ${live ? `<div class="ar-res-emo" aria-hidden="true"><span><span class="ar-emo" id="ar-emo-seat-me"></span><small>나</small></span><span><span class="ar-emo" id="ar-emo-seat-foe"></span><small>${esc(R.r.foe.name)}</small></span></div><div class="ar-emo-row" role="group" aria-label="이모트">${LIVE.EMOTES.map((e, i) => `<button type="button" data-ar="emote-i" data-i="${i}">${esc(e)}</button>`).join('')}</div><div class="ar-invite" id="ar-res-invite"></div>` : ''}
      <div class="ar-res-btns">${R.replayData ? '<button type="button" class="btn full" data-ar="replay">🎬 다시 보기</button>' : ''}<button type="button" class="yl-cta" data-ar="again">${live ? '친구 대전 한 판 더' : '한 판 더'}</button><button type="button" class="btn full" data-ar="exit">놀이터로</button></div>
    </div>
  </section>`);
  artGuard();
  if (coins) { later(() => { sfx('coins'); coinShower(app(), 22); const b = $('ar-coins'); if (b) countUp(b, Number(R.A.data.stats?.points_balance || 0), 900); }, 500); }
}

// 상성표(도움말 · 검사용): '불꽃 → 풀 · 얼음'.
export const beatsText = () => Object.entries(BEATS).filter(([, v]) => v.length).map(([k, v]) => `${ELEMENTS[k].name} → ${v.map(x => ELEMENTS[x].name).join(' · ')}`);
