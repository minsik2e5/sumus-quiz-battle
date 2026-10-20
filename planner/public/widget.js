// SUMUS TODAY — the desktop widget page (/widget), opened by the widget EXE (and the planner).
// Same saved document as the planner; the layout is the original widget's, plus one row for
// 출근 · 퇴근 · 기상 · 취침.
import { createStore } from './sync.js';
import { ensureSignedIn, pinChecking } from './auth.js';
import { icon, esc, isEnter, input, checkbox, isChecked, toast } from './ui.js';
import * as C from './core.js';
import { NOTE_COLORS, NOTE_BASE, noteHtml, readLines, linesToHtml, linesToText } from './memo.js';

const root = document.getElementById('app');
const inExe = navigator.userAgent.includes('SUMUSWidget/');
const ATT = [['clockIn', '출근'], ['clockOut', '퇴근'], ['wake', '기상'], ['sleep', '취침']];
let today = C.todayKst(), store = null, status = 'loading';
const S = () => store.data;
const change = (fn, opts) => store.change(fn, opts);

async function boot() {
  root.innerHTML = pinChecking('안전하게 확인하는 중…', true);
  try { await ensureSignedIn(root); } catch { root.innerHTML = pinChecking('연결을 기다리는 중이에요…'); setTimeout(boot, 3000); return; }
  root.innerHTML = pinChecking('불러오는 중…');
  store = createStore({ normalize: st => C.normalizeState(st, C.todayKst()), onChange: draw, onStatus: st => { status = st.state === 'dirty' ? 'saving' : st.state; drawStatus(); } });
  for (let a = 0; ; a++) {
    try { await store.load(); break; }
    catch (err) { if (err.status === 401) { location.reload(); return; } root.innerHTML = pinChecking('연결을 기다리는 중이에요…'); shown = ''; await new Promise(r => setTimeout(r, Math.min(30000, 2000 * (a + 1)))); }
  }
  housekeeping();
  draw();
  requestAnimationFrame(() => syncSize(true));
  setInterval(refresh, 30000);
  addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
}
// 끝난 시험은 다음 시험(기말)으로 넘어가고, 정해 둔 기말 날짜가 들어감 — 플래너 화면과 같은 규칙 (위젯만 켜 둬도 반영됨)
function housekeeping() {
  const probe = JSON.parse(JSON.stringify(S()));
  C.applyMigrations(probe); C.autoRollExams(probe, today);
  if (JSON.stringify(probe) !== JSON.stringify(S())) change(s => { C.applyMigrations(s); C.autoRollExams(s, today); });
}
async function refresh() {
  today = C.todayKst();
  if (!(await store.refresh())) draw();
  housekeeping();
}

// Which widget this page is: /widget.html?w=all (the whole card, as before) or one piece for the
// desktop widget windows: classes, work, quick, checklist, notes (?n=<note id>), clock.
const Q = new URLSearchParams(location.search), KIND = Q.get('w') || 'all';
const TITLES = { classes: '오늘 수업', work: '출퇴근 · 생활', quick: '일정 메모', checklist: '오늘 체크리스트', notes: '메모장', clock: '시계', exams: '시험 D-day' };
document.body.dataset.widget = KIND;
// 작게 접기: 제목줄만 남김. 이 위젯 종류별로 기억 (EXE 창 높이도 같이 줄이고 펼칠 때 원래 높이로 되돌림).
const FOLD_KEY = `sumus-fold-${KIND}`, HEIGHT_KEY = `sumus-open-h-${KIND}`;
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
let folded = lsGet(FOLD_KEY) === '1', lastSize = '';
document.body.classList.toggle('folded', folded);
function syncSize(force) {
  if (!inExe) return;
  const post = m => window.chrome?.webview?.postMessage(m);
  let msg;
  if (folded) { const c = root.querySelector('.desktop-widget-card'); if (!c) return; msg = `h:${Math.ceil(c.getBoundingClientRect().height)}:fold`; }
  else { const h = parseInt(lsGet(HEIGHT_KEY) || '', 10); if (!h) return; msg = `h:${h}:open`; }
  if (force || msg !== lastSize) { lastSize = msg; post(msg); }
}
function toggleFold() {
  folded = !folded;
  if (folded) lsSet(HEIGHT_KEY, String(Math.round(innerHeight)));
  lsSet(FOLD_KEY, folded ? '1' : '0');
  document.body.classList.toggle('folded', folded);
  shown = ''; draw();
  requestAnimationFrame(() => syncSize(true));
}
const sec = (ic, title, extra, body) => `<section class="desktop-widget-section"><div class="desktop-widget-title">${icon(ic)}<strong>${title}</strong>${extra || ''}</div>${body}</section>`;

