import { api, esc, num, icon, modal, toast } from './ui.js';
import { titleBadge, titleEmblem, coin, trophy } from './emblems.js';
import { avatar } from './character.js';

// V13.66 academy tournament (학원 대회) drawing: the bracket (teacher and students) and a
// student's card with their next match. The server sends the tournament ready to draw
// (tournamentView in server/service.mjs).

const matchState = m => m.winner
  ? (m.by === 'bye' ? '부전승' : m.by === 'teacher' ? '선생님 판정' : '경기 끝')
  : m.live === 'active' ? '경기 중' : m.live === 'waiting' ? '입장 대기' : m.a && m.b ? '경기 전' : '상대 기다리는 중';
function slot(m, side, meId) {
  const p = m[side];
  if (!p) return `<div class="tn-slot empty"><span>${m.winner && m.by === 'bye' ? '—' : '?'}</span></div>`;
  const win = !!m.winner && m.winner === p.id, lose = !!m.winner && m.winner !== p.id;
  return `<div class="tn-slot${win ? ' win' : ''}${lose ? ' lose' : ''}${p.id === meId ? ' me' : ''}"><span>${esc(p.name)}</span>${win ? '<b>승</b>' : ''}</div>`;
}
export function bracketHtml(t, { teacher = false, meId = null } = {}) {
  const rounds = t.rounds.map(round => `<div class="tn-round"><h4>${esc(round.label)}</h4><div class="tn-matches">${round.matches.map(m => `
    <div class="tn-match${m.winner ? ' done' : ''}${m.live ? ' live' : ''}${meId && (m.a?.id === meId || m.b?.id === meId) ? ' mine' : ''}">
      ${slot(m, 'a', meId)}${slot(m, 'b', meId)}
      <small class="tn-state">${matchState(m)}${m.draws ? ` · 무승부 ${m.draws}번` : ''}</small>
      ${teacher && t.status === 'active' && !m.winner && m.a && m.b ? `<div class="tn-decide" role="group" aria-label="승자 지정"><button type="button" data-tn-decide="${esc(t.id)}" data-match="${esc(m.id)}" data-winner="${esc(m.a.id)}" data-name="${esc(m.a.name)}">${esc(m.a.name)} 승</button><button type="button" data-tn-decide="${esc(t.id)}" data-match="${esc(m.id)}" data-winner="${esc(m.b.id)}" data-name="${esc(m.b.name)}">${esc(m.b.name)} 승</button></div>` : ''}
    </div>`).join('')}</div></div>`).join('');
  return `<div class="tn-scroll"><div class="tn-bracket">${rounds}<div class="tn-round tn-final"><h4>우승</h4><div class="tn-matches"><div class="tn-champ${t.champion ? ' on' : ''}">${trophy('lg')}<b>${t.champion ? esc(t.champion.name) : '누가 될까요?'}</b>${t.runner_up ? `<small>준우승 ${esc(t.runner_up.name)}</small>` : ''}</div></div></div></div></div>`;
}
const prizeLine = t => t.prize ? `${coin()} 우승 ${num(t.prize)} · 준우승 ${num(Math.floor(t.prize / 2))}` : '상금 없음';

// A student's tournament card: their next match, waiting, out, or the result.
export function tournamentCard(t, { compact = false } = {}) {
  const me = t.me || {}, m = me.match;
  let line = '', action = '';
  if (t.status === 'finished') {
    line = me.champion ? '<b>우승했어요!</b> SUMUS 챔피언 칭호를 받았어요.' : `우승 <b>${esc(t.champion?.name || '')}</b>${t.runner_up ? ` · 준우승 ${esc(t.runner_up.name)}` : ''}`;
  } else if (me.out) {
    line = `${esc(me.out)}에서 아쉽게 멈췄어요. 끝까지 응원해요!`;
  } else if (m && !m.ready) {
    line = `<b>${esc(m.round)}</b> 진출! 상대가 정해지면 경기를 할 수 있어요.`;
  } else if (m) {
    const waitingForMe = m.room && !m.room.host;
    line = `<span class="tn-vs"><b>${esc(m.round)}</b> vs <span class="tn-opp">${m.opponent?.pet ? avatar(m.opponent.pet.key, { size: 'mini', form: Math.max(1, m.opponent.pet.form) }) : ''}${esc(m.opponent?.name || '')}</span>${m.opponent?.title && m.opponent.title !== 'rookie' ? titleBadge(m.opponent.title, { size: 'xs' }) : ''}</span>${m.draws ? `<small>무승부 ${m.draws}번 · 다시 겨뤄요</small>` : ''}`;
    action = `<button type="button" class="btn primary full tn-play" data-action="tournament-play" data-tournament="${esc(t.id)}" data-match="${esc(m.id)}">${m.room?.host ? '대기실로 가기' : waitingForMe ? '상대가 기다려요 · 입장하기' : '경기 시작'} ${icon('arrow')}</button>`;
  }
  return `<section class="tn-card${t.status === 'finished' ? ' finished' : ''}${compact ? ' compact' : ''}">
    <div class="tn-card-head">${trophy('md')}<div><small>학원 야차 대회 · ${esc(t.class_name || t.grade || '')}</small><strong>${esc(t.name)}</strong></div><button type="button" class="tn-bracket-open" data-action="tournament-bracket" data-tournament="${esc(t.id)}">대진표</button></div>
    <div class="tn-line">${line}</div>
    ${action}
    <p class="tn-foot">${t.mode === 'skill' ? '실력전' : '스피드전'} · 판돈 없는 대결 · ${prizeLine(t)}</p>
  </section>`;
}

// The bracket in a pop-up, fetched fresh (a match may have just ended). `fallback` is the copy
// the screen already has, used when the network is slow.
export async function openBracket(id, meId, fallback = null) {
  let t = fallback;
  try { t = (await api(`/tournament/view?id=${encodeURIComponent(id)}`)).tournament; }
  catch (err) { if (!t) return toast(err.message); }
  modal(`<h2>${esc(t.name)}</h2><p>${esc(t.class_name || t.grade || '')} · ${num(t.players)}명 · 판돈 없는 대결</p>${bracketHtml(t, { meId })}`, '대진표');
}
