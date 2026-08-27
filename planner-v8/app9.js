(()=>{
'use strict';
let savedTab='all';
const savedSection=()=>document.getElementById('savedSection');
const safeArr=v=>Array.isArray(v)?v:[];
const active=v=>safeArr(v).filter(x=>!x.deleted);
const fmtTime=ts=>{if(!ts)return '—';const d=new Date(Number(ts));if(Number.isNaN(d.getTime()))return '—';return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`};
const dayLabel=i=>['일','월','화','수','목','금','토'][Number(i)]||'';

function savedItems(){
  const out=[];
  active(state.tasks).forEach(x=>out.push({type:'task',label:'작업',title:x.name||'제목 없음',detail:[x.due||'',x.priority||'',x.status||''].filter(Boolean).join(' · '),updatedAt:x.updatedAt||0,target:'tasksSection'}));
  active(state.weeklySchedule).forEach(x=>out.push({type:'schedule',label:'시간표',title:x.title||'일정',detail:`${dayLabel(x.day)}요일 ${x.start||''}~${x.end||''}${x.details?` · ${x.details}`:''}`,updatedAt:x.updatedAt||0,target:'scheduleSection'}));
  Object.entries(state.timeLogs||{}).forEach(([date,rows])=>active(rows).forEach(x=>out.push({type:'logs',label:'시간 기록',title:x.activity||'기록',detail:`${date} · ${x.start||''}~${x.end||''}`,updatedAt:x.updatedAt||0,target:null,date})));
  const defs=active(state.routineDefinitions);
  Object.entries(state.routineHistory||{}).forEach(([date,h])=>{if(!h?.updatedAt)return;const n=defs.filter(r=>h.checks?.[r.id]).length;out.push({type:'routine',label:'루틴',title:`${date} 루틴`,detail:`${n}/${defs.length} 완료`,updatedAt:h.updatedAt||0,target:'routineSection'})});
  active(state.procedures).forEach(x=>out.push({type:'beauty',label:'시술',title:x.name||'시술',detail:[x.date||'',x.hospital||'',x.amount?Number(x.amount).toLocaleString('ko-KR')+'원':''].filter(Boolean).join(' · '),updatedAt:x.updatedAt||0,target:'beautySection'}));
  safeArr(state.goals).forEach(x=>out.push({type:'goals',label:'목표',title:x.text||'목표',detail:'최우선 목표',updatedAt:x.updatedAt||0,target:'todaySection'}));
  return out.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
}

function renderSavedRecords(){
  if(!savedSection())return;
  const all=savedItems();
  const filtered=savedTab==='all'?all:all.filter(x=>x.type===savedTab);
  const stats=document.getElementById('savedStats');
  if(stats){
    const tasks=active(state.tasks).length,schedules=active(state.weeklySchedule).length,logs=Object.values(state.timeLogs||{}).reduce((n,rows)=>n+active(rows).length,0),routines=Object.values(state.routineHistory||{}).filter(x=>x?.updatedAt).length,beauty=active(state.procedures).length;
    stats.innerHTML=`<span><b>${tasks}</b> 작업</span><span><b>${schedules}</b> 일정</span><span><b>${logs}</b> 시간기록</span><span><b>${routines}</b> 루틴일</span><span><b>${beauty}</b> 시술</span>`;
  }
  const box=document.getElementById('savedRecordsList');if(!box)return;
  box.innerHTML=filtered.length?filtered.map(x=>`<button class="saved-record" data-saved-target="${esc(x.target||'')}"><span class="saved-type t-${x.type}">${esc(x.label)}</span><span class="saved-main"><b>${esc(x.title)}</b><small>${esc(x.detail||'')}</small></span><span class="saved-time">${fmtTime(x.updatedAt)}</span></button>`).join(''):'<div class="empty-state">아직 저장된 기록이 없어.</div>';
}

function bindSavedTabs(){document.querySelectorAll('[data-saved-tab]').forEach(b=>b.onclick=()=>{savedTab=b.dataset.savedTab;document.querySelectorAll('[data-saved-tab]').forEach(x=>x.classList.toggle('active',x===b));renderSavedRecords()})}
document.addEventListener('click',e=>{const b=e.target.closest('[data-saved-target]');if(!b)return;const id=b.dataset.savedTarget;if(id&&document.getElementById(id))document.getElementById(id).scrollIntoView({behavior:'smooth',block:'center'})});

if(typeof openBeautyProcedure==='function'){
  openBeautyProcedure=function(id=null){let live=id?activeProcedures().find(x=>x.id===id):null;modal(`<h3>${live?'시술 내역 수정':'시술 내역 추가'}</h3><div class="form-grid"><div class="field"><label>시술명</label><input id="mBeautyName" value="${esc(live?.name||'')}" placeholder="예: 쥬베룩 스킨"></div><div class="form-row"><div class="field"><label>금액</label><input id="mBeautyAmount" type="number" min="0" step="100" value="${Number(live?.amount||0)||''}" placeholder="예: 308000"></div><div class="field"><label>시술일</label><input id="mBeautyDate" type="date" value="${live?.date||todayISO()}"></div></div><div class="form-row"><div class="field"><label>병원</label><input id="mBeautyHospital" value="${esc(live?.hospital||'')}" placeholder="병원명"></div><div class="field"><label>분류</label><select id="mBeautyCategory">${['보톡스','스킨부스터','기타'].map(x=>`<option ${x===(live?.category||'기타')?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="field"><label>용량·부위</label><input id="mBeautyVolume" value="${esc(live?.volume||'')}" placeholder="예: 4CC, 50U, 3부위"></div><div class="field"><label>이벤트·비고</label><textarea id="mBeautyMemo" class="beauty-modal-note" placeholder="이벤트명, 구성, 가격 메모 등을 자유롭게 적어줘">${esc(live?.memo||'')}</textarea></div><div class="autosave-note">시술명을 입력한 뒤부터 모든 항목이 자동 저장돼.</div></div>${modalActions(live?'<button class="danger-button" data-beauty-modal-delete>삭제</button>':'')}`,()=>{const save=()=>{const name=$('mBeautyName').value.trim();if(!name)return;const data={name,amount:Math.max(0,Number($('mBeautyAmount').value)||0),hospital:$('mBeautyHospital').value.trim(),category:$('mBeautyCategory').value,date:$('mBeautyDate').value,volume:$('mBeautyVolume').value.trim(),memo:$('mBeautyMemo').value.trim(),updatedAt:nowStamp()};if(live)Object.assign(live,data);else{live={id:uid(),...data};state.procedures.push(live)}markChanged();renderProcedures()};$('mBeautyName').focus();bindAutoSaveFields(['mBeautyName','mBeautyAmount','mBeautyDate','mBeautyHospital','mBeautyCategory','mBeautyVolume','mBeautyMemo'],save);$('modal').querySelector('[data-save]').onclick=()=>{save();closeModal()};const del=$('modal').querySelector('[data-beauty-modal-delete]');if(del)del.onclick=()=>{if(live){live.deleted=true;live.updatedAt=nowStamp();markChanged();renderProcedures()}closeModal()}})};
}

if(typeof markChanged==='function'){
  const baseMark=markChanged;
  markChanged=function(){baseMark();clearTimeout(markChanged._savedTimer);markChanged._savedTimer=setTimeout(renderSavedRecords,80)};
}
if(typeof renderAll==='function'){
  const baseRenderAll=renderAll;
  renderAll=function(){baseRenderAll();setTimeout(renderSavedRecords,0)};
}

bindSavedTabs();renderSavedRecords();
})();
