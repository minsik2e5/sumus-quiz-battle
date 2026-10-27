// V13.151 놀이터 '게임' 묶음: 낚시터 · 짝 맞추기 타임어택 · 몬스터 사냥(V13.162) · 교실 게임 참가(V13.158부터 맨 아래 한 줄).
// 짝 맞추기와 교실 게임은 야차전 '게임' 탭에 있다가 놀이터로 옮겨 왔다(야차전은 겨루기만: 대결 · 몬스터 · 던전 · 기록).
// 게임 단어는 야차전 '단어 범위'와 같은 저장값(sumus-yacha-ranges:<학생>)을 쓴다. 한쪽에서 바꾸면 다른 쪽도 같다.
import { esc, num, toast, rangeLabel } from './ui.js';
import { getRanges, periodGroups } from './student.js';
import { openSheet } from './sheet.js';
import { uiArt, coin } from './emblems.js';
import { matchTime } from './match-rules.js';
import { rodOf } from './reel-rules.js';
import { CLAW, clawOpen } from './claw-rules.js';

export const GAME_WORDS_MIN = 8;
const rangesKey = A => `sumus-yacha-ranges:${A.data.profile.id}`;
const readPref = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const writePref = (key, value) => { try { localStorage.setItem(key, value); } catch {} };

// 게임 단어: 저장한 범위(8단어 이상) → 학습 범위 → 8단어가 넘는 첫 과. battle.js lobbyRanges와 같은 순서.
export function arcadeWords(A) {
  const { words, codes, selected } = getRanges(A, A.school, A.data.profile.class_name);
  const counts = new Map(); for (const w of words) counts.set(w.range_code, (counts.get(w.range_code) || 0) + 1);
  let saved = []; try { saved = JSON.parse(readPref(rangesKey(A), '[]')); } catch {}
  const known = list => (Array.isArray(list) ? list : []).map(String).filter(code => codes.includes(code));
  const enough = list => list.reduce((n, c) => n + (counts.get(c) || 0), 0) >= GAME_WORDS_MIN;
  const picked = [known(saved), known(selected)].find(enough) || codes.filter(c => (counts.get(c) || 0) >= GAME_WORDS_MIN).slice(0, 1);
  const n = picked.reduce((a, code) => a + (counts.get(code) || 0), 0);
  return { codes, counts, picked, n, ok: n >= GAME_WORDS_MIN, list: words.filter(x => picked.includes(String(x.range_code))) };
}
export function wordsLabel(A, codes) {
  const labels = (codes || []).map(code => rangeLabel(A.data.profile.school, code));
  return labels.length > 2 ? `${labels.slice(0, 2).join(' · ')} 외 ${labels.length - 2}` : labels.join(' · ');
}

