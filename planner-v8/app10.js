(()=>{
'use strict';
const qs=(s,r=document)=>r.querySelector(s), qsa=(s,r=document)=>[...r.querySelectorAll(s)];
const active=v=>(Array.isArray(v)?v:[]).filter(x=>!x.deleted);
const tmin=t=>{if(!t||!t.includes(':'))return 0;const [h,m]=t.split(':').map(Number);return h*60+m};
const minsLabel=n=>{n=Math.max(0,Math.round(n||0));const h=Math.floor(n/60),m=n%60;return h?`${h}시간${m?` ${m}분`:''}`:`${m}분`};
const nowMinutes=()=>{const d=new Date();return d.getHours()*60+d.getMinutes()};
const formatSaved=ts=>{if(!ts)return '아직 저장 전';const d=new Date(Number(ts));return `${pad(d.getHours())}:${pad(d.getMinutes())} 저장`};

function injectCommandCenter(){
  if(document.getElementById('proCommandCenter'))return;
  const main=qs('.main-wrap');if(!main)return;
  const section=document.createElement('section');section.id='proCommandCenter';section.className='pro-command-center';
  section.innerHTML=`
    <div class="pro-command-grid">
      <div class="pro-welcome"><div class="pro-avatar">S</div><div><h3 id="proGreeting">오늘도 잘 해보자.</h3><p id="proDateLine">SUMUS Productivity</p></div></div>
      <div class="pro-capture"><input id="proQuickCapture" autocomplete="off" placeholder="할 일을 바로 적고 Enter · '내일 자료정리', '! 시험지 제작'도 가능"><button id="proCaptureBtn">+ 오늘 할 일</button></div>
      <div class="pro-actions"><button id="proSearchBtn">⌘K 전체 검색</button><button id="proDataBtn">▤ 데이터 관리</button><button id="proAccountBtn">☁ 계정</button></div>
    </div>
    <div id="proBrief" class="pro-brief"></div>`;
  const board=document.getElementById('dashboardCanvas');
  main.insertBefore(section,board||main.firstElementChild);
  qs('#proCaptureBtn').onclick=quickCapture;
  qs('#proQuickCapture').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();quickCapture()}});
  qs('#proSearchBtn').onclick=openGlobalSearch;
  qs('#proDataBtn').onclick=openDataCenter;
  qs('#proAccountBtn').onclick=()=>typeof accountModal==='function'&&accountModal();
}

function quickCapture(){
  const input=qs('#proQuickCapture');let text=(input?.value||'').trim();if(!text)return;
  let due=todayISO(),priority='Medium';
  if(/^내일\s+/.test(text)){due=addDays(todayISO(),1);text=text.replace(/^내일\s+/,'')}
  if(/^!\s*/.test(text)||/^긴급\s+/.test(text)){priority='Urgent';text=text.replace(/^!\s*/,'').replace(/^긴급\s+/,'')}
  if(!text)return;
  state.tasks.push({id:uid(),name:text,due,priority,status:'Not started',done:false,updatedAt:nowStamp()});
  input.value='';markChanged();renderTasks();renderBrief();toast(due===todayISO()?'오늘 할 일에 자동 저장했어':'내일 할 일에 자동 저장했어');
}