function draw() {
  if (!store?.data) return;
  // Do not redraw under the cursor (a memo being typed, a time being changed, a note line).
  const ae = document.activeElement;
  if (dragging || editingTitle) return;
  if (ae && root.contains(ae) && ((ae.id === 'w-memo' && ae.value) || ae.dataset.time || ae.dataset.noteTask || ae.dataset.noteRoutine || ae.id === 'w-note-text' || ae.id === 'w-note-title')) { drawStatus(); return; }
  const s = S(), ov = s.scheduleOverrides[today], classes = C.classesOn(today, s), p = C.dayProgress(s, today);
  const tasks = s.tasks.filter(t => t.date === today).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  const routines = s.routineItems, doneTasks = tasks.filter(t => t.done).length, doneRoutines = routines.filter(r => s.routineChecks[`${today}-${r.id}`]).length;
  const at = s.attendance[today] || {}, mins = C.workMinutes(at.clockIn, at.clockOut);
  // For the widget EXE's character (수무): today's classes, read without guessing from the page text.
  window.sumusClasses = classes.map((c, i) => c ? { start: C.SLOT_TIMES[i]?.[0] || '', label: c } : null).filter(x => x && x.start);
  const rowActs = k => `<span class="chk-acts"><button type="button" data-act="chk-edit" data-key="${esc(k)}" aria-label="수정" title="수정">${icon('pencil')}</button><button type="button" data-act="chk-del" data-key="${esc(k)}" aria-label="삭제" title="삭제">${icon('x')}</button></span>`;
  const parts = {
    work: () => sec('clock-3', '출퇴근 · 생활', mins != null ? `<em>${C.fmtDuration(mins)} 근무</em>` : '', `<div class="desktop-time-list">${ATT.map(([k, l]) => `<div><span>${l}</span>${at[k] ? input(`type="time" value="${esc(at[k])}" data-time="${k}" aria-label="${l} 시간"`) : `<button type="button" data-now="${k}">지금</button>`}</div>`).join('')}</div>`),
    classes: () => sec('book-open-check', '오늘 수업', ov ? `<em>${esc(ov.label)}</em>` : '', `<div class="desktop-class-list">${classes.length ? classes.map((c, i) => { if (!c) return ''; const key = `${today}-${i}`, done = !!s.classDone[key], [st, en] = C.SLOT_TIMES[i] || ['보강', '']; return `<label class="${done ? 'done' : ''}">${checkbox(done, `data-class="${key}"`)}<span><b>${i + 1}</b><strong>${esc(c)}</strong><small>${st}–${en}</small></span></label>`; }).join('') : '<p>오늘은 수업이 없어요.</p>'}</div>`),
    quick: () => sec('plus', '일정 메모', '', `<div class="desktop-memo-add">${input('id="w-memo" maxlength="80" placeholder="할 일을 빠르게 적어보세요" autocomplete="off"')}<button type="button" data-act="memo" disabled aria-label="메모 추가">${icon('plus')}</button></div>`),
    checklist: () => {
      // One list of today's tasks and daily routines; the order can be changed by dragging ⋮⋮.
      const items = [...tasks.map(t => ({ k: `t:${t.id}`, t })), ...routines.map(r => ({ k: `r:${r.id}`, r }))].map((x, n) => ({ ...x, n }));
      const ord = s.checkOrder?.[today] || [], pos = x => { const i = ord.indexOf(x.k); return i < 0 ? 1e6 + x.n : i; };
      items.sort((a, b) => pos(a) - pos(b));
      const row = x => {
        if (x.t) { const t = x.t; return `<div class="chk-row ${t.done ? 'done' : ''}" draggable="true" data-ck="${esc(x.k)}"><i class="grip" aria-hidden="true">⋮⋮</i>${checkbox(t.done, `data-task="${esc(t.id)}"`)}<span><strong>${esc(t.title)}</strong><input class="sub-note" data-note-task="${esc(t.id)}" maxlength="60" value="${esc(t.note || '')}" placeholder="${!t.start || t.start === t.end ? '작게 메모' : `${esc(t.start)}–${esc(t.end)} · 작게 메모`}" aria-label="${esc(t.title)} 메모"></span>${rowActs(x.k)}</div>`; }
        const r = x.r, on = !!s.routineChecks[`${today}-${r.id}`];
        return `<div class="chk-row ${on ? 'done' : ''}" draggable="true" data-ck="${esc(x.k)}"><i class="grip" aria-hidden="true">⋮⋮</i>${checkbox(on, `data-routine="${esc(r.id)}"`)}<span><strong>${esc(r.title)}</strong><input class="sub-note" data-note-routine="${esc(r.id)}" maxlength="60" value="${esc(r.note || '')}" placeholder="매일 루틴 · 작게 메모" aria-label="${esc(r.title)} 메모"></span>${rowActs(x.k)}</div>`;
      };
      return sec('list-checks', '오늘 체크리스트', `<em>${doneTasks + doneRoutines}/${tasks.length + routines.length}</em>`, `<div class="desktop-check-list" id="w-checks">${items.map(row).join('')}${!items.length ? '<p>체크할 항목이 없어요.</p>' : ''}</div>`);
    },
    exams: () => {
      // 시험 D-day: 가까운 시험부터. 범위 진행(체크한 번호/전체), 시험 전 남은 수업, 진도 상태.
      const all = C.sortExams(C.examsOf(s)).filter(x => C.examUpcoming(x, today)), list = KIND === 'all' ? all.slice(0, 3) : all;
      if (!list.length) return KIND === 'all' ? '' : sec('graduation-cap', '시험 D-day', '', '<p>예정된 시험이 없어요.</p>');
      const rank = { 지연: 4, 주의: 3, 여유: 2, 완료: 1 };
      const row = x => {
        const undated = C.examUndated(x), cs = C.COHORTS.filter(c => (x.cohortIds || []).includes(c.id));
        let items = 0, checked = 0, lessons = 0, worst = '준비';
        for (const c of cs) { const st = C.rangeStats(s, c.id), p = C.pace(s, c.id, today); items += st.items.length; checked += st.checked; lessons += p.lessons; if ((rank[p.state] || 0) > (rank[worst] || 0)) worst = p.state; }
        const label = C.examStatus(x, today), days = /^D-(\d+)$/.exec(label)?.[1], tone = label === '시험 중' ? 'now' : days != null && +days <= 7 ? 'soon' : undated ? 'none' : '';
        const when = undated ? '날짜 미정' : x.start === x.end ? C.fmtMd(x.start) : `${C.fmtMd(x.start)} – ${C.fmtMd(x.end)}`;
        const pct = items ? Math.round(checked / items * 100) : 0;
        return `<div class="dday-row"><div class="dday-top"><span class="exam-dot ${esc(x.color || 'blue')}"></span><div><strong>${esc(x.school)} ${esc(x.label)}</strong><small>${when}</small></div><b class="dday-badge ${tone}">${label}</b></div>${items ? `<div class="dday-meter"><span><i style="width:${pct}%"></i></span><small>범위 ${checked}/${items}${undated ? '' : ` · 시험 전 수업 ${lessons}회`} · <em class="pace-${worst}">${worst}</em></small></div>` : ''}</div>`;
      };
      return sec('graduation-cap', '시험 D-day', all.length > list.length ? `<em>외 ${all.length - list.length}개</em>` : '', `<div class="dday-list">${list.map(row).join('')}</div>`);
    },
    notes: () => {
      if (trashOpen) return sec('file-text', '휴지통', '', `<div class="trash-head"><small>지운 메모는 30일 동안 여기서 되살릴 수 있어요.</small><button type="button" data-act="trash-close">돌아가기</button></div><div class="trash-list">${(s.trash || []).slice().reverse().map(n => `<div class="trash-row"><div><strong>${esc(n.title || '제목 없음')}</strong><small>${esc(String(n.text || '').split('\n').find(l => l.trim()) || '내용 없음').slice(0, 40)} · ${C.fmtMd(new Date(n.deletedAt + 9 * 3600000).toISOString().slice(0, 10))} 삭제</small></div><button type="button" data-act="trash-restore" data-id="${esc(n.id)}">되살리기</button><button type="button" class="purge" data-act="trash-purge" data-id="${esc(n.id)}" aria-label="완전히 삭제">×</button></div>`).join('') || '<p>휴지통이 비었어요.</p>'}</div>`);
      const list = s.notes, cur = list.find(n => n.id === Q.get('n')) || list[0], trashBtn = (s.trash || []).length ? `<button type="button" class="trash-open" data-act="trash-open">휴지통 (${s.trash.length})</button>` : '';
      return sec('file-text', '메모장', '', `<div class="note-tabs">${list.map(n => `<button type="button" class="${n.id === cur?.id ? 'on' : ''}" data-note-open="${esc(n.id)}">${esc(n.title || '제목 없음')}</button>`).join('')}<button type="button" data-act="note-new" aria-label="새 메모">${icon('plus')}</button></div>${cur
        ? `<input id="w-note-title" class="note-title" maxlength="40" value="${esc(cur.title || '')}" placeholder="제목" data-note="${esc(cur.id)}"><div class="note-bar" aria-label="글 서식"><button type="button" data-act="note-ck" title="체크박스 줄 넣기·빼기" aria-label="체크박스">${icon('list-checks')}<span>체크</span></button><button type="button" data-act="note-b" title="굵게 (Ctrl+B)" aria-label="굵게"><b>B</b></button><button type="button" data-act="note-h" title="제목 줄" aria-label="제목 줄"><span>제목</span></button><i></i>${NOTE_COLORS.map(([name, hex]) => `<button type="button" class="note-color${hex === NOTE_BASE ? ' base' : ''}" data-color="${hex}" style="--c:${hex}" title="글씨색 ${name}" aria-label="글씨색 ${name}"></button>`).join('')}</div><div id="w-note-text" class="note-text${cur.text ? '' : ' is-empty'}" contenteditable="true" spellcheck="false" role="textbox" aria-multiline="true" data-note="${esc(cur.id)}" data-placeholder="쓰고 싶은 걸 적으세요. 자동으로 저장돼요.">${noteHtml(cur)}</div><div class="note-foot">${trashBtn}<button type="button" data-act="note-del" data-note="${esc(cur.id)}">이 메모 지우기</button></div>`
        : `<p>아직 메모가 없어요. + 를 눌러 새로 만드세요.</p><div class="note-foot">${trashBtn}</div>`}`);
    },
    clock: () => `<div class="w-clock"><b id="w-clock-t"></b><span id="w-clock-d"></span></div>`
  };
  const foldBtn = `<button type="button" class="w-fold" data-act="fold" aria-label="${folded ? '펼치기' : '작게 접기'}" title="${folded ? '펼치기' : '작게 접기'}">${icon(folded ? 'chevron-down' : 'chevron-up')}</button>`;
  const head = KIND === 'all'
    ? `<header class="desktop-widget-head"><div class="desktop-widget-logo">S</div><div><strong>SUMUS TODAY</strong><span>${C.fmtLong(today)}</span></div><i id="w-dot"></i><button type="button" data-act="refresh" aria-label="새로고침">${icon('refresh-cw')}</button>${foldBtn}${inExe ? `<button type="button" class="w-plus" data-act="add-widget" aria-label="위젯 추가·메뉴" title="위젯 추가 · 메뉴">+</button>` : ''}</header>
    <div class="desktop-widget-progress"><div>${icon('sparkles')}<strong>오늘 ${p.completed}/${p.total || 0} 완료</strong></div><span><b style="width: ${p.total ? Math.round(p.completed / p.total * 100) : 0}%;"></b></span></div>`
    : `<header class="desktop-widget-head slim"><div class="desktop-widget-logo">S</div><div><strong>${TITLES[KIND] || 'SUMUS'}</strong><span>${C.fmtLong(today)}</span></div><i id="w-dot"></i>${foldBtn}${inExe ? `<button type="button" class="w-plus" data-act="add-widget" aria-label="위젯 추가·메뉴" title="위젯 추가 · 메뉴">+</button><button type="button" class="w-close" data-act="close-widget" aria-label="이 위젯 닫기" title="이 위젯 닫기">×</button>` : ''}</header>`;
  const body = KIND === 'all' ? ['work', 'classes', 'exams', 'quick', 'checklist'].map(k => parts[k]()).join('') : (parts[KIND] || parts.classes)();
  const foot = KIND === 'all' ? `<footer><div>${inExe ? '' : '<a href="/SUMUS_Widget_Installer.zip" download>Windows 설치</a>'}<button type="button" data-act="planner">${icon('external-link')} 전체 플래너</button></div><span id="w-status"></span></footer>` : '<footer class="slim"><span id="w-status"></span></footer>';
  // Same markup as what is on screen: leave the page alone (no flash, no scroll jump).
  // The 30-second check, window focus and the refresh button all land here with nothing new.
  const html = `<main class="desktop-widget-page kind-${KIND}"><section class="desktop-widget-card">${head}${body}${foot}</section></main>`;
  if (html === shown && root.firstElementChild) { drawStatus(); tickClock(); return; }
  const keep = root.querySelector('.desktop-widget-card'), scroll = keep ? [keep.scrollTop, root.scrollTop, document.scrollingElement?.scrollTop || 0] : null;
  root.innerHTML = shown = html;
  if (scroll) { const c = root.querySelector('.desktop-widget-card'); if (c) c.scrollTop = scroll[0]; root.scrollTop = scroll[1]; if (document.scrollingElement) document.scrollingElement.scrollTop = scroll[2]; }
  drawStatus(); tickClock();
  if (folded) requestAnimationFrame(() => syncSize());
}
let shown = '', editingTitle = false, trashOpen = false;
function tickClock() {
  const t = document.getElementById('w-clock-t'); if (!t) return;
  const n = new Date(Date.now() + 9 * 3600000), iso = n.toISOString();
  t.textContent = iso.slice(11, 16); document.getElementById('w-clock-d').textContent = C.fmtLong(iso.slice(0, 10));
}
setInterval(tickClock, 10000);
function drawStatus() {
  const dot = document.getElementById('w-dot'), el = document.getElementById('w-status');
  if (dot) { dot.className = status === 'loading' ? '' : status; dot.title = status === 'saved' ? '저장됨' : status === 'saving' ? '저장 중' : '연결 상태'; }
  if (el) el.innerHTML = status === 'saving' ? '저장 중…' : status === 'error' ? '연결 오류' : `${icon('check')} 자동 저장`;
}
let adding = false;
function addMemo() {
  const box = document.getElementById('w-memo'), title = box?.value.trim();
  if (!title || adding) return;
  adding = true; box.value = '';
  const now = C.nowHM();
  change(s => { s.tasks.push({ id: `w${Date.now()}`, date: today, start: now, end: now, title, category: '업무', done: false }); });
  adding = false;
}
// After typing a time: only the work line changes; the input keeps the cursor.
function patchWork() {
  const title = root.querySelector('.desktop-time-list')?.previousElementSibling; if (!title) return;
  const at = S().attendance[today] || {}, mins = C.workMinutes(at.clockIn, at.clockOut);
  title.querySelector('em')?.remove();
  if (mins != null) title.insertAdjacentHTML('beforeend', `<em>${C.fmtDuration(mins)} 근무</em>`);
}

