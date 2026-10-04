import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import Home from './page';
import {apiFetch,cloudConfigured,setAccessCode} from '../lib/cloud';
import './globals.css';
function App() {
  const [unlocked,setUnlocked]=useState(false), [code,setCode]=useState(''), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  if(unlocked) return <Home/>;
  return <main className="access-screen"><form onSubmit={async e=>{e.preventDefault();setBusy(true);setAccessCode(code);try{const r=await apiFetch('/api/state');if(r.ok||r.status===404){setUnlocked(true);setCode('');}else setError(r.status===401?'접속 코드를 확인해 주세요.':'서버에 연결하지 못했습니다.');}catch{setError('네트워크를 확인해 주세요.');}finally{setBusy(false);}}}><span className="access-logo">D</span><p>리셀 운영의 모든 기록</p><h1>Deal Hunter <em>V5</em></h1><label>운영 접속 코드<input type="password" value={code} autoComplete="current-password" onChange={e=>setCode(e.target.value)} required/></label><button className="primary" disabled={busy||!cloudConfigured()}>{busy?'연결 확인 중':'내 원장 열기'}</button>{!cloudConfigured()&&<small>클라우드 연결 설정이 필요한 빌드입니다. 배포 안내서를 확인해 주세요.</small>}{error&&<p role="alert">{error}</p>}<small>같은 접속 코드로 PC와 휴대폰에서 사용하세요.</small></form></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
