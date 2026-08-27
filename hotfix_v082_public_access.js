    /* V0.8.2 PUBLIC ACCESS HOTFIX · public HTTPS student link / iPhone Safari / copy button */
    const V082={version:'0.8.2-public-access'};
    try{
      let meta=document.querySelector('meta[name="viewport"]');
      if(!meta){meta=document.createElement('meta');meta.name='viewport';document.head.append(meta)}
      meta.content='width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover';
      const apple=document.createElement('meta');apple.name='apple-mobile-web-app-capable';apple.content='yes';document.head.append(apple);
      const format=document.createElement('meta');format.name='format-detection';format.content='telephone=no';document.head.append(format);
      const style=document.createElement('style');style.textContent=`
        .v082-access-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}
        .v082-copy-link{min-height:40px;padding:0 14px;border:1px solid #5ce0de66;border-radius:10px;background:#0c3037;color:#95f5ed;font-weight:950;cursor:pointer}
        .v082-access-badge{display:inline-flex;align-items:center;padding:5px 9px;border:1px solid #5de4a844;border-radius:999px;background:#5de4a80c;color:#87efba;font-size:9px;font-weight:950}
        .student-url{word-break:break-all;user-select:all;-webkit-user-select:all}
        @media(max-width:520px){input,select,textarea{font-size:16px!important}.student-view{padding-bottom:max(16px,env(safe-area-inset-bottom))}.v082-copy-link{width:100%;min-height:48px}}
      `;document.head.append(style);
    }catch{}

    const V082_publicStudentUrl=()=>{
      const u=new URL(location.href);
      u.pathname='/';u.hash='';u.search='';
      u.searchParams.set('role','student');
      if(typeof BattleSession!=='undefined'&&BattleSession.code)u.searchParams.set('code',BattleSession.code);
      u.searchParams.set('v','082');
      return u.toString();
    };
    const V082_copy=async text=>{try{await navigator.clipboard.writeText(text);return true}catch{}try{const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();return!!ok}catch{return false}};
    const V082_installAccessUI=()=>{
      const label=document.querySelector('#studentUrlLabel');if(!label)return;
      const url=V082_publicStudentUrl();label.textContent=url;
      const host=label.parentElement||label;
      let row=document.querySelector('.v082-access-row');
      if(!row){row=document.createElement('div');row.className='v082-access-row';row.innerHTML='<button class="v082-copy-link" type="button">학생 링크 복사</button><span class="v082-access-badge">인터넷 접속 · Wi-Fi/LTE/5G 모두 가능</span>';host.append(row)}
      const btn=row.querySelector('.v082-copy-link');if(btn&&!btn.dataset.bound){btn.dataset.bound='1';btn.addEventListener('click',async()=>{const current=V082_publicStudentUrl();const ok=await V082_copy(current);if(ok){const old=btn.textContent;btn.textContent='복사 완료 ✓';try{toast('학생 인터넷 링크를 복사했습니다.')}catch{}setTimeout(()=>btn.textContent=old,1400)}else{try{toast('링크를 길게 눌러 복사해 주세요.','warn')}catch{}}})}
      const qr=document.querySelector('.qr');if(qr){qr.title=url;qr.dataset.publicStudentUrl=url}
    };
    if(typeof TeacherBridge!=='undefined'&&TeacherBridge.updateStudentUrl){const V082_update=TeacherBridge.updateStudentUrl.bind(TeacherBridge);TeacherBridge.updateStudentUrl=function(){try{V082_update()}catch{}V082_installAccessUI()}}
    const V082_bind=bind;bind=function(){V082_bind();setTimeout(V082_installAccessUI,0)};
    window.addEventListener('pageshow',()=>setTimeout(V082_installAccessUI,0));
    window.SUMUS_V082=V082;
