import { api, esc, icon, toast, num, rangeLabel } from './ui.js';
import { CHARACTERS, PET_FORMS } from './core.js';
import { avatar, petKey, showPose, holdPose } from './character.js';
import { getRanges } from './student.js';
import { petJosa } from './pet-moments.js';
import { startPractice } from './sessions.js';
import { TITLES, TITLE_KEYS, titleProgress } from './titles.js';
import { titleBadge, titleEmblem, tierEmblem, coin, trophy, artOr, uiArt } from './emblems.js';
import { titleState, openTitleDetail } from './titles-ui.js';
import { mountLeagueBoard, clearLeagueCache, shownTitle } from './league-ui.js';
import { createPracticeMatch, practiceQuestions, BOT_LEVELS } from './battle-bot.js';
import { BATTLE, BATTLE_MODES, PET_SKILLS, PET_SKILL_NEED, petSkill } from './battle-engine.js';
import { BOT_WIN_REWARDS, BOT_TRY_REWARD, BOT_DAILY, BOT_MIN_RIGHT } from './rewards.js';
import { tournamentCard, openBracket } from './tournament-ui.js';
import { MONSTERS, MONSTER_ART, MONSTER_LEVELS, MONSTER_LEVEL_KEYS, MONSTER_DAILY, MONSTER_TRY, monsterParts, monsterOpen } from './monsters.js';

// Yacha battle screens: lobby (create / join / practice, league, my record), waiting room,
// the match, and the result. A match runs in a battle room on the server (or, for a practice
// match, on the phone: battle-bot.js); this module only draws what the room says and sends
// answers. Pet skills fire by themselves (V13.72). It owns #app while A.screen === 'battle'.

const STAKES = [10, 30, 50];
// V13.94: full HP comes with the match (250; a room started before V13.94 had 100).
const maxHp = () => B?.view?.max_hp || 100;
const matchMs = mode => BATTLE_MODES[mode === 'skill' ? 'skill' : 'speed'].match_ms;
const clockText = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const minutesText = ms => `${Math.floor(ms / 60000) ? `${Math.floor(ms / 60000)}분` : ''}${ms % 60000 ? ` ${Math.round(ms % 60000 / 1000)}초` : ''}`.trim();
// V13.72 "3번 연속 맞히면" (토리: 2번).
const skillWhen = s => `${s.need}번 연속 맞히면`;
// Why a match ended, from the point of view of the player reading the result.
const REASONS = { end: () => '시간 종료', forfeit: mine => mine ? '대결을 포기했어요' : '상대가 대결을 포기했어요', disconnect: mine => mine ? '연결이 끊겨 패배했어요' : '상대의 연결이 끊겼어요', cancelled: () => '대결이 취소됐어요' };

// V13.82: who won a match that ended on equal HP.
const TIEBREAKS = {
  ko_first: mine => mine ? '먼저 쓰러뜨려서 이겼어요' : '상대가 먼저 쓰러뜨렸어요',
  correct: mine => mine ? '더 많이 맞혀서 이겼어요' : '상대가 더 많이 맞혔어요',
  speed: mine => mine ? '정답 속도가 더 빨라서 이겼어요' : '상대의 정답 속도가 더 빨랐어요'
};
const EMOTES = { lol: 'ㅋㅋ', come: '덤벼!', gg: 'GG', nice: '좋았어!' };
// V13.67 modes: 스피드전 (the original) and 실력전 (spelling words on an in-app keyboard).
const MODE_ICONS = {
  speed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  skill: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 1-4L16 5l3 3L8 19zM14 7l3 3"/></svg>'
};
const modeName = mode => BATTLE_MODES[mode === 'skill' ? 'skill' : 'speed'].name;
const modeTag = mode => `<span class="yb-mode-tag ${mode === 'skill' ? 'skill' : 'speed'}">${MODE_ICONS[mode === 'skill' ? 'skill' : 'speed']}${modeName(mode)}</span>`;
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const REMATCH_MS = 2 * 60000;

let B = null; // current screen state

/* ---------- sound and vibration (one switch, remembered on this phone) ---------- */
const pref = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const setPref = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
const soundOn = () => pref('sumus-yacha-sound', 'on') === 'on';
const emotesShown = () => pref('sumus-yacha-emotes', 'on') === 'on';
let audio = null;
// Short synthesized tones: no sound files to download. iPhones ignore vibration.
const SFX = {
  tick: [[880], { len: .08, vol: .035 }], go: [[660, 990], {}],
  hit: [[520, 780], { type: 'triangle' }], crit: [[520, 780, 1040], { type: 'square', vol: .03 }],
  hurt: [[190, 120], { type: 'sawtooth', vol: .035, len: .18 }], wrong: [[220], { type: 'square', vol: .03, len: .2 }],
  skill: [[660, 880, 1320], { gap: .05 }], fever: [[440, 660, 880, 1100], { type: 'square', gap: .06, vol: .03 }],
  win: [[523, 659, 784, 1047], { gap: .1, len: .22 }], lose: [[392, 330, 262], { gap: .14, len: .26, type: 'triangle' }],
  emote: [[990], { len: .06, vol: .025 }]
};
function unlockAudio() {
  if (!soundOn()) return;
  try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch {}
}
function sfx(name, buzz = 0) {
  if (!soundOn()) return;
  const [notes, { type = 'sine', gap = .07, len = .14, vol = .045 } = {}] = SFX[name] || [[]];
  try {
    unlockAudio();
    const t0 = audio.currentTime;
    notes.forEach((f, i) => {
      const o = audio.createOscillator(), g = audio.createGain(), t = t0 + i * gap;
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + len);
      o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + len + .02);
    });
  } catch {}
  if (buzz) try { navigator.vibrate?.(buzz); } catch {}
}

// V13.68: the lobby is drawn inside the 야차전 tab (`host`, with the app's menu around it);
// a room or a match takes the whole screen (#app).
let host = null;
const root = () => host || document.getElementById('app');
const serverNow = () => Date.now() + (B?.clockOffset || 0);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Timers that draw on this screen; they do nothing once the screen (or a newer one) took over.
function later(fn, ms) {
  const cur = B;
  const id = setTimeout(() => { if (B === cur && !cur.closing) fn(); }, ms);
  cur.timers = [...(cur.timers || []), id];
}
const petName = pet => pet?.name || CHARACTERS[petKey(pet?.key)]?.ko || '';
// V13.94 몬스터 잡기: a monster's picture (its own art once it arrives, until then a pet picture
// recoloured), and who a player is in the match lines (a monster has no pet name).
// V13.95 the art sits in the same box as a pet picture (avatar-img), so showPose() can swap it.
function monsterPic(m, { size = '', pose = '' } = {}) {
  const mon = MONSTERS.find(x => x.key === m?.key) || MONSTERS[0];
  if (MONSTER_ART.has(mon.key)) return `<div class="avatar-art avatar-img mon-art ${size}" style="--pet-grow:1"><img src="/assets/monsters/${mon.key}${pose ? '-' + pose : ''}.webp" alt="${esc(mon.name)}" width="512" height="512" decoding="async" draggable="false"></div>`;
  return `<div class="mon-temp ${size}" style="--mon-filter:${mon.temp.filter};--mon-color:${mon.color}">${avatar(mon.temp.pet, { size, form: mon.temp.form })}</div>`;
}
const petArt = (p, opts = {}) => p?.monster ? monsterPic(p.monster, opts) : avatar(p?.pet?.key, { form: p?.pet?.form ?? 1, ...opts });
const whoName = p => p?.monster ? (MONSTERS.find(x => x.key === p.monster.key)?.name || p.name) : petName(p?.pet);

// opts.accept: a challenge from the home screen ({ code, stake, host }) to confirm right away.
// opts.tournament: { tid, mid } a tournament match to start or join (V13.66).
export async function openBattle(A, exit, opts = {}) {
  closeSocket();
  host = opts.embedded || null;
  B = { A, exit, embedded: !!host, stake: 10, ranges: null, joinCode: '', tab: opts.tab || A.yachaTab || 'play', botLevel: 'normal', mode: pref('sumus-yacha-mode', 'speed') === 'skill' ? 'skill' : 'speed' };
  root().innerHTML = shell('<div class="yb-loading">야차전을 준비하고 있어요…</div>');
  bindRoot();
  try {
    const [{ battle }, history] = await Promise.all([api('/battle/current'), api('/battle/history')]);
    B.history = history;
    if (battle) return enterRoom(battle);
    lobby();
    if (opts.accept) acceptChallenge(opts.accept);
    if (opts.tournament) playTournament(opts.tournament.tid, opts.tournament.mid);
  } catch (err) {
    toast(err.message);
    // V13.71: inside the 야차전 tab, leaving re-rendered the tab, which opened the lobby again and
    // failed again in a loop. Show the error in the tab and let the student retry instead.
    if (B?.embedded) {
      root().innerHTML = shell(`<div class="yb-loading yb-error-v1371"><p>야차전을 불러오지 못했어요.<br><small>${esc(err.message || '잠시 후 다시 시도해 주세요.')}</small></p><button type="button" class="btn primary" data-yb-retry>다시 시도</button></div>`);
      root().querySelector('[data-yb-retry]')?.addEventListener('click', () => openBattle(A, exit, opts));
      return;
    }
    leaveScreen();
  }
}

// The 야차전 tab: draws the lobby in `el` (a fresh element on every app render).
export function mountYacha(el, A, exit, opts = {}) {
  if (!el || el.dataset.mounted) return;
  el.dataset.mounted = '1';
  openBattle(A, exit, { ...(opts || {}), embedded: el });
}
// Leaves the tab for the full screen when a room opens or a match starts.
function goFull() {
  if (!B?.embedded) return;
  if (host) { host.onclick = null; host.oninput = null; }
  host = null;
  B.embedded = false;
  B.A.screen = 'battle';
  root().innerHTML = shell('');
  bindRoot();
  window.scrollTo(0, 0);
}
function shell(content) {
  if (B?.embedded) return `<div class="battle-app yb-embedded"><header class="yb-top yb-top-tab"><strong>야차전</strong><span class="yb-top-note" id="yb-top-note"></span><button type="button" class="yb-sound" data-yb="sound" aria-pressed="${soundOn()}" aria-label="효과음과 진동">${soundOn() ? '소리 켜짐' : '소리 꺼짐'}</button></header><main class="yb-main" id="yb-main">${content}</main></div>`;
  return `<div class="session-app battle-app"><header class="yb-top"><button type="button" class="yb-back" data-yb="exit" aria-label="나가기">${icon('back')}</button><strong>야차전</strong><span class="yb-top-note" id="yb-top-note"></span><button type="button" class="yb-sound" data-yb="sound" aria-pressed="${soundOn()}" aria-label="효과음과 진동">${soundOn() ? '소리 켜짐' : '소리 꺼짐'}</button></header><main class="yb-main" id="yb-main">${content}</main></div>`;
}
function main(html) { const m = document.getElementById('yb-main'); if (m) m.innerHTML = html; }

function bindRoot() {
  root().onclick = event => {
    // Tournament cards use the app's own data-action names; inside the battle screen they are
    // handled here (the app's click handler steps aside while a screen is open).
    const card = event.target.closest('[data-action="tournament-play"],[data-action="tournament-bracket"]');
    if (card && !card.disabled) return card.dataset.action === 'tournament-play' ? playTournament(card.dataset.tournament, card.dataset.match, card) : showBracket(card.dataset.tournament);
    const b = event.target.closest('[data-yb]'); if (!b || b.disabled) return;
    const act = b.dataset.yb;
    unlockAudio(); // phones start audio only from a tap
    if (act === 'sound') { setPref('sumus-yacha-sound', soundOn() ? 'off' : 'on'); b.setAttribute('aria-pressed', soundOn()); b.textContent = soundOn() ? '소리 켜짐' : '소리 꺼짐'; return; }
    if (act === 'emote') return sendEmote(b);
    if (act === 'emotes-toggle') { setPref('sumus-yacha-emotes', emotesShown() ? 'off' : 'on'); drawEmotes(); return; }
    if (act === 'rematch') return askRematch(b);
    if (act === 'offer-yes') return acceptOffer(b);
    if (act === 'offer-no') return declineOffer(b);
    if (act === 'review') return reviewWords();
    if (act === 'exit') return tryExit();
    if (act === 'home') { B.A.tab = 'home'; return leaveScreen(); }
    if (act === 'range') { toggleRange(b.dataset.code); return; }
    if (act === 'stake') { B.stake = Number(b.dataset.stake); lobby(); return; }
    if (act === 'range-mode') { setPref('sumus-yacha-range-mode', b.dataset.rangeMode === 'same' ? 'same' : 'each'); lobby(); return; }
    if (act === 'tab') { B.tab = B.A.yachaTab = b.dataset.tab; lobby(); window.scrollTo(0, 0); return; }
    if (act === 'bot-level') { B.botLevel = b.dataset.level; lobby(); return; }
    if (act === 'mode') { B.mode = b.dataset.mode === 'skill' ? 'skill' : 'speed'; setPref('sumus-yacha-mode', B.mode); lobby(); return; }
    if (act === 'key') return spellKey(b.dataset.key);
    if (act === 'spell-go') return spellSubmit();
    if (act === 'bot') return startBotMatch(b);
    if (act === 'bot-again') return botAgain();
    if (act === 'monster-go') return askMonster(b.dataset.part, b.dataset.level);
    if (act === 'monster-again') { const m = B.monsterSetup; nextScreen(); return m ? startMonster(m.part, m.level) : null; }
    if (act === 'monster-list') { B.A.tab = 'yacha'; B.A.yachaTab = 'monster'; return leaveScreen(); }
    if (act === 'title') return openTitleDetail(B.A, b.dataset.key);
    if (act === 'create') return createRoom(b);
    if (act === 'challenge') return pickFriend(b);
    if (act === 'join') return joinRoom(b);
    if (act === 'cancel') return cancelRoom(b);
    if (act === 'answer') return pickChoice(Number(b.dataset.choice), b);
    if (act === 'leave') return confirmLeave();
    if (act === 'again') { B.A.tab = 'yacha'; return leaveScreen(); }
  };
  root().oninput = event => { if (event.target.id === 'yb-code') B.joinCode = event.target.value.replace(/\D/g, '').slice(0, 6); };
}