function greeting(){const h=new Date().getHours();return h<6?'늦은 시간, 무리하지 말자.':h<12?'좋은 아침. 오늘 할 일을 정리해보자.':h<18?'오늘 계획을 하나씩 끝내보자.':'오늘 남은 일만 깔끔하게 마무리하자.'}
function renderBrief(){
  const box=qs('#proBrief');if(!box)return;
  qs('#proGreeting').textContent=greeting();
  const d=new Date();qs('#proDateLine').textContent=`${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 · 모든 입력 자동저장`;
  const tasks=active(state.tasks),today=todayISO();
  const todayTasks=tasks.filter(x=>!x.done&&x.due===today).length;
  const overdue=tasks.filter(x=>!x.done&&x.due&&x.due<today).length;
  const defs=active(state.routineDefinitions),rh=state.routineHistory?.[today];
  const routineDone=defs.filter(r=>rh?.checks?.[r.id]).length,routinePct=defs.length?Math.round(routineDone/defs.length*100):0;
  const logs=active(state.timeLogs?.[today]);const logged=logs.reduce((n,x)=>{let a=tmin(x.start),b=tmin(x.end);if(b<a)b+=1440;return n+Math.max(0,b-a)},0);
  const dow=new Date().getDay(),nowM=nowMinutes();const todaySchedules=active(state.weeklySchedule).filter(x=>Number(x.day)===dow).sort((a,b)=>tmin(a.start)-tmin(b.start));
  const next=todaySchedules.find(x=>tmin(x.end)>=nowM);const nextText=next?`${next.start} ${next.title}`:(todaySchedules.length?'오늘 일정 종료':'고정 일정 없음');
  const focus=Number(state.focus?.sessions||0);
  const saveText=formatSaved(state.meta?.updatedAt);
  box.innerHTML=`
    <div class="pro-metric ${todayTasks===0?'good':''}"><small>오늘 할 일</small><strong>${todayTasks}개</strong><span>${todayTasks?'처리 대기':'모두 완료'}</span></div>
    <div class="pro-metric ${overdue?'bad':'good'}"><small>밀린 작업</small><strong>${overdue}개</strong><span>${overdue?'확인 필요':'깔끔해'}</span></div>
    <div class="pro-metric ${routinePct>=70?'good':routinePct?'warn':''}"><small>오늘 루틴</small><strong>${routinePct}%</strong><span>${routineDone}/${defs.length} 완료</span></div>
    <div class="pro-metric"><small>기록한 시간</small><strong>${minsLabel(logged)}</strong><span>${logs.length}개 기록</span></div>
    <div class="pro-metric"><small>다음 일정</small><strong title="${esc(nextText)}">${esc(nextText)}</strong><span>주간 시간표 기준</span></div>
    <div class="pro-metric ${auth?.user?.email?'good':'warn'}"><small>저장 상태</small><strong>${auth?.user?.email?'클라우드':'이 기기'}</strong><span>${saveText}</span></div>`;
}

function injectAccountChip(){
  const wrap=qs('.sync-wrap');if(!wrap||qs('#proAccountChip'))return;
  const chip=document.createElement('button');chip.id='proAccountChip';chip.className='pro-account-chip';chip.onclick=()=>typeof accountModal==='function'&&accountModal();
  wrap.insertBefore(chip,qs('#accountBtn'));
  renderAccountChip();
}
function renderAccountChip(){const c=qs('#proAccountChip');if(!c)return;const email=auth?.user?.email;c.classList.toggle('show',Boolean(email));c.innerHTML=email?`<i></i><b>${esc(email)}</b>`:''}

