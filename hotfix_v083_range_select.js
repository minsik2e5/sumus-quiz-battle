    /* V0.8.3 RANGE PRESET FIX · teacher numbered ranges / student self-select */
    const V083={version:'0.8.3-range-preset-fix',min:2,max:8,mode:'individual',key:'sumus.quiz.range.v083'};
    const V083_id=()=>`rng-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
    const V083_bookId=()=>state.book?.bookId||state.book?.id||'';
    const V083_units=()=>Array.isArray(state.units)?state.units:[];
    const V083_slice=(from,to)=>{
      const u=V083_units(); if(!u.length)return[];
      let a=u.indexOf(from),b=u.indexOf(to);
      if(a<0)a=0;if(b<0)b=a;if(b<a)b=a;
      return u.slice(a,b+1)
    };
    const V083_sanitize=(r={})=>{
      const u=V083_units(); if(!u.length)return{id:r.id||V083_id(),from:'',to:'',units:[]};
      let from=u.includes(r.from)?r.from:(state.selectedUnits?.[0]||u[0]);
      let to=u.includes(r.to)?r.to:(state.selectedUnits?.at(-1)||from);
      const units=V083_slice(from,to);from=units[0]||u[0];to=units.at(-1)||from;
      return{id:r.id||V083_id(),from,to,units}
    };
    const V083_load=()=>{
      if(!state.book||!V083_units().length)return[];
      if(Array.isArray(state.rangeOptions)&&state.rangeOptionBookId===V083_bookId()&&state.rangeOptions.length)return state.rangeOptions;
      let saved=[];try{const x=JSON.parse(localStorage.getItem(V083.key)||'{}');if(x.bookId===V083_bookId()&&Array.isArray(x.rows))saved=x.rows}catch{}
      state.rangeOptions=(saved.length?saved:[{},{}]).slice(0,V083.max).map(V083_sanitize);
      while(state.rangeOptions.length<V083.min)state.rangeOptions.push(V083_sanitize({}));
      state.rangeOptionBookId=V083_bookId();
      return state.rangeOptions
    };
    const V083_save=()=>{try{localStorage.setItem(V083.key,JSON.stringify({bookId:V083_bookId(),rows:V083_load().map(r=>({id:r.id,from:r.from,to:r.to}))}))}catch{}};
    const V083_apply=(p,r)=>{
      if(!p||!r)return;
      p.rangeOptionId=r.id;p.rangeOptionNumber=V083_load().findIndex(x=>x.id===r.id)+1;
      p.rangeFrom=r.from;p.rangeTo=r.to;p.units=[...r.units]
    };
    const V083_clone=()=>V083_load().map((r,i)=>({id:r.id,number:i+1,from:r.from,to:r.to,units:[...r.units],wordCount:typeof rangeWordCount==='function'?rangeWordCount(r.from,r.to):0}));
    const V083_label=p=>{const i=V083_load().findIndex(r=>r.id===p?.rangeOptionId);return i>=0?`${i+1}번 범위`:''};

    try{
      const p=$('#individualPanel');
      if(p){
        p.innerHTML=`<div class="panel-head"><div><div class="v083-badge">학생이 번호로 선택</div><h3>개별 범위</h3><small>1번, 2번처럼 범위를 만들어 두면 학생이 입장할 때 자기 번호를 직접 선택합니다.</small></div><div><button class="btn sm" id="addRangeChoice">+ 범위 추가</button><button id="applyAllRanges" hidden type="button"></button></div></div><div class="v083-help">예: <b>1번 범위</b> 31번 → 34번 · <b>2번 범위</b> 36번 → 40번</div><div class="player-ranges" id="playerRanges"></div>`;
      }
      const style=document.createElement('style');style.textContent=`
        .v083-badge{display:inline-flex;padding:5px 9px;border:1px solid #5ce0de55;border-radius:999px;background:#5ce0de10;color:#8df2e8;font-size:9px;font-weight:950;margin-bottom:7px}
        .v083-help{margin:0 0 12px;color:#8ea8b5;font-size:11px}.v083-row{display:grid;grid-template-columns:110px minmax(130px,1fr) 24px minmax(130px,1fr) minmax(160px,1.2fr) 58px;gap:9px;align-items:center;padding:11px 10px;border-top:1px solid #ffffff0d}
        .v083-no{display:flex;align-items:center;gap:8px;font-weight:950}.v083-no i{display:grid;place-items:center;width:28px;height:28px;border:1px solid #5ce0de66;border-radius:8px;color:#75eee5;font-style:normal}.v083-row label{display:grid;gap:4px;font-size:9px;color:#75919d}.v083-row select{min-height:36px}.v083-summary b{display:block;color:#d9f7f3}.v083-summary span{display:block;margin-top:2px;color:#78949f;font-size:9px}
        .player-range-badge{display:inline-flex;margin-top:5px;padding:4px 7px;border:1px solid #5ce0de44;border-radius:999px;color:#7ee9df;font-size:8px;font-weight:900}
        .student-range-select-list{display:grid;gap:10px;width:min(100%,520px);margin:18px auto}.student-range-option{width:100%;display:grid;grid-template-columns:46px 1fr auto;gap:12px;align-items:center;text-align:left;padding:14px;border:1px solid #5ce0de55;border-radius:14px;background:#0b222a;color:#fff}.student-range-no{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#5ce0de18;color:#7cf3e8;font-size:20px;font-weight:1000}.student-range-info{display:grid;gap:4px}.student-range-info b{font-size:15px}.student-range-info span,.student-range-count{font-size:11px;color:#89a7b2}
        @media(max-width:760px){.v083-row{grid-template-columns:1fr 1fr}.v083-no,.v083-summary{grid-column:1/-1}.v083-row>.range-arrow{display:none}}
      `;document.head.append(style);
    }catch{}

    const V083_render=()=>{
      const panel=$('#individualPanel'),box=$('#playerRanges');
      if(!panel||!box)return;
      const active=state.rangeMode===V083.mode;
      panel.classList.toggle('hidden',!active);
      $('#unitPicker')?.classList.toggle('hidden',active);
      $$('[data-range-mode]').forEach(b=>b.classList.toggle('active',b.dataset.rangeMode===state.rangeMode));
      if(!active)return;
      const rows=V083_load(),opts=V083_units().map(u=>`<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join('');
      box.innerHTML=rows.map((r,i)=>`<div class="v083-row">
        <div class="v083-no"><i>${i+1}</i><span>${i+1}번 범위</span></div>
        <label>시작<select data-v083-from="${escapeHtml(r.id)}">${opts}</select></label><span class="range-arrow">→</span>
        <label>끝<select data-v083-to="${escapeHtml(r.id)}">${opts}</select></label>
        <div class="v083-summary"><b>${escapeHtml(r.from)}${r.from===r.to?'':` → ${escapeHtml(r.to)}`}</b><span>${Number(typeof rangeWordCount==='function'?rangeWordCount(r.from,r.to):0).toLocaleString()} WORDS</span></div>
        <button class="btn sm danger" data-v083-remove="${escapeHtml(r.id)}" ${rows.length<=V083.min?'disabled':''}>삭제</button>
      </div>`).join('');
      rows.forEach(r=>{const a=$(`[data-v083-from="${CSS.escape(r.id)}"]`),b=$(`[data-v083-to="${CSS.escape(r.id)}"]`);if(a)a.value=r.from;if(b)b.value=r.to});
      const add=$('#addRangeChoice');if(add)add.disabled=rows.length>=V083.max
    };

    const V083_oldRows=renderRangeRows;renderRangeRows=function(){if(state.rangeMode===V083.mode){V083_render();renderQuestionCountHint?.();return}return V083_oldRows()};
    const V083_oldSetBook=setBook;setBook=function(bookId,options={}){const before=V083_bookId();V083_oldSetBook(bookId,options);if(before&&before!==V083_bookId()){state.rangeOptions=[];state.rangeOptionBookId=''}V083_load();V083_save();V083_render()};

    const V083_oldSnapshot=battleSnapshot;battleSnapshot=function(targetClientId=''){const snap=V083_oldSnapshot(targetClientId);const p=snap?.payload||snap;if(p){p.rangeMode=state.rangeMode;p.rangeOptions=state.rangeMode===V083.mode?V083_clone():[];p.players=(p.players||[]).map(x=>{const s=state.players.find(y=>y.id===x.id);return s?{...x,rangeOptionId:s.rangeOptionId||'',rangeOptionNumber:s.rangeOptionNumber||0,rangeFrom:s.rangeFrom,rangeTo:s.rangeTo}:x})}return snap};

    const V083_oldTeacherJoin=TeacherBridge.join.bind(TeacherBridge);TeacherBridge.join=function(message){
      const p=message.payload||{},existing=state.players.find(x=>x.clientId===message.senderId||(p.deviceId&&x.deviceId===p.deviceId));
      let option=null;
      if(state.rangeMode===V083.mode&&!existing){
        option=V083_load().find(r=>r.id===p.rangeOptionId);
        if(!option){LocalTransport.send('PLAYER_JOIN_REJECTED',{...EventPayload.base(),targetClientId:message.senderId,reason:'자기 범위 번호를 선택한 뒤 입장해 주세요.'});return}
      }
      const before=new Set(state.players.map(x=>x.id));V083_oldTeacherJoin(message);
      const player=existing||state.players.find(x=>!before.has(x.id)&&x.clientId===message.senderId);
      if(player&&state.rangeMode===V083.mode){option=option||V083_load().find(r=>r.id===player.rangeOptionId)||V083_load()[0];V083_apply(player,option);TeacherBridge.publish?.(message.senderId);renderLobby();V083_render()}
    };

    const V083_oldLobby=renderLobby;renderLobby=function(){V083_oldLobby();if(state.rangeMode===V083.mode){const cards=$$('#lobbyPlayers .player-card');state.players.forEach(p=>{const card=cards.find(c=>c.querySelector('b')?.textContent===p.name);if(!card||card.querySelector('.player-range-badge'))return;const lab=V083_label(p);if(!lab)return;const e=document.createElement('span');e.className='player-range-badge';e.textContent=`${lab} · ${p.rangeFrom}${p.rangeFrom===p.rangeTo?'':` → ${p.rangeTo}`}`;card.append(e)})}V083_render()};

    Object.assign(StudentSession,{selectedRangeOptionId:'',pendingJoinName:''});
    const V083_oldStudentJoin=StudentApp.join.bind(StudentApp);StudentApp.join=function(name){
      const clean=typeof sanitizePlayerName==='function'?sanitizePlayerName(name):String(name||'').replace(/\s+/g,'').trim();
      const snap=StudentSession.snapshot||{};
      if(snap.rangeMode===V083.mode&&Array.isArray(snap.rangeOptions)&&snap.rangeOptions.length){
        const ok=snap.rangeOptions.some(r=>r.id===StudentSession.selectedRangeOptionId);
        if(!ok){StudentSession.pendingJoinName=clean;StudentSession.selectedRangeOptionId='';StudentSession.screen='range-select';StudentSession.error='';this.render();return}
        const payload={...EventPayload.base(),name:clean,rangeOptionId:StudentSession.selectedRangeOptionId,reconnectToken:StudentSession.reconnectToken||''};
        if(typeof DeviceIdentity!=='undefined')payload.deviceId=DeviceIdentity.id;
        if(window.SUMUS_V065?.PracticeSession?.profile?.grade)payload.grade=window.SUMUS_V065.PracticeSession.profile.grade;
        LocalTransport.send('PLAYER_JOIN_REQUEST',payload);return
      }
      return V083_oldStudentJoin(clean)
    };
    const V083_oldView=StudentApp.view.bind(StudentApp);StudentApp.view=function(){
      if(StudentSession.screen==='range-select'){
        const s=StudentSession.snapshot||{},ranges=Array.isArray(s.rangeOptions)?s.rangeOptions:[];
        return`<section class="student-view center"><div class="student-eyebrow">BATTLE ${escapeHtml(StudentSession.battleCode)} · ${escapeHtml(s.bookName||'')}</div><h1 class="student-title">내 범위 번호를 선택하세요</h1><p class="student-copy">선생님이 만든 범위 중 내가 공부할 번호를 선택하세요.</p><div class="student-range-select-list">${ranges.map((r,i)=>`<button class="student-range-option" data-v083-student="${escapeHtml(r.id)}"><span class="student-range-no">${i+1}</span><span class="student-range-info"><b>${i+1}번 범위</b><span>${escapeHtml(r.from)}${r.from===r.to?'':` → ${escapeHtml(r.to)}`}</span></span><span class="student-range-count">${Number(r.wordCount||0).toLocaleString()}개</span></button>`).join('')}</div><button class="student-secondary" id="v083RangeBack">← 배틀 코드로</button></section>`
      }return V083_oldView()
    };
    const V083_oldBindView=StudentApp.bindView.bind(StudentApp);StudentApp.bindView=function(){V083_oldBindView();$$('[data-v083-student]').forEach(b=>b.onclick=()=>{StudentSession.selectedRangeOptionId=b.dataset.v083Student;this.join(StudentSession.pendingJoinName||'')});$('#v083RangeBack')?.addEventListener('click',()=>{StudentSession.selectedRangeOptionId='';StudentSession.pendingJoinName='';StudentSession.screen='battle-code';this.render()})};

    const V083_oldBind=bind;bind=function(){V083_oldBind();document.addEventListener('click',e=>{
      if(e.target.closest('#addRangeChoice')){const rows=V083_load();if(rows.length<V083.max){rows.push(V083_sanitize(rows.at(-1)||{}));V083_save();V083_render();TeacherBridge.publish?.()}}
      const rm=e.target.closest('[data-v083-remove]');if(rm){if(state.players.some(p=>p.rangeOptionId===rm.dataset.v083Remove)){toast('현재 학생이 사용 중인 범위는 삭제할 수 없습니다.','warn');return}state.rangeOptions=V083_load().filter(r=>r.id!==rm.dataset.v083Remove);V083_save();V083_render();TeacherBridge.publish?.()}
      if(e.target.closest('[data-range-mode]'))setTimeout(()=>{V083_render();TeacherBridge.publish?.()},0)
    });document.addEventListener('change',e=>{
      const a=e.target.closest('[data-v083-from]'),b=e.target.closest('[data-v083-to]');if(!a&&!b)return;const id=(a||b).dataset.v083From||(a||b).dataset.v083To,r=V083_load().find(x=>x.id===id);if(!r)return;
      let from=$(`[data-v083-from="${CSS.escape(id)}"]`)?.value||r.from,to=$(`[data-v083-to="${CSS.escape(id)}"]`)?.value||r.to;let units=V083_slice(from,to);r.from=units[0]||from;r.to=units.at(-1)||r.from;r.units=units;state.players.filter(p=>p.rangeOptionId===id).forEach(p=>V083_apply(p,r));V083_save();V083_render();renderLobby();TeacherBridge.publish?.()
    })};

    V083_load();V083_render();window.SUMUS_V083=V083;