/* ---------- lobby ---------- */
// V13.94: the ranges a student battles with are remembered on the phone. The first time they
// are the ranges picked on the 학습 screen (what the student is memorizing now).
const rangesKey = () => `sumus-yacha-ranges:${B.A.data.profile.id}`;
function lobbyRanges() {
  const A = B.A, grade = A.data.profile.class_name;
  const { words, codes, selected } = getRanges(A, A.school, grade);
  const counts = new Map(); for (const w of words) counts.set(w.range_code, (counts.get(w.range_code) || 0) + 1);
  if (!B.ranges) {
    let saved = []; try { saved = JSON.parse(pref(rangesKey(), '[]')); } catch {}
    const known = list => (Array.isArray(list) ? list : []).map(String).filter(code => codes.includes(code));
    const pick = [known(saved), known(selected)].find(list => list.reduce((n, c) => n + (counts.get(c) || 0), 0) >= 8);
    B.ranges = new Set(pick || codes.filter(c => (counts.get(c) || 0) >= 8).slice(0, 1));
  }
  return { codes, counts, studying: (selected || []).map(String) };
}
function toggleRange(code) { B.ranges.has(code) ? B.ranges.delete(code) : B.ranges.add(code); setPref(rangesKey(), JSON.stringify([...B.ranges])); lobby(); }
// V13.94 단어 범위: 'each' — a friend who studies another range gets the words of their own range
// on every turn; 'same' — the friend plays my words.
const rangeMode = () => pref('sumus-yacha-range-mode', 'each') === 'same' ? 'same' : 'each';
const myRanges = () => (B.ranges ? [...B.ranges] : []);
// What the joining student is told about the words before saying yes.
function rangeDeal(room) {
  const hostRanges = room.host_ranges || [], mine = myRanges();
  const same = !mine.length || (mine.length === hostRanges.length && mine.every(code => hostRanges.includes(code)));
  if (room.range_mode === 'each' && !same) return `<p class="ya-deal each"><b>각자 내 범위</b>로 겨뤄요.<span>나: ${esc(rangesText(mine))} · ${esc(room.host)}: ${esc(rangesText(hostRanges))}</span></p>`;
  return hostRanges.length ? `<p class="ya-deal"><b>${esc(rangesText(hostRanges))}</b> 단어로 겨뤄요.</p>` : '';
}

function lobby() {
  const A = B.A, g = A.data.stats, h = B.history || { record: { wins: 0, losses: 0, draws: 0 }, battles: [], lost_today: 0, daily_loss_cap: 150 };
  const tab = ['play', 'monster', 'league', 'me'].includes(B.tab) ? B.tab : 'play';
  const pet = g.pet, league = h.league || A.data.league, r = h.record;
  const played = r.wins + r.losses + r.draws;
  main(`
    <section class="ya-hero" aria-label="야차전">
      <div class="ya-hero-sky" aria-hidden="true"><i></i><i></i><i></i><b>夜叉</b></div>
      <div class="ya-hero-head">
        <span class="ya-kicker">${artOr('nav-yacha', '', 'ya-kicker-art')}1 : 1 단어 배틀</span>
        ${league?.tier ? `<button type="button" class="ya-league" data-yb="tab" data-tab="league" aria-label="이번 주 리그 ${esc(league.tier.name)} ${num(league.points)}점${league.rank ? ` ${league.rank}위` : ''}">${tierEmblem(league.tier.key, { size: 'sm' })}<span><b>${esc(league.tier.name)}</b><small>${num(league.points)}점${league.rank ? ` · ${league.rank}위` : ''}</small></span>${icon('chevron')}</button>` : ''}
      </div>
      <div class="ya-stage">
        <div class="ya-pet">${pet ? avatar(pet.key, { form: pet.form }) : ''}<i class="ya-floor" aria-hidden="true"></i></div>
        <div class="ya-hero-copy">
          <h1>${pet ? `${esc(petJosa(petName(pet), '과', '와'))}<br>출전 준비!` : '야차전'}</h1>
          <p>맞히면 공격, 빠르면 더 세게!<br>외우는 범위가 달라도 OK</p>
        </div>
      </div>
      <div class="ya-record" role="group" aria-label="내 전적">
        <div><b>${num(r.wins)}</b><span>승</span></div><div><b>${num(r.losses)}</b><span>패</span></div><div><b>${num(r.draws)}</b><span>무</span></div>
        <div class="ya-rate"><b>${played ? `${r.win_rate}%` : '—'}</b><span>승률</span></div>
        ${r.streak >= 2 ? `<div class="ya-streak">${uiArt('streak', 'ya-streak-art')}<b>${num(r.streak)}</b><span>연승 중</span></div>` : r.best_streak ? `<div class="ya-best"><b>${num(r.best_streak)}</b><span>최고 연승</span></div>` : ''}
      </div>
      ${petSkillChip(pet)}
    </section>
    <div class="ya-tabs" role="group" aria-label="야차전 메뉴">${[['play', '대결'], ['monster', '몬스터'], ['league', '리그'], ['me', '내 전적']].map(([key, label]) => `<button type="button" data-yb="tab" data-tab="${key}" class="${tab === key ? 'selected' : ''}" aria-pressed="${tab === key}">${key === 'monster' ? uiArt('monster-tab', 'ya-tab-art') : ''}${label}</button>`).join('')}</div>
    ${tab === 'league' ? `<div class="lg-board" data-league-board data-period="${B.leaguePeriod === 'all' ? 'all' : 'week'}" data-fresh="1"></div>` : tab === 'me' ? myRecord(h) : tab === 'monster' ? monsterTab() : playTab(h)}`);
  if (tab === 'league') mountLeagueBoard(document.querySelector('#yb-main [data-league-board]'), period => { B.leaguePeriod = period; });
}
// V13.72: what my pet does in a match, and what every pet does (the other player's too).
function petSkillChip(pet) {
  const s = petSkill(pet);
  if (s.key === 'none') return `<div class="ya-skill legend"><span class="ya-skill-ico" aria-hidden="true">✦</span><span><b>전설 펫</b><small>펫 특기 없이 실력으로 겨뤄요</small></span></div>`;
  return `<details class="ya-skill"><summary><span class="ya-skill-ico" aria-hidden="true">✦</span><span><b>${esc(s.name)}</b><small>${skillWhen(s)} 저절로 · ${esc(s.desc)}</small></span>${icon('chevron')}</summary>
    <p>버튼을 누르지 않아도 돼요. 틀리거나 시간이 지나면 게이지가 처음부터 다시 차요. 펫 레벨과 상관없이 세기는 같아요.</p>
    <ul>${Object.entries(PET_SKILLS).map(([key, x]) => `<li class="${key === s.key ? 'mine' : ''}"><span class="yb-skill-pet">${avatar(key, { size: 'mini', form: 1 })}</span><span><b>${esc(CHARACTERS[key]?.ko || '')} · ${esc(x.name)}</b><small>${x.need || PET_SKILL_NEED}번 연속 · ${esc(x.desc)}</small></span></li>`).join('')}</ul>
  </details>`;
}
const MODE_FACTS = {
  speed: ['4지선다', '빠를수록 세게'],
  skill: ['철자 쓰기 섞임', '정확도 승부']
};
function playTab(h) {
  const A = B.A, g = A.data.stats;
  const { codes, counts, studying } = lobbyRanges();
  // History is fetched each time the lobby opens, so its balance is fresher than stats.
  const balance = Number(h.points_balance ?? g.points_balance ?? 0), lossLeft = Math.max(0, h.daily_loss_cap - h.lost_today);
  const selectedWords = [...B.ranges].reduce((n, c) => n + (counts.get(c) || 0), 0);
  const wordsOk = B.ranges.size && selectedWords >= 8;
  const canCreate = wordsOk && balance >= B.stake && B.stake <= lossLeft;
  const each = rangeMode() === 'each';
  // Running tournaments, and finished ones for three days (their results).
  const tourneys = A.data.tournaments || [];
  const step = (n, title, aside = '') => `<div class="ya-step"><span class="ya-step-n">${n}</span><h3>${title}</h3>${aside ? `<small>${aside}</small>` : ''}</div>`;
  return `${tourneys.map(t => tournamentCard(t)).join('')}
    <div class="ya-play">
    <section class="ya-panel ya-setup" aria-label="대결 준비">
      ${step(1, '대결 방식')}
      <div class="ya-modes" role="group" aria-label="대결 방식">${Object.entries(BATTLE_MODES).map(([key, m]) => `<button type="button" class="ya-mode ${key} ${B.mode === key ? 'on' : ''}" data-yb="mode" data-mode="${key}" aria-pressed="${B.mode === key}">
        <span class="ya-mode-art">${artOr('mode-' + key, MODE_ICONS[key], 'mode-art')}</span>
        <b>${m.name}</b>
        <span class="ya-mode-facts"><i>${uiArt('stopwatch', 'ya-mini-art')}${minutesText(m.match_ms)}</i>${MODE_FACTS[key].map(f => `<i>${f}</i>`).join('')}</span>
        <span class="ya-check" aria-hidden="true">${icon('check')}</span>
      </button>`).join('')}</div>
      <p class="ya-hint">${B.mode === 'skill' ? '두 문제에 한 번은 <b>뜻을 보고 철자를 써요</b>. 쓰기 정답은 두 배로 세요.' : '뜻을 골라 공격해요. <b>2초 안에 맞히면 크리티컬!</b>'} 마지막 ${Math.round(BATTLE.FEVER_MS / 1000)}초는 피버 타임(공격력 ${BATTLE.FEVER_MULT}배).</p>

      ${step(2, '내 단어 범위', '대결에 나올 단어')}
      <p class="ya-explain">지금 외우고 있는 <b>단어장 번호</b>를 눌러 골라요. 여러 개 골라도 돼요.${studying.length ? ' <span class="ya-study-tag">학습 중</span>은 학습 화면에서 고른 범위예요.' : ''}</p>
      <div class="ya-ranges">${codes.map(c => `<button type="button" class="ya-chip ${B.ranges.has(c) ? 'on' : ''}" data-yb="range" data-code="${esc(c)}" aria-pressed="${B.ranges.has(c)}" aria-label="${esc(rangeLabel(A.data.profile.school, c))} ${counts.get(c) || 0}단어${studying.includes(c) ? ' 학습 중' : ''}">${studying.includes(c) ? '<i class="ya-chip-study">학습 중</i>' : ''}<b>${esc(rangeLabel(A.data.profile.school, c))}</b><small>${counts.get(c) || 0}단어</small><span class="ya-chip-check" aria-hidden="true">${icon('check')}</span></button>`).join('') || '<p class="yb-muted">학습할 단어 범위가 없어요.</p>'}</div>
      <div class="ya-picked ${wordsOk ? 'ok' : 'need'}" aria-live="polite">${B.ranges.size
        ? `${wordsOk ? icon('check') : '!'}<span><b>${esc(rangesText([...B.ranges]))}</b> · ${num(selectedWords)}단어${wordsOk ? '로 대결해요' : ' — 8단어 이상이 되게 더 골라 주세요'}</span>`
        : '!<span>위에서 단어장 번호를 하나 이상 눌러 주세요</span>'}</div>

      <div class="ya-sub">친구가 다른 번호를 외우고 있다면?</div>
      <div class="ya-rangemode" role="group" aria-label="친구 단어">
        ${[['each', '각자 내 범위', '추천', '나는 내 번호, 친구는 친구 번호 단어', B.ranges.size ? rangesText([...B.ranges]) : '24번', '친구 번호'], ['same', '같은 범위로', '', '친구도 내가 고른 번호 단어', B.ranges.size ? rangesText([...B.ranges]) : '24번', B.ranges.size ? rangesText([...B.ranges]) : '24번']].map(([key, title, badge, line, mine, theirs]) => `<button type="button" data-yb="range-mode" data-range-mode="${key}" class="ya-rm ${key} ${rangeMode() === key ? 'on' : ''}" aria-pressed="${rangeMode() === key}">
          <span class="ya-rm-duel" aria-hidden="true"><span class="ya-rm-side">${A.data.stats.pet ? avatar(A.data.stats.pet.key, { size: 'mini', form: Math.max(1, A.data.stats.pet.form) }) : ''}<em>${esc(mine)}</em></span><b>VS</b><span class="ya-rm-side friend"><i>?</i><em>${esc(theirs)}</em></span></span>
          <span class="ya-rm-title"><b>${title}</b>${badge ? `<i>${badge}</i>` : ''}</span><small>${line}</small>
        </button>`).join('')}
      </div>
      <p class="ya-hint">${each ? '같은 학년이면 외우는 부분이 달라도 괜찮아요. 매 턴 <b>둘 다 자기가 외우는 단어</b>가 나와서 공평해요.' : '친구가 내 번호를 같이 외웠을 때 좋아요.'}</p>

      ${step(3, '판돈', `가진 코인 ${num(balance)}`)}
      <div class="ya-stakes">${STAKES.map(s => `<button type="button" class="ya-stake ${B.stake === s ? 'on' : ''}" data-yb="stake" data-stake="${s}" aria-pressed="${B.stake === s}" aria-label="판돈 ${s}코인" ${balance < s || s > lossLeft ? 'disabled' : ''}>${coin()}<b>${s}</b></button>`).join('')}</div>
      <p class="ya-hint">이기면 +${num(B.stake)}, 지면 −${num(B.stake)}코인 · 오늘 더 잃을 수 있는 코인 ${num(lossLeft)}</p>

      <div class="ya-go">
        <button type="button" class="ya-cta" data-yb="challenge" ${canCreate ? '' : 'disabled'}>${artOr('nav-yacha', '', 'ya-cta-art')}<span><b>친구에게 도전장</b><small>${modeName(B.mode)} · 판돈 ${num(B.stake)}코인</small></span>${icon('arrow')}</button>
        <button type="button" class="ya-cta2" data-yb="create" ${canCreate ? '' : 'disabled'}>${icon('plus')}코드로 방 만들기</button>
      </div>
      <details class="ya-rules"><summary>HP와 승패 규칙</summary><p>HP ${num(BATTLE.MAX_HP)}에서 시작해요. 둘 다 맞히면 둘 다 공격해요. 시간이 끝나면 HP가 많은 쪽이 이기고, HP가 같으면 먼저 쓰러뜨린 쪽, 그다음 더 많이 맞힌 쪽, 그다음 더 빨리 맞힌 쪽이 이겨요.</p></details>
    </section>
    <div class="ya-side">
    <section class="ya-panel ya-join" aria-label="코드로 참가">
      <div class="ya-join-head"><h3>코드로 참가</h3><small>친구가 만든 방의 6자리 코드</small></div>
      <div class="ya-join-row"><input id="yb-code" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="000000" value="${esc(B.joinCode)}" aria-label="대결 방 코드"><button type="button" class="btn primary" data-yb="join">참가</button></div>
    </section>
    <section class="ya-panel ya-bot" aria-label="로보와 연습 대결">
      <div class="ya-bot-head"><span class="ya-bot-pet" aria-hidden="true">${avatar('robot', { form: BOT_LEVELS[B.botLevel]?.form || 2 })}<i>AI</i></span><div><h3>로보와 연습 대결</h3><p>판돈 없이 ${modeName(B.mode)}으로 몸풀기. 기록·리그에는 안 들어가요.</p></div></div>
      <div class="ya-bot-levels" role="group" aria-label="연습 상대 난이도">${Object.entries(BOT_LEVELS).map(([key, lv]) => `<button type="button" class="ya-level ${key} ${B.botLevel === key ? 'on' : ''}" data-yb="bot-level" data-level="${key}" aria-pressed="${B.botLevel === key}"><b>${lv.name}</b><small>정답률 ${Math.round(lv.accuracy * 100)}%</small></button>`).join('')}</div>
      ${botRewardLine()}
      <button type="button" class="ya-bot-go" data-yb="bot" ${wordsOk ? '' : 'disabled'}>연습 대결 시작 ${icon('arrow')}</button>
    </section>
    </div>
    </div>`;
}
function historyList(h) {
  if (!h.battles.length) return '<p class="yb-muted">아직 대결 기록이 없어요. 첫 대결에 도전해요!</p>';
  return `<ul class="yb-history">${h.battles.slice(0, 12).map(b => `<li class="${b.outcome}"><b>${b.outcome === 'win' ? '승' : b.outcome === 'lose' ? '패' : '무'}</b><span>${esc(b.opponent || '친구')}${b.tournament ? ` <em class="yb-tn-tag">${esc(b.tournament)}</em>` : ''}${b.mode === 'skill' ? ' <em class="yb-mode-mini">실력전</em>' : ''}</span><small>${b.tournament ? '대회' : `${b.outcome === 'win' ? '+' : b.outcome === 'lose' ? '−' : '±'}${b.outcome === 'draw' ? 0 : b.stake}코인`}</small></li>`).join('')}</ul>`;
}
// My record: totals, win rate, special wins and the yacha titles with their progress.
function myRecord(h) {
  const r = h.record, t = titleState(B.A), stats = t.stats || {};
  const played = r.wins + r.losses + r.draws;
  const keys = TITLE_KEYS.filter(key => TITLES[key].group === 'yacha');
  return `<section class="yb-card yb-me-v1366">
      <h2>내 야차전 기록</h2>
      <div class="yb-me-rate"><div class="yb-me-ring" style="--p:${played ? r.win_rate : 0}"><b>${played ? `${r.win_rate}%` : '—'}</b><small>승률</small></div>
        <div class="yb-me-grid"><div><b>${num(r.wins)}</b><span>승</span></div><div><b>${num(r.losses)}</b><span>패</span></div><div><b>${num(r.draws)}</b><span>무</span></div><div><b>${num(r.best_streak)}</b><span>최고 연승</span></div><div><b>${num(stats.comebacks || 0)}</b><span>역전승</span></div><div><b>${num(stats.flawless || 0)}</b><span>완벽승</span></div></div></div>
    </section>
    <section class="yb-card">
      <h2>야차전 칭호 <small>${keys.filter(key => t.unlocked.includes(key)).length}/${keys.length}</small></h2>
      <div class="yb-me-titles">${keys.map(key => {
        const on = t.unlocked.includes(key), prog = on ? null : titleProgress(key, stats);
        return `<button type="button" class="yb-me-title${on ? ' on' : ''}" data-yb="title" data-key="${key}">${titleEmblem(key, { size: 'sm', locked: !on })}<span class="yb-me-copy"><b>${esc(TITLES[key].name)}</b><small>${esc(TITLES[key].how)}</small>${prog ? `<i class="tt-prog"><i style="width:${Math.round(prog[0] / prog[1] * 100)}%"></i></i>` : ''}</span></button>`;
      }).join('')}</div>
      <p class="yb-note">칭호와 리그의 승리는 같은 친구에게 하루 3번까지만 세어요.</p>
    </section>
    <section class="yb-card"><h2>최근 대결</h2>${historyList(h)}</section>`;
}

