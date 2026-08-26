'use strict';
const $=id=>document.getElementById(id);
const LOCAL_KEY='sumus_productivity_state_v1';
const AUTH_KEY='sumus_productivity_auth_v1';
const DEVICE_KEY='sumus_productivity_device_v1';
const CLOUD=window.SUMUS_CLOUD||{};
const cloudConfigured=()=>Boolean(CLOUD.supabaseUrl&&CLOUD.anonKey);
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayISO=()=>iso(new Date());
const fromISO=s=>new Date(`${s}T00:00:00`);
const addDays=(s,n)=>{const d=fromISO(s);d.setDate(d.getDate()+n);return iso(d)};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const koDate=s=>{const d=fromISO(s);return `${d.getMonth()+1}월 ${d.getDate()}일 (${['일','월','화','수','목','금','토'][d.getDay()]})`};
const shortDate=s=>{const d=fromISO(s);return `${d.getMonth()+1}/${d.getDate()}`};
const nowStamp=()=>Date.now();
const deviceId=localStorage.getItem(DEVICE_KEY)||uid(); localStorage.setItem(DEVICE_KEY,deviceId);
function initialState(){const t=nowStamp();return{meta:{updatedAt:t,deviceId},note:'걱정하지마.\n잘하고 있어.',goals:[],tasks:[],routineDefinitions:[{id:'bed',label:'☀️ 침대 정리',updatedAt:t},{id:'water',label:'💧 물 마시기',updatedAt:t},{id:'reflect',label:'🧾 오늘 회고',updatedAt:t},{id:'focus25',label:'🧠 25분 집중',updatedAt:t},{id:'exercise',label:'🚶 가볍게 운동',updatedAt:t},{id:'read',label:'📖 독서',updatedAt:t},{id:'journal',label:'🌙 취침 전 일기',updatedAt:t}],routineHistory:{},timeLogs:{},weeklySchedule:[],focus:{sessions:0,wins:0,updatedAt:t},pomodoroHistory:[]}}
function normalizeState(s){const base=initialState();if(!s||typeof s!=='object')return base;s.meta=s.meta||base.meta;s.meta.updatedAt=Number(s.meta.updatedAt)||nowStamp();s.note=typeof s.note==='string'?s.note:base.note;s.goals=Array.isArray(s.goals)?s.goals:[];s.tasks=Array.isArray(s.tasks)?s.tasks:[];s.routineDefinitions=Array.isArray(s.routineDefinitions)&&s.routineDefinitions.length?s.routineDefinitions:base.routineDefinitions;s.routineHistory=s.routineHistory&&typeof s.routineHistory==='object'?s.routineHistory:{};s.timeLogs=s.timeLogs&&typeof s.timeLogs==='object'?s.timeLogs:{};s.weeklySchedule=Array.isArray(s.weeklySchedule)?s.weeklySchedule:[];s.focus=s.focus&&typeof s.focus==='object'?s.focus:base.focus;s.focus.sessions=Number(s.focus.sessions)||0;s.focus.wins=Number(s.focus.wins)||0;s.pomodoroHistory=Array.isArray(s.pomodoroHistory)?s.pomodoroHistory:[];return s}
let state;try{state=normalizeState(JSON.parse(localStorage.getItem(LOCAL_KEY)||'null'))}catch(e){state=initialState()}
let auth;try{auth=JSON.parse(localStorage.getItem(AUTH_KEY)||'null')}catch(e){auth=null}
let dirty=false,saveTimer=null,pollTimer=null,isSyncing=false;
function saveLocal(){localStorage.setItem(LOCAL_KEY,JSON.stringify(state))}
function setSyncStatus(mode,text){const el=$('syncStatus');el.className='status-pill '+mode;$('syncText').textContent=text}
function markChanged(){state.meta.updatedAt=nowStamp();state.meta.deviceId=deviceId;dirty=true;saveLocal();if(!navigator.onLine){setSyncStatus('offline','오프라인 · 기기에 저장됨');return}if(auth&&cloudConfigured()){setSyncStatus('saving','저장 중…');clearTimeout(saveTimer);saveTimer=setTimeout(()=>syncPush(),650)}else setSyncStatus('saved','기기에 자동저장됨')}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.add('hidden'),1600)}
async function api(path,options={}){const headers={'apikey':CLOUD.anonKey,'Content-Type':'application/json',...(options.headers||{})};if(auth?.access_token)headers.Authorization=`Bearer ${auth.access_token}`;const res=await fetch(`${CLOUD.supabaseUrl}${path}`,{...options,headers});if(res.status===401&&auth?.refresh_token){const ok=await refreshAuth();if(ok)return api(path,options)}return res}
async function refreshAuth(){try{const res=await fetch(`${CLOUD.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{'apikey':CLOUD.anonKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:auth.refresh_token})});if(!res.ok)throw 0;const j=await res.json();auth={...auth,...j};localStorage.setItem(AUTH_KEY,JSON.stringify(auth));return true}catch(e){auth=null;localStorage.removeItem(AUTH_KEY);renderAccountBadge();return false}}
async function cloudSignIn(email,password,signup=false){const url=signup?'/auth/v1/signup':'/auth/v1/token?grant_type=password';const res=await fetch(`${CLOUD.supabaseUrl}${url}`,{method:'POST',headers:{'apikey':CLOUD.anonKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const j=await res.json();if(!res.ok)throw new Error(j.msg||j.error_description||j.message||'로그인 실패');if(!j.access_token&&signup)throw new Error('가입 완료. 이메일 인증이 켜져 있다면 메일 인증 후 로그인해줘.');auth=j;localStorage.setItem(AUTH_KEY,JSON.stringify(auth));renderAccountBadge();await syncAfterLogin();return j}
async function remoteRow(){if(!auth||!cloudConfigured())return null;const userId=auth.user?.id;if(!userId)return null;const res=await api(`/rest/v1/planner_state?select=state,updated_at&user_id=eq.${encodeURIComponent(userId)}`,{headers:{'Accept':'application/vnd.pgrst.object+json'}});if(res.status===406)return null;if(!res.ok)throw new Error(await res.text());return res.json()}
async function pushState(){const userId=auth?.user?.id;if(!userId)throw new Error('로그인 필요');const res=await api('/rest/v1/planner_state?on_conflict=user_id',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:userId,state,updated_at:new Date(state.meta.updatedAt).toISOString()})});if(!res.ok)throw new Error(await res.text())}
async function syncPush(){if(isSyncing||!dirty||!auth||!cloudConfigured())return;if(!navigator.onLine){setSyncStatus('offline','오프라인 · 기기에 저장됨');return}isSyncing=true;try{await pushState();dirty=false;setSyncStatus('saved','클라우드 저장됨 ✓')}catch(e){console.error(e);setSyncStatus('error','동기화 실패 · 기기에 저장됨')}finally{isSyncing=false}}
async function syncAfterLogin(){if(!navigator.onLine)return;setSyncStatus('saving','동기화 중…');try{const remote=await remoteRow();if(remote?.state){const r=normalizeState(remote.state);if((r.meta?.updatedAt||0)>(state.meta?.updatedAt||0)){state=r;saveLocal();dirty=false;renderAll();toast('다른 기기의 최신 기록을 불러왔어')}else{dirty=true;await syncPush()}}else{dirty=true;await syncPush()}setSyncStatus('saved','클라우드 저장됨 ✓')}catch(e){console.error(e);setSyncStatus('error','클라우드 연결 확인 필요')}}
async function pollRemote(){if(dirty||isSyncing||!auth||!cloudConfigured()||!navigator.onLine)return;try{const remote=await remoteRow();if(remote?.state&&(remote.state.meta?.updatedAt||0)>(state.meta?.updatedAt||0)){state=normalizeState(remote.state);saveLocal();renderAll();toast('다른 기기의 변경사항이 반영됐어')}}catch(e){console.warn(e)}}
window.addEventListener('online',()=>{setSyncStatus('saving','다시 연결됨 · 동기화 중…');if(auth&&cloudConfigured()){if(dirty)syncPush();else pollRemote()}else setSyncStatus('saved','기기에 자동저장됨')});
window.addEventListener('offline',()=>setSyncStatus('offline','오프라인 · 기기에 저장됨'));
function renderAccountBadge(){if(auth?.user?.email&&cloudConfigured()){$('accountBtn').textContent='✓';$('accountBtn').title=auth.user.email}else{$('accountBtn').textContent='☁';$('accountBtn').title='계정/동기화'}}
function startPolling(){clearInterval(pollTimer);pollTimer=setInterval(pollRemote,12000)}
function tickClock(){const d=new Date();$('clock').textContent=`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;$('dateLine').textContent=`${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 ${['일','월','화','수','목','금','토'][d.getDay()]}요일`}
setInterval(tickClock,1000);tickClock();
async function loadWeather(){try{const r=await fetch('https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=temperature_2m,weather_code&timezone=Asia%2FSeoul');const j=await r.json();const c=j.current.weather_code;const icon=c===0?'☀️':c<=3?'🌤️':c<=67?'🌧️':c<=77?'🌨️':c<=82?'🌦️':'⛈️';$('weatherTemp').textContent=Math.round(j.current.temperature_2m)+'°';$('weatherIcon').textContent=icon;$('weatherDesc').textContent=c===0?'맑음':c<=3?'구름 조금':c<=67?'비':'변화 많은 날씨'}catch(e){$('weatherDesc').textContent='날씨를 불러오지 못했어'}}loadWeather();
$('heroNote').innerHTML=esc(state.note).replace(/\n/g,'<br>');let noteTimer;$('heroNote').addEventListener('input',()=>{clearTimeout(noteTimer);noteTimer=setTimeout(()=>{state.note=$('heroNote').innerText.replace(/\n{3,}/g,'\n\n').trim();markChanged()},600)});
function modal(html,onOpen){$('modal').innerHTML=html;$('modalBackdrop').classList.remove('hidden');if(onOpen)onOpen()}
function closeModal(){$('modalBackdrop').classList.add('hidden');$('modal').innerHTML=''}
$('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))closeModal()});
function modalActions(deleteHtml=''){return `<div class="modal-actions">${deleteHtml}<button class="secondary-button" data-close>취소</button><button class="primary-button" data-save>완료</button></div>`}
document.addEventListener('click',e=>{if(e.target.closest('[data-close]'))closeModal()});