function searchItems(){
  const out=[];
  active(state.tasks).forEach(x=>out.push({type:'작업',title:x.name||'작업',detail:[x.due,x.priority,x.status].filter(Boolean).join(' · '),updatedAt:x.updatedAt,id:x.id,action:'task'}));
  active(state.weeklySchedule).forEach(x=>out.push({type:'시간표',title:x.title||'일정',detail:`${['일','월','화','수','목','금','토'][x.day]||''}요일 ${x.start||''}~${x.end||''}${x.details?' · '+x.details:''}`,updatedAt:x.updatedAt,id:x.id,action:'schedule'}));
  Object.entries(state.timeLogs||{}).forEach(([date,rows])=>active(rows).forEach(x=>out.push({type:'시간 기록',title:x.activity||'시간 기록',detail:`${date} · ${x.start||''}~${x.end||''}`,updatedAt:x.updatedAt,id:x.id,date,action:'log'})));
  active(state.procedures).forEach(x=>out.push({type:'시술',title:x.name||'시술',detail:[x.date,x.hospital,x.amount?Number(x.amount).toLocaleString('ko-KR')+'원':''].filter(Boolean).join(' · '),updatedAt:x.updatedAt,id:x.id,action:'beauty'}));
  active(state.goals).forEach(x=>out.push({type:'목표',title:x.text||'목표',detail:'오늘의 최우선',updatedAt:x.updatedAt,id:x.id,action:'goal'}));
  Object.entries(state.routineHistory||{}).forEach(([date,h])=>{if(h?.updatedAt)out.push({type:'루틴',title:`${date} 루틴`,detail:'날짜별 루틴 기록',updatedAt:h.updatedAt,date,action:'routine'})});
  return out.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
}
let searchData=[],searchIndex=0;
function openGlobalSearch(){
  if(qs('#proSearchBackdrop'))return;
  const bg=document.createElement('div');bg.id='proSearchBackdrop';bg.className='pro-search-backdrop';
  bg.innerHTML=`<div class="pro-search-box"><div class="pro-search-head"><span>⌕</span><input id="proSearchInput" placeholder="작업, 일정, 상세 계획, 시간 기록, 시술 내역 검색"><kbd>ESC</kbd></div><div id="proSearchResults" class="pro-search-results"></div></div>`;
  document.body.appendChild(bg);bg.addEventListener('mousedown',e=>{if(e.target===bg)closeGlobalSearch()});
  const input=qs('#proSearchInput');input.addEventListener('input',()=>renderGlobalSearch(input.value));input.addEventListener('keydown',searchKeys);input.focus();renderGlobalSearch('');
}
function closeGlobalSearch(){qs('#proSearchBackdrop')?.remove()}
function renderGlobalSearch(query){
  const q=(query||'').trim().toLowerCase();searchData=searchItems().filter(x=>!q||`${x.type} ${x.title} ${x.detail}`.toLowerCase().includes(q)).slice(0,60);searchIndex=0;
  const box=qs('#proSearchResults');if(!box)return;
  box.innerHTML=searchData.length?searchData.map((x,i)=>`<button class="pro-search-item ${i===0?'active':''}" data-search-i="${i}"><span class="pro-search-type">${esc(x.type)}</span><span><b>${esc(x.title)}</b><small>${esc(x.detail||'')}</small></span><span class="pro-search-time">${formatSaved(x.updatedAt)}</span></button>`).join(''):'<div class="pro-search-empty">일치하는 저장 기록이 없어.</div>';
  qsa('[data-search-i]',box).forEach(b=>b.onclick=()=>activateSearchItem(Number(b.dataset.searchI)));
}
function searchKeys(e){if(e.key==='Escape'){closeGlobalSearch();return}if(!searchData.length)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();searchIndex=(searchIndex+(e.key==='ArrowDown'?1:-1)+searchData.length)%searchData.length;qsa('[data-search-i]').forEach((b,i)=>b.classList.toggle('active',i===searchIndex));qsa('[data-search-i]')[searchIndex]?.scrollIntoView({block:'nearest'})}if(e.key==='Enter'){e.preventDefault();activateSearchItem(searchIndex)}}
function activateSearchItem(i){const x=searchData[i];if(!x)return;closeGlobalSearch();try{
  if(x.action==='task'&&typeof openTask==='function')openTask(x.id);
  else if(x.action==='schedule'&&typeof openSchedule==='function')openSchedule(x.id);
  else if(x.action==='beauty'&&typeof openBeautyProcedure==='function')openBeautyProcedure(x.id);
  else if(x.action==='goal'&&typeof openGoal==='function')openGoal(x.id);
  else if(x.action==='log'){logDate=x.date;renderLogs();document.querySelector('.two-col')?.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>typeof openLogEdit==='function'&&openLogEdit(x.id),250)}
  else if(x.action==='routine'){routineDate=x.date;renderRoutine();qs('#routineSection')?.scrollIntoView({behavior:'smooth',block:'center'})}
}catch(e){console.warn(e)}}

