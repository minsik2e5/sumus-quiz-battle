// V13.90 카드로 가리고 외우기: one card at a time, the word on top and its meaning under a
// green cover. Pull the cover down a little to peek; pull it all the way down when you know the
// word — the card becomes 아는 카드 and leaves the next round. Swipe left (or 다음) for the next
// card. The cards you did not know come back round after round until every card is known.
// Known words are kept on this phone (per student), so the list can show 외운 단어 n/N.
import { esc, icon } from './ui.js';

const PREF_KEY = 'sumus:fc-prefs';
const knownKey = id => 'sumus:fc-known:' + id;
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
export const knownWords = profileId => new Set(load(knownKey(profileId), []));
const KNOWN_KEEP = 4000;

const shuffled = list => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const buzz = ms => { try { navigator.vibrate?.(ms); } catch {} };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// How far the cover must go down (of its full way) to count as 아는 카드.
const KNOWN_AT = .78;
const STRIP = 46; // the bit of cover left showing on a known card (다시 덮기)

/**
 * words: [{ id, word, meaning, source? }], title: what the deck is (범위 이름).
 * isStarred(id), toggleStar(id) → on, starMany(ids), speak(word): from the app.
 * onQuiz(ids, mode): start a practice with these words. onClose(): the list re-draws.
 */
