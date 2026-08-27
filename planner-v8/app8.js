(()=>{
'use strict';
const layoutKey='dashboardLayout';
const qs=new URLSearchParams(location.search);
const requestedWidget=qs.get('widget');
let board=null,editing=false,deferredInstall=null;

const defs=[
  {id:'hero',label:'상단 대시보드',sel:'.hero-card',w:12,h:6},
  {id:'quick',label:'빠른 추가',sel:'.quick-panel',w:4,h:5},
  {id:'today',label:'오늘 할 일',sel:'.today-panel',w:4,h:5},
  {id:'priority',label:'오늘의 최우선',sel:'.focus-goals-panel',w:4,h:5},
  {id:'routine',label:'일일 루틴',sel:'#routineSection',w:12,h:5},
  {id:'tasks',label:'작업 현황',sel:'#tasksSection',w:12,h:7},
  {id:'timelog',label:'실제 시간 기록',sel:'.two-col > article:first-child',w:8,h:6},
  {id:'focus',label:'집중 세션',sel:'.two-col > article:nth-child(2)',w:4,h:6},
  {id:'schedule',label:'주간 시간표',sel:'#scheduleSection',w:12,h:12},
  {id:'calendar',label:'월간 캘린더',sel:'#calendarSection',w:12,h:10},
  {id:'beauty',label:'시술 내역',sel:'#beautySection',w:12,h:10}
];

function ensureState(){
  state[layoutKey]=state[layoutKey]&&typeof state[layoutKey]==='object'?state[layoutKey]:{};
  const l=state[layoutKey];
  l.items=l.items&&typeof l.items==='object'?l.items:{};
  l.order=Array.isArray(l.order)?l.order:defs.map(x=>x.id);
  l.boardEnabled=l.boardEnabled===true;
  return l;
}

function injectTools(){
  const sync=document.querySelector('.sync-wrap'); if(!sync||document.getElementById('layoutEditBtn'))return;
  const tools=document.createElement('div'); tools.className='layout-tools';
  tools.innerHTML='<button id="layoutEditBtn" title="카드를 직접 옮기고 크기를 바꿔">▦ 위젯 배치</button><button id="widgetModeBtn" title="작은 앱 창처럼 사용">◫ 위젯 모드</button><button id="installAppBtn" class="install-accent" title="PC 바탕화면에 앱처럼 설치">⬇ 바탕화면 설치</button>';
  sync.prepend(tools);
  document.getElementById('layoutEditBtn').onclick=()=>{enableBoard();setEditing(!editing)};
  document.getElementById('widgetModeBtn').onclick=()=>{document.body.classList.toggle('desktop-widget-mode');toast(document.body.classList.contains('desktop-widget-mode')?'위젯 모드 켬':'위젯 모드 끔')};
  document.getElementById('installAppBtn').onclick=installApp;
}

function addHint(){
  if(document.getElementById('layoutHint'))return;
  const h=document.createElement('div');h.id='layoutHint';h.className='layout-hint';h.innerHTML='<b>위젯 배치 모드</b> · 카드를 드래그해서 순서를 바꾸고, 오른쪽 아래 파란 모서리를 당겨 크기를 바꿀 수 있어. 카드의 ↗ 버튼을 누르면 그 카드만 별도 창으로 열 수 있어. 변경한 배치는 자동 저장돼.';
  const main=document.querySelector('.main-wrap');main?.prepend(h);
}

function createShell(def,el){
  const shell=document.createElement('div');shell.className='widget-shell';shell.dataset.widgetId=def.id;
  const saved=ensureState().items[def.id]||{};const w=saved.w||def.w,h=saved.h||def.h;
  shell.style.setProperty('--ww',w);shell.style.setProperty('--wh',h);
  const chrome=document.createElement('div');chrome.className='widget-chrome';chrome.innerHTML=`<div class="widget-drag">⠿ ${def.label}</div><div class="widget-actions"><button type="button" data-pop title="별도 창으로 열기">↗</button></div>`;
  const content=document.createElement('div');content.className='widget-content';
  const resizer=document.createElement('div');resizer.className='widget-resizer';resizer.title='드래그해서 크기 변경';
  shell.append(chrome,content,resizer);content.appendChild(el);
  shell.draggable=false;
  chrome.querySelector('[data-pop]').onclick=(e)=>{e.stopPropagation();popWidget(def.id,def.label)};
  bindDrag(shell);bindResize(shell);
  return shell;
}

function enableBoard(){
  if(board)return;
  const l=ensureState();
  const main=document.querySelector('.main-wrap'); if(!main)return;
  const todayWrap=document.getElementById('todaySection'); if(todayWrap)todayWrap.id='todaySectionOriginal';
  board=document.createElement('div');board.id='dashboardCanvas';board.className='widget-board';
  const anchor=document.createElement('div');anchor.id='todaySection';anchor.className='nav-anchor';board.appendChild(anchor);
  const found=new Map();
  defs.forEach(def=>{const el=document.querySelector(def.sel);if(el)found.set(def.id,{def,el})});
  const order=[...l.order,...defs.map(d=>d.id).filter(id=>!l.order.includes(id))];
  order.forEach(id=>{const f=found.get(id);if(f)board.appendChild(createShell(f.def,f.el))});
  main.insertBefore(board,main.querySelector('#todaySectionOriginal')||main.children[1]||null);
  ['#todaySectionOriginal','.two-col'].forEach(sel=>{const el=document.querySelector(sel);if(el&&el.children.length===0)el.style.display='none'});
  if(todayWrap)todayWrap.style.display='none';
  l.boardEnabled=true; saveLayout(false);
  if(requestedWidget)activateSingleWidget(requestedWidget);
}

function setEditing(on){
  editing=on;if(!board)return;board.classList.toggle('editing',on);document.getElementById('layoutEditBtn')?.classList.toggle('active',on);document.getElementById('layoutHint')?.classList.toggle('show',on);
  board.querySelectorAll('.widget-shell').forEach(s=>s.draggable=on);
  toast(on?'위젯 배치 편집 시작':'위젯 배치 저장 완료');
}

let dragEl=null;
function bindDrag(shell){
  shell.addEventListener('dragstart',e=>{if(!editing){e.preventDefault();return}dragEl=shell;shell.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',shell.dataset.widgetId)});
  shell.addEventListener('dragend',()=>{shell.classList.remove('dragging');board?.querySelectorAll('.drop-target').forEach(x=>x.classList.remove('drop-target'));dragEl=null;saveLayout()});
  shell.addEventListener('dragover',e=>{if(!editing||!dragEl||dragEl===shell)return;e.preventDefault();shell.classList.add('drop-target')});
  shell.addEventListener('dragleave',()=>shell.classList.remove('drop-target'));
  shell.addEventListener('drop',e=>{if(!editing||!dragEl||dragEl===shell)return;e.preventDefault();shell.classList.remove('drop-target');const r=shell.getBoundingClientRect();const after=e.clientY>r.top+r.height/2;board.insertBefore(dragEl,after?shell.nextSibling:shell);saveLayout()});
}

function bindResize(shell){
  const handle=shell.querySelector('.widget-resizer');let sx=0,sy=0,sw=0,sh=0,colW=100,rowH=54;
  handle.addEventListener('pointerdown',e=>{if(!editing)return;e.preventDefault();e.stopPropagation();handle.setPointerCapture(e.pointerId);const r=shell.getBoundingClientRect(),br=board.getBoundingClientRect();sx=e.clientX;sy=e.clientY;sw=parseInt(getComputedStyle(shell).getPropertyValue('--ww'))||6;sh=parseInt(getComputedStyle(shell).getPropertyValue('--wh'))||5;colW=Math.max(40,(br.width-14*11)/12);rowH=54;shell.classList.add('resizing')});
  handle.addEventListener('pointermove',e=>{if(!shell.classList.contains('resizing'))return;const dw=Math.round((e.clientX-sx)/(colW+14)),dh=Math.round((e.clientY-sy)/rowH);const w=Math.max(2,Math.min(12,sw+dw)),h=Math.max(2,Math.min(28,sh+dh));shell.style.setProperty('--ww',w);shell.style.setProperty('--wh',h)});
  const done=()=>{if(!shell.classList.contains('resizing'))return;shell.classList.remove('resizing');saveLayout()};
  handle.addEventListener('pointerup',done);handle.addEventListener('pointercancel',done);
}

function saveLayout(mark=true){
  if(!board)return;const l=ensureState();l.order=[...board.querySelectorAll('.widget-shell')].map(x=>x.dataset.widgetId);board.querySelectorAll('.widget-shell').forEach(s=>{l.items[s.dataset.widgetId]={w:parseInt(getComputedStyle(s).getPropertyValue('--ww'))||12,h:parseInt(getComputedStyle(s).getPropertyValue('--wh'))||5}});l.updatedAt=Date.now();if(mark)markChanged();else saveLocal();
}

function popWidget(id,label){
  const url=new URL(location.href);url.searchParams.set('widget',id);const w=window.open(url.toString(),`sumus_${id}`,'width=520,height=650,resizable=yes,scrollbars=yes');if(!w)toast('팝업 차단을 풀어주면 별도 위젯 창으로 열 수 있어');else toast(`${label} 위젯 창을 열었어`);
}
function activateSingleWidget(id){
  document.body.classList.add('single-widget','desktop-widget-mode');const shell=board?.querySelector(`[data-widget-id="${CSS.escape(id)}"]`);if(shell)shell.classList.add('single-active');else toast('해당 위젯을 찾지 못했어');
}

async function installApp(){
  if(window.matchMedia('(display-mode: standalone)').matches){toast('이미 앱으로 실행 중이야');return}
  if(deferredInstall){deferredInstall.prompt();const r=await deferredInstall.userChoice;deferredInstall=null;if(r.outcome==='accepted')toast('바탕화면 앱 설치를 시작했어');return}
  toast('Chrome/Edge 주소창 오른쪽의 앱 설치 아이콘 또는 메뉴 > 앱 설치를 눌러줘');
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;const b=document.getElementById('installAppBtn');if(b)b.classList.add('active')});
window.addEventListener('appinstalled',()=>{toast('SUMUS가 바탕화면 앱으로 설치됐어');deferredInstall=null});

function registerSW(){if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})}

injectTools();addHint();registerSW();
const l=ensureState();if(l.boardEnabled||requestedWidget)enableBoard();
})();