root.addEventListener('click', e => {
  if (!store?.data) return;
  const cb = e.target.closest('[role=checkbox]');
  if (cb) {
    const on = !isChecked(cb), d = cb.dataset;
    if (d.class) change(s => { s.classDone[d.class] = on; });
    else if (d.task) change(s => { const x = s.tasks.find(y => y.id === d.task); if (x) x.done = on; });
    else if (d.routine) change(s => { s.routineChecks[`${today}-${d.routine}`] = on; });
    return;
  }
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  if (d.now) {
    const key = d.now, day = key === 'sleep' ? C.sleepDay() : today;
    change(s => { (s.attendance[day] ||= { clockIn: '', clockOut: '' })[key] = C.nowHM(); if (key === 'wake') s.routineChecks[`${day}-wake`] = true; });
    if (day !== today) toast(`${C.fmtMd(day)} 밤 취침으로 기록했어요.`);
    return;
  }
  if (d.act === 'fold') { toggleFold(); return; }
  if (d.act === 'chk-edit') { startTitleEdit(d.key); return; }
  if (d.act === 'chk-del') { deleteCheck(d.key); return; }
  if (d.act === 'note-ck') { toggleCheckLines(); return; }
  if (d.act === 'note-b') { boldText(); return; }
  if (d.act === 'note-h') { toggleHeading(); return; }
  if (d.act === 'trash-open') { trashOpen = true; draw(); return; }
  if (d.act === 'trash-close') { trashOpen = false; draw(); return; }
  if (d.act === 'trash-restore') { restoreNote(d.id); return; }
  if (d.act === 'trash-purge') { if (confirm('완전히 지울까요? 이건 되살릴 수 없어요.')) change(s => { s.trash = (s.trash || []).filter(n => n.id !== d.id); }); return; }
  if (d.color) { applyColor(d.color); return; }
  if (d.act === 'add-widget') { window.chrome?.webview?.postMessage('menu'); return; }
  if (d.act === 'close-widget') { window.chrome?.webview?.postMessage('close'); return; }
  if (d.noteOpen) { Q.set('n', d.noteOpen); window.chrome?.webview?.postMessage('n:' + d.noteOpen); history.replaceState(null, '', '?' + Q); draw(); return; }
  if (d.act === 'note-new') { const id = `n${Date.now()}`; change(s => { s.notes.push({ id, title: '', text: '', updatedAt: Date.now() }); }); Q.set('n', id); history.replaceState(null, '', '?' + Q); draw(); setTimeout(() => document.getElementById('w-note-title')?.focus(), 30); return; }
  if (d.act === 'note-del') { if (!confirm('이 메모를 지울까요?\n(휴지통에서 30일 동안 되살릴 수 있어요)')) return; change(s => { const gone = s.notes.find(n => n.id === d.note); if (gone) s.trash = pruneTrash([...(s.trash || []), { ...gone, deletedAt: Date.now() }]); s.notes = s.notes.filter(n => n.id !== d.note); }); Q.delete('n'); history.replaceState(null, '', '?' + Q); draw(); return; }
  if (d.act === 'refresh') store.refresh().then(ch => ch || draw());
  if (d.act === 'memo') addMemo();
  if (d.act === 'planner') window.open('/', '_blank');
});
root.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.time) { change(s => { (s.attendance[today] ||= { clockIn: '', clockOut: '' })[t.dataset.time] = t.value; }, { render: false }); patchWork(); }
});
// 위젯 어디서나 오른쪽 클릭 → 위젯 추가·닫기 메뉴 (입력칸 안은 제외)
document.addEventListener('contextmenu', e => { if (!inExe || e.target.closest('textarea, input')) return; e.preventDefault(); window.chrome?.webview?.postMessage('menu'); });
// 체크리스트 순서 바꾸기 (끌어서 놓기)
let dragging = null;
root.addEventListener('dragstart', e => { const r = e.target.closest?.('.chk-row'); if (!r) return; dragging = r; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', r.dataset.ck); } catch {} });
root.addEventListener('dragover', e => {
  if (!dragging) return;
  const list = document.getElementById('w-checks'), over = e.target.closest?.('.chk-row');
  if (!list || !over || over === dragging || !list.contains(over)) { if (list?.contains(e.target)) e.preventDefault(); return; }
  e.preventDefault();
  const b = over.getBoundingClientRect();
  list.insertBefore(dragging, e.clientY < b.top + b.height / 2 ? over : over.nextSibling);
});
root.addEventListener('dragend', () => {
  if (!dragging) return;
  dragging.classList.remove('dragging'); dragging = null;
  const keys = [...document.querySelectorAll('#w-checks .chk-row')].map(r => r.dataset.ck);
  change(s => { const o = (s.checkOrder ||= {}); o[today] = keys; for (const d of Object.keys(o).sort().slice(0, -14)) delete o[d]; }, { render: false });
});
root.addEventListener('input', e => {
  const t = e.target, d = t.dataset;
  if (t.id === 'w-memo') root.querySelector('[data-act=memo]').disabled = !t.value.trim();
  else if (d.noteTask) change(s => { const x = s.tasks.find(y => y.id === d.noteTask); if (x) x.note = t.value; }, { render: false });
  else if (d.noteRoutine) change(s => { const x = s.routineItems.find(y => y.id === d.noteRoutine); if (x) x.note = t.value; }, { render: false });
  else if (t.id === 'w-note-text') { fixEditor(t, e); saveNote(t); }
  else if (t.id === 'w-note-title') change(s => { const n = s.notes.find(y => y.id === d.note); if (n) { n.title = t.value; n.updatedAt = Date.now(); } }, { render: false });
});
root.addEventListener('keydown', e => { if (e.target.id === 'w-memo' && isEnter(e)) { e.preventDefault(); addMemo(); } });

// ── 체크리스트: 제목 고치기 · 지우기 ───────────────────────────────────────
function startTitleEdit(key) {
  if (editingTitle) return;
  const row = [...root.querySelectorAll('.chk-row')].find(r => r.dataset.ck === key), strong = row?.querySelector('strong');
  if (!strong) return;
  const cur = key.startsWith('t:') ? S().tasks.find(t => t.id === key.slice(2))?.title : S().routineItems.find(r => r.id === key.slice(2))?.title;
  if (cur == null) return;
  editingTitle = true; row.draggable = false;
  const box = document.createElement('input');
  box.className = 'title-edit'; box.maxLength = 80; box.value = cur; box.setAttribute('aria-label', '제목 수정');
  strong.replaceWith(box); box.focus(); box.select();
  let done = false;
  const finish = ok => {
    if (done) return; done = true; editingTitle = false;
    const title = box.value.trim();
    if (!ok || !title || title === cur) { shown = ''; draw(); return; }
    change(s => { const x = key.startsWith('t:') ? s.tasks.find(t => t.id === key.slice(2)) : s.routineItems.find(r => r.id === key.slice(2)); if (x) x.title = title; });
  };
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); finish(false); } });
  box.addEventListener('blur', () => finish(true));
}
function deleteCheck(key) {
  const isTask = key.startsWith('t:'), id = key.slice(2);
  const item = isTask ? S().tasks.find(t => t.id === id) : S().routineItems.find(r => r.id === id);
  if (!item) return;
  if (!confirm(isTask ? `‘${item.title}’ 항목을 지울까요?` : `‘${item.title}’ 은(는) 매일 루틴이에요. 루틴에서 완전히 지울까요?`)) return;
  change(s => {
    if (isTask) s.tasks = s.tasks.filter(t => t.id !== id);
    else s.routineItems = s.routineItems.filter(r => r.id !== id);
    for (const d of Object.keys(s.checkOrder || {})) s.checkOrder[d] = s.checkOrder[d].filter(k => k !== key);
  });
}