function openDataCenter(){
  const totalTasks=active(state.tasks).length,totalSchedule=active(state.weeklySchedule).length,totalLogs=Object.values(state.timeLogs||{}).reduce((n,x)=>n+active(x).length,0),totalBeauty=active(state.procedures).length;
  modal(`<h3>데이터 관리</h3><div class="pro-data-card">
    ${auth?.user?.email?`<div class="pro-data-row"><div><b>클라우드 동기화 연결됨</b><small>${esc(auth.user.email)} · 여러 PC에서 같은 계정으로 사용 가능</small></div><button id="proSyncNow">지금 동기화</button></div>`:`<div class="pro-login-hint">현재는 이 기기에도 자동 저장되고 있어. 여러 컴퓨터에서 같은 데이터를 쓰려면 상단 ☁ 계정에서 로그인해줘.</div>`}
    <div class="pro-data-row"><div><b>현재 저장 데이터</b><small>작업 ${totalTasks} · 일정 ${totalSchedule} · 시간 기록 ${totalLogs} · 시술 ${totalBeauty}</small></div><button id="proOpenSaved">저장 기록 보기</button></div>
    <div class="pro-data-row"><div><b>전체 백업 파일</b><small>현재 데이터를 JSON 파일로 내려받아 별도 보관</small></div><button id="proExport">백업 내보내기</button></div>
    <div class="pro-data-row"><div><b>백업 복원</b><small>이전에 내려받은 SUMUS JSON 파일을 불러오기</small></div><label><button type="button" id="proImportBtn">백업 불러오기</button><input id="proImportFile" type="file" accept="application/json,.json"></label></div>
  </div><div class="modal-actions"><button class="secondary-button" data-close>닫기</button></div>`,()=>{
    const sync=qs('#proSyncNow');if(sync)sync.onclick=async()=>{dirty=true;setSyncStatus('saving','동기화 중…');await syncPush();renderBrief();toast('클라우드 동기화 완료')};
    qs('#proOpenSaved').onclick=()=>{closeModal();qs('#savedSection')?.scrollIntoView({behavior:'smooth',block:'start'})};
    qs('#proExport').onclick=exportBackup;
    qs('#proImportBtn').onclick=()=>qs('#proImportFile').click();qs('#proImportFile').onchange=importBackup;
  })
}
function exportBackup(){const payload={app:'SUMUS Productivity',version:6,exportedAt:new Date().toISOString(),state};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`SUMUS_backup_${todayISO()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('전체 백업 파일을 저장했어')}
async function importBackup(e){const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());const incoming=data?.state||data;if(!incoming||typeof incoming!=='object')throw new Error('invalid');if(!confirm('현재 데이터를 이 백업 내용으로 교체할까?'))return;state=normalizeState(incoming);state.meta.updatedAt=nowStamp();state.meta.deviceId=deviceId;dirty=true;saveLocal();renderAll();if(typeof renderSavedRecords==='function')renderSavedRecords();renderBrief();await syncPush();closeModal();toast('백업을 복원했어')}catch(err){toast('올바른 SUMUS 백업 파일이 아니야')}}

function enhanceSavedSearch(){const panel=qs('#savedSection');if(!panel||qs('#proSavedSearch'))return;const head=qs('.panel-head',panel);const input=document.createElement('input');input.id='proSavedSearch';input.className='pro-saved-search';input.placeholder='저장 기록 안에서 검색';head?.appendChild(input);input.addEventListener('input',applySavedFilter);const list=qs('#savedRecordsList');if(list)new MutationObserver(applySavedFilter).observe(list,{childList:true});}
function applySavedFilter(){const q=(qs('#proSavedSearch')?.value||'').trim().toLowerCase();qsa('#savedRecordsList .saved-record').forEach(el=>{el.style.display=!q||el.textContent.toLowerCase().includes(q)?'':'none'})}

function addKeyboardShortcuts(){document.addEventListener('keydown',e=>{const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openGlobalSearch();return}if(e.key==='Escape'&&qs('#proSearchBackdrop')){closeGlobalSearch();return}if(!typing&&e.key==='/'){e.preventDefault();qs('#proQuickCapture')?.focus()}})}

function wrapRenderers(){
  if(typeof markChanged==='function'){const base=markChanged;markChanged=function(){base();renderBrief();renderAccountChip()}}
  if(typeof renderAll==='function'){const base=renderAll;renderAll=function(){base();setTimeout(()=>{renderBrief();renderAccountChip();applySavedFilter()},0)}}
  const status=qs('#syncText');if(status)new MutationObserver(()=>renderBrief()).observe(status,{childList:true,characterData:true,subtree:true});
}

injectCommandCenter();injectAccountChip();enhanceSavedSearch();addKeyboardShortcuts();wrapRenderers();renderBrief();renderAccountChip();setInterval(renderBrief,30000);
})();