async function createRoom(button) {
  button.disabled = true;
  try {
    const room = await api('/battle/rooms', { stake: B.stake, range_codes: [...B.ranges], mode: B.mode, range_mode: rangeMode() });
    enterRoom({ ...room, host: true });
  } catch (err) { toast(err.message); button.disabled = false; }
}
// V13.61 challenge: pick a friend of the same school and grade; the room is only for them.
async function pickFriend(button) {
  button.disabled = true;
  let friends;
  try { ({ friends } = await api('/battle/friends')); }
  catch (err) { toast(err.message); button.disabled = false; return; }
  button.disabled = false;
  const cur = B;
  const box = document.createElement('div');
  box.className = 'yb-confirm';
  box.innerHTML = `<div class="yb-confirm-card yb-friends-v1361" role="dialog" aria-modal="true" aria-label="도전장 보낼 친구">
    <h2>누구에게 도전할까요?</h2><p class="yb-note">${modeName(B.mode)} · 판돈 ${num(B.stake)}코인 · ${rangeMode() === 'each' ? '친구는 친구가 외우는 범위로, 나는 내 범위로 겨뤄요' : '고른 범위로 같이 겨뤄요'}. 친구 홈 화면에 도전장이 떠요.</p>
    <div class="yb-friend-list">${friends.length ? friends.map(f => `<button type="button" class="yb-friend" data-friend="${esc(f.id)}" ${f.busy || f.invited ? 'disabled' : ''}>
      <span class="yb-friend-pet">${f.pet ? avatar(f.pet.key, { form: f.pet.form }) : ''}</span>
      <span class="yb-friend-name"><b>${esc(f.name)}</b><small>${esc(f.class_name)}${f.busy ? ' · 대결 중' : f.invited ? ' · 도전장 받는 중' : ''}</small>${shownTitle(f.title) ? titleBadge(f.title, { size: 'xs' }) : ''}</span>
      ${f.tier ? `<span class="yb-friend-tier">${tierEmblem(f.tier, { size: 'sm' })}</span>` : ''}
    </button>`).join('') : '<p class="yb-muted">같은 학교·학년 친구가 아직 없어요. 아래 <b>연습 상대</b>와 먼저 겨뤄 봐요!</p>'}</div>
    <button type="button" class="btn full" data-friend-close>닫기</button></div>`;
  box.onclick = async e => {
    if (e.target === box || e.target.closest('[data-friend-close]')) { box.remove(); return; }
    const pick = e.target.closest('[data-friend]'); if (!pick || pick.disabled) return;
    pick.disabled = true;
    try {
      const room = await api('/battle/challenge', { friend_id: pick.dataset.friend, stake: B.stake, range_codes: [...B.ranges], mode: B.mode, range_mode: rangeMode() });
      box.remove();
      if (B === cur) enterRoom({ ...room, host: true });
    } catch (err) { toast(err.message); pick.disabled = false; }
  };
  box.onkeydown = e => { if (e.key === 'Escape') box.remove(); };
  document.querySelector('.battle-app')?.appendChild(box);
  box.querySelector('[data-friend-close]').focus();
}
// A challenge accepted on the home screen: show the stake once more, then join.
function acceptChallenge(invite) {
  const cur = B;
  const text = invite.tournament
    ? `<h2>${esc(invite.tournament.name)}</h2>${modeTag(invite.mode)}<p><b>${esc(invite.tournament.round)}</b> · ${esc(petJosa(invite.host, '과', '와'))} 겨뤄요.<br>판돈 없는 대회 경기예요. 들어가면 바로 시작해요.</p>`
    : `<h2>${esc(invite.host)}의 도전장</h2>${modeTag(invite.mode)}${rangeDeal(invite)}<p>판돈 <b>${num(invite.stake)}코인</b>을 걸고 대결해요.<br>들어가면 바로 시작하고, 지면 ${num(invite.stake)}코인을 잃어요.</p>`;
  if (invite.tournament) B.tournament = { tid: invite.tournament.id };
  confirmBox(text, '나중에', invite.tournament ? '입장하기' : '도전 받기', async yes => {
    if (B !== cur || !yes) return;
    try {
      const joined = await api('/battle/join', { code: invite.code, stake: invite.stake, range_codes: myRanges() });
      if (B === cur) enterRoom({ ...joined, host: false });
    } catch (err) { toast(err.message); }
  });
}
// Joining shows the stake and the host first; the match can start as soon as we connect.
async function joinRoom(button) {
  if (!/^\d{6}$/.test(B.joinCode)) return toast('6자리 코드를 입력해주세요.');
  button.disabled = true;
  let room;
  try { room = await api(`/battle/preview?code=${B.joinCode}`); }
  catch (err) { toast(err.message); button.disabled = false; return; }
  const cur = B;
  confirmBox(`<h2>${esc(room.host)}의 방</h2>${modeTag(room.mode)}${rangeDeal(room)}<p>판돈 <b>${num(room.stake)}코인</b>을 걸고 대결해요.<br>들어가면 바로 시작하고, 지면 ${num(room.stake)}코인을 잃어요.</p>`, '돌아가기', '참가하기', async yes => {
    if (B !== cur) return;
    if (!yes) { button.disabled = false; return; }
    try {
      const joined = await api('/battle/join', { code: room.code, stake: room.stake, range_codes: myRanges() });
      if (B === cur) enterRoom({ ...joined, host: false });
    } catch (err) { toast(err.message); button.disabled = false; }
  });
}
function confirmBox(html, noLabel, yesLabel, done, danger = false) {
  const box = document.createElement('div');
  box.className = 'yb-confirm';
  box.innerHTML = `<div class="yb-confirm-card" role="dialog" aria-modal="true">${html}<div class="btn-row"><button type="button" class="btn" data-confirm="no">${noLabel}</button><button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-confirm="yes">${yesLabel}</button></div></div>`;
  box.onclick = e => { const c = e.target.closest('[data-confirm]')?.dataset.confirm; if (!c) return; box.remove(); done(c === 'yes'); };
  box.onkeydown = e => { if (e.key === 'Escape') { box.remove(); done(false); } };
  document.querySelector('.battle-app')?.appendChild(box);
  box.querySelector('[data-confirm="no"]').focus();
}
async function cancelRoom(button) {
  button.disabled = true;
  try { await api(`/battle/rooms/${B.room.id}/cancel`, {}); } catch (err) { toast(err.message); }
  closeSocket(); openBattle(B.A, B.exit);
}