// V13.158 놀이터 순서: 코인 지갑 → 게임(낚시터 · 짝 맞추기, 그림이 크게 들어간 카드) → 상점 · 뽑기 → 교실 게임 참가(맨 아래 한 줄).
// 그림은 있을 때만 쓴다: 낚시터는 FISHING_ART(reel.js), 짝 맞추기는 MATCH_ART(match-game.js)의 'entry'(주문서 32).
// 그림 목록은 arcade.js가 넘긴다(검사에서 빈 목록을 넘겨 그림이 없을 때 모습도 본다).
const fishArt = (art, name, fallback, cls = '') => art?.fishing?.has(name) ? `<img class="ag-ico ${cls}" src="/assets/fishing/${name}.webp" alt="" draggable="false">` : fallback;
export function reelCard(A, art) {
  const v = A.data.rewards?.reel || {}, rod = rodOf(v.rod);
  const bg = art?.fishing?.has('bg-entry') ? '<img class="ag-big-bg" src="/assets/fishing/bg-entry.webp" alt="" draggable="false" decoding="async">' : '<span class="ag-big-bg ag-sea"><i class="w1"></i><i class="w2"></i></span>';
  return `<article class="ag-big ag-reel">
    <div class="ag-big-art" aria-hidden="true">${bg}<span class="ag-big-title"><small>손맛 낚시</small><strong>낚시터</strong><em>공부로 받은 미끼로 낚고, 물고기를 진주로 바꿔요</em></span></div>
    <div class="ag-big-body">
      <ul class="ag-stats" aria-label="내 낚시">
        <li>${fishArt(art, 'bait-can', '<i class="ag-ico">🪱</i>')}<b>${num(v.bait || 0)}</b><small>미끼</small></li>
        <li>${fishArt(art, `icon-rod-${rod.level}`, '<i class="ag-ico">🎣</i>')}<b>${rod.level}단계</b><small>낚싯대</small></li>
        <li>${fishArt(art, 'pearl', '<i class="ag-ico">⚪</i>')}<b>${num(v.pearls || 0)}</b><small>진주</small></li>
      </ul>
      <button type="button" class="yl-cta ag-go" data-action="reel-open" aria-label="낚시터 들어가기">들어가기</button>
    </div>
  </article>`;
}
export function matchCard(A, art) {
  const w = arcadeWords(A), m = A.data.rewards?.match || {};
  const pic = art?.match?.has('entry') ? '<img class="ag-big-bg" src="/assets/match/entry.webp" alt="" draggable="false" decoding="async">'
    : '<span class="ag-big-bg ag-stage"><span class="gm-mini en">brave</span><span class="gm-mini ko">용감한</span><span class="gm-mini en">calm</span><span class="gm-mini ko">차분한</span><i class="ag-spark"></i></span>';
  return `<article class="ag-big ag-match">
    <div class="ag-big-art" aria-hidden="true">${pic}<span class="ag-big-title"><small>혼자 · 타임어택</small><strong>짝 맞추기</strong><em>영어와 뜻 카드를 3라운드 동안 가장 빨리 지워요</em></span></div>
    <div class="ag-big-body">
      <ul class="ag-stats" aria-label="내 기록">
        <li><b>${m.best ? matchTime(m.best) : '—'}</b><small>내 최고</small></li>
        <li><b>${num(m.left ?? 5)}</b><small>오늘 코인 판</small></li>
      </ul>
      <div class="ag-words"><span>게임 단어</span><b class="${w.ok ? 'ok' : 'need'}">${w.picked.length ? `${esc(wordsLabel(A, w.picked))} · ${num(w.n)}단어` : '아직 안 골랐어요'}</b><button type="button" class="btn small" data-action="arcade-words">바꾸기</button></div>
      <button type="button" class="yl-cta ag-go" data-action="arcade-match" ${w.ok ? '' : 'disabled'}>시작</button>
    </div>
  </article>`;
}
// V13.162 몬스터 사냥(처음 이름 펫 사냥): 낚시터 · 짝 맞추기처럼 그림 카드. 그림은 HUNT_ART(hunt.js)의 'entry'(주문서 34)가 있으면 쓴다.
const huntArt = (art, name, fallback) => art?.hunt?.has(name) ? `<img class="ag-ico" src="/assets/hunt/${name}.webp" alt="" draggable="false">` : fallback;
export function huntCard(A, art) {
  const v = A.data.rewards?.hunt || {};
  const pic = art?.hunt?.has('entry') ? '<img class="ag-big-bg" src="/assets/hunt/entry.webp" alt="" draggable="false" decoding="async">'
    : '<span class="ag-big-bg ag-meadow"><i class="ag-hunt-sun"></i><i class="ag-hunt-hill"></i><i class="ag-hunt-pet"></i><i class="ag-hunt-ring"></i><i class="ag-hunt-ball"><b></b></i><i class="ag-hunt-grass"></i></span>';
  return `<article class="ag-big ag-hunt">
    <div class="ag-big-art" aria-hidden="true">${pic}<span class="ag-big-title"><small>공 던져 잡기</small><strong>몬스터 사냥</strong><em>지도 위 야생 몬스터를 잡아 별조각으로 바꾸고, 가끔 펫도 만나요</em></span></div>
    <div class="ag-big-body">
      <ul class="ag-stats" aria-label="내 공">
        <li>${huntArt(art, 'ball-basic', '<i class="ag-ico">🟢</i>')}<b>${num(Number(v.basic || 0) + Number(v.good || 0) + Number(v.gold || 0))}</b><small>공</small></li>
        <li><i class="ag-ico">✦</i><b>${num(v.stars || 0)}</b><small>별조각</small></li>
        <li><i class="ag-ico">📖</i><b>${num(v.kinds || 0)}/${num(v.all || 34)}</b><small>도감</small></li>
      </ul>
      <button type="button" class="yl-cta ag-go" data-action="hunt-open" aria-label="몬스터 사냥 들어가기">들어가기</button>
    </div>
  </article>`;
}
// V13.180 인형뽑기: 몬스터 사냥 옆 그림 카드. 그림(주문서 44 claw/entry)이 있으면 쓴다. 그림 게이트(clawOpen)가 닫혀 있으면 '곧 열려요'.
export function clawCard(A, art) {
  const v = A.data.rewards?.claw || {}, open = v.open ?? clawOpen();
  const pic = art?.claw?.has('entry') ? '<img class="ag-big-bg" src="/assets/claw/entry.webp" alt="" draggable="false" decoding="async">'
    : '<span class="ag-big-bg ag-clawbox"><i class="ag-claw-glass"></i><i class="ag-claw-toy">🧸</i></span>';
  const ticketIco = art?.claw?.has('icon-ticket') ? '<img class="ag-ico" src="/assets/claw/icon-ticket.webp" alt="" draggable="false">' : '<i class="ag-ico">🎟️</i>';
  return `<article class="ag-big ag-claw${open ? '' : ' soon'}">
    <div class="ag-big-art" aria-hidden="true">${pic}<span class="ag-big-title"><small>집게로 쏙</small><strong>인형뽑기</strong><em>공부로 받은 집게권으로 열두 띠 인형을 뽑아 도감을 채워요</em></span></div>
    <div class="ag-big-body">
      <ul class="ag-stats" aria-label="내 인형뽑기">
        <li>${ticketIco}<b>${num(v.tickets || 0)}</b><small>집게권</small></li>
        <li><i class="ag-ico">🧸</i><b>${num(v.kinds || 0)}/${num(v.all || 12)}</b><small>도감</small></li>
        <li>${coin()}<b>${num(v.coin_today || 0)}/${num(v.coin_daily || CLAW.COIN_DAILY)}</b><small>오늘 코인</small></li>
      </ul>
      <button type="button" class="yl-cta ag-go" data-action="claw-open" aria-label="인형뽑기 들어가기" ${open ? '' : 'disabled'}>${open ? '들어가기' : '곧 열려요'}</button>
    </div>
  </article>`;
}
export function gamesSection(A, art) {
  return `<section class="ag-group" aria-label="게임"><h2 class="ag-head">게임</h2>
    ${reelCard(A, art)}
    ${matchCard(A, art)}
    ${huntCard(A, art)}
    ${clawCard(A, art)}
  </section>
  <h2 class="ag-head">상점 · 뽑기</h2>`;
}
// 교실 게임 참가: 놀이터 맨 아래 한 줄(번호 4자리 + 들어가기).
export function partyRow() {
  return `<section class="ag-party" aria-label="교실 게임 참가">
    <span class="ag-party-copy"><b>교실 게임 참가</b><small>TV에 나온 번호 4자리</small></span>
    <form class="ag-join" onsubmit="return false"><input id="gm-code" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="0000" aria-label="방 번호 4자리"><button type="button" class="yl-cta" data-action="arcade-party">들어가기</button></form>
  </section>`;
}

