    /* V0.9.3 RAID integration. RUN delegates to the frozen RaceEngine path unchanged. */
    ArenaMeta.raid = { label: 'RAID', name: 'WORD TAMING RAID', final: 'FINAL BOSS' };
    ArenaRenderer.raid = { entity: () => '', decor: () => '', correct: () => 'RAID HIT', wrong: 'COUNTER' };
    if (!ArenaCatalog.some(row => row[0] === 'raid')) ArenaCatalog.push(['raid', 'RAID', 'WORD TAMING RAID', '학생별 독립 PvE · 정답으로 공격을 끊으세요']);
    CharacterIcons.raid = Array(8).fill('');

    const V093_escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
    const V093_isRaid = () => state.arena === 'raid';
    const V093_events = [];
    const V093_log = (player, label) => {
      V093_events.unshift({ at: Date.now(), playerId: player.id, name: player.name, label });
      V093_events.length = Math.min(V093_events.length, 40);
    };
    const V093_publicPlayer = (player, includeResult = false) => ({
      id: player.id, name: player.name, character: player.character, ready: !!player.ready,
      connected: player.connected !== false, status: player.finished ? 'FINISHED' : player.connected === false ? 'DISCONNECTED' : state.screen === 'race' ? 'ANSWERING' : player.ready ? 'READY' : 'CONNECTING',
      rangeFrom: player.rangeFrom, rangeTo: player.rangeTo, units: player.units || [],
      assignedTotal: player.assignedTotal || 0, questionIndex: player.questionIndex || 0,
      combo: player.combo || 0, correct: player.correct || 0, wrong: player.wrong || 0,
      pass: player.pass || 0, maxCombo: player.maxCombo || 0, times: player.times || [],
      finished: !!player.finished, raid: player.raid ? RaidFoundation.snapshot(player.raid) : null,
      currentQuestion: player.raid && player.questions?.[player.questionIndex] ? serializeQuestion(player.raidReviveQuestions?.[0] || player.questions[player.questionIndex]) : null,
      raidAttemptId: player.raidCurrentAttempt || '',
      raidSessionEnded: !!player.raidSessionEnded,
      raidManualEnd: !!player.raidManualEnd,
      raidResult: includeResult && (player.finished || player.raidSessionEnded) ? RaidResultsModel.publicResult(player) : null
    });
    const V093_learningRow = (player, question) => {
      player.raidLearning ||= { schemaVersion: 1, counts: { correct:0, wrong:0, pass:0, timeout:0 }, words: {} };
      const id = String(question?.id || '');
      return player.raidLearning.words[id] ||= {
        id, word: String(question?.word?.word || ''), meaning: String(question?.word?.rawMeaning || ''),
        expected: String(question?.answer || ''), correct:0, wrong:0, pass:0, timeout:0
      };
    };
    const V093_recordLearning = (player, question, outcome) => {
      const row = V093_learningRow(player, question), key = outcome === 'timeout' ? 'timeout' : outcome;
      if (!Object.hasOwn(row, key) || !Object.hasOwn(player.raidLearning.counts, key)) return;
      row[key] += 1; player.raidLearning.counts[key] += 1;
      row.lastOutcome = key; row.updatedAt = Date.now();
    };

    /* Legacy RAID skin removed. Dedicated shell styles are injected by raid-presentation.js. */

    const RaidTeacherView = {
      auto: true, selectedId: '', lockedUntil: 0, lastSwitchAt: 0,
      minimumDisplayMs: 3500, repeatCooldownMs: 7000, recentlyFeatured: Object.create(null),
      root() { return window.SUMUS_RAID_SHELLS?.teacherRoot?.() || $('#raidTeacherRoot'); },
      priority(player) { const r = player.raid || {}, event = String(r.lastEvent || ''); if (r.cleared) return this.recentlyFeatured[player.id] ? 4 : 120; if (r.battleState === 'DOWN') return 115; if (r.battleState === 'REVIVE') return 110; if (event.includes('PERFECT BREAK')) return 108; if (r.heavyAttackState?.active) return 105; if (event.includes('SPECIAL') || event.includes('LEGEND')) return 102; if (r.hp <= 15) return 96; if (r.enemyHp / Math.max(1,r.enemyMaxHp) <= .1) return 92; if (event.includes('CRITICAL')) return 88; if (r.combo >= 10) return 84; return 10 + Math.min(20,r.combo || 0); },
      select() { const now = Date.now(); let currentValid = state.players.some(p => p.id === this.selectedId); if (!this.auto && currentValid) return this.selectedId; if (now < this.lockedUntil && currentValid) return this.selectedId; const current=state.players.find(p=>p.id===this.selectedId); if(current?.raid?.cleared){this.recentlyFeatured[current.id]=now;this.selectedId='';currentValid=false;} const ordered = [...state.players].sort((a,b) => this.priority(b)-this.priority(a)); const next = ordered.find(player => player.id === this.selectedId || now - Number(this.recentlyFeatured[player.id] || 0) >= this.repeatCooldownMs) || ordered[0]; if (next && next.id !== this.selectedId) { if (this.selectedId) this.recentlyFeatured[this.selectedId] = now; this.selectedId = next.id; this.lastSwitchAt = now; this.lockedUntil = now + this.minimumDisplayMs; } return this.selectedId; },
      status(r) { if (r.cleared) return 'CLEAR'; if (r.battleState === 'DOWN') return 'DOWN'; if (r.battleState === 'REVIVE') return 'REVIVE'; if (r.heavyAttackState?.active) return 'HEAVY'; if (r.shield) return 'SHIELD'; if (r.hp <= 15) return 'DANGER'; return 'NORMAL'; },
      render() {
        if (!V093_isRaid() || AppRole !== 'teacher' || state.screen !== 'race') return;
        document.body.classList.add('raid-mode','raid-shell-active');
        this.select();
        this.root();
        window.SUMUS_RAID_VISUAL?.renderTeacher?.();
      }
    };

    const V093_baseSnapshot = battleSnapshot;
    battleSnapshot = function(targetClientId = '') {
      const snapshot = V093_baseSnapshot(targetClientId), payload = snapshot?.payload || snapshot;
      if (V093_isRaid() && payload) payload.players = state.players.map(player => V093_publicPlayer(player, !!targetClientId && player.clientId === targetClientId));
      return snapshot;
    };

    const V093_baseSetup = RaceEngine.setup.bind(RaceEngine);
    RaceEngine.setup = function() {
      if (!V093_isRaid()) return V093_baseSetup();
      const count = state.players.length;
      state.players.forEach((player, index) => {
        const questions = QuizEngine.buildQuestions(player);
        Object.assign(player, { answered:0, correct:0, wrong:0, pass:0, combo:0, maxCombo:0, times:[], assignedTotal:questions.length, questions, questionIndex:0, finished:false, finishRank:0, initialRank:index+1, raidCorrectQuestions:[], raidReviveQuestions:[], raidSessionEnded:false, raidManualEnd:false, raidLearning:{schemaVersion:1,counts:{correct:0,wrong:0,pass:0,timeout:0},words:{}} });
        player.raid = RaidFoundation.create(questions.length);
      });
      state.race.order = state.players.map(p=>p.id); state.race.running = true; state.race.paused = false;
      RaidTeacherView.render();
      setTimeout(() => TeacherBridge.assignAll(), 0);
      TeacherBridge.publish();
      return count;
    };

    const V093_assign = (player, question, options = {}) => {
      if (!player || !question || player.finished) return;
      const now = Date.now(), waitForAudio = question.type === 'listen' && !options.listenReady;
      if (!options.continueCurrent) RaidFoundation.beginQuestion(player.raid, question, now, { waitForAudio });
      const attemptId = `raid-${player.questionIndex}-${now.toString(36)}-${Math.random().toString(36).slice(2,5)}`;
      player.raidCurrentAttempt = attemptId;
      const remainingMs = player.raid.attackDeadline ? Math.max(0, player.raid.attackDeadline - now) : 0;
      LocalTransport.send('QUESTION_ASSIGN', { ...EventPayload.base(player.id,{questionId:question.id,attemptId}), targetClientId:options.targetClientId||'', question:serializeQuestion(question), player:V093_publicPlayer(player), rank:teacherRank(player.id), timeLimit:options.continueCurrent?remainingMs/1000:waitForAudio?0:player.raid.attackDurationMs/1000, raidTiming:{questionStartAt:player.raid.attackStartAt,attackDeadline:player.raid.attackDeadline,durationMs:player.raid.attackDurationMs}, arena:'raid' });
      if (!options.continueCurrent) TeacherBridge.publish();
    };
    const V093_currentQuestion = player => player.raidReviveQuestions?.[0] || player.questions?.[player.questionIndex];
    const V093_prepareRevive = player => {
      if (player.raid.battleState !== 'DOWN' || player.raidReviveQuestions.length) return;
      const easy = player.raidCorrectQuestions.slice(-4).reverse();
      const fallback = player.questions[player.questionIndex] || player.questions[0];
      player.raidReviveQuestions = [easy[0] || fallback, easy[1] || easy[0] || fallback].filter(Boolean);
      player.raid.battleState = 'REVIVE'; player.raid.lastEvent = 'REVIVE CHALLENGE 0/2';
      V093_log(player, 'DOWN');
    };
    const V093_finishIfNeeded = player => {
      if (player.raid.cleared) player.raid.earlyClear = player.questionIndex < player.assignedTotal - 1;
      if (player.questionIndex >= player.questions.length || player.raid.cleared) {
        player.finished = true; player.finishRank = state.players.filter(p=>p.finished).length; player.finishAt = Date.now();
        V093_log(player, player.raid.cleared ? 'BOSS CLEAR · WORD TAMED' : 'QUESTIONS COMPLETE');
        LocalTransport.send('PLAYER_FINISHED',{...EventPayload.base(player.id),targetClientId:player.clientId||'',player:V093_publicPlayer(player,true),rank:player.finishRank});
      }
    };

    const V093_baseTeacherAnswer = TeacherBridge.answer.bind(TeacherBridge);
    TeacherBridge.answer = function(payload) {
      if (!V093_isRaid()) return V093_baseTeacherAnswer(payload);
      const key = `${payload.playerId}|${payload.questionId}|${payload.attemptId}`;
      if (this.resolved.has(key)) return;
      const player = state.players.find(p=>p.id===payload.playerId), q = V093_currentQuestion(player);
      if (!player || !q || q.id !== payload.questionId || player.finished || state.race.paused) return;
      // A submission received while paused is rejected without consuming its
      // attempt id. The same answer can therefore be submitted after resume.
      this.resolved.add(key);
      const now = Date.now(), raid = player.raid;
      if (raid.attackDeadline && now >= raid.attackDeadline) RaidFoundation.applyTimeout(raid, raid.attackDeadline);
      if (payload.action === 'timeout') {
        V093_recordLearning(player,q,'timeout');
        RaidFoundation.applyTimeout(raid, now); player.wrong += 1; player.combo = raid.combo;
        if (raid.battleState === 'DOWN') V093_prepareRevive(player);
        LocalTransport.send('ANSWER_RESULT',{...EventPayload.base(player.id,{questionId:q.id,attemptId:payload.attemptId}),result:'wrong',reason:'timeout',combo:raid.combo,rank:teacherRank(player.id),player:V093_publicPlayer(player)});
        V093_log(player, raid.lastEvent); RaidTeacherView.render();
        return setTimeout(()=>V093_assign(player,V093_currentQuestion(player),{continueCurrent:true}),420);
      }
      const correctAnswer = QuizEngine.judge(q,payload.answer);
      let result, advance = false, detail;
      if (payload.action === 'pass') { result='pass'; detail=RaidFoundation.pass(raid,q.id,now); player.pass += 1; advance=true; q.passCount=(q.passCount||0)+1; if(state.config.passRetry&&q.passCount<=state.config.passMaxRetry)player.questions.push(q); }
      else if (correctAnswer) { result='correct'; detail=RaidFoundation.correct(raid,q.type,now); player.correct += 1; player.raidCorrectQuestions.push(q); advance=true; }
      else { result='wrong'; detail=RaidFoundation.wrong(raid,q.id,now); player.wrong += 1; advance=detail.advance; if(advance&&state.config.passRetry)player.questions.push(q); }
      V093_recordLearning(player,q,result);
      player.answered += advance?1:0; player.combo=raid.combo; player.maxCombo=raid.maxCombo; player.times.push(Math.max(.1,(now-(raid.attackStartAt||now))/1000));
      if (raid.battleState === 'DOWN') V093_prepareRevive(player);
      if (player.raidReviveQuestions.length && correctAnswer) { player.raidReviveQuestions.shift(); advance=false; if(raid.battleState==='ACTIVE')player.raidReviveQuestions=[]; }
      if (advance) player.questionIndex += 1;
      if (correctAnswer && raid.waveIndex === raid.totalWaves - 1 && !raid.heavyTriggered && player.correct >= 4 && !raid.guardState?.active) {
        RaidFoundation.activateHeavy(raid); raid.heavyTriggered = true; V093_log(player,'HEAVY ATTACK');
      }
      if (detail?.comboEvents?.length) detail.comboEvents.forEach(label=>V093_log(player,label));
      if (['critical','normal','weak'].includes(detail?.grade)) V093_log(player,detail.grade.toUpperCase());
      if (raid.lastEvent.includes('HEAVY')||raid.lastEvent.includes('BREAK')||raid.lastEvent==='REVIVE') V093_log(player,raid.lastEvent);
      V093_finishIfNeeded(player);
      LocalTransport.send('ANSWER_RESULT',{...EventPayload.base(player.id,{questionId:q.id,attemptId:payload.attemptId}),result,reason:result,correctAnswer:state.config.showAnswer&&result==='wrong'?q.answer:'',bonus:detail?.damage||0,combo:raid.combo,rank:teacherRank(player.id),player:V093_publicPlayer(player),raidDetail:detail});
      Events.emit('PLAYER_PROGRESS',{playerId:player.id,result,responseTime:player.times.at(-1),raid:true});
      RaidTeacherView.render(); this.publish();
      setTimeout(V091_saveTeacherState,0);
      if (!player.finished) setTimeout(()=>V093_assign(player,V093_currentQuestion(player),{continueCurrent:!advance}),420);
      else if (state.players.every(p=>p.finished)) setTimeout(()=>RaceEngine.finish(),850);
    };
    const V093_baseAssign = TeacherBridge.assign.bind(TeacherBridge);
    TeacherBridge.assign = function(player,q,options={}){ return V093_isRaid()?V093_assign(player,q,{continueCurrent:!!options.reuse,targetClientId:options.targetClientId||''}):V093_baseAssign(player,q,options); };

    const V093_baseTeacherHandle = TeacherBridge.handle;
    TeacherBridge.handle = function(message) {
      if (V093_isRaid() && message?.type === 'RAID_LISTEN_READY') {
        const p=message.payload||{}, player=state.players.find(x=>x.id===p.playerId), q=V093_currentQuestion(player);
        if(player&&q?.id===p.questionId&&!player.raid.attackStartAt){RaidFoundation.startListenTimer(player.raid,Date.now());LocalTransport.send('RAID_TIMING',{...EventPayload.base(player.id,{questionId:q.id}),targetClientId:message.senderId,raidTiming:{questionStartAt:player.raid.attackStartAt,attackDeadline:player.raid.attackDeadline,durationMs:player.raid.attackDurationMs}});this.publish();}
        return;
      }
      if (V093_isRaid() && message?.type === 'TRANSPORT_PING') {
        const player=state.players.find(x=>x.id===message.payload?.playerId);
        if(player) player.clientId=message.senderId;
      }
      const result=V093_baseTeacherHandle.call(this,message);
      if (V093_isRaid() && message?.type === 'TRANSPORT_PING') this.publish(message.senderId);
      return result;
    };

    const V093_baseFinish = RaceEngine.finish.bind(RaceEngine);
    RaceEngine.finish = function(){
      if(V093_isRaid()&&state.screen==='race')state.players.forEach(player=>{
        player.raidSessionEnded=true;
        player.raidManualEnd=!player.finished;
      });
      return V093_baseFinish();
    };
    const V093_baseOfficialResults = TeacherBridge.sendOfficialResults.bind(TeacherBridge);
    TeacherBridge.sendOfficialResults = function(){
      if(!V093_isRaid())return V093_baseOfficialResults();
      const sorted=[...state.players].sort((a,b)=>(b.raid?.cleared?1:0)-(a.raid?.cleared?1:0)||(b.correct/Math.max(1,b.correct+b.wrong+b.pass))-(a.correct/Math.max(1,a.correct+a.wrong+a.pass))||(b.questionIndex||0)-(a.questionIndex||0)||(b.raid?.maxCombo||0)-(a.raid?.maxCombo||0));
      sorted.forEach((player,index)=>LocalTransport.send('GAME_FINISH',{...EventPayload.base(player.id),targetClientId:player.clientId||'',rank:index+1,player:V093_publicPlayer(player,true),award:[]}));
    };

    Events.on('GAME_PAUSE',()=>{if(V093_isRaid())state.raidPausedAt=Date.now()});
    Events.on('GAME_RESUME',()=>{if(!V093_isRaid()||!state.raidPausedAt)return;const shift=Date.now()-state.raidPausedAt;state.players.forEach(p=>{if(p.raid?.attackDeadline){p.raid.attackStartAt+=shift;p.raid.attackDeadline+=shift}});state.raidPausedAt=0;TeacherBridge.publish()});
    setInterval(()=>{
      if(AppRole!=='teacher'||!V093_isRaid()||!state.race.running||state.race.paused)return;
      const now=Date.now();state.players.forEach(player=>{const r=player.raid,q=V093_currentQuestion(player);if(!player.finished&&q&&r?.attackDeadline&&!r.timeoutHitApplied&&now>=r.attackDeadline&&player.raidCurrentAttempt)TeacherBridge.answer({...EventPayload.base(player.id,{questionId:q.id,attemptId:player.raidCurrentAttempt}),action:'timeout',answer:'',responseTime:r.attackDurationMs/1000})});
    },250);

    const V093_baseRenderArenaScene=RaceEngine.renderArenaScene.bind(RaceEngine),V093_baseRenderRunners=RaceEngine.renderRunners.bind(RaceEngine),V093_baseFrame=RaceEngine.frame.bind(RaceEngine);
    RaceEngine.renderArenaScene=function(){return V093_isRaid()?RaidTeacherView.render():V093_baseRenderArenaScene()};
    RaceEngine.renderRunners=function(){return V093_isRaid()?RaidTeacherView.render():V093_baseRenderRunners()};
    RaceEngine.frame=function(){return V093_isRaid()?undefined:V093_baseFrame()};

    const V093_baseStudentAccept = StudentApp.acceptSnapshot;
    StudentApp.acceptSnapshot = function(snap){
      const result=V093_baseStudentAccept.call(this,snap);
      if(snap?.arena==='raid'){
        document.body.classList.add('raid-mode');const p=snap.players?.find(x=>x.id===StudentSession.playerId);
        if(p?.raid){
          StudentSession.player=p;
          if((p.finished||p.raidSessionEnded||snap.screen==='results')&&p.raidResult){StudentSession.screen=p.raidSessionEnded?'official':'finish';StudentSession.official={player:p,rank:StudentSession.rank};}
          if(snap.running&&!p.finished&&p.currentQuestion&&p.raidAttemptId&&StudentSession.question?.id!==p.currentQuestion.id){
            const remaining=Math.max(0,(p.raid.attackDeadline||0)-Date.now());
            this.showQuestion({question:p.currentQuestion,attemptId:p.raidAttemptId,player:p,rank:1,timeLimit:remaining/1000,raidTiming:{questionStartAt:p.raid.attackStartAt,attackDeadline:p.raid.attackDeadline,durationMs:p.raid.attackDurationMs},arena:'raid'});
          }
        }
      }
      return result
    };
    const V093_baseStudentHandle = StudentApp.handle;
    StudentApp.handle = function(message){
      if(message?.type==='RAID_TIMING'&&message.payload?.playerId===StudentSession.playerId){const t=message.payload.raidTiming;StudentSession.raidTiming=t;StudentSession.timeLimit=t.durationMs/1000;LocalClock.start({seconds:StudentSession.timeLimit,onTick:(ratio,left)=>this.tick(ratio,left),onExpire:()=>this.submit('','timeout')});this.renderRaidHud();return;}
      const result=V093_baseStudentHandle.call(this,message);
      if((message?.type==='GAME_PAUSE'||message?.type==='GAME_RESUME')&&StudentSession.snapshot?.arena==='raid'){document.body.classList.toggle('raid-paused',message.type==='GAME_PAUSE');this.render();}
      if(message?.type==='TRANSPORT_STATUS'&&message.payload?.status==='live'&&StudentSession.snapshot?.arena==='raid'&&StudentSession.playerId){
        setTimeout(()=>LocalTransport.send('TRANSPORT_PING',{...EventPayload.base(StudentSession.playerId),reconnectToken:StudentSession.reconnectToken,requestQuestion:true}),40);
      }
      return result;
    };
    const V093_baseShowQuestion = StudentApp.showQuestion;
    StudentApp.showQuestion = function(payload){if(payload.arena==='raid'||payload.player?.raid){StudentSession.raidTiming=payload.raidTiming;document.body.classList.add('raid-mode');}return V093_baseShowQuestion.call(this,payload)};
    const V093_baseStudentRender = StudentApp.render;
    StudentApp.render = function(){const result=V093_baseStudentRender.call(this);this.renderRaidHud();return result};
    StudentApp.renderRaidHud = function(){
      if(StudentSession.snapshot?.arena!=='raid'&&!StudentSession.player?.raid)return;
      window.SUMUS_RAID_VISUAL?.renderStudent?.();
    };
    StudentApp.updateRaidGauge = function(){cancelAnimationFrame(this.raidGaugeRaf);const frame=()=>{const fill=$('#raidAttackFill'),t=StudentSession.raidTiming;if(!fill||!t)return;const duration=t.durationMs||1,ratio=t.attackDeadline?Math.min(1,Math.max(0,(Date.now()-t.questionStartAt)/duration)):0;fill.style.width=`${ratio*100}%`;if(ratio<1)this.raidGaugeRaf=requestAnimationFrame(frame)};this.raidGaugeRaf=requestAnimationFrame(frame)};
    const V093_audioPlay = AudioPronunciationProvider.play.bind(AudioPronunciationProvider);
    AudioPronunciationProvider.play = function(text,onState=()=>{}){const raidListen=StudentSession.snapshot?.arena==='raid'&&StudentSession.question?.type==='listen';return V093_audioPlay(text,playing=>{onState(playing);if(raidListen&&!playing)LocalTransport.send('RAID_LISTEN_READY',{...EventPayload.base(StudentSession.playerId,{questionId:StudentSession.question.id,attemptId:StudentSession.attemptId})})})};

    const V093_baseRenderLobby = renderLobby;
    renderLobby = function(){const result=V093_baseRenderLobby();if(V093_isRaid())setTimeout(()=>window.SUMUS_RAID_SHELLS?.renderTeacherLobby?.(),0);else window.SUMUS_RAID_SHELLS?.restoreRunTeacherSurface?.();return result};
    const V093_baseRenderResults = renderResults;
    renderResults = function(){if(!V093_isRaid())return V093_baseRenderResults();const sorted=[...state.players].sort((a,b)=>(b.raid?.cleared?1:0)-(a.raid?.cleared?1:0)||(b.correct/Math.max(1,b.answered))-(a.correct/Math.max(1,a.answered))||(b.raid?.maxCombo||0)-(a.raid?.maxCombo||0));$('#resultsBody').innerHTML=sorted.map((p,i)=>`<tr><td>${i+1}</td><td><b>${V093_escape(p.name)}</b></td><td>${p.correct}</td><td>${p.wrong}</td><td>${p.pass}</td><td>${Math.round(p.correct/Math.max(1,p.answered)*100)}%</td><td>${avg(p.times).toFixed(1)}s</td><td>${p.times.length?`${Math.min(...p.times).toFixed(1)}s`:'-'}</td><td>×${p.raid?.maxCombo||0}</td><td>${p.raid?.cleared?'CLEAR':`W${(p.raid?.waveIndex||0)+1}`} · DMG ${p.raid?.totalDamage||0}</td></tr>`).join('');$('#awards').innerHTML='<div class="award"><span>RAID RESULT</span><b>CLEAR · ACCURACY · COMBO · DAMAGE</b></div>';$('#podium').innerHTML='';updateArenaLabels()};
    window.SUMUS_RAID = { foundation:RaidFoundation, teacherView:RaidTeacherView, snapshot:()=>state.players.map(V093_publicPlayer), events:V093_events };