/* ---------- V13.66 practice match against the app ---------- */
// V13.70 what a robot match pays (coins and 경험치), by level; the first few matches a day.
function botRewardLine() {
  const win = BOT_WIN_REWARDS[B.botLevel] || BOT_WIN_REWARDS.normal, left = B.A.data.rewards?.bot?.left ?? BOT_DAILY;
  return `<div class="yb-bot-reward-v1370"><span><b>이기면</b>${coin()}${win.coins} · 경험치 ${win.xp}</span><span><b>져도</b>${coin()}${BOT_TRY_REWARD.coins} · 경험치 ${BOT_TRY_REWARD.xp}</span><small>${left > 0 ? `오늘 보상 ${left}/${BOT_DAILY}판 남음 · 단어 ${BOT_MIN_RIGHT}개 이상 맞히면 받아요` : '오늘 보상은 다 받았어요. 연습은 계속할 수 있어요!'}</small></div>`;
}
function meAsPlayer() {
  const A = B.A, pet = A.data.stats.pet;
  return { id: A.data.profile.id, name: A.data.profile.display_name, pet: pet ? { key: pet.key, form: pet.form, name: pet.name || '' } : null, streak: 0, title: titleState(A).equipped, tier: A.data.league?.tier?.key || null };
}
function startBotMatch(button) {
  const A = B.A;
  const { words } = getRanges(A, A.school, A.data.profile.class_name);
  const questions = practiceQuestions(words.filter(word => B.ranges.has(word.range_code)), B.mode);
  if (questions.length < 8) return toast('뜻이 서로 다른 단어가 부족해요. 범위를 더 골라주세요.');
  if (button) button.disabled = true;
  goFull();
  closeSocket(false);
  B.room = { id: 'practice', practice: true, stake: 0 };
  B.view = null;
  B.practiceSetup = { ranges: [...B.ranges], level: B.botLevel, mode: B.mode };
  B.botReward = null;
  // The server notes the start (and the level); a match it never heard of pays nothing.
  const ticket = api('/battle/practice/start', { level: B.botLevel, mode: B.mode }).then(res => res.id).catch(() => null);
  B.local = createPracticeMatch({ me: meAsPlayer(), questions, level: B.botLevel, mode: B.mode, onMessage });
  B.local.ticket = ticket;
  main('<div class="yb-loading">로보를 부르고 있어요…</div>');
  B.local.start();
}
function botAgain() {
  const setup = B.practiceSetup;
  nextScreen();
  if (setup) { B.ranges = new Set(setup.ranges); B.botLevel = setup.level; B.mode = setup.mode || 'speed'; }
  startBotMatch();
}

/* ---------- V13.94 몬스터 잡기 ---------- */
// The student's word ranges, in order, make parts (파트); each part's monster is beaten at
// 이지 → 노말 → 하드. The fight is the robot practice match with the monster as the opponent:
// it has its own HP and skill and must be knocked out before time runs out.
const monsterState = () => B.A.data.rewards?.monster || { cleared: {}, left: MONSTER_DAILY, daily: MONSTER_DAILY, wins: 0, hard_wins: 0 };
function myParts() { const { counts } = lobbyRanges(); return monsterParts(counts); }
// V13.95 이지 · 노말 · 하드 badges: a mint, blue and burning crimson shield with 1–3 stars.
const levelBadge = (level, cls) => uiArt('monster-' + level, cls);
function monsterTab() {
  const parts = myParts(), st = monsterState(), cleared = st.cleared || {};
  const total = parts.length * 3, done = parts.reduce((n, p) => n + MONSTER_LEVEL_KEYS.filter(k => cleared[p.key]?.[k]).length, 0);
  const hardDone = parts.filter(p => cleared[p.key]?.hard).length;
  return `<section class="mh-hero" aria-label="몬스터 잡기">
      <div class="mh-hero-art" aria-hidden="true">${monsterPic(parts[0]?.monster || MONSTERS[0])}</div>
      <span class="mh-kicker">MONSTER HUNT</span>
      <h2>몬스터 잡기</h2>
      <p>내 단어장을 <b>파트</b>로 나눠 몬스터가 하나씩 지키고 있어요. <b>이지 → 노말 → 하드</b> 순서로 깨요.</p>
      <div class="mh-stats"><div><b>${num(done)}</b><span>/ ${num(total)} 처치</span></div><div class="hard"><b>${num(hardDone)}</b><span>하드 정복</span></div><div><b>${num(st.left)}</b><span>/ ${num(st.daily)} 오늘 다시 보상</span></div></div>
      <ul class="mh-rules"><li>⏱ 시간 안에 <b>쓰러뜨려야</b> 이겨요</li><li>🎁 처음 잡으면 <b>큰 보상</b></li><li>🔥 하드는 철자 쓰기까지, <b>정말 어려워요</b></li></ul>
    </section>
    ${parts.length ? `<div class="mh-list">${parts.map(p => monsterCard(p, cleared[p.key] || {})).join('')}</div>` : '<p class="yb-muted">학습할 단어 범위가 없어서 몬스터가 아직 없어요.</p>'}`;
}
function monsterCard(p, c) {
  const m = p.monster;
  return `<article class="mh-part${c.hard ? ' conquered' : ''}" style="--mc:${m.color}">
    <div class="mh-mon">${monsterPic(m)}<span class="mh-no">PART ${p.index + 1}</span>${c.hard ? '<span class="mh-crown" aria-label="하드 정복">👑</span>' : ''}</div>
    <div class="mh-info">
      <h3>${esc(m.name)}</h3>
      <p>${esc(m.line)}</p>
      <div class="mh-range">${esc(rangesText(p.codes))} · ${num(p.words)}단어</div>
      <div class="mh-levels">${MONSTER_LEVEL_KEYS.map(k => {
        const L = MONSTER_LEVELS[k], open = monsterOpen(c, k), won = !!c[k];
        const sub = won ? `처치 완료 · 다시 ${coin()}${L.again.coins}` : open ? `첫 처치 ${coin()}${num(L.first.coins)}` : k === 'hard' ? '노말을 먼저' : '이지를 먼저';
        return `<button type="button" class="mh-lv ${k}${won ? ' won' : ''}${open ? '' : ' locked'}" data-yb="monster-go" data-part="${esc(p.key)}" data-level="${k}" ${open ? '' : 'disabled'} aria-label="${esc(m.name)} ${L.name}${won ? ' 처치 완료' : open ? '' : ' 잠김'}"><b>${won ? icon('check') : open ? '' : icon('lock')}${L.name}</b>${levelBadge(k, 'mh-lv-art')}<small>${sub}</small></button>`;
      }).join('')}</div>
    </div>
  </article>`;
}
// What a level means, before the fight starts.
function askMonster(partKey, level) {
  const p = myParts().find(x => x.key === partKey), L = MONSTER_LEVELS[level];
  if (!p || !L) return toast('몬스터를 찾지 못했어요.');
  const c = monsterState().cleared?.[p.key] || {}, first = !c[level];
  const reward = first ? L.first : L.again;
  confirmBox(`<div class="mh-ask ${level}" style="--mc:${p.monster.color}">
      <div class="mh-ask-mon">${monsterPic(p.monster)}</div>
      <span class="mh-ask-lv">${levelBadge(level, 'mh-ask-lv-art')}${L.name}</span>
      <h2>${esc(p.monster.name)}</h2>
      <ul class="mh-ask-facts">
        <li><b>${L.mode === 'skill' ? '실력전' : '스피드전'}</b>${L.mode === 'skill' ? '뜻 고르기 + 철자 쓰기' : '뜻 고르기 4지선다'}</li>
        <li><b>HP</b>나 ${num(L.hp)} · 몬스터 ${num(L.monsterHp)}</li>
        <li><b>시간</b>${minutesText(matchMs(L.mode))} 안에 쓰러뜨려야 이겨요</li>
        <li><b>단어</b>${esc(rangesText(p.codes))} · ${num(p.words)}단어</li>
        <li class="reward"><b>${first ? '첫 처치' : '다시 처치'}</b>${coin()}${num(reward.coins)} · 경험치 ${num(reward.xp)}${first ? '' : ` <small>(오늘 ${monsterState().left}번 남음)</small>`}</li>
      </ul>
      ${level === 'hard' ? '<p class="mh-warn">하드 몬스터는 거의 틀리지 않고 아주 빨라요. 단어를 완벽하게 외웠을 때 도전하세요!</p>' : ''}
    </div>`, '그만두기', '도전!', yes => { if (yes) startMonster(p.key, level); });
}
function startMonster(partKey, level) {
  const A = B.A, p = myParts().find(x => x.key === partKey), L = MONSTER_LEVELS[level];
  if (!p || !L) return toast('몬스터를 찾지 못했어요.');
  const { words } = getRanges(A, A.school, A.data.profile.class_name);
  const questions = practiceQuestions(words.filter(w => p.codes.includes(String(w.range_code))), L.mode);
  if (questions.length < 8) return toast('뜻이 서로 다른 단어가 부족해요.');
  goFull();
  closeSocket(false);
  B.room = { id: 'monster', practice: true, monster: { part: p.key, level }, stake: 0 };
  B.view = null;
  B.monsterSetup = { part: p.key, level };
  B.monsterReward = null;
  const ticket = api('/monster/start', { part: p.key, level }).then(res => res.id).catch(err => { toast(err.message); return null; });
  const foe = { name: p.monster.name, pet: { key: p.monster.temp.pet, form: p.monster.temp.form, skill: L.skill }, monster: { key: p.monster.key, level }, hp: L.monsterHp };
  B.local = createPracticeMatch({ me: meAsPlayer(), questions, mode: L.mode, onMessage, foe, skill: L, hp: L.hp, ko: true, label: `몬스터 · ${L.name}` });
  B.local.ticket = ticket;
  main(`<div class="yb-loading">${esc(p.monster.name)}이(가) 나타났어요…</div>`);
  B.local.start();
}
function drawMonsterResult() {
  const v = B.view, r = v.result || {}, m = me(), f = foe(), local = B.local, setup = B.monsterSetup || {};
  const won = r.winner === v.me, L = MONSTER_LEVELS[setup.level] || MONSTER_LEVELS.easy;
  const mon = MONSTERS.find(x => x.key === f.monster?.key) || MONSTERS[0];
  closeSocket();
  if (!B.resultSounded) { B.resultSounded = true; sfx(won ? 'win' : 'lose', won ? [60, 50, 120] : 0); }
  const why = won ? (r.reason === 'forfeit' ? '' : `${esc(mon.name)}을(를) 쓰러뜨렸어요!`) : r.reason === 'forfeit' ? '도전을 그만뒀어요' : f.hp > 0 && m.hp > 0 ? '시간 안에 쓰러뜨리지 못했어요' : '내 펫이 쓰러졌어요';
  const missed = r.review?.[v.me] || [];
  main(`<section class="yb-card mh-result ${won ? 'win' : 'lose'} ${setup.level || ''}" style="--mc:${mon.color}">
    <span class="yb-result-kind">몬스터 잡기 · ${esc(L.name)}</span>
    <div class="mh-result-stage">${won ? `<div class="mh-result-down${MONSTER_ART.has(mon.key) ? ' art' : ''}">${monsterPic(f.monster, { pose: 'down' })}</div>` : `<div class="mh-result-mon">${monsterPic(f.monster, { pose: 'attack' })}</div>`}<div class="mh-result-pet">${avatar(m.pet?.key, { form: m.pet?.form ?? 1, expression: won ? 'win' : 'hurt' })}</div></div>
    <div class="mh-result-badge">${won ? '처치 성공!' : '실패…'}</div>
    <p class="yb-result-lead">${why} · 내 HP ${num(Math.max(0, m.hp))} · 몬스터 HP ${num(Math.max(0, f.hp))}</p>
    <div class="yb-result-points mh-reward" id="mh-reward">${monsterRewardText()}</div>
    <button type="button" class="btn primary full" data-yb="monster-again">${won ? '한 번 더' : '다시 도전'} <small>${esc(mon.name)} · ${esc(L.name)}</small></button>
    <div class="btn-row yb-result-actions"><button type="button" class="btn" data-yb="home">홈으로</button><button type="button" class="btn" data-yb="monster-list">몬스터 목록</button></div>
  </section>
  ${missed.length ? `<section class="yb-card yb-review"><h2>이번 전투에서 놓친 단어 <small>${missed.length}개</small></h2><ul>${missed.slice(0, 10).map(w => `<li><b>${esc(w.word)}</b><span>${esc(w.meaning)}</span></li>`).join('')}</ul><button type="button" class="btn primary full" data-yb="review">놓친 단어 연습하기</button></section>` : ''}`);
  if (won && !reduced()) burstConfetti(document.querySelector('.mh-result-stage'));
  claimMonsterReward(won ? 'win' : 'lose', local);
}
function monsterRewardText() {
  const r = B.monsterReward;
  if (!r) return '보상 확인 중…';
  if (r.paid) return `${r.first ? '<em class="mh-first">첫 처치 보상!</em>' : ''}${coin()}+${num(r.coins)} · 경험치 +${num(r.xp)}`;
  const need = MONSTER_LEVELS[B.monsterSetup?.level]?.need || 5;
  return { few: `단어를 ${need}개 이상 맞히면 보상을 받아요`, daily: '오늘 다시 잡기 보상은 다 받았어요 (첫 처치는 언제나 받아요)', short: '너무 빨리 끝난 전투예요', error: '보상을 확인하지 못했어요' }[r.reason] || '보상 없음';
}
async function claimMonsterReward(outcome, local) {
  const cur = B;
  if (!local || local.claimed) return;
  local.claimed = true;
  const id = await local.ticket;
  let res = { paid: false, reason: 'error' };
  if (id) { try { res = await api('/monster/finish', { id, result: outcome, right: local.myRight() }); } catch { res = { paid: false, reason: 'error' }; } }
  if (B !== cur) return;
  B.monsterReward = res;
  if (res.cleared && B.A.data.rewards) B.A.data.rewards.monster = { cleared: res.cleared, left: res.left, daily: res.daily, wins: res.wins, hard_wins: res.hard_wins };
  if (res.paid && res.stats) Object.assign(B.A.data.stats, res.stats);
  const el = document.getElementById('mh-reward');
  if (el) { el.innerHTML = monsterRewardText(); if (res.paid) el.classList.add('paid'); if (res.first) el.classList.add('first'); }
}
// A small burst of paper pieces over an element (the monster went down).
function burstConfetti(el) {
  if (!el) return;
  const colors = ['#f4c64f', '#7fe0b8', '#ff8a65', '#b9a3ff', '#5ec7ff'];
  for (let i = 0; i < 26; i++) {
    const bit = document.createElement('i');
    bit.className = 'mh-bit';
    bit.style.cssText = `--x:${Math.round(Math.random() * 260 - 130)}px;--y:${Math.round(-60 - Math.random() * 120)}px;--r:${Math.round(Math.random() * 720 - 360)}deg;background:${colors[i % colors.length]};animation-delay:${Math.round(Math.random() * 180)}ms`;
    el.appendChild(bit);
    setTimeout(() => bit.remove(), 1600);
  }
}