// 게임 단어 고르기 창(야차전 '단어 범위'와 같은 저장값). 닫으면 onDone으로 놀이터를 다시 그린다.
export function openWordsSheet(A, onDone) {
  const { codes, counts } = arcadeWords(A);
  const ranges = new Set(arcadeWords(A).picked);
  const groups = periodGroups(A, codes), tabbed = !!groups[0].period;
  let period = tabbed ? (groups.find(group => group.codes.some(code => ranges.has(code))) || groups[0]).period : null;
  const total = () => [...ranges].reduce((n, c) => n + (counts.get(c) || 0), 0);
  const draw = () => {
    const shown = tabbed ? groups.find(group => group.period === period).codes : codes, ok = ranges.size && total() >= GAME_WORDS_MIN;
    return `<div class="rs-head"><h2>${uiArt('study-vocab', 'rs-art')}게임 단어</h2></div>
      ${tabbed ? `<div class="ya-seg" role="group" aria-label="시험 구분">${groups.map(group => `<button type="button" data-rs-period="${group.period}" class="${period === group.period ? 'on' : ''}" aria-pressed="${period === group.period}">${esc(group.label)}</button>`).join('')}</div>` : ''}
      <div class="rs-codes">${shown.map(code => `<button type="button" data-rs-code="${esc(code)}" class="${ranges.has(code) ? 'on' : ''}" aria-pressed="${ranges.has(code)}"><b>${esc(rangeLabel(A.data.profile.school, code))}</b><small>${num(counts.get(code) || 0)}단어</small></button>`).join('')}</div>
      <button type="button" class="yl-cta" data-rs-done ${ok ? '' : 'disabled'}>${ok ? `${esc(wordsLabel(A, codes.filter(code => ranges.has(code))))} · ${num(total())}단어로 하기` : `${num(total())}단어 · ${GAME_WORDS_MIN}단어 이상 골라 주세요`}</button>`;
  };
  const sheet = openSheet(draw(), '게임 단어', { className: 'rs-sheet', onClose: onDone });
  const redraw = focus => { sheet.set(draw()); if (focus) sheet.box.querySelector(focus)?.focus(); };
  sheet.box.addEventListener('click', event => {
    const periodButton = event.target.closest('[data-rs-period]');
    if (periodButton) { period = periodButton.dataset.rsPeriod; return redraw(`[data-rs-period="${period}"]`); }
    const codeButton = event.target.closest('[data-rs-code]');
    if (codeButton) {
      const code = codeButton.dataset.rsCode;
      ranges.has(code) ? ranges.delete(code) : ranges.add(code);
      writePref(rangesKey(A), JSON.stringify([...ranges]));
      return redraw(`[data-rs-code="${CSS.escape(code)}"]`);
    }
    if (event.target.closest('[data-rs-done]')) sheet.close();
  });
}

export function partyCode() {
  const code = (document.getElementById('gm-code')?.value || '').replace(/\D/g, '').slice(0, 4);
  if (code.length !== 4) { toast('TV에 나온 번호 4자리를 넣어 주세요.'); return null; }
  return code;
}
