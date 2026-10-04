import {useEffect,useRef,useState} from 'react';
import {apiFetch,hydrateFiles} from './cloud';
import {serializeState,validateState} from './state';
import {SaveQueue} from './save-queue';
const KEY='resell_os_v4_state', DRAFT='deal_hunter_v5_draft', RECOVERY='deal_hunter_v5_recovery';
export function useLedgerSync<T>(state:T,setState:(value:T|((s:T)=>T))=>void,initial:T,migrate:(raw:unknown)=>T) {
  const [ready,setReady]=useState(false),[serverLoading,setServerLoading]=useState(true),[isSaving,setIsSaving]=useState(false);
  const [sync,setSync]=useState({status:'불러오는 중',revision:0,updatedAt:'',conflict:false});
  const [loadIssue,setLoadIssue]=useState(''),[serverNeedsInitialCommit,setServerNeedsInitialCommit]=useState(false),[loadNonce,setLoadNonce]=useState(0);
  const revisionRef=useRef(0),lastSyncedJsonRef=useRef(''),pendingLocalChangesRef=useRef(false), latest=useRef(state),generation=useRef(0),blocked=useRef(false),localFailed=useRef(false);
  const migration=useRef(migrate);migration.current=migrate;latest.current=state;
  const persist=(value:T,pending:boolean)=>{
    try {localStorage.setItem(DRAFT,JSON.stringify({state:JSON.parse(serializeState(value)),baseRevision:revisionRef.current,pending}));localFailed.current=false;return true;}
    catch {localFailed.current=true;setSync(s=>({...s,status:'브라우저 백업 실패 · JSON 백업 필요'}));return false;}
  };
  const queue=useRef<SaveQueue<T>|null>(null);
  if(!queue.current) queue.current=new SaveQueue(async value=>{
    setIsSaving(true);setSync(s=>({...s,status:'서버 저장 중'}));
    const json=serializeState(value);
    validateState(JSON.parse(json));
    const response=await apiFetch('/api/state',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({state:JSON.parse(json),expectedRevision:revisionRef.current})});
    if(response.status===409){blocked.current=true;setSync(s=>({...s,status:'다른 기기 변경 감지 · 내 변경 보존',conflict:true}));throw new Error('conflict');}
    if(!response.ok)throw new Error('save');
    const payload=await response.json();revisionRef.current=payload.revision;lastSyncedJsonRef.current=json;
    const pending=serializeState(latest.current)!==json;pendingLocalChangesRef.current=pending;persist(latest.current,pending);
    if(!pending) {setIsSaving(false);setLoadIssue('');setSync({status:localFailed.current?'서버 저장됨 · 브라우저 백업 실패':'운영 서버 저장됨',revision:payload.revision,updatedAt:payload.updatedAt,conflict:false});}
  },()=>{setIsSaving(false);pendingLocalChangesRef.current=true;setSync(s=>s.conflict?s:{...s,status:'서버 저장 실패 · 변경 보존 중'});});
  useEffect(()=>{
    let cancelled=false;const currentGeneration=++generation.current;
    const load=async()=>{
      setServerLoading(true);blocked.current=true;
      let local=initial, draft:{state:T;baseRevision:number;pending:boolean}|null=null;
      try {
        const saved=localStorage.getItem(DRAFT);if(saved){if(!localStorage.getItem(RECOVERY))localStorage.setItem(RECOVERY,saved);draft=JSON.parse(saved);validateState(draft?.state);local=migration.current(draft!.state);}
        else {const raw=localStorage.getItem(KEY)||localStorage.getItem('seller_os_v1_state');if(raw){const parsed=JSON.parse(raw);validateState(parsed);local=migration.current(parsed);localStorage.setItem(RECOVERY,raw);}}
      }catch{setLoadIssue('local');setSync(s=>({...s,status:'로컬 백업 오류 · 원본 보존'}));}
      if(cancelled)return;
      latest.current=local;setState(local);setReady(true);
      try {
        const response=await apiFetch('/api/state');
        if(cancelled||currentGeneration!==generation.current)return;
        if(response.status===404){revisionRef.current=0;lastSyncedJsonRef.current=serializeState(local);setServerNeedsInitialCommit(true);setLoadIssue('empty');setSync({status:'최초 원장 가져오기·저장 대기',revision:0,updatedAt:'',conflict:false});return;}
        if(!response.ok)throw new Error('load');
        const payload=await response.json();validateState(payload.state);
        const remote=migration.current(await hydrateFiles(payload.state)),remoteJson=serializeState(remote);
        revisionRef.current=draft?.pending ? draft.baseRevision : payload.revision;lastSyncedJsonRef.current=remoteJson;
        if(draft?.pending){
          pendingLocalChangesRef.current=true;
          if(draft.baseRevision!==payload.revision){setSync({status:'서버 변경·미저장본 충돌 · 둘 다 보존',revision:payload.revision,updatedAt:payload.updatedAt,conflict:true});setLoadIssue('conflict');return;}
        }else{latest.current=remote;setState(remote);persist(remote,false);pendingLocalChangesRef.current=false;}
        blocked.current=false;setServerNeedsInitialCommit(false);setLoadIssue('');setSync({status:'운영 서버 연결됨',revision:payload.revision,updatedAt:payload.updatedAt,conflict:false});
      }catch{if(!cancelled){setLoadIssue('connection');setSync(s=>({...s,status:'서버 연결 실패 · 변경 보존'}));}}
      finally{if(!cancelled)setServerLoading(false);}
    };void load();return()=>{cancelled=true;};
    // Reload is explicit; it never runs when a field changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[loadNonce]);
  useEffect(()=>{
    if(!ready||serverLoading)return;
    const json=serializeState(state),changed=json!==lastSyncedJsonRef.current;
    pendingLocalChangesRef.current=changed;
    persist(state,changed);
    if(!changed||serverNeedsInitialCommit||sync.conflict||blocked.current)return;
    setIsSaving(true);
    const timer=setTimeout(()=>{queue.current!.stopped=false;queue.current!.enqueue(state);},650);
    return()=>clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[state,ready,serverLoading,serverNeedsInitialCommit,sync.conflict]);
  useEffect(()=>{
    let busy=false,disposed=false;
    const refresh=async()=>{
      if(!ready||serverLoading||busy||blocked.current||sync.conflict||serverNeedsInitialCommit)return;
      if(pendingLocalChangesRef.current){queue.current!.retry();return;}
      busy=true;
      try{
        const r=await apiFetch('/api/state');if(!r.ok)return;const p=await r.json();validateState(p.state);
        const remote=migration.current(await hydrateFiles(p.state));
        if(disposed||pendingLocalChangesRef.current||queue.current!.running)return;
        if(p.revision>=revisionRef.current){revisionRef.current=p.revision;lastSyncedJsonRef.current=serializeState(remote);latest.current=remote;setState(remote);persist(remote,false);setSync({status:'운영 서버 연결됨',revision:p.revision,updatedAt:p.updatedAt,conflict:false});}
      }catch{/* preserve the draft */}finally{busy=false;}
    };
    const visibility=()=>{if(document.visibilityState==='visible')void refresh();};
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},30000);
    window.addEventListener('online',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',visibility);
    const protect=(e:BeforeUnloadEvent)=>{if(pendingLocalChangesRef.current||queue.current!.running){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',protect);
    return()=>{disposed=true;clearInterval(timer);window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('beforeunload',protect);};
  },[ready,serverLoading,sync.conflict,serverNeedsInitialCommit,setState]);
  return {enableSync:()=>{blocked.current=false;},ready,serverLoading,isSaving,setIsSaving,sync,setSync,loadIssue,setLoadIssue,serverNeedsInitialCommit,setServerNeedsInitialCommit,loadNonce,setLoadNonce,revisionRef,lastSyncedJsonRef,pendingLocalChangesRef};
}