// ── 메모장: 체크박스 줄 · 글씨색 ───────────────────────────────────────────
const editor = () => document.getElementById('w-note-text');
const lineOf = (ed, node) => { let n = node; while (n && n.parentNode !== ed) n = n.parentNode; return n && n.nodeType === 1 ? n : null; };
function saveNote(ed) {
  const id = ed.dataset.note, lines = readLines(ed), html = linesToHtml(lines), text = linesToText(lines);
  ed.classList.toggle('is-empty', !text);
  change(s => { const n = s.notes.find(y => y.id === id); if (n) { n.html = html; n.text = text; n.updatedAt = Date.now(); } }, { render: false });
}
// 줄 바깥에 글자가 있으면 줄(div)로 감싸고, 엔터로 새로 생긴 줄은 체크 해제 상태로 시작
function fixEditor(ed, e) {
  if (!ed.firstChild) { ed.innerHTML = '<div><br></div>'; const r = document.createRange(); r.setStart(ed.firstChild, 0); r.collapse(true); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
  else if (ed.firstChild.nodeType !== 1 || ed.firstChild.tagName !== 'DIV') document.execCommand('formatBlock', false, 'div');
  if (e?.inputType === 'insertParagraph' || e?.inputType === 'insertLineBreak') { const sel = getSelection(), ln = sel.anchorNode && lineOf(ed, sel.anchorNode); if (ln) ln.classList.remove('on', 'h'); }
}
function selectedLines(ed) {
  const sel = getSelection(); if (!sel.rangeCount) return [];
  const r = sel.getRangeAt(0);
  if (!ed.contains(r.commonAncestorContainer)) return [];
  const all = [...ed.children].filter(c => c.tagName === 'DIV');
  const hit = all.filter(c => r.intersectsNode(c));
  return hit.length ? hit : [lineOf(ed, r.startContainer)].filter(Boolean);
}
// 포커스를 줘도 이미 잡아 둔 글자 선택·커서는 그대로
function focusEditor(ed) {
  const sel = getSelection(), saved = sel.rangeCount && ed.contains(sel.getRangeAt(0).commonAncestorContainer) ? sel.getRangeAt(0).cloneRange() : null;
  ed.focus();
  if (saved) { sel.removeAllRanges(); sel.addRange(saved); }
}
function toggleCheckLines() {
  const ed = editor(); if (!ed) return;
  focusEditor(ed); fixEditor(ed);
  let lines = selectedLines(ed);
  if (!lines.length) lines = [ed.lastElementChild].filter(Boolean);   // 커서가 아직 없으면 맨 아래 줄
  if (!lines.length) return;
  const on = !lines.every(l => l.classList.contains('ck'));
  for (const l of lines) { l.classList.toggle('ck', on); if (on) l.classList.remove('h'); else l.classList.remove('on'); }
  saveNote(ed);
}
function applyColor(hex) {
  const ed = editor(); if (!ed) return;
  focusEditor(ed);
  document.execCommand('styleWithCSS', false, true);
  document.execCommand('foreColor', false, hex);
  saveNote(ed);
}
const TRASH_MS = 30 * 86400000;
const pruneTrash = list => list.filter(n => Date.now() - n.deletedAt < TRASH_MS).slice(-50);
function restoreNote(id) {
  change(s => {
    const n = (s.trash || []).find(t => t.id === id); if (!n) return;
    const { deletedAt, ...note } = n;
    if (s.notes.some(x => x.id === note.id)) note.id = `n${Date.now()}`;
    s.notes.push(note); s.trash = s.trash.filter(t => t !== n);
    Q.set('n', note.id);
  });
  trashOpen = false; history.replaceState(null, '', '?' + Q); shown = ''; draw();
}
function boldText() {
  const ed = editor(); if (!ed) return;
  focusEditor(ed);
  document.execCommand('bold');
  saveNote(ed);
}
function toggleHeading() {
  const ed = editor(); if (!ed) return;
  focusEditor(ed); fixEditor(ed);
  let lines = selectedLines(ed);
  if (!lines.length) lines = [ed.lastElementChild].filter(Boolean);
  if (!lines.length) return;
  const on = !lines.every(l => l.classList.contains('h'));
  for (const l of lines) { l.classList.toggle('h', on); if (on) l.classList.remove('ck', 'on'); }
  saveNote(ed);
}
// 박스 자리(줄 왼쪽)를 누르면 체크 · 해제
root.addEventListener('mousedown', e => {
  if (e.target.closest?.('.note-bar')) { e.preventDefault(); return; }   // 글자 선택을 풀지 않음
  const ln = e.target.classList?.contains('ck') ? e.target : null;
  if (ln && ln.parentNode?.id === 'w-note-text' && e.clientX - ln.getBoundingClientRect().left < 24) { e.preventDefault(); ln.classList.toggle('on'); saveNote(ln.parentNode); }
});
root.addEventListener('keydown', e => {
  const ed = e.target.closest?.('#w-note-text'); if (!ed || e.isComposing) return;
  const sel = getSelection(), ln = sel.anchorNode && lineOf(ed, sel.anchorNode);
  if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); document.execCommand('insertParagraph'); return; }
  if (!ln || !ln.classList.contains('ck') || !sel.isCollapsed) return;
  // 빈 체크박스 줄에서 엔터, 또는 줄 맨 앞에서 지우기 → 체크박스를 빼고 보통 줄로
  const before = document.createRange(); before.selectNodeContents(ln); before.setEnd(sel.anchorNode, sel.anchorOffset);
  if ((e.key === 'Enter' && !ln.textContent.trim()) || (e.key === 'Backspace' && !before.toString())) { e.preventDefault(); ln.classList.remove('ck', 'on'); saveNote(ed); }
});
// 붙여넣기는 글자만 (다른 곳의 서식·색이 섞이지 않게)
root.addEventListener('paste', e => {
  if (e.target.id !== 'w-note-text') return;
  e.preventDefault();
  const text = (e.clipboardData?.getData('text/plain') || '').replace(/\r/g, '');
  text.split('\n').forEach((line, i) => { if (i) document.execCommand('insertParagraph'); if (line) document.execCommand('insertText', false, line); });
});

boot();
