// V13.142 학습 보상 이벤트 화면: 학생 홈 배너, 학습 결과 줄, 선생님 이벤트 창.
// 남은 시간은 서버 시간(bootstrap의 server_time + 받은 뒤 흐른 시간)으로 센다. 폰 시계는 쓰지 않는다.
import { $, api, esc, toast, modal, buttonBusy } from './ui.js';

const HOUR = 3600000, DAY = 24 * HOUR;
const GRADES = { middle: ['중1', '중2', '중3'], high: ['고1', '고2', '고3'] };
export const multiplierText = m => `${m}배`;
export const serverNow = A => Number(A?.data?.server_time || 0) ? Number(A.data.server_time) + (Date.now() - Number(A.loadedAt || Date.now())) : Date.now();
// 3일 남음 · 끝나기 24시간 전부터는 5시간 남음 · 1시간 안이면 40분 남음
export function leftText(ms) {
  if (ms >= DAY) return `${Math.floor(ms / DAY)}일 남음`;
  if (ms >= HOUR) return `${Math.floor(ms / HOUR)}시간 남음`;
  return `${Math.max(1, Math.ceil(ms / 60000))}분 남음`;
}
const kstInput = ms => new Date(ms + 9 * HOUR).toISOString().slice(0, 16);
const kstLabel = ms => { const s = kstInput(ms); return `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))} ${s.slice(11, 16)}`; };

let bannerTimer = null;
// 학생 홈 맨 위. 끝나는 순간 저절로 사라진다(다음 bootstrap에는 서버가 더 보내지 않는다).
export function rewardEventBanner(A) {
  const e = A.data?.reward_event;
  clearTimeout(bannerTimer);
  if (!e) return '';
  const left = Number(e.end_at) - serverNow(A);
  if (left <= 0) return '';
  bannerTimer = setTimeout(() => {
    if (A.data?.reward_event?.id === e.id) A.data.reward_event = null;
    document.querySelector('.reward-event-v13142')?.remove();
  }, Math.min(left, 2 ** 31 - 1));
  return `<section class="reward-event-v13142" role="status"><span class="rev-mark" aria-hidden="true">🎉</span><div><b>학습 보상 ${multiplierText(e.multiplier)} · ${leftText(left)}</b><small>${esc(e.name)} · 연습·시험 코인과 경험치</small></div><strong class="rev-x" aria-hidden="true">×${e.multiplier}</strong></section>`;
}
// 학습 결과 화면: 이벤트로 더 받은 만큼.
export function rewardEventResult(x) {
  const e = x?.reward_event;
  if (!e) return '';
  const parts = [e.coins ? `코인 +${e.coins}` : '', e.xp ? `경험치 +${e.xp}` : ''].filter(Boolean).join(' · ');
  return `<div class="result-event-v13142"><span aria-hidden="true">🎉</span><div><b>${esc(e.name)} · 학습 보상 ${multiplierText(e.multiplier)}</b><small>이벤트로 ${parts} 더 받았어요</small></div></div>`;
}