/* ---------- V13.66 academy tournament ---------- */
async function playTournament(tid, mid, button) {
  if (!tid || !mid) return;
  if (button) button.disabled = true;
  try {
    const room = await api('/tournament/play', { tournament_id: tid, match_id: mid });
    if (!B) return;
    B.tournament = { tid, mid };
    enterRoom({ ...room, tournament: room.tournament || '대회' });
  } catch (err) { toast(err.message); if (button) button.disabled = false; }
}
function showBracket(tid) {
  if (!B || !tid) return;
  openBracket(tid, B.A.data.profile.id, (B.A.data.tournaments || []).find(item => item.id === tid) || null);
}

/* ---------- room connection ---------- */
function enterRoom(room) {
  goFull();
  B.room = room;
  B.view = null;
  if (room.status === 'waiting' && room.host) waitingRoom();
  else main('<div class="yb-loading">대결 방에 연결하고 있어요…</div>');
  openSocket();
}

function openSocket() {
  closeSocket(false);
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/battle/ws/${B.room.id}?ticket=${encodeURIComponent(B.room.ticket)}`;
  const ws = new WebSocket(url);
  B.ws = ws;
  ws.onmessage = event => { let msg; try { msg = JSON.parse(event.data); } catch { return; } onMessage(msg); };
  ws.onclose = event => {
    if (B?.ws !== ws || B.closing) return;
    if (B.view?.phase === 'finished') return;
    // Opened on another tab or phone: that one keeps the match; this one stops fighting it.
    if (event.code === 4000) { setNote(''); main('<section class="yb-card yb-waiting"><h2>다른 화면에서 대결을 열었어요</h2><p>이 대결은 방금 연 화면에서 이어서 할 수 있어요.</p><button type="button" class="btn full" data-yb="exit">나가기</button></section>'); B.closing = true; return; }
    B.retries = (B.retries || 0) + 1;
    if (B.retries > 8) { toast('대결 방에 다시 연결하지 못했어요.'); return; }
    setNote('연결이 끊겨 다시 연결하는 중…');
    setTimeout(() => { if (B?.ws === ws) openSocket(); }, Math.min(4000, 600 * B.retries));
  };
  ws.onopen = () => { B.retries = 0; setNote(''); };
  clearInterval(B.pinger);
  B.pinger = setInterval(() => { if (ws.readyState === 1) ws.send('{"type":"ping"}'); }, 20000);
}
function closeSocket(final = true) {
  if (!B) return;
  if (final) { B.closing = true; clearInterval(B.pinger); cancelAnimationFrame(B.raf); clearInterval(B.waitTimer); (B.timers || []).forEach(clearTimeout); B.timers = []; }
  try { B.ws?.close(); } catch {}
  B.ws = null;
  B.local?.close();
  B.local = null;
}
// Returns whether the message left the phone.
function send(message, button) {
  if (B?.local) { if (button) button.classList.add('picked'); B.local.send(message); return true; }
  if (B?.ws?.readyState !== 1) { toast('대결 방과 연결되지 않았어요.'); return false; }
  if (button) button.classList.add('picked');
  B.ws.send(JSON.stringify(message));
  return true;
}
// V13.99: an answer carries the number of its word (idx), so a tap that arrives after the word
// closed is not counted for the next one, and the word takes no more taps once one was sent.
function pickChoice(choice, button) {
  const q = B?.view?.question;
  if (!q || q.locked || q.answer !== undefined) return;
  // `picked` before sending: a practice match answers at once and draws from it.
  const before = q.picked;
  q.picked = choice;
  if (!send({ type: 'answer', choice, ...(Number.isInteger(q.idx) ? { idx: q.idx } : {}) }, button)) { q.picked = before; return; }
  q.locked = true;
  document.querySelectorAll('.yb-answer').forEach(b => { b.disabled = true; });
}
function setNote(text) { const n = document.getElementById('yb-top-note'); if (n) n.textContent = text; }

function onMessage(msg) {
  if (typeof msg.now === 'number') B.clockOffset = msg.now - Date.now();
  if (msg.type === 'lobby') { if (B.room.host) waitingRoom(msg.expires_at); return; }
  if (msg.type === 'cancelled' || msg.type === 'expired') { toast(msg.type === 'expired' ? '10분 동안 아무도 들어오지 않아 방이 닫혔어요.' : msg.reason === 'tournament' ? '선생님이 이 대회 경기를 정리했어요.' : msg.reason === 'declined' ? (B.room?.tournament ? '상대가 대회 경기를 다음에 하기로 했어요.' : B.room?.challenge ? '친구가 이번에는 도전을 거절했어요.' : '상대가 이번에는 설욕전을 거절했어요.') : '대결 방이 취소됐어요.'); closeSocket(); return openBattle(B.A, B.exit); }
  if (msg.type === 'view') {
    // A view after a reconnect or reload has the word but not what this phone typed for it.
    const q = msg.view?.question;
    if (q) Object.assign(q, { typed: [], hint: q.hint || '', options: q.options || [], opDone: !!q.opDone, judged: !!q.locked });
    B.view = msg.view; return drawMatch();
  }
  if (msg.type === 'events' && B.view) { for (const e of msg.events) applyEvent(e); }
}

/* ---------- waiting room ---------- */
function waitingRoom(expiresAt = B.room.expires_at) {
  const code = String(B.room.code || '');
  if (B.room.tournament) main(`<section class="yb-card yb-waiting yb-waiting-tn">
    <span class="yb-eyebrow">${esc(B.room.tournament)}</span>
    ${trophy('lg')}
    <h2>${esc(B.room.friend || '상대')}의 입장을 기다리는 중</h2>
    <p>상대 홈 화면에 대회 경기 알림이 떴어요.<br>들어오면 바로 시작해요.</p>
    <p class="yb-note">판돈 없는 대회 경기 · <span id="yb-wait-left"></span></p>
    <button type="button" class="btn full" data-yb="cancel">나가기</button>
  </section>`);
  else if (B.room.challenge) main(`<section class="yb-card yb-waiting">
    <span class="yb-eyebrow">도전장 보냄</span>
    <h2>${esc(B.room.friend || '친구')}의 답을 기다리는 중</h2>
    <p>친구 홈 화면에 도전장이 떴어요.<br>받으면 바로 시작해요.</p>
    <p class="yb-note">판돈 ${B.room.stake}코인 · <span id="yb-wait-left"></span></p>
    <button type="button" class="btn full" data-yb="cancel">도전장 취소</button>
  </section>`);
  else if (B.room.rematch) main(`<section class="yb-card yb-waiting">
    <span class="yb-eyebrow">설욕전 신청 완료</span>
    <h2>상대의 답을 기다리는 중</h2>
    <p>상대 화면에 설욕전 신청이 떴어요.<br>수락하면 바로 시작해요.</p>
    <p class="yb-note">판돈 ${B.room.stake}코인 · <span id="yb-wait-left"></span></p>
    <button type="button" class="btn full" data-yb="cancel">신청 취소</button>
  </section>`);
  else main(`<section class="yb-card yb-waiting">
    <span class="yb-eyebrow">친구를 기다리는 중</span>
    <div class="yb-code" aria-label="대결 방 코드 ${esc(code)}">${esc(code.slice(0, 3))}<i></i>${esc(code.slice(3))}</div>
    <p>같은 학교·학년 친구에게 이 코드를 알려주세요.<br>친구가 <b>야차전 → 코드로 참가</b>에 입력하면 시작해요.</p>
    <p class="yb-note">판돈 ${B.room.stake}코인 · <span id="yb-wait-left"></span></p>
    <button type="button" class="btn full" data-yb="cancel">방 취소</button>
  </section>`);
  clearInterval(B.waitTimer);
  const tickWait = () => { const left = Math.max(0, (expiresAt || 0) - serverNow()); const el = document.getElementById('yb-wait-left'); if (el) el.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')} 뒤에 방이 닫혀요`; };
  tickWait(); B.waitTimer = setInterval(tickWait, 1000);
}

/* ---------- match ---------- */
const me = () => B.view.players[B.view.me];
const foe = () => B.view.players[B.view.order.find(id => id !== B.view.me)];

function drawMatch() {
  clearInterval(B.waitTimer);
  hookKeys();
  const v = B.view;
  if (v.phase === 'finished') return drawResult();
  const m = me(), f = foe();
  // The lobby may have been scrolled; the arena starts at the top of the screen.
  if (!document.getElementById('yb-arena')) window.scrollTo(0, 0);
  // V13.70 easier to read: a smaller arena, one line for what is happening next to the clock,
  // and the answers right under the word (V13.72: my pet's skill below them, no buttons).
  main(`
    <div class="yb-arena" id="yb-arena">
      <div class="yb-banner">夜叉</div><div class="yb-centerline"></div><div class="yb-ring"></div>
      ${hud(f, 'op')}
      <div class="yb-pet op${f.monster ? ' monster' : ''}" id="yb-pet-op">${petArt(f)}</div>
      <div class="yb-pet me" id="yb-pet-me">${petArt(m)}</div>
      ${hud(m, 'me')}
      <div class="yb-flash" id="yb-flash"></div>
      <div class="yb-vs-v1366" id="yb-vs" hidden>${vsSide(f, 'op')}<b class="yb-vs-mark">VS</b>${vsSide(m, 'me')}</div>
      <div class="yb-countdown" id="yb-countdown" hidden></div>
      <div class="yb-fever-banner" id="yb-fever" hidden>피버 타임!<small>공격력 1.5배</small></div>
      <div class="yb-skill-banner-v1372" id="yb-skill-banner" hidden></div>
    </div>
    <div class="yb-strip-v1370">
      <div class="yb-msg" aria-live="polite"><div class="yb-msg-main" id="yb-msg-main"></div><div class="yb-msg-sub" id="yb-msg-sub"></div></div>
      <div class="yb-clock"><b>남은 시간</b><span id="yb-clock">${clockText(matchMs(v.mode))}</span><em class="yb-fever-tag">피버 1.5배</em></div>
    </div>
    <div class="yb-question"><div class="yb-q-head"><span id="yb-q-n"></span><span>${v.own_words ? `<em class="yb-own-tag">내 범위 단어</em>${v.label ? esc(v.label) : `판돈 ${num(v.stake)}`}` : `${modeName(v.mode)} · ${v.label ? esc(v.label) : `판돈 ${num(v.stake)}코인`}`}</span></div><div class="yb-q-word" id="yb-q-word">…</div><div class="yb-turnbar"><i id="yb-turnbar"></i></div><div class="yb-status"><span id="yb-status-me"></span><span id="yb-status-op"></span></div></div>
    <div class="yb-answers" id="yb-answers"></div>
    <div class="yb-myskill-v1372" id="yb-myskill"></div>
    <div class="yb-emotes" id="yb-emotes"></div>
    <button type="button" class="yb-leave" data-yb="leave">대결 포기하기</button>`);
  refreshHud();
  drawEmotes();
  if (v.phase === 'waiting') say('상대가 들어오기를 기다리는 중…', '둘 다 연결되면 3초 뒤에 시작해요.');
  if (v.phase === 'countdown') showCountdown(v.deadline);
  if (v.question) drawQuestion();
  loop();
}

