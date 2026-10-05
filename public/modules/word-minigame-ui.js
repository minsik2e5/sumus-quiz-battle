import { esc } from './ui.js';
import { MINIGAME_KINDS, BOMB_COMBO, TILE_WORDS, createGame, bonusText } from './word-minigame.js';

// V13.104 단어 미니게임 screen: a card over the battle screen (a sheet at the bottom of a phone,
// in the middle on a pad) with three steps: an intro (the match stands still until the 시작! tap),
// the game, and a result with the bonus. The rules are word-minigame.js. Everything a thumb needs
// is in the lower half, and 건너뛰기 is always there (a small button at the top, so a fast tap on
// the game cannot hit it). With 움직임 줄이기 on nothing moves: a wrong tap is a red mark and a
// word, not a shake.

const ICON = { tiles: '🔤', ox: '⭕', bomb: '💣' };
const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);

// `reduced`: the player asked for less motion. `sfx(name)`: the battle screen's sounds.
// `finish({ kind, stars })` is called once when the game is over (stars 0 = skipped or lost).
// Returns `cancel()`, which closes the card without finishing (the match was left).
export function openMiniGame({ kind, words, reduced = false, sfx = () => {}, finish }) {
  const info = MINIGAME_KINDS[kind], game = createGame(kind, words);
  if (!info || !game) { finish?.({ kind, stars: 0 }); return () => {}; }
  const before = document.activeElement;
  const attack = info.bonus === 'boost';
  const el = document.createElement('div');
  el.className = `mg-overlay mg-kind-${kind}${reduced ? ' mg-calm' : ''}`;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'mg-title');
  el.innerHTML = `<div class="mg-card">
    <div class="mg-top"><b class="mg-tag">${attack ? '⚔️ 공격 강화 도전' : '🛡️ 방어막 도전'}</b><button type="button" class="mg-skip" data-mg="skip">건너뛰기</button></div>
    <div class="mg-clock" id="mg-clock" hidden><div class="mg-bar"><i id="mg-bar"></i></div><span id="mg-sec" aria-hidden="true"></span></div>
    <div class="mg-body" id="mg-body"></div>
    <div class="mg-foot" id="mg-foot"></div>
  </div>`;
  document.body.append(el);
  const body = el.querySelector('#mg-body'), foot = el.querySelector('#mg-foot'), clock = el.querySelector('#mg-clock');
  let phase = 'intro', t0 = 0, timer = null, closed = false;
  const elapsed = () => Date.now() - t0;
  const tilesLeft = () => game.left ? game.left(elapsed()) : Math.max(0, game.limit - elapsed());

  function close(result) {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    document.removeEventListener('keydown', onKey, true);
    el.remove();
    try { before?.focus?.({ preventScroll: true }); } catch {}
    if (result) finish?.(result);
  }

  /* ---- intro ---- */
  function intro() {
    phase = 'intro';
    body.innerHTML = `<div class="mg-icon" aria-hidden="true">${ICON[kind]}</div><h2 id="mg-title">${esc(info.name)}</h2>
      <p class="mg-line">${esc(info.line)}</p>
      <p class="mg-prize">잘하면 <b>${esc(bonusText(kind, 3))}</b> · 약 ${Math.round(info.ms / 1000)}초</p>
      <p class="mg-note">경기 시간은 멈춰 있어요. 코인은 걸려 있지 않아요.</p>`;
    foot.innerHTML = '<button type="button" class="mg-go" data-mg="start">시작!</button><button type="button" class="mg-later" data-mg="skip">건너뛰고 계속하기</button>';
    foot.querySelector('.mg-go').focus({ preventScroll: true });
  }

  /* ---- playing ---- */
  function start() {
    phase = 'play';
    t0 = Date.now();
    clock.hidden = false;
    body.removeAttribute('aria-live');
    sfx('go');
    draw();
    timer = setInterval(tick, 100);
    tick();
  }
  function tick() {
    if (phase !== 'play') return;
    const left = tilesLeft();
    el.querySelector('#mg-bar').style.width = `${Math.max(0, left / game.limit * 100)}%`;
    el.querySelector('#mg-sec').textContent = Math.ceil(left / 1000);
    clock.classList.toggle('low', left <= 4000);
    if (left <= 0) end();
  }
  function draw() {
    if (kind === 'tiles') drawTiles();
    else if (kind === 'ox') drawOx();
    else drawBomb();
  }
  function end() {
    if (phase === 'result') return;
    phase = 'result';
    clearInterval(timer);
    game.finished = true;
    const n = game.stars();
    const detail = kind === 'tiles' ? `단어 ${game.done}/${TILE_WORDS}개 완성 · 틀린 타일 ${game.mistakes}번`
      : kind === 'ox' ? `맞힌 ${game.right} · 틀린 ${game.wrong}`
      : game.won ? `폭탄 해제! ${(game.elapsed / 1000).toFixed(1)}초` : `콤보 ${game.combo}/${BOMB_COMBO}에서 시간이 다 됐어요`;
    sfx(n ? 'win' : 'lose');
    clock.hidden = true;
    el.querySelector('.mg-skip').hidden = true;
    body.setAttribute('aria-live', 'polite');
    body.innerHTML = `<h2 id="mg-title">${n ? (n === 3 ? '완벽해요!' : '좋아요!') : '아쉬워요'}</h2>
      <div class="mg-stars s${n}" role="img" aria-label="별 3개 중 ${n}개">${stars(n)}</div>
      <p class="mg-line">${esc(detail)}</p>
      <p class="mg-prize ${n ? 'got' : ''}">${n ? `${attack ? '⚔️' : '🛡️'} <b>${esc(bonusText(kind, n))}</b> · 다음 ${attack ? '공격' : '받는 공격'}에` : '이번에는 보너스가 없어요'}</p>`;
    foot.innerHTML = '<button type="button" class="mg-go" data-mg="next">이어서 싸우기</button>';
    foot.querySelector('.mg-go').focus({ preventScroll: true });
    game.result = n;
  }

  function mark(button, bad) {
    if (!button) return;
    button.classList.add(bad ? 'bad' : 'good');
    setTimeout(() => button.classList.remove('bad', 'good'), 420);
  }

  // 1. 철자 타일
  function drawTiles() {
    const round = game.rounds[game.round], word = game.target;
    body.innerHTML = `<p class="mg-count">단어 ${Math.min(game.round + 1, TILE_WORDS)}/${TILE_WORDS}</p>
      <h2 class="mg-meaning" id="mg-title">${esc(round.meaning)}</h2>
      <div class="mg-slots" aria-label="지금까지 ${esc(word.slice(0, game.pos).toUpperCase().split('').join(' '))}">${[...word].map((ch, i) => `<span class="${i < game.pos ? 'on' : i === game.pos ? 'next' : ''}">${i < game.pos ? esc(ch.toUpperCase()) : ''}</span>`).join('')}</div>
      <p class="mg-status" id="mg-status" aria-live="polite">${game.penalty ? `틀린 타일 ${game.mistakes}번 · −${game.penalty / 1000}초` : '글자를 순서대로 눌러요'}</p>`;
    foot.innerHTML = `<div class="mg-tiles">${game.tiles.map((t, i) => `<button type="button" class="mg-tile${t.used ? ' used' : ''}" data-mg="tile" data-i="${i}" ${t.used ? 'disabled' : ''} aria-label="${esc(t.ch.toUpperCase())}">${esc(t.ch.toUpperCase())}</button>`).join('')}</div>`;
  }
  function pressTile(button) {
    const out = game.press(Number(button.dataset.i), elapsed());
    if (out === 'wrong') {
      sfx('wrong');
      try { navigator.vibrate?.(30); } catch {}
      mark(button, true);
      const status = el.querySelector('#mg-status');
      if (status) status.textContent = `앗! 틀린 타일 · −1초 (${game.mistakes}번)`;
      tick();
      return;
    }
    sfx(out === 'right' ? 'tick' : 'hit');
    if (out === 'win') return end();
    draw();
  }

  // 2. O/X 연타
  function drawOx() {
    body.innerHTML = `<h2 class="mg-sr" id="mg-title">${esc(info.name)}</h2><p class="mg-hint">단어와 뜻이 <b>맞으면 ○ 오른쪽</b> · <b>틀리면 ✕ 왼쪽</b></p>
      <div class="mg-pair" id="mg-pair"></div><p class="mg-last" id="mg-last" aria-live="polite"></p><p class="mg-score" id="mg-score"></p>`;
    foot.innerHTML = '<div class="mg-ox-row"><button type="button" class="mg-ox no" data-mg="ox" data-v="0"><b>✕</b>달라요</button><button type="button" class="mg-ox yes" data-mg="ox" data-v="1"><b>○</b>맞아요</button></div>';
    pair();
  }
  function pair() {
    const c = game.current;
    el.querySelector('#mg-pair').innerHTML = `<b class="mg-eng">${esc(c.word.word)}</b><span class="mg-mean">${esc(c.shown)}</span>`;
    const last = game.last;
    el.querySelector('#mg-last').innerHTML = last ? `<span class="${last.ok ? 'ok' : 'miss'}">${last.ok ? '○ 정답' : '✕ 오답'}</span> ${esc(last.word)} = ${esc(last.meaning)}` : '&nbsp;';
    el.querySelector('#mg-score').textContent = `맞힌 ${game.right} · 틀린 ${game.wrong}`;
  }
  function pressOx(button) {
    const out = game.answer(button.dataset.v === '1');
    if (out === 'end') return;
    sfx(out === 'right' ? 'tick' : 'wrong');
    mark(button, out === 'wrong');
    pair();
  }

  // 3. 폭탄 해제
  function drawBomb() {
    body.innerHTML = `<h2 class="mg-sr" id="mg-title">${esc(info.name)}</h2>
      <div class="mg-pips" role="img" aria-label="콤보 ${game.combo}/${BOMB_COMBO}">${Array.from({ length: BOMB_COMBO }, (_, i) => `<i class="${i < game.combo ? 'on' : ''}"></i>`).join('')}</div>
      <p class="mg-meaning">${esc(game.target.meaning)}</p>
      <p class="mg-status" id="mg-status" aria-live="polite">${game.last ? `틀렸어요! ${esc(game.last.word)} = ${esc(game.last.meaning)} · 처음부터!` : `연속 ${BOMB_COMBO}번 맞히면 해제`}</p>`;
    foot.innerHTML = `<div class="mg-cards">${game.cards.map((w, i) => `<button type="button" class="mg-card-word" data-mg="card" data-i="${i}">${esc(w)}</button>`).join('')}</div>`;
  }
  function pressCard(button) {
    const out = game.press(Number(button.dataset.i), elapsed());
    if (out === 'none' || out === 'end') return;
    if (out === 'win') { sfx('crit'); return end(); }
    if (out === 'wrong') { sfx('wrong'); try { navigator.vibrate?.(30); } catch {} } else sfx('tick');
    drawBomb();
    if (out === 'wrong') mark(foot.querySelector('.mg-cards'), true);
  }

  /* ---- input ---- */
  el.addEventListener('click', event => {
    const b = event.target.closest('[data-mg]');
    if (!b || b.disabled || closed) return;
    event.stopPropagation();
    const act = b.dataset.mg;
    if (act === 'skip') return close({ kind, stars: 0 });
    if (act === 'start' && phase === 'intro') return start();
    if (act === 'next' && phase === 'result') return close({ kind, stars: game.result || 0 });
    if (phase !== 'play') return;
    if (act === 'tile') return pressTile(b);
    if (act === 'ox') return pressOx(b);
    if (act === 'card') return pressCard(b);
  });
  // Pad / computer: Esc skips, ← ✕ and → ○ in the O/X game, Enter starts and continues.
  function onKey(event) {
    if (closed) return;
    const key = event.key;
    if (key === 'Escape') { event.preventDefault(); event.stopPropagation(); return close({ kind, stars: phase === 'result' ? game.result || 0 : 0 }); }
    if (phase === 'play' && kind === 'ox' && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      event.preventDefault(); event.stopPropagation();
      return pressOx(foot.querySelector(`.mg-ox.${key === 'ArrowRight' ? 'yes' : 'no'}`));
    }
    if (key === 'Enter' && phase !== 'play' && document.activeElement === document.body) { event.preventDefault(); foot.querySelector('.mg-go')?.click(); }
  }
  document.addEventListener('keydown', onKey, true);
  intro();
  return () => close(null);
}