/* ---------- 선생님: 이벤트 만들기 · 목록 ---------- */
// 폰에서는 머리말에 자리가 없어서 대시보드 맨 위 한 줄로 연다(큰 화면은 머리말 버튼).
export const rewardEventEntry = () => `<button type="button" class="rev-entry-v13142" data-action="reward-events"><span aria-hidden="true">🎉</span><div><b>학습 보상 이벤트</b><small>연습·시험 코인과 경험치 1.5배·2배 기간 정하기</small></div><i aria-hidden="true">›</i></button>`;
const STATUS = { live: ['진행 중', 'live'], upcoming: ['예정', 'upcoming'], ended: ['끝남', 'ended'] };
function eventRow(e) {
  const [label, cls] = STATUS[e.status] || STATUS.ended;
  const actions = e.status === 'ended'
    ? `<button type="button" class="text-button rev-del" data-rev-delete="${esc(e.id)}">지우기</button>`
    : `<button type="button" class="btn secondary small" data-rev-end="${esc(e.id)}">${e.status === 'live' ? '미리 끝내기' : '취소'}</button><button type="button" class="text-button rev-del" data-rev-delete="${esc(e.id)}">지우기</button>`;
  return `<li class="rev-row ${cls}"><div class="rev-row-main"><span class="rev-status ${cls}">${label}</span><b>${esc(e.name)}</b><em>×${e.multiplier}</em></div><small>${esc(e.target_label)} · ${kstLabel(e.start_at)} ~ ${kstLabel(e.end_at)}${e.ended_early ? ' (일찍 끝냄)' : ''}</small><div class="rev-row-actions">${actions}</div></li>`;
}
function listHtml(events) {
  if (!events.length) return '<p class="rev-empty">아직 만든 이벤트가 없어요.</p>';
  const order = ['live', 'upcoming', 'ended'];
  return order.map(status => {
    const rows = events.filter(e => e.status === status);
    return rows.length ? `<h3 class="rev-group">${STATUS[status][0]} ${rows.length}</h3><ul class="rev-list">${rows.map(eventRow).join('')}</ul>` : '';
  }).join('');
}
export async function rewardEventModal(A) {
  const schools = A.data.schools || [];
  const now = serverNow(A);
  const startDefault = kstInput(now);
  const endDefault = kstInput(now + 7 * DAY).slice(0, 10) + 'T23:59';
  const schoolOptions = schools.map(s => `<option value="${esc(s.id)}" ${s.id === A.data.profile.active_school_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  modal(`<div class="reward-event-modal-v13142">
    <h2>🎉 학습 보상 이벤트</h2>
    <p>정한 기간 동안 <b>연습·시험</b>의 코인과 경험치를 더 줘요. 몬스터전·던전·야차전·놀이터·출석·칭호 코인은 그대로예요.</p>
    <form id="rev-form" class="rev-form" novalidate>
      <label class="field"><span>이름 (30자)</span><input id="rev-name" maxlength="30" placeholder="예: 기말 대비 2배 주간" autocomplete="off"></label>
      <div class="field"><span>배율</span><div class="rev-seg" role="radiogroup"><label><input type="radio" name="rev-mult" value="1.5"><b>1.5배</b></label><label><input type="radio" name="rev-mult" value="2" checked><b>2배</b></label></div></div>
      <div class="rev-two rev-dates"><label class="field"><span>시작 (한국 시간)</span><input id="rev-start" type="datetime-local" value="${startDefault}"></label><label class="field"><span>끝 (한국 시간)</span><input id="rev-end" type="datetime-local" value="${endDefault}"></label></div>
      <div class="rev-two"><label class="field"><span>대상</span><select id="rev-scope"><option value="all">전체</option><option value="school">학교</option><option value="grade" selected>학교 + 학년</option></select></label><label class="field" id="rev-school-wrap"><span>학교</span><select id="rev-school">${schoolOptions}</select></label></div>
      <label class="field" id="rev-grade-wrap"><span>학년</span><select id="rev-grade"></select></label>
      <p class="rev-error" id="rev-error" role="alert" hidden></p>
      <button type="submit" class="btn primary full" id="rev-create">이벤트 만들기</button>
    </form>
    <div id="rev-events" class="rev-events"><p class="rev-empty">불러오는 중…</p></div>
  </div>`, '학습 보상 이벤트', { className: 'reward-event-sheet-v13142' });
  const sync = () => {
    const scope = $('#rev-scope').value;
    $('#rev-school-wrap').hidden = scope === 'all';
    $('#rev-grade-wrap').hidden = scope !== 'grade';
    const school = schools.find(s => s.id === $('#rev-school').value);
    const keep = $('#rev-grade').value;
    $('#rev-grade').innerHTML = (GRADES[school?.division] || GRADES.high).map(g => `<option ${g === keep ? 'selected' : ''}>${g}</option>`).join('');
  };
  $('#rev-scope').onchange = sync; $('#rev-school').onchange = sync; sync();
  const show = events => {
    const box = $('#rev-events');
    if (!box) return;
    box.innerHTML = listHtml(events);
    box.querySelectorAll('[data-rev-end]').forEach(b => b.onclick = () => act(b, `/teacher/reward-events/${b.dataset.revEnd}/end`, b.textContent === '취소' ? '예정된 이벤트를 취소할까요?' : '이벤트를 지금 끝낼까요? 학생 화면에서 바로 사라져요.'));
    box.querySelectorAll('[data-rev-delete]').forEach(b => b.onclick = () => act(b, `/teacher/reward-events/${b.dataset.revDelete}/delete`, '이벤트를 목록에서 지울까요? 학생이 이미 받은 보상은 그대로예요.'));
  };
  const act = async (button, path, question) => {
    if (!confirm(question)) return;
    buttonBusy(button);
    try { show((await api(path, {})).events); toast('바꿨어요.'); }
    catch (err) { buttonBusy(button, false); toast(err.message); }
  };
  $('#rev-form').onsubmit = async event => {
    event.preventDefault();
    const button = $('#rev-create'), error = $('#rev-error');
    error.hidden = true;
    const body = { name: $('#rev-name').value.trim(), multiplier: Number(document.querySelector('input[name="rev-mult"]:checked')?.value), start: $('#rev-start').value, end: $('#rev-end').value, scope: $('#rev-scope').value, school_id: $('#rev-school').value, grade: $('#rev-grade').value };
    if (!body.name) { error.textContent = '이벤트 이름을 적어 주세요.'; error.hidden = false; return; }
    buttonBusy(button);
    try {
      const r = await api('/teacher/reward-events', body);
      buttonBusy(button, false);
      $('#rev-name').value = '';
      show(r.events);
      toast(`“${r.event.name}” 이벤트를 만들었어요.`);
    } catch (err) {
      buttonBusy(button, false);
      error.textContent = err.message; error.hidden = false;
    }
  };
  try { show((await api('/teacher/reward-events')).events); }
  catch (err) { const box = $('#rev-events'); if (box) box.innerHTML = `<p class="rev-empty">${esc(err.message)}</p>`; }
}