// "24번 · 25번 외 2": the ranges a player plays with (V13.94 각자 내 범위).
function rangesText(codes) {
  const labels = (codes || []).map(code => rangeLabel(B.A.data.profile.school, code));
  return labels.length > 2 ? `${labels.slice(0, 2).join(' · ')} 외 ${labels.length - 2}` : labels.join(' · ');
}
// V13.66: both players' names come with their title and league tier.
function vsSide(p, side) {
  return `<div class="yb-vs-side ${side}">${B.view?.own_words && p.ranges?.length ? `<span class="yb-vs-range">${esc(rangesText(p.ranges))}</span>` : ''}<span class="yb-vs-pet">${petArt(p, { size: 'mini' })}</span><b>${esc(p.name)}${p.bot ? ' <i class="yb-ai">AI</i>' : ''}</b>${shownTitle(p.title) ? titleBadge(p.title, { size: 'xs' }) : ''}${p.tier ? `<span class="yb-vs-tier">${tierEmblem(p.tier, { size: 'xs' })}${esc({ bronze: '브론즈', silver: '실버', gold: '골드', diamond: '다이아' }[p.tier] || '')}</span>` : ''}</div>`;
}
function hud(p, side) {
  return `<div class="yb-hud ${side}" id="yb-hud-${side}">
    <div class="yb-hud-row"><span class="yb-hud-name">${esc(whoName(p))}</span><span class="yb-hud-lv">${p.monster ? esc(MONSTER_LEVELS[p.monster.level]?.name || '') : PET_FORMS[p.pet?.form ?? 1] || ''}</span></div>
    <div class="yb-hud-who">${p.monster ? `<b class="mh-hud-tag">MONSTER</b>${esc(MONSTER_LEVELS[p.monster.level]?.name || '')} 몬스터` : `${p.tier ? tierEmblem(p.tier, { size: 'xs' }) : ''}${esc(p.name)}${side === 'me' ? ' · 나' : ''}${p.bot ? ' <i class="yb-ai">AI</i>' : ''}${p.streak >= 2 ? ` <span class="yb-streak">${p.streak}연승</span>` : ''}`}</div>
    ${shownTitle(p.title) ? `<div class="yb-hud-title">${titleBadge(p.title, { size: 'xs' })}</div>` : ''}
    <div class="yb-hpbar"><i>HP</i><div class="yb-track"><div class="yb-fill" id="yb-hp-${side}"></div></div><b class="yb-hp-num" id="yb-hpn-${side}">${Math.max(0, p.hp)}</b></div>
    <div class="yb-hud-foot"><div class="yb-gauge-v1372" id="yb-gauge-${side}"></div><div class="yb-fx" id="yb-fx-${side}"></div></div>
  </div>`;
}

// Pet skill effects still waiting: a bonus on my next attacks, a guard, poison.
// 파도's bite hurts over a few words like 초롱's poison; it is named after the pet.
const dotName = pet => pet?.key === 'shark' ? '물기' : '독';
function effectBadges(fx = {}, pet = null) {
  const list = (xs, sign) => xs.length > 1 && xs.every(x => x === xs[0]) ? `${sign}${xs[0]} ×${xs.length}` : xs.map(x => sign + x).join(' ');
  return [fx.boost?.length && `<b class="boost">공격 ${list(fx.boost, '+')}</b>`, fx.guard?.length && `<b class="guard">방어 ${list(fx.guard, '−')}</b>`, fx.poison > 0 && `<b class="poison">${dotName(pet)} ${fx.poison}번</b>`].filter(Boolean);
}
function refreshHud() {
  for (const [side, p] of [['me', me()], ['op', foe()]]) {
    const pct = Math.min(100, Math.max(0, p.hp) / (p.max_hp || maxHp()) * 100), fill = document.getElementById('yb-hp-' + side);
    if (fill) { fill.style.width = pct + '%'; fill.style.backgroundColor = pct > 50 ? '#2fbf71' : pct > 20 ? '#f2b233' : '#e5484d'; }
    const hpn = document.getElementById('yb-hpn-' + side);
    if (hpn) hpn.textContent = Math.max(0, p.hp);
    const skill = p.skill || petSkill(p.pet), gauge = skill.need > 0 ? Math.min(p.gauge || 0, skill.need) : 0;
    const box = document.getElementById('yb-gauge-' + side);
    if (box) {
      box.innerHTML = skill.need > 0 ? '<i>스킬</i>' + Array.from({ length: skill.need }, (_, i) => `<span class="${i < gauge ? 'on' : ''}"></span>`).join('') : '<i>특기 없음</i>';
      box.classList.toggle('near', skill.need > 0 && gauge === skill.need - 1);
      box.setAttribute('aria-label', skill.need > 0 ? `${skill.name} 게이지 ${gauge}/${skill.need}` : '전설 펫은 펫 특기가 없어요');
    }
    const fx = document.getElementById('yb-fx-' + side);
    if (fx) fx.innerHTML = [...effectBadges(p.effects, p.pet), !p.connected && B.view.phase !== 'waiting' && '<b class="off">연결 끊김</b>'].filter(Boolean).join('');
    document.getElementById('yb-pet-' + side)?.classList.toggle('buff', !!p.effects?.boost?.length);
    document.getElementById('yb-pet-' + side)?.classList.toggle('guarded', !!p.effects?.guard?.length);
  }
  drawMySkill();
}
// Under the answers: my pet's skill and how close it is, so nobody has to look for a button.
function drawMySkill() {
  const box = document.getElementById('yb-myskill'); if (!box) return;
  const p = me(), s = p.skill || petSkill(p.pet), gauge = Math.min(p.gauge || 0, s.need), left = s.need - gauge;
  if (s.key === 'none') { box.innerHTML = '<span class="yb-myskill-name"><span aria-hidden="true">✦</span> 전설 펫</span><span class="yb-myskill-desc">펫 특기 없이 함께 대결해요.</span>'; return; }
  box.innerHTML = `<span class="yb-myskill-name"><span aria-hidden="true">✦</span> ${esc(s.name)}</span><span class="yb-myskill-desc">${esc(s.desc)}</span><span class="yb-myskill-left ${left === 1 ? 'near' : ''}">${left === 1 ? '한 번만 더!' : `${left}번 더 맞히면`}</span>`;
}
// A pet skill went off: a banner across the arena for a moment.
function skillBanner(side, name, text) {
  const box = document.getElementById('yb-skill-banner'); if (!box) return;
  box.className = `yb-skill-banner-v1372 ${side}`;
  box.innerHTML = `<b>${name}</b><small>${esc(text)}</small>`;
  box.hidden = false;
  clearTimeout(B.skillBannerTimer);
  B.skillBannerTimer = setTimeout(() => { box.hidden = true; }, reduced() ? 1200 : 1500);
}

// The line shown when a word is revealed: "word = meaning".
function revealLine(q, answer) {
  return q.kind === 'spell' ? `${answer} = ${q.prompt}` : `${q.prompt} = ${q.options[answer]}`;
}

