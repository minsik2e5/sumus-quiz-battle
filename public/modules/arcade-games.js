// V13.151 놀이터 '게임' 묶음: 낚시터 · 짝 맞추기 타임어택 · 교실 게임 참가.
// 짝 맞추기와 교실 게임은 야차전 '게임' 탭에 있다가 놀이터로 옮겨 왔다(야차전은 겨루기만: 대결 · 몬스터 · 던전 · 기록).
// 게임 단어는 야차전 '단어 범위'와 같은 저장값(sumus-yacha-ranges:<학생>)을 쓴다. 한쪽에서 바꾸면 다른 쪽도 같다.
import { esc, num, toast, rangeLabel } from './ui.js';
import { getRanges, periodGroups } from './student.js';
import { openSheet } from './sheet.js';
import { uiArt } from './emblems.js';
import { matchTime } from './match-rules.js';

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

export function gamesSection(A, reelEntry) {
  const w = arcadeWords(A), m = A.data.rewards?.match || {};
  return `<section class="ag-group" aria-label="게임"><h2 class="ag-head">게임</h2>
    ${reelEntry}
    <article class="gm-card gm-match">
      <div class="gm-art" aria-hidden="true"><span class="gm-mini en">brave</span><span class="gm-mini ko">용감한</span><span class="gm-mini en">calm</span><span class="gm-mini ko">차분한</span></div>
      <div class="gm-copy"><span class="gm-kicker">혼자 · 타임어택</span><h3>짝 맞추기 타임어택</h3><p>영어와 뜻 카드를 가장 빨리 지워요. 이번 주 1등에 도전!</p>
        <div class="gm-facts"><span>내 최고 <b>${m.best ? matchTime(m.best) : '—'}</b></span><span>오늘 코인 판 <b>${num(m.left ?? 5)}</b></span></div></div>
      <div class="ag-words"><span>게임 단어</span><b class="${w.ok ? 'ok' : 'need'}">${w.picked.length ? `${esc(wordsLabel(A, w.picked))} · ${num(w.n)}단어` : '아직 안 골랐어요'}</b><button type="button" class="btn small" data-action="arcade-words">바꾸기</button></div>
      <button type="button" class="yl-cta gm-go" data-action="arcade-match" ${w.ok ? '' : 'disabled'}>시작</button>
    </article>
    <article class="gm-card gm-party">
      <div class="gm-copy"><span class="gm-kicker">교실 TV · 반 전체</span><h3>교실 게임 참가</h3><p>선생님이 TV에 연 <b>보물 사냥</b>이나 <b>반 전체 낚시</b>에 들어가요. TV에 나온 번호 4자리를 넣어요.</p></div>
      <form class="gm-join" onsubmit="return false"><input id="gm-code" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="0000" aria-label="방 번호 4자리"><button type="button" class="yl-cta" data-action="arcade-party">들어가기</button></form>
    </article>
  </section>
  <h2 class="ag-head">상점 · 뽑기</h2>`;
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