export function openFlashcards({ words, title = '', profileId = 'me', isStarred = () => false, toggleStar = () => false, starMany = () => {}, speak = () => {}, onQuiz = null, onClose = () => {} }) {
  const all = words.filter(w => w && w.id && w.word);
  if (!all.length) return;
  const prefs = { face: 'word', shuffle: true, auto: false, ...load(PREF_KEY, {}) };
  const known = knownWords(profileId);
  const st = { deck: [], i: 0, round: 1, y: 0, peek: false };

  const box = document.createElement('div');
  box.className = 'fc-v1390';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', '카드로 가리고 외우기');
  document.body.appendChild(box);
  document.body.classList.add('fc-open-v1390');
  const lastFocus = document.activeElement;

  const persist = () => save(knownKey(profileId), [...known].slice(-KNOWN_KEEP));
  const close = () => {
    document.removeEventListener('keydown', onKey);
    try { speechSynthesis?.cancel(); } catch {}
    box.classList.add('bye');
    document.body.classList.remove('fc-open-v1390');
    setTimeout(() => box.remove(), reduced() ? 0 : 180);
    lastFocus?.focus?.();
    onClose();
  };

  /* ---------- 1. setup ---------- */
  function setup() {
    const before = all.filter(w => known.has(w.id)).length;
    const someKnown = before > 0 && before < all.length;
    box.innerHTML = `<div class="fc-top"><button type="button" class="fc-x" data-fc="close" aria-label="닫기">${icon('close')}</button><span class="fc-top-title">${esc(title)}</span><span></span></div>
      <div class="fc-setup">
        <div class="fc-setup-head"><span class="fc-deck-art" aria-hidden="true"><i></i><i></i><i></i></span><h2>카드로 가리고 외우기</h2><p>${esc(title)} · ${all.length}개${before ? ` · 외운 단어 ${before}개` : ''}</p></div>
        <div class="fc-opt"><span class="fc-opt-label">먼저 볼 쪽</span><div class="fc-seg" role="group" aria-label="먼저 볼 쪽">
          <button type="button" data-fc-face="word" aria-pressed="${prefs.face === 'word'}">영어 보고 뜻</button>
          <button type="button" data-fc-face="meaning" aria-pressed="${prefs.face === 'meaning'}">뜻 보고 영어</button></div></div>
        <label class="fc-opt fc-switch"><span class="fc-opt-label">카드 섞기</span><input type="checkbox" data-fc-pref="shuffle" ${prefs.shuffle ? 'checked' : ''}><i aria-hidden="true"></i></label>
        <label class="fc-opt fc-switch"><span class="fc-opt-label">발음 자동 듣기 <small>영어가 보일 때</small></span><input type="checkbox" data-fc-pref="auto" ${prefs.auto ? 'checked' : ''}><i aria-hidden="true"></i></label>
        ${someKnown ? `<label class="fc-opt fc-switch"><span class="fc-opt-label">외운 ${before}개는 빼고 시작</span><input type="checkbox" data-fc-skip checked><i aria-hidden="true"></i></label>` : before === all.length ? '<p class="fc-note">모두 외운 단어예요. 처음부터 다시 확인해요.</p>' : ''}
        <ol class="fc-howto">
          <li><b>뜻을 떠올려</b> 보세요.</li>
          <li>생각이 안 나면 초록 커버를 <b>조금 내려</b> 확인해요.</li>
          <li>확실히 알면 커버를 <b>끝까지 내려요</b> → 아는 카드는 다음 라운드에서 빠져요.</li>
          <li>카드를 <b>왼쪽으로 밀면</b> 다음 카드예요.</li>
        </ol>
        <button type="button" class="fc-start" data-fc="start">시작하기</button>
      </div>`;
    box.querySelectorAll('[data-fc-face]').forEach(b => b.onclick = () => {
      prefs.face = b.dataset.fcFace; save(PREF_KEY, prefs);
      box.querySelectorAll('[data-fc-face]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    });
    box.querySelectorAll('[data-fc-pref]').forEach(input => input.onchange = () => { prefs[input.dataset.fcPref] = input.checked; save(PREF_KEY, prefs); });
    box.querySelector('[data-fc="start"]').onclick = () => {
      const skip = box.querySelector('[data-fc-skip]')?.checked;
      if (!skip) { for (const w of all) known.delete(w.id); persist(); }
      start(all.filter(w => !known.has(w.id)), 1);
    };
    box.querySelector('[data-fc="start"]').focus();
  }

  /* ---------- 2. cards ---------- */
  function start(list, round) {
    st.deck = prefs.shuffle ? shuffled(list) : list.slice();
    st.i = 0; st.round = round;
    box.innerHTML = `<div class="fc-top"><button type="button" class="fc-x" data-fc="close" aria-label="그만하기">${icon('close')}</button>
        <span class="fc-count" aria-live="polite"></span><span class="fc-round"></span></div>
      <div class="fc-stage"></div>
      <div class="fc-nav"><button type="button" class="fc-prev" data-fc="prev" aria-label="이전 카드">${icon('back')}</button><button type="button" class="fc-know" data-fc="know"></button><button type="button" class="fc-next" data-fc="next" aria-label="다음 카드">${icon('arrow')}</button></div>`;
    show(0);
  }
  const card = () => st.deck[st.i];
  const promptOf = w => prefs.face === 'word' ? w.word : w.meaning;
  const answerOf = w => prefs.face === 'word' ? w.meaning : w.word;
  function counts() {
    const k = st.deck.filter(w => known.has(w.id)).length;
    box.querySelector('.fc-count').innerHTML = `<b>✓ ${k}</b> <i>|</i> ${st.deck.length}`;
    box.querySelector('.fc-round').textContent = `${st.round}라운드 · ${st.i + 1}/${st.deck.length}`;
    const w = card(), on = known.has(w.id);
    const kb = box.querySelector('.fc-know');
    kb.textContent = on ? '다시 덮기' : '알아요 ✓';
    kb.classList.toggle('on', on);
    box.querySelector('.fc-prev').disabled = st.i === 0;
  }
  function show(dir) {
    const w = card(), on = known.has(w.id), star = isStarred(w.id);
    const stage = box.querySelector('.fc-stage');
    stage.innerHTML = `<article class="fc-card ${on ? 'known' : ''} ${dir > 0 ? 'in-right' : dir < 0 ? 'in-left' : ''}">
      <header class="fc-tools">
        <button type="button" class="fc-tool" data-fc="speak" aria-label="발음 듣기">${icon('sound')}</button>
        <button type="button" class="fc-tool fc-star ${star ? 'on' : ''}" data-fc="star" aria-pressed="${star}" aria-label="${star ? '어려운 단어 해제' : '어려운 단어 표시'}">${star ? '★' : '☆'}</button>
        <span class="fc-badge" aria-hidden="${!on}">✓<small>아는 카드</small></span>
      </header>
      <div class="fc-prompt ${prefs.face === 'meaning' ? 'is-meaning' : ''}"><strong>${esc(promptOf(w))}</strong><small class="fc-out">다음 라운드부터 빠져요</small></div>
      <div class="fc-answer">
        <div class="fc-answer-in"><strong class="${prefs.face === 'word' ? 'is-meaning' : ''}">${esc(answerOf(w))}</strong>${w.source ? `<small>${esc(w.source)}</small>` : ''}</div>
        <div class="fc-cover" role="button" tabindex="0" aria-label="${on ? '아는 카드예요. 다시 덮으려면 누르세요' : '뜻 가림막. 아래로 내리면 뜻이 보여요'}">
          <span class="fc-cover-text"><span class="fc-chev" aria-hidden="true">︾</span>${prefs.face === 'word' ? '뜻' : '영어'}을 가리고 기억해 보세요.<br>생각이 안 나면 커버를 조금 내려<br>확인하고 다음 카드로 넘기세요!</span>
          <span class="fc-cover-strip">아는 단어가 아니면 다시 덮어요 <b aria-hidden="true">︽</b></span>
        </div>
      </div>
    </article>`;
    st.peek = false;
    setY(on ? maxY() : 0, false);
    bindCard();
    counts();
    if (prefs.auto && prefs.face === 'word') speak(w);
  }
  const cardEl = () => box.querySelector('.fc-card');
  const coverEl = () => box.querySelector('.fc-cover');
  const maxY = () => Math.max(60, (box.querySelector('.fc-answer')?.clientHeight || 260) - STRIP);
  function setY(y, animate = true) {
    st.y = y;
    const c = coverEl(); if (!c) return;
    c.classList.toggle('glide', animate);
    c.style.transform = `translateY(${Math.round(y)}px)`;
    c.classList.toggle('down', y >= maxY() * KNOWN_AT);
  }
  function setKnown(on) {
    const w = card();
    if (on) known.add(w.id); else known.delete(w.id);
    persist();
    cardEl().classList.toggle('known', on);
    cardEl().querySelector('.fc-badge').setAttribute('aria-hidden', String(!on));
    coverEl().setAttribute('aria-label', on ? '아는 카드예요. 다시 덮으려면 누르세요' : '뜻 가림막. 아래로 내리면 뜻이 보여요');
    setY(on ? maxY() : 0);
    st.peek = false;
    if (on) buzz(12);
    counts();
  }
  function go(step) {
    const next = st.i + step;
    if (next < 0) return;
    if (next >= st.deck.length) return roundEnd();
    const el = cardEl();
    if (el && !reduced()) {
      el.classList.add(step > 0 ? 'out-left' : 'out-right');
      setTimeout(() => { st.i = next; show(step); }, 170);
    } else { st.i = next; show(step); }
  }
  function bindCard() {
    const c = coverEl(), el = cardEl();
    let drag = null;
    c.addEventListener('pointerdown', e => {
      e.stopPropagation();
      drag = { y0: e.clientY, base: st.y, moved: false };
      c.setPointerCapture?.(e.pointerId);
      c.classList.remove('glide');
    });
    c.addEventListener('pointermove', e => {
      if (!drag) return;
      const dy = e.clientY - drag.y0;
      if (Math.abs(dy) > 6) drag.moved = true;
      if (drag.moved) setY(Math.min(maxY(), Math.max(0, drag.base + dy)), false);
    });
    const up = () => {
      if (!drag) return;
      const wasKnown = known.has(card().id), moved = drag.moved;
      drag = null;
      if (!moved) {
        // A tap: a known card is covered again; otherwise peek half way, or cover back.
        if (wasKnown) return setKnown(false);
        st.peek = !st.peek;
        return setY(st.peek ? maxY() * .5 : 0);
      }
      if (st.y >= maxY() * KNOWN_AT) return wasKnown ? setY(maxY()) : setKnown(true);
      if (wasKnown) return setKnown(false);
      st.peek = false;
      setY(0);
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKnown(!known.has(card().id)); } });
    // Swipe the card sideways: left = next, right = back.
    let sw = null;
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('button,.fc-cover')) return;
      sw = { x0: e.clientX, y0: e.clientY, dx: 0 };
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!sw) return;
      sw.dx = e.clientX - sw.x0;
      if (Math.abs(sw.dx) > Math.abs(e.clientY - sw.y0)) el.style.transform = `translateX(${sw.dx * .6}px) rotate(${sw.dx / 40}deg)`;
    });
    const end = () => {
      if (!sw) return;
      const dx = sw.dx; sw = null;
      el.style.transform = '';
      if (dx < -60) go(1); else if (dx > 60) go(-1);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  /* ---------- 3. end of a round ---------- */
  function roundEnd() {
    const left = st.deck.filter(w => !known.has(w.id));
    const done = st.deck.length - left.length;
    const unstarred = left.filter(w => !isStarred(w.id));
    if (!left.length) {
      const total = all.filter(w => known.has(w.id)).length;
      buzz([20, 40, 20]);
      box.innerHTML = `<div class="fc-top"><button type="button" class="fc-x" data-fc="close" aria-label="닫기">${icon('close')}</button><span></span><span></span></div>
        <div class="fc-end all-known">
          <span class="fc-end-burst" aria-hidden="true">🎉</span>
          <h2>다 외웠어요!</h2>
          <p>${esc(title)} ${total}/${all.length}개를 모두 아는 카드로 만들었어요${st.round > 1 ? ` · ${st.round}라운드` : ''}.</p>
          ${onQuiz ? `<button type="button" class="fc-start" data-fc="quiz">바로 확인 테스트 <small>${prefs.face === 'word' ? '영어 → 뜻' : '뜻 → 영어'} · ${Math.min(200, all.length)}문제</small></button>` : ''}
          <button type="button" class="fc-ghost" data-fc="again">처음부터 다시 보기</button>
          <button type="button" class="fc-ghost" data-fc="close">닫기</button>
        </div>`;
      return;
    }
    box.innerHTML = `<div class="fc-top"><button type="button" class="fc-x" data-fc="close" aria-label="닫기">${icon('close')}</button><span></span><span></span></div>
      <div class="fc-end">
        <span class="fc-end-round">${st.round}라운드 끝!</span>
        <div class="fc-end-meter" aria-label="아는 카드 ${done}/${st.deck.length}"><i style="width:${Math.round(done / st.deck.length * 100)}%"></i></div>
        <p>아는 카드 <b>${done}</b> · 아직 헷갈리는 카드 <b>${left.length}</b></p>
        <ul class="fc-left-list">${left.slice(0, 8).map(w => `<li><b>${esc(w.word)}</b><span>${esc(w.meaning)}</span></li>`).join('')}${left.length > 8 ? `<li class="more">외 ${left.length - 8}개</li>` : ''}</ul>
        <button type="button" class="fc-start" data-fc="next-round">헷갈리는 ${left.length}개로 ${st.round + 1}라운드</button>
        ${unstarred.length ? `<button type="button" class="fc-ghost" data-fc="star-left">★ 어려운 단어에 ${unstarred.length}개 담기</button>` : '<p class="fc-note">헷갈리는 단어는 모두 ★ 어려운 단어에 담겨 있어요.</p>'}
        <button type="button" class="fc-ghost" data-fc="close">오늘은 그만하기</button>
      </div>`;
  }

  /* ---------- buttons and keys ---------- */
  box.addEventListener('click', e => {
    const b = e.target.closest('[data-fc]');
    if (!b) return;
    const what = b.dataset.fc;
    if (what === 'close') return close();
    if (what === 'prev') return go(-1);
    if (what === 'next') return go(1);
    if (what === 'know') return setKnown(!known.has(card().id));
    if (what === 'speak') return speak(card());
    if (what === 'star') {
      const on = toggleStar(card().id);
      b.classList.toggle('on', on); b.textContent = on ? '★' : '☆'; b.setAttribute('aria-pressed', String(on));
      return;
    }
    if (what === 'next-round') return start(st.deck.filter(w => !known.has(w.id)), st.round + 1);
    if (what === 'star-left') {
      const ids = st.deck.filter(w => !known.has(w.id) && !isStarred(w.id)).map(w => w.id);
      starMany(ids);
      b.outerHTML = `<p class="fc-note">★ 어려운 단어에 ${ids.length}개 담았어요.</p>`;
      return;
    }
    if (what === 'again') { for (const w of all) known.delete(w.id); persist(); return start(all, 1); }
    if (what === 'quiz') {
      const ids = all.map(w => w.id).slice(0, 200), mode = prefs.face === 'word' ? 'eng2mean' : 'mean2eng';
      close();
      return onQuiz(ids, mode);
    }
  });
  function onKey(e) {
    if (e.key === 'Escape') return close();
    if (!box.querySelector('.fc-card') || e.target.closest?.('input,textarea')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (!known.has(card().id)) setKnown(true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (known.has(card().id)) setKnown(false); }
  }
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => box.classList.add('open'));
  setup();
}