/* ---------- V13.67 실력전 spelling words ---------- */
// The hint shows the first letter of each word (already filled in); the player types the
// rest on the in-app keyboard (phone keyboards would autocorrect the spelling).
const blanks = q => [...q.hint].filter(ch => ch === '_').length;
function spelled(q) {
  let i = 0;
  return [...q.hint].map(ch => ch === '_' ? (q.typed[i++] || '') : ch).join('');
}
function spellSlots(q) {
  let i = 0;
  const reveal = typeof q.answer === 'string' ? q.answer : null;
  return [...q.hint].map((ch, k) => {
    if (ch === ' ') return '<span class="yb-slot gap" aria-hidden="true"></span>';
    const typed = ch === '_' ? q.typed[i++] : null;
    const shown = reveal ? reveal[k] || '' : ch === '_' ? (typed || '') : ch;
    const cls = ch !== '_' ? 'fixed' : typed ? 'typed' : i - 1 === q.typed.length ? 'next' : '';
    return `<span class="yb-slot ${cls}">${esc(shown)}</span>`;
  }).join('');
}
function drawSpell(q) {
  const done = q.answer !== undefined, closed = q.locked || done;
  const full = q.typed.length === blanks(q);
  // Once the word is revealed the right spelling shows (in yellow), even after a wrong try.
  const state = q.right ? 'right' : done ? 'reveal' : q.wrong ? 'wrong' : '';
  const box = document.getElementById('yb-answers');
  box.innerHTML = `<div class="yb-spell ${state}" id="yb-spell">
      <div class="yb-spell-slots" id="yb-spell-slots" aria-label="입력한 철자 ${esc(spelled(q))}">${spellSlots(q)}</div>
      <div class="yb-kb" role="group" aria-label="알파벳 자판">${KEY_ROWS.map((row, r) => `<div class="yb-kb-row">${r === 2 ? `<button type="button" class="yb-key wide" data-yb="key" data-key="back" aria-label="지우기" ${closed ? 'disabled' : ''}>⌫</button>` : ''}${[...row].map(k => `<button type="button" class="yb-key" data-yb="key" data-key="${k}" ${closed ? 'disabled' : ''}>${k}</button>`).join('')}${r === 2 ? `<button type="button" class="yb-key go" data-yb="spell-go" id="yb-spell-go" ${closed || !full ? 'disabled' : ''}>공격!</button>` : ''}</div>`).join('')}</div>
    </div>`;
}
function spellKey(key) {
  const q = B?.view?.question;
  if (!q || q.kind !== 'spell' || q.locked || q.answer !== undefined) return;
  if (key === 'back') q.typed.pop();
  else if (/^[a-z]$/.test(key) && q.typed.length < blanks(q)) q.typed.push(key);
  else return;
  const slots = document.getElementById('yb-spell-slots');
  if (slots) { slots.innerHTML = spellSlots(q); slots.setAttribute('aria-label', `입력한 철자 ${spelled(q)}`); }
  const go = document.getElementById('yb-spell-go');
  if (go) go.disabled = q.typed.length !== blanks(q);
}
function spellSubmit() {
  const q = B?.view?.question;
  if (!q || q.kind !== 'spell' || q.locked || q.answer !== undefined || q.typed.length !== blanks(q)) return;
  if (!send({ type: 'answer', choice: spelled(q), ...(Number.isInteger(q.idx) ? { idx: q.idx } : {}) })) return;
  q.locked = true;
  document.querySelectorAll('#yb-spell button').forEach(b => { b.disabled = true; });
}
// A hardware keyboard (tablets, computers) types too.
let keysHooked = false;
function hookKeys() {
  if (keysHooked) return;
  keysHooked = true;
  window.addEventListener('keydown', event => {
    if (!document.getElementById('yb-spell') || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key === 'Backspace' ? 'back' : event.key === 'Enter' ? 'go' : event.key.toLowerCase();
    if (key === 'go') { event.preventDefault(); return spellSubmit(); }
    if (key === 'back' || /^[a-z]$/.test(key)) { event.preventDefault(); spellKey(key); }
  });
}

function drawQuestion() {
  const q = B.view.question; if (!q) return;
  document.getElementById('yb-q-n').textContent = `${q.n}번째 단어 · ${q.kind === 'spell' ? '철자 쓰기' : '뜻 고르기'}`;
  document.getElementById('yb-q-word').textContent = q.prompt;
  document.getElementById('yb-q-word').classList.toggle('meaning', q.kind === 'spell');
  document.querySelector('.battle-app')?.classList.toggle('yb-spelling', q.kind === 'spell');
  if (q.kind === 'spell') drawSpell(q);
  else document.getElementById('yb-answers').innerHTML = q.options.map((o, i) => `<button type="button" class="yb-answer ${q.answer === i ? 'right' : ''} ${q.answer !== undefined && q.answer !== i ? 'dim' : ''} ${q.picked === i ? 'picked' : ''} ${q.picked === i && q.hit ? 'hit' : ''}" data-yb="answer" data-choice="${i}" aria-label="${i + 1}번 ${esc(o)} 공격" ${q.locked || q.answer !== undefined ? 'disabled' : ''}><span class="yb-tag"><b>${i + 1}</b></span><span class="yb-ko">${esc(o)}</span></button>`).join('');
  // The word itself is in the question card; the line only says what to do.
  if (q.answer === undefined && !q.locked) say(q.kind === 'spell' ? '뜻을 보고 <em>영어 철자</em>를 써요!' : '알맞은 <em>뜻</em>을 누르면 바로 공격!', q.kind === 'spell' ? '쓰기 정답은 두 배로 세요.' : '');
}

function say(mainHtml, sub = '') {
  const a = document.getElementById('yb-msg-main'), b = document.getElementById('yb-msg-sub');
  if (a) a.innerHTML = mainHtml; if (b) b.textContent = sub;
}
function setStatus(side, text) { const el = document.getElementById('yb-status-' + side); if (el) el.textContent = text; }
function flash(color) { const f = document.getElementById('yb-flash'); if (!f) return; f.style.setProperty('--flash', color); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
function pop(side, text, kind = '') {
  const arena = document.getElementById('yb-arena'), pet = document.getElementById('yb-pet-' + side); if (!arena || !pet) return;
  const a = arena.getBoundingClientRect(), r = pet.getBoundingClientRect(), d = document.createElement('div');
  d.className = 'yb-pop ' + kind; d.textContent = text;
  d.style.left = (r.left - a.left + r.width * .22) + 'px'; d.style.top = (r.top - a.top + r.height * .1) + 'px';
  arena.appendChild(d); setTimeout(() => d.remove(), 1050);
}
// V13.85 the pets act out the hit: the attacker shows its attack (cheer) pose, the one hit its
// hurt (sad) pose, for a moment (로보 has its own punch and flinch).
function hit(side) { const el = document.getElementById('yb-pet-' + side); if (!el) return; el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); showPose(el, 'hurt', 900); }
function lunge(side) { const el = document.getElementById('yb-pet-' + side); if (!el) return; showPose(el, 'attack', 900); if (reduced()) return; el.classList.add('lunge'); setTimeout(() => el.classList.remove('lunge'), 240); }
const sideOf = pid => pid === B.view.me ? 'me' : 'op';

// V13.94 attack effects: a shot flies from the attacker to the one hit (a thick beam for a pet
// skill, claw marks from a monster), then an impact ring, sparks and a shake that grows with
// the damage. Everything is drawn over the arena and removed by itself.
function fxColor(p) { return p?.monster ? (MONSTERS.find(x => x.key === p.monster.key)?.color || '#e5484d') : (CHARACTERS[petKey(p?.pet?.key)]?.color || '#f4c64f'); }
function fxCenter(side, arena) {
  const pet = document.getElementById('yb-pet-' + side); if (!pet) return null;
  const a = arena.getBoundingClientRect(), r = pet.getBoundingClientRect();
  return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height * .52 };
}
function fxAdd(arena, cls, css, ms) { const el = document.createElement('div'); el.className = cls; Object.assign(el.style, css); arena.appendChild(el); setTimeout(() => el.remove(), ms); return el; }
function strike(atk, def, { dmg = 0, crit = false, skill = false, attacker = null } = {}) {
  const arena = document.getElementById('yb-arena'); if (!arena || reduced()) return;
  const from = fxCenter(atk, arena), to = fxCenter(def, arena); if (!from || !to) return;
  const color = fxColor(attacker), big = skill || crit || dmg >= 22;
  if (skill) {
    const len = Math.hypot(to.x - from.x, to.y - from.y), ang = Math.atan2(to.y - from.y, to.x - from.x);
    fxAdd(arena, 'fx-beam', { left: from.x + 'px', top: from.y + 'px', width: len + 'px', transform: `rotate(${ang}rad)`, '--fx': color }, 520);
  } else {
    const shot = fxAdd(arena, 'fx-shot' + (big ? ' big' : ''), { left: from.x + 'px', top: from.y + 'px', '--fx': color }, 400);
    shot.animate([{ transform: 'translate(-50%,-50%) scale(.6)', opacity: .4 }, { transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(${big ? 1.5 : 1.1})`, opacity: 1 }], { duration: 230, easing: 'cubic-bezier(.3,.1,.7,1)', fill: 'forwards' });
  }
  setTimeout(() => {
    fxAdd(arena, 'fx-ring' + (big ? ' big' : ''), { left: to.x + 'px', top: to.y + 'px', '--fx': color }, 600);
    for (let i = 0; i < (big ? 12 : 7); i++) {
      const a = Math.PI * 2 * i / (big ? 12 : 7) + Math.random() * .4, dist = (big ? 70 : 46) + Math.random() * 24;
      fxAdd(arena, 'fx-spark', { left: to.x + 'px', top: to.y + 'px', '--fx': color, '--dx': Math.cos(a) * dist + 'px', '--dy': Math.sin(a) * dist + 'px' }, 560);
    }
    if (attacker?.monster) fxAdd(arena, 'fx-claw', { left: to.x + 'px', top: to.y + 'px' }, 620);
    arena.classList.remove('fx-shake-s', 'fx-shake-l'); void arena.offsetWidth;
    arena.classList.add(big ? 'fx-shake-l' : 'fx-shake-s');
  }, skill ? 180 : 230);
}
function knockout(side) {
  const arena = document.getElementById('yb-arena'); if (!arena) return;
  fxAdd(arena, 'fx-ko', {}, 1300).textContent = 'K.O.!';
  if (!reduced()) { arena.classList.remove('fx-shake-l'); void arena.offsetWidth; arena.classList.add('fx-shake-l'); }
  const pet = document.getElementById('yb-pet-' + side);
  pet?.classList.add('fx-down');
  // V13.95 a monster with its own pictures falls into its drawn 쓰러짐 pose (no tilt, see v1395.css).
  if (pet?.classList.contains('monster') && holdPose(pet, 'down')) pet.classList.add('mon-down');
}

function showCountdown(deadline) {
  const box = document.getElementById('yb-countdown'); if (!box) return;
  box.hidden = false;
  const vs = document.getElementById('yb-vs');
  if (vs) vs.hidden = false;
  const step = () => {
    const left = Math.ceil((deadline - serverNow()) / 1000);
    if (left <= 0 || B.view.phase !== 'countdown') { box.hidden = true; if (vs) vs.hidden = true; return; }
    if (box.textContent !== String(left)) sfx('tick');
    box.textContent = left; later(step, 150);
  };
  step();
  say('곧 시작해요!', '연속으로 맞히면 펫 스킬이 저절로 나가요.');
}

// Clock and word timer, drawn from the room's deadlines.
function loop() {
  cancelAnimationFrame(B.raf);
  const frame = () => {
    if (!B?.view || B.view.phase === 'finished') return;
    const v = B.view, now = serverNow();
    const clock = document.getElementById('yb-clock');
    if (clock) { const left = v.ends_at ? Math.max(0, v.ends_at - now) : matchMs(v.mode); clock.textContent = clockText(left); clock.parentElement.classList.toggle('warn', left <= (v.fever_ms || 15000) && !!v.ends_at); }
    // Fever time: the room deals 1.5x damage in the last seconds; show it once it starts.
    const fever = !!v.ends_at && v.ends_at - now <= (v.fever_ms || 15000);
    if (fever !== !!B.fever) {
      B.fever = fever;
      document.getElementById('yb-arena')?.classList.toggle('fever', fever);
      clock?.parentElement.classList.toggle('fever', fever);
      if (fever) { flash('rgba(255,90,90,.55)'); sfx('fever', [60, 40, 60]); const banner = document.getElementById('yb-fever'); if (banner) { banner.hidden = false; later(() => { banner.hidden = true; }, 1800); } }
    }
    const bar = document.getElementById('yb-turnbar');
    if (bar) bar.style.transform = `scaleX(${v.phase === 'question' && v.deadline ? Math.max(0, Math.min(1, (v.deadline - now) / (v.deadline - v.question.started_at))) : 0})`;
    B.raf = requestAnimationFrame(frame);
  };
  B.raf = requestAnimationFrame(frame);
}

function applyEvent(e) {
  const v = B.view;
  if (e.seq && e.seq <= v.seq) return; // already in the view
  v.seq = e.seq || v.seq;
  const P = v.players;
  if (e.type === 'presence') { P[e.player].connected = e.connected; if (e.player !== v.me) setStatus('op', e.connected ? '' : '상대 연결이 끊겼어요. 15초 기다려요'); refreshHud(); return; }
  if (e.type === 'countdown') { v.phase = 'countdown'; v.deadline = e.deadline; if (!document.getElementById('yb-arena')) drawMatch(); showCountdown(e.deadline); drawEmotes(); return; }
  if (e.type === 'start') { v.ends_at = e.ends_at; return; }
  if (e.type === 'question') {
    v.phase = 'question'; v.deadline = e.deadline;
    // V13.94 각자 내 범위: each player has a word of their own range on the same turn.
    const mine = e.own?.[v.me] || e;
    v.question = { n: e.n, idx: e.idx, kind: mine.kind || 'choice', prompt: mine.prompt, hint: mine.hint || '', options: mine.options || [], started_at: e.started_at, locked: false, opDone: false, answer: undefined, typed: [] };
    if (!document.getElementById('yb-arena')) return drawMatch();
    setStatus('me', ''); setStatus('op', '');
    const vs = document.getElementById('yb-vs'); if (vs) vs.hidden = true;
    if (e.n === 1) sfx('go');
    drawQuestion(); refreshHud(); drawEmotes(); return;
  }
  if (e.type === 'emote') return showEmote(e);
  if (e.type === 'wrong') {
    P[e.player].gauge = 0;
    if (e.player !== v.me) v.question.opDone = true;
    if (e.player === v.me) {
      sfx('wrong', 40);
      v.question.locked = true; v.question.judged = true;
      document.querySelector('.yb-answer.picked')?.classList.add('wrong');
      document.querySelectorAll('.yb-answer').forEach(b => { b.disabled = true; });
      if (v.question.kind === 'spell') { v.question.wrong = true; drawQuestion(); }
      setStatus('me', '틀렸어요! 이번 단어는 공격 불가');
    } else setStatus('op', '상대가 틀렸어요!');
    refreshHud(); return;
  }
  // V13.59: a hit no longer ends the word; the answer arrives with 'reveal' (someone hit)
  // or 'miss' (nobody did) once both players answered or the time ran out.
  if (e.type === 'reveal' || e.type === 'miss') {
    v.phase = 'reveal'; v.question.answer = e.answers?.[v.me] ?? e.answer;
    const line = revealLine(v.question, v.question.answer);
    // A word left to run out empties the gauge, like a wrong answer.
    if (e.type === 'miss') {
      for (const id of v.order) P[id].gauge = 0;
      say(e.timeout ? '시간 초과!' : '둘 다 놓쳤어요!', line);
    } else {
      // `judged`: the room took my answer (V13.99: the word locks as soon as an answer is sent).
      if (e.timeout && !v.question.judged) { P[v.me].gauge = 0; setStatus('me', '시간 초과!'); }
      if (e.timeout && !v.question.opDone) foe().gauge = 0;
      say('정답 공개', line);
    }
    drawQuestion(); refreshHud(); return;
  }
  if (e.type === 'attack') {
    {
      const atk = sideOf(e.attacker), def = sideOf(e.defender);
      P[e.attacker].hp = e.hp[e.attacker]; P[e.defender].hp = e.hp[e.defender];
      P[e.attacker].gauge = e.gauge ?? P[e.attacker].gauge;
      if (e.effects) for (const id of Object.keys(e.effects)) P[id].effects = e.effects[id];
      if (atk === 'me') { v.question.locked = true; v.question.hit = true; v.question.judged = true; } else v.question.opDone = true;
      if (e.spell && atk === 'me') v.question.right = true;
      const need = (P[e.attacker].skill || petSkill(P[e.attacker].pet)).need;
      setStatus(atk, `${(e.ms / 1000).toFixed(1)}초 ${e.spell ? '철자 ' : ''}정답!${atk === 'me' && e.gauge ? ` 스킬 ${e.gauge}/${need}` : ''}`);
      if (atk === 'op' && !v.question.locked) setStatus('me', '나도 맞히면 반격!');
      const strong = e.boost || e.fast || e.fever;
      const label = e.boost ? '<em>스킬</em> 공격!' : e.fast ? '<em>크리티컬</em> 공격!' : e.spell ? '<em>철자</em> 공격!' : '공격!';
      if (atk === 'me') sfx(strong ? 'crit' : 'hit', e.boost || e.fever ? 30 : 0);
      else later(() => sfx('hurt', e.boost || e.fever ? [80, 40, 80] : 70), reduced() ? 0 : 230);
      say(`${atk === 'op' && !P[e.attacker].monster ? '상대 ' : ''}${esc(whoName(P[e.attacker]))}의 ${label}`, `${atk === 'me' ? '정답! 상대를 기다려요' : '상대가 맞혔어요'}${e.guard ? ` · ${def === 'me' ? '내' : '상대'} 펫이 ${e.guard}만큼 막았어요` : ''}`);
      lunge(atk);
      if (e.dmg) strike(atk, def, { dmg: e.dmg, crit: e.fast || e.fever, attacker: P[e.attacker] });
      later(() => { if (e.boost || e.fast || e.spell) flash(e.boost ? 'rgba(255,214,90,.9)' : e.spell ? 'rgba(150,230,210,.75)' : 'rgba(255,236,160,.8)'); if (e.dmg) { hit(def); pop(def, `-${e.dmg}${e.boost ? ' 스킬!' : e.fast ? ' 크리티컬!' : e.spell ? ' 철자!' : e.fever ? ' 피버!' : ''}`, strong || e.spell ? 'crit' : ''); } if (e.guard) pop(def, e.dmg ? `막기 ${e.guard}` : '다 막았다!', 'info'); refreshHud(); }, reduced() ? 0 : 230);
      // Redraw only my own buttons: the other player's hit must not replace my question.
      if (atk === 'me') drawQuestion();
    }
    refreshHud(); return;
  }
  // V13.72: a full gauge sets off the pet's own skill.
  if (e.type === 'petskill') {
    const p = P[e.player], side = sideOf(e.player), other = side === 'me' ? 'op' : 'me', foeId = v.order.find(id => id !== e.player);
    p.gauge = 0; p.effects = e.effects;
    P[e.player].hp = e.hp[e.player]; P[foeId].hp = e.hp[foeId];
    later(() => {
      sfx('skill', side === 'me' ? 30 : 50);
      flash(side === 'me' ? 'rgba(255,214,90,.8)' : 'rgba(170,160,255,.65)');
      skillBanner(side, `${side === 'op' && !p.monster ? '상대 ' : ''}${esc(whoName(p))}의 ${esc(e.name)}!`, e.desc);
      if (e.dmg) { strike(side, other, { dmg: e.dmg, skill: true, attacker: p }); hit(other); pop(other, `-${e.dmg} 스킬!`, 'crit'); }
      if (e.heal) pop(side, `+${e.heal}`, 'heal');
      refreshHud();
    }, reduced() ? 0 : 520);
    refreshHud(); return;
  }
  // 초롱's poison bites as a word closes.
  if (e.type === 'poison') {
    const side = sideOf(e.target);
    P[e.target].hp = e.hp;
    P[e.player].effects = { ...(P[e.player].effects || {}), poison: e.left };
    later(() => { hit(side); pop(side, `-${e.dmg} ${dotName(P[e.player].pet)}`, 'poison'); refreshHud(); }, reduced() ? 0 : 700);
    refreshHud(); return;
  }
  if (e.type === 'end') {
    v.phase = 'finished'; v.result = e.result;
    const loser = e.result.loser ? sideOf(e.result.loser) : null;
    if (loser) document.getElementById('yb-pet-' + loser)?.classList.add('faint');
    // A knock-out (not time running out) gets its own moment before the result.
    const ko = loser && Number(e.result.hp?.[e.result.loser]) <= 0 && e.result.reason === 'end';
    if (ko) later(() => knockout(loser), reduced() ? 0 : 350);
    cancelAnimationFrame(B.raf);
    later(drawResult, reduced() ? 0 : ko ? 1700 : 1100);
  }
}

function drawResult() {
  if (B.room?.monster) return drawMonsterResult();
  const v = B.view, r = v.result || {}, m = me(), local = B.local;
  const outcome = !r.winner ? 'draw' : r.winner === v.me ? 'win' : 'lose';
  const practice = !!B.room?.practice, tournament = !practice && /^대회/.test(v.label || '');
  const delta = practice ? `<span id="yb-bot-reward">${botRewardText()}</span>`
    : tournament ? (outcome === 'win' ? '다음 라운드 진출!' : outcome === 'lose' ? '여기까지! 멋진 경기였어요' : '무승부 · 다시 겨뤄요')
    : `${coin()}${outcome === 'win' ? `+${num(r.stake)}` : outcome === 'lose' ? `−${num(r.stake)}` : '±0'}`;
  closeSocket();
  if (!practice) clearLeagueCache();
  if (!B.resultSounded) { B.resultSounded = true; if (outcome !== 'draw') sfx(outcome, outcome === 'win' ? [60, 50, 120] : 0); }
  const missed = r.review?.[v.me] || [];
  const finishedAt = Number(r.finished_at || Date.now());
  const canRematch = !practice && !tournament && r.reason !== 'cancelled' && serverNow() - finishedAt < REMATCH_MS;
  const hpMe = r.hp?.[v.me] ?? m.hp, special = !practice && outcome === 'win' && r.reason === 'end' ? (hpMe === (r.max_hp || 100) ? '퍼펙트 게임!' : hpMe > 0 && hpMe <= (r.max_hp || 100) / 5 ? '기적의 역전승!' : '') : '';
  main(`<section class="yb-card yb-result ${outcome}${practice ? ' practice' : ''}${tournament ? ' tournament' : ''}">
    <span class="yb-result-kind">${practice || tournament ? `${esc(v.label || '')} · ` : ''}${modeName(v.mode)}</span>
    <div class="yb-result-pet">${avatar(m.pet?.key, { form: m.pet?.form ?? 1, expression: outcome === 'win' ? 'win' : outcome === 'lose' ? 'hurt' : 'normal' })}</div>
    <div class="yb-result-badge">${{ win: '승리!', lose: '패배', draw: r.reason === 'cancelled' ? '취소' : '무승부' }[outcome]}</div>
    ${special ? `<div class="yb-result-special">${special}</div>` : ''}
    <p class="yb-result-lead">${esc(REASONS[r.reason]?.(r.loser === v.me) || '')}${r.hp ? ` · 내 HP ${hpMe} · 상대 HP ${r.hp[foe().id] ?? foe().hp}` : ''}</p>
    ${TIEBREAKS[r.tiebreak] ? `<p class="yb-tiebreak-v1382">⚖️ HP 동점 · ${esc(TIEBREAKS[r.tiebreak](r.winner === v.me))}</p>` : ''}
    <div class="yb-result-points ${outcome}">${delta}</div>
    ${practice ? `<button type="button" class="btn primary full" data-yb="bot-again">한 판 더 <small>${esc(BOT_LEVELS[B.practiceSetup?.level]?.name || '')}</small></button>` : ''}
    ${canRematch ? `<button type="button" class="btn primary full yb-rematch" data-yb="rematch">${outcome === 'lose' ? '설욕전 신청' : '한 판 더'} <small>판돈 ${num(r.stake)}코인</small></button><div id="yb-offer"></div>` : ''}
    ${tournament && B.tournament ? `<button type="button" class="btn full" data-action="tournament-bracket" data-tournament="${esc(B.tournament.tid)}">대진표 보기</button>` : ''}
    <div class="btn-row yb-result-actions"><button type="button" class="btn" data-yb="home">홈으로</button><button type="button" class="btn" data-yb="again">로비로</button></div>
  </section>
  ${missed.length ? `<section class="yb-card yb-review"><h2>이번 대결에서 놓친 단어 <small>${missed.length}개</small></h2><ul>${missed.slice(0, 10).map(w => `<li><b>${esc(w.word)}</b><span>${esc(w.meaning)}</span></li>`).join('')}</ul>${missed.length > 10 ? `<p class="yb-note">외 ${missed.length - 10}개</p>` : ''}<button type="button" class="btn primary full" data-yb="review">놓친 단어 연습하기</button></section>` : ''}`);
  if (canRematch) watchOffers(v.id, finishedAt);
  if (practice && r.reason === 'forfeit' && r.loser === v.me && !B.botReward) { B.botReward = { paid: false, reason: 'forfeit' }; document.getElementById('yb-bot-reward').innerHTML = botRewardText(); }
  else if (practice) claimBotReward(outcome, local);
}
// V13.70 the robot match reward: asked once per match, shown on the result card.
function botRewardText() {
  const r = B.botReward;
  if (!r) return '보상 확인 중…';
  if (r.paid) return `${coin()}+${num(r.coins)} · 경험치 +${num(r.xp)}`;
  return { few: `단어를 ${BOT_MIN_RIGHT}개 이상 맞히면 보상을 받아요`, daily: '오늘 연습 보상은 다 받았어요', forfeit: '포기한 경기는 보상이 없어요' }[r.reason] || '연습 경기 · 보상 없음';
}
async function claimBotReward(outcome, local) {
  const cur = B;
  if (!local || local.claimed) return;
  local.claimed = true;
  const id = await local.ticket;
  let res = { paid: false, reason: 'error' };
  if (id) {
    try { res = await api('/battle/practice/finish', { id, result: outcome, right: local.myRight() }); }
    catch { res = { paid: false, reason: 'error' }; }
  }
  if (B !== cur) return;
  B.botReward = res;
  if (res.left !== undefined && B.A.data.rewards) B.A.data.rewards.bot = { left: res.left, daily: res.daily };
  if (res.paid && res.stats) Object.assign(B.A.data.stats, res.stats);
  const el = document.getElementById('yb-bot-reward');
  if (el) el.innerHTML = botRewardText();
  if (res.paid) el?.closest('.yb-result-points')?.classList.add('paid');
}

/* ---------- rematch ---------- */
// The room is closed after the match, so the other player's rematch request is read
// from the server every few seconds while the result is on screen.
function watchOffers(battleId, finishedAt) {
  const cur = B;
  clearInterval(cur.offerTimer);
  const poll = async () => {
    if (B !== cur || serverNow() - finishedAt >= REMATCH_MS) { clearInterval(cur.offerTimer); if (B === cur) document.querySelector('.yb-rematch')?.remove(); return; }
    try {
      const { offer } = await api(`/battle/rematch-offer?battle_id=${encodeURIComponent(battleId)}`);
      if (B !== cur || !offer || cur.offer?.code === offer.code) return;
      cur.offer = offer;
      const box = document.getElementById('yb-offer');
      if (box) box.innerHTML = `<div class="yb-offer" role="alert"><b>${esc(offer.host)}의 설욕전 신청!</b><p>판돈 <b>${num(offer.stake)}코인</b>을 걸고 한 번 더 겨뤄요. 지면 ${num(offer.stake)}코인을 잃어요.</p><div class="btn-row"><button type="button" class="btn" data-yb="offer-no">이번엔 쉬기</button><button type="button" class="btn primary" data-yb="offer-yes">수락하기</button></div></div>`;
      document.querySelector('.yb-rematch')?.remove();
      sfx('skill', 60);
    } catch {}
  };
  cur.offerTimer = setInterval(poll, 3000);
  poll();
}
function nextScreen() {
  const { A, exit, history, botLevel } = B;
  clearInterval(B.offerTimer);
  B = { A, exit, stake: 10, ranges: null, joinCode: '', history, tab: 'play', botLevel: botLevel || 'normal' };
}
async function askRematch(button) {
  button.disabled = true;
  try {
    const room = await api('/battle/rematch', { battle_id: B.view.id });
    nextScreen();
    enterRoom({ ...room, host: true });
  } catch (err) {
    toast(err.message);
    // The other player asked first: their request appears here within a moment.
    if (/먼저/.test(err.message)) button.remove(); else button.disabled = false;
  }
}
async function acceptOffer(button) {
  const offer = B.offer; if (!offer) return;
  button.disabled = true;
  try {
    const joined = await api('/battle/join', { code: offer.code, stake: offer.stake });
    nextScreen();
    enterRoom({ ...joined, host: false });
  } catch (err) { toast(err.message); button.disabled = false; }
}
async function declineOffer(button) {
  button.disabled = true;
  try { await api('/battle/rematch/decline', { battle_id: B.view.id }); } catch {}
  clearInterval(B.offerTimer);
  const box = document.getElementById('yb-offer'); if (box) box.innerHTML = '<p class="yb-note">설욕전 신청을 거절했어요.</p>';
}

/* ---------- review the words missed in the match ---------- */
async function reviewWords() {
  const ids = (B.view?.result?.review?.[B.view.me] || []).map(w => w.word_id);
  if (!ids.length) return;
  const A = B.A;
  await leaveScreen();
  try { await startPractice({ wordIds: ids, mode: A.mode || 'write_meaning', runMode: 'practice' }); }
  catch (err) { toast(err.message); }
}

/* ---------- emotes ---------- */
function drawEmotes() {
  const bar = document.getElementById('yb-emotes'); if (!bar) return;
  const live = ['countdown', 'question', 'reveal'].includes(B.view?.phase);
  bar.innerHTML = `${Object.entries(EMOTES).map(([id, text]) => `<button type="button" class="yb-emote" data-yb="emote" data-emote="${id}" ${live ? '' : 'disabled'}>${esc(text)}</button>`).join('')}<button type="button" class="yb-emote-toggle" data-yb="emotes-toggle" aria-pressed="${!emotesShown()}">${emotesShown() ? '상대 이모트 끄기' : '상대 이모트 켜기'}</button>`;
}
function sendEmote(button) {
  if (Date.now() - (B.emoteAt || 0) < 3000) return;
  B.emoteAt = Date.now();
  send({ type: 'emote', emote: button.dataset.emote });
  document.querySelectorAll('.yb-emote').forEach(b => { b.disabled = true; });
  later(drawEmotes, 3000);
}
function showEmote(e) {
  const side = sideOf(e.player);
  if (side === 'op' && !emotesShown()) return;
  const text = EMOTES[e.emote]; if (!text) return;
  pop(side, text, 'emote');
  if (side === 'op') sfx('emote');
}

/* ---------- leaving ---------- */
function confirmLeave() {
  if (!B.view || B.view.phase === 'finished') return leaveScreen();
  const cur = B;
  // Before the match starts, leaving calls it off without moving any points.
  if (B.view.phase === 'waiting') {
    return confirmBox('<h2>대결을 취소할까요?</h2><p>아직 시작 전이라 코인은 그대로예요.</p>', '기다릴게요', '취소하기', yes => {
      if (!yes || B !== cur) return;
      send({ type: 'leave' });
      later(leaveScreen, 200);
    });
  }
  const lossText = B.room?.practice ? '연습 경기라 코인은 그대로예요.' : B.view.stake ? `판돈 ${num(B.view.stake)}코인을 잃어요.` : '대회 경기는 상대가 다음 라운드에 올라가요.';
  confirmBox(`<h2>대결을 포기할까요?</h2><p>지금 나가면 <b>패배</b>로 처리돼요. ${lossText}</p>`, '계속할게요', '포기하기', yes => { if (yes && B === cur) send({ type: 'leave' }); }, true);
}
function tryExit() {
  if (B?.view && B.view.phase !== 'finished' && !B.closing) return confirmLeave();
  leaveScreen();
}
async function leaveScreen() {
  const exit = B?.exit;
  clearInterval(B?.offerTimer);
  closeSocket();
  root().onclick = null; root().oninput = null;
  B = null;
  await exit?.();
}
