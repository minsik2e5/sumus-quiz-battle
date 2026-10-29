// V13.192 10초 맞추기 오늘의 챌린지 — 선생님 설정 창. 날짜별 목표 시간(0.50 ~ 30.00초) · 숫자 보임 · 한 줄 메시지.
// 오늘부터 13일 뒤까지 정할 수 있고, 안 정한 날은 자동(서버가 날짜로 5.00 ~ 15.00초). 규칙 검사는 timing-rules.js dailyCheck(서버와 같이).
import { $, api, esc, toast, modal, buttonBusy } from './ui.js';
import { TIMING, secText, dailyCheck } from './timing-rules.js';

const WEEK = '일월화수목금토';
const dayLabel = day => { const [y, m, d] = day.split('-').map(Number); return `${m}/${d}(${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`; };
const showLabel = ms => ms ? `숫자 ${ms / 1000}초 보임` : '처음부터 가림';
const QUICK = [3330, 5000, 7770, 10000, 12340, 15000];
// 입력한 초(소수 둘째 자리까지) → ms. 형식이 틀리면 NaN.
export const secondsToMs = text => /^\d{1,2}(\.\d{1,2})?$/.test(String(text).trim()) ? Math.round(Number(text) * 100) * 10 : NaN;

export const timingDailyEntry = () => `<button type="button" class="tmd-entry-v13192" data-action="timing-daily"><span aria-hidden="true">🎯</span><div><b>10초 맞추기 오늘의 챌린지</b><small>날짜별 목표 시간(예: 7.77초) 정하기</small></div><i aria-hidden="true">›</i></button>`;

export async function timingDailyModal() {
  const D = TIMING.DAILY;
  let view = null, pick = null;
  modal(`<div class="tmd-modal">
    <h2>🎯 오늘의 챌린지</h2>
    <p>날짜별 목표 시간을 정하면 그날 같은 학년끼리 그 시간으로 <b>하루 ${D.PLAYS}판</b> 겨뤄요(10.00초 기본 판과 따로). 안 정한 날은 <b>자동</b>(${secText(D.AUTO_MIN)} ~ ${secText(D.AUTO_MAX)}초). 참여만 해도 ${D.BONUS}코인, 등급 코인은 기존 표 그대로예요.</p>
    <p class="tmd-today" id="tmd-today">불러오는 중…</p>
    <form id="tmd-form" class="tmd-form" novalidate>
      <label class="field tmd-wide"><span>날짜</span><select id="tmd-day"></select></label>
      <label class="field"><span>목표 시간(초)</span><input id="tmd-target" class="tmd-target-input" inputmode="decimal" autocomplete="off" placeholder="7.77" maxlength="5"></label>
      <label class="field"><span>숫자 보임</span><select id="tmd-show">${D.SHOWS.map(ms => `<option value="${ms}">${showLabel(ms)}</option>`).join('')}</select></label>
      <div class="tmd-quick" role="group" aria-label="자주 쓰는 목표">${QUICK.map(ms => `<button type="button" data-tmd-quick="${ms}">${secText(ms)}</button>`).join('')}</div>
      <label class="field tmd-wide"><span>한 줄 메시지 (${D.MSG}자)</span><input id="tmd-msg" maxlength="${D.MSG}" placeholder="예: 오늘은 7.77초! 행운의 숫자" autocomplete="off"></label>
      <p class="tmd-error" id="tmd-error" role="alert" hidden></p>
      <div class="tmd-actions"><button type="button" class="btn secondary" id="tmd-auto">자동으로</button><button type="submit" class="btn primary" id="tmd-save">저장</button></div>
    </form>
    <ul class="tmd-days" id="tmd-days" aria-label="날짜별 챌린지"></ul>
  </div>`, '오늘의 챌린지', { className: 'tmd-sheet-v13192' });
  const error = text => { const e = $('#tmd-error'); if (!e) return; e.textContent = text || ''; e.hidden = !text; };
  const fill = day => {
    const c = view?.days.find(x => x.day === day);
    if (!c) return;
    pick = day;
    $('#tmd-day').value = day; $('#tmd-target').value = secText(c.target); $('#tmd-show').value = String(c.show); $('#tmd-msg').value = c.auto ? '' : c.msg;
    $('#tmd-auto').disabled = c.auto;
    document.querySelectorAll('.tmd-day').forEach(b => b.classList.toggle('on', b.dataset.tmdDay === day));
    error('');
  };
  const draw = v => {
    view = v;
    if (!$('#tmd-days')) return;
    $('#tmd-today').textContent = `오늘 ${v.played}명 도전${v.played ? ' · 오늘 것은 이제 바꿀 수 없어요' : ''}`;
    $('#tmd-day').innerHTML = v.days.map((c, i) => `<option value="${esc(c.day)}">${dayLabel(c.day)}${i ? '' : ' 오늘'} · ${c.auto ? '자동' : '정함'}</option>`).join('');
    $('#tmd-days').innerHTML = v.days.map((c, i) => `<li><button type="button" class="tmd-day" data-tmd-day="${esc(c.day)}"><span class="tmd-date">${dayLabel(c.day)}${i ? '' : '<em>오늘</em>'}</span><span class="tmd-val"><b>${secText(c.target)}초</b><small>${esc(showLabel(c.show))}${c.msg ? ` · ${esc(c.msg)}` : ''}</small></span><span class="tmd-tag${c.auto ? '' : ' set'}">${c.auto ? '자동' : '정함'}</span></button></li>`).join('');
    fill(pick && v.days.some(c => c.day === pick) ? pick : v.days[0].day);
  };
  const send = async (body, button) => {
    buttonBusy(button);
    try { draw(await api('/teacher/timing-daily', body)); toast(body.clear ? `${dayLabel(body.day)} 챌린지를 자동으로 돌렸어요.` : `${dayLabel(body.day)} 챌린지 ${secText(body.target_ms)}초로 정했어요.`); }
    catch (err) { error(err.message); }
    finally { buttonBusy(button, false); if (view) $('#tmd-auto').disabled = !!view.days.find(x => x.day === pick)?.auto; }
  };
  $('#tmd-day').onchange = e => fill(e.target.value);
  $('#tmd-days').onclick = e => { const b = e.target.closest('[data-tmd-day]'); if (b) fill(b.dataset.tmdDay); };
  document.querySelector('.tmd-quick').onclick = e => { const b = e.target.closest('[data-tmd-quick]'); if (b) { $('#tmd-target').value = secText(Number(b.dataset.tmdQuick)); error(''); } };
  $('#tmd-auto').onclick = e => send({ day: pick, clear: true }, e.currentTarget);
  $('#tmd-form').onsubmit = e => {
    e.preventDefault();
    const body = { day: pick, target_ms: secondsToMs($('#tmd-target').value), show_ms: Number($('#tmd-show').value), msg: $('#tmd-msg').value };
    const v = dailyCheck(body);
    if (v.error) return error(v.error);
    send(body, $('#tmd-save'));
  };
  try { draw(await api('/teacher/timing-daily')); }
  catch (err) { const t = $('#tmd-today'); if (t) t.textContent = err.message; }
}
