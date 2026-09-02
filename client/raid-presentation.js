    /* V0.9.3B.1 RAID VISUAL DIRECTOR compatibility marker. */
    /* V0.9.3C.4 RAID GAME FEEL + CLASSROOM PLAYABILITY — presentation only. */
    /* Motion policy lives in raid-premium.css under prefers-reduced-motion:reduce. */
    const RaidPresentation = (() => {
      const teacherClockStartedAt = Date.now();
      const style = document.createElement('style');
      style.dataset.sumusRaidVisual = 'V0.9.3C.4';
      style.textContent = SUMUS_RAID_PREMIUM_CSS;
      document.head.appendChild(style);

      const preview = (() => {
        const params = new URLSearchParams(location.search);
        return params.get('debug') === '1' ? String(params.get('raidVisualState') || '') : '';
      })();
      let studentPrevious = null;
      let teacherPrevious = null;
      let teacherTarget = '';
      let teacherBumperKey = '';
      let teacherBumperAt = 0;
      let teacherSignature = '';
      let scheduled = false;
      let timerRaf = 0;
      const effectTimers = new Set();
      const queueEffect = (node, delay, task) => {
        const timer = setTimeout(() => {
          effectTimers.delete(timer);
          if (node?.isConnected) task();
        }, delay);
        effectTimers.add(timer);
        return timer;
      };
      const escapeText = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
      const percent = (value, max) => Math.max(0, Math.min(100, Number(value || 0)) / Math.max(1, Number(max || 1)) * 100);
      const formatNumber = value => Math.max(0, Number(value || 0)).toLocaleString('en-US');
      const formatClock = seconds => {
        const safe = Math.max(0, Math.ceil(Number(seconds || 0)));
        return `${String(Math.floor(safe / 60)).padStart(2,'0')}:${String(safe % 60).padStart(2,'0')}`;
      };
      setInterval(() => {
        const clock = document.querySelector('[data-raid-battle-clock]');
        if (clock) clock.textContent = formatClock((Date.now() - teacherClockStartedAt) / 1000);
      }, 1000);
      const eventKind = event => {
        const value = String(event || '').toUpperCase();
        if (value.includes('CRITICAL')) return 'critical';
        if (value === 'WEAK' || value.includes('WEAK HIT')) return 'weak';
        if (value.includes('SHIELD')) return 'shield';
        if (value.includes('BREAK') || value.includes('GUARD')) return 'guard';
        if (value.includes('HEAVY')) return 'heavy';
        if (value.includes('DOWN')) return 'down';
        if (value.includes('REVIVE')) return 'revive';
        if (value.includes('CLEAR') || value.includes('TAMED')) return 'clear';
        if (value.includes('COUNTER') || value.includes('BOSS ATTACK')) return 'player-hit';
        if (value.includes('PASS')) return 'pass';
        if (value.includes('GAUGE') || value.includes('WRONG')) return 'wrong';
        return 'normal';
      };
      const statusLabel = raid => String(RaidTeacherView.status(raid || {}) || 'NORMAL').toUpperCase();
      const reasonLabel = visual => {
        const event = String(visual.lastEvent || '').toUpperCase();
        if (visual.cleared) return 'ALL WORDS TAMED';
        if (visual.primaryState === 'down') return 'PLAYER DOWN';
        if (visual.primaryState === 'revive') return 'REVIVE SUCCESS';
        if (visual.heavy) return 'HEAVY ATTACK';
        if (visual.guard) return 'GUARD BREAK';
        if (event.includes('CRITICAL')) return 'CRITICAL HIT';
        if (visual.enemyHp / Math.max(1,visual.enemyMaxHp) <= .1) return 'CLEAR CHANCE';
        return event || 'RAID BATTLE';
      };
      const asset = (id, className = '') => RaidAssetDirector.markup(id, className);
      const statusIcons = visual => {
        const flags = [];
        if (visual.shield) flags.push(['shield','SHIELD']);
        if (visual.guard) flags.push(['guard','GUARD']);
        if (visual.heavy) flags.push(['heavy',`HEAVY ${visual.heavyProgress}/2`]);
        if (visual.primaryState === 'down') flags.push(['down','DANGER']);
        return flags.slice(0,4).map(([kind,label])=>`<span class="raid-status-icon ${kind}"><i></i>${label}</span>`).join('');
      };
      const stateRibbon = visual => {
        const event = String(visual.lastEvent || '').toUpperCase();
        if (visual.cleared) return ['clear','ALL WORDS TAMED'];
        if (visual.primaryState === 'down') return ['down','DOWN · REVIVE 0/2'];
        if (visual.primaryState === 'revive') return ['revive',`REVIVE ${visual.reviveStreak}/2`];
        if (visual.heavy) return ['heavy',`HEAVY CHARGE ${visual.heavyProgress}/2`];
        if (visual.guard) return ['guard','GUARD · BREAK IT'];
        if (event.includes('GAUGE +25')) return ['warning','RETRY BATTLE · GAUGE +25%'];
        if (event.includes('PASS')) return ['warning','RETRY BATTLE · PASS +35%'];
        if (event.includes('COUNTER')) return ['danger','ENEMY COUNTER · HP -8'];
        if (event.includes('BOSS ATTACK')) return ['danger','TIMEOUT · HP -10'];
        return ['', ''];
      };
      const arenaDecor = () => '<div class="raid-scene-stars"></div><div class="raid-scene-castle"></div><div class="raid-scene-crest"></div><div class="raid-scene-beam a"></div><div class="raid-scene-beam b"></div><div class="raid-scene-floor"></div>';
      const combatArenaMarkup = (visual, broadcast = false) => { const ribbon = stateRibbon(visual); return `<div class="raid-combat-scene" data-tier="${visual.tier}" data-primary="${visual.primaryState}" data-event="${eventKind(visual.lastEvent)}" data-combo="${visual.combo}">${arenaDecor()}<div class="raid-unit raid-player-unit">${asset(RaidAssetDirector.playerId(visual))}</div><div class="raid-unit raid-enemy-unit">${asset(RaidAssetDirector.enemyId(visual))}</div><div class="raid-shield-field"></div><div class="raid-guard-field"></div><div class="raid-impact-core"></div><div class="raid-fx-layer" aria-live="polite"></div>${ribbon[1]?`<div class="raid-state-ribbon ${ribbon[0]}">${escapeText(ribbon[1])}</div>`:''}${broadcast?`<div class="raid-broadcast-state">${escapeText(reasonLabel(visual))}</div>`:''}</div>`; };
      const emit = (stage, kind, label) => {
        const layer = stage?.querySelector('.raid-fx-layer');
        if (!layer) return;
        while (layer.children.length >= RaidVisualModel.MAX_EFFECT_NODES) layer.firstElementChild?.remove();
        const node = document.createElement('span');
        const assetId = RaidAssetDirector.fxId(kind,label);
        node.className = `raid-damage-fx ${kind}`;
        node.innerHTML = `${assetId ? asset(assetId) : ''}<b>${escapeText(label)}</b>`;
        layer.appendChild(node);
        RaidAssetDirector.mountAll(node);
        const timer = setTimeout(() => { node.remove(); effectTimers.delete(timer); }, 900);
        effectTimers.add(timer);
      };
      const emitTransition = (stage, previous, visual) => {
        if (!previous) {
          if (visual.preview) emit(stage,eventKind(visual.lastEvent),visual.preview === 'boss-clear' ? 'ALL WORDS TAMED' : visual.lastEvent);
          return;
        }
        const damage = Math.max(0,previous.enemyHp - visual.enemyHp);
        const kind = eventKind(visual.lastEvent);
        const hpLoss = Math.max(0,previous.hp - visual.hp);
        const crossed = [3,5,10,15,20].filter(value => previous.combo < value && visual.combo >= value).at(-1) || 0;
        stage.classList.add('is-confirming');
        if (damage > 0) {
          queueEffect(stage,80,()=>stage.classList.add('is-player-attacking'));
          queueEffect(stage,220,()=>{stage.classList.add(`is-impact-${kind}`);emit(stage,kind,`${kind === 'critical' ? 'CRITICAL! ' : kind === 'weak' ? 'WEAK · ' : ''}${formatNumber(damage)}`)});
          queueEffect(stage,330,()=>stage.classList.add('is-enemy-reacting'));
          queueEffect(stage,500,()=>stage.classList.add('is-resolved'));
        } else if (hpLoss > 0) {
          queueEffect(stage,120,()=>stage.classList.add('is-enemy-attacking'));
          queueEffect(stage,270,()=>{stage.classList.add('is-player-reacting');emit(stage,'player-hit',visual.lastEvent || `HP -${hpLoss}`)});
        } else if (previous.lastEvent !== visual.lastEvent) {
          queueEffect(stage,120,()=>emit(stage,kind,visual.lastEvent));
        }
        if (crossed) queueEffect(stage,360,()=>{stage.classList.add(`is-combo-${crossed}`);emit(stage,crossed >= 10 ? 'critical' : crossed === 5 ? 'shield' : 'normal',crossed === 10 ? 'SPECIAL ATTACK · COMBO 10' : crossed === 15 ? 'SUPER CRITICAL · COMBO 15' : crossed === 20 ? 'LEGEND COMBO 20' : `COMBO ${crossed}`)});
        if (previous.waveIndex !== visual.waveIndex) queueEffect(stage,80,()=>{stage.classList.add('is-wave-transition');emit(stage,'clear',visual.tier === 'boss' ? 'FINAL BOSS' : `WAVE ${visual.waveIndex+1}`)});
        if (!previous.cleared && visual.cleared) queueEffect(stage,180,()=>{stage.classList.add('is-raid-clear');emit(stage,'clear','ALL WORDS TAMED')});
      };

      const studentRaid = () => StudentSession?.player?.raid || StudentSession?.snapshot?.players?.find(player=>player.id===StudentSession.playerId)?.raid || null;
      const studentMarkup = visual => {
        const enemyPct = percent(visual.enemyHp,visual.enemyMaxHp);
        const hpPct = percent(visual.hp,visual.maxHp);
        const playerName = StudentSession.player?.name || 'RAIDER';
        const comboClass = visual.combo >= 20 ? 'legend' : visual.combo >= 15 ? 'super' : visual.combo >= 10 ? 'special' : visual.combo >= 5 ? 'shield-ready' : visual.combo >= 3 ? 'glow' : '';
        return `<header class="raid-mobile-hud"><div class="raid-wave"><small>WAVE</small><b>${visual.waveIndex+1} / ${visual.totalWaves}</b></div><div class="raid-wordmark"><span></span><b>SUMUS RAID</b></div><div class="raid-clock"><small>TIME</small><b data-raidp-clock>00:00</b></div></header><section class="raid-enemy-hud"><div class="raid-enemy-line"><strong>${visual.tier.toUpperCase()}</strong><b>${escapeText(visual.monster.name)}</b><span>${statusIcons(visual)}</span></div><div class="raid-hp-line enemy"><div class="raid-meter"><i style="width:${enemyPct}%"></i></div><b>${formatNumber(visual.enemyHp)} / ${formatNumber(visual.enemyMaxHp)}</b></div></section>${combatArenaMarkup(visual)}<section class="raid-player-hud"><div class="raid-player-portrait">${asset(RaidAssetDirector.playerId(visual))}</div><div class="raid-player-stats"><div><b>${escapeText(playerName)}</b><strong>HP ${formatNumber(visual.hp)} / ${formatNumber(visual.maxHp)}</strong></div><div class="raid-meter player"><i style="width:${hpPct}%"></i></div><div class="raid-status-row">${statusIcons(visual) || '<span class="raid-status-icon normal"><i></i>READY</span>'}</div></div></section><div class="raid-combo ${comboClass}"><small>COMBO</small><b>${visual.combo}</b></div>`;
      };
      const updateStudentTimer = () => {
        cancelAnimationFrame(timerRaf);
        const frame = () => {
          const timing = StudentSession.raidTiming;
          const duration = Number(timing?.durationMs || 1);
          const elapsed = timing?.attackDeadline ? Math.min(1,Math.max(0,(Date.now()-Number(timing.questionStartAt || Date.now()))/duration)) : 0;
          const remaining = timing?.attackDeadline ? Math.max(0,(Number(timing.attackDeadline)-Date.now())/1000) : 0;
          const phase = elapsed >= .85 ? 'danger' : elapsed >= .65 ? 'charge' : elapsed >= .35 ? 'alert' : 'safe';
          const battle = document.getElementById('raidStudentStage');
          if (battle) battle.dataset.timerPhase = phase;
          const top = document.querySelector('[data-raidp-clock]');
          const seconds = document.querySelector('[data-raidp-seconds]');
          const fill = document.querySelector('.raid-attack-meter i');
          if (top) top.textContent = formatClock(remaining);
          if (seconds) seconds.textContent = String(Math.max(0,Math.ceil(remaining))).padStart(2,'0');
          if (fill) fill.style.width = `${(1-elapsed)*100}%`;
          if (elapsed < 1) timerRaf = requestAnimationFrame(frame);
        };
        timerRaf = requestAnimationFrame(frame);
      };
      const renderStudent = () => {
        const raid = studentRaid();
        const root = document.getElementById('raidStudentStage');
        if (!raid || !root) return;
        const visual = RaidVisualModel.project(raid,preview);
        document.body.classList.add('raidv-ready');
        RaidAssetDirector.preloadFor(visual);
        const signature = RaidVisualModel.signature(visual);
        if (root.dataset.signature !== signature) {
          const previous = studentPrevious;
          root.dataset.signature = signature;
          root.innerHTML = studentMarkup(visual);
          RaidAssetDirector.mountAll(root);
          emitTransition(root.querySelector('.raid-combat-scene'),previous,visual);
          studentPrevious = visual;
        }
        updateStudentTimer();
      };

      const playerProgress = player => {
        const raid = player?.raid || {};
        if (raid.cleared) return 100;
        const waves = Math.max(1,Number(raid.totalWaves || 1));
        const wave = Math.max(0,Number(raid.waveIndex || 0));
        const encounter = 1-Math.max(0,Math.min(1,Number(raid.enemyHp || 0)/Math.max(1,Number(raid.enemyMaxHp || 1))));
        return Math.max(0,Math.min(99,Math.round((wave+encounter)/waves*100)));
      };
      const accuracy = player => Math.round(Number(player.correct || 0)/Math.max(1,Number(player.answered || 0))*100);
      const ranking = players => [...players].sort((a,b)=>Number(!!b.raid?.cleared)-Number(!!a.raid?.cleared)||playerProgress(b)-playerProgress(a)||accuracy(b)-accuracy(a)||Number(b.raid?.maxCombo||0)-Number(a.raid?.maxCombo||0));
      const cardMarkup = (player,index,selectedId) => {
        const raid = player.raid || {}, status = statusLabel(raid), signal = eventKind(raid.lastEvent);
        return `<button class="raid-student-card ${status.toLowerCase()} signal-${signal} ${player.connected===false?'disconnected':''} ${player.id===selectedId?'active':''}" data-signal="${signal}" data-raid-player="${escapeText(player.id)}"><span class="raid-card-rank">${index+1}</span><b>${escapeText(player.name)}</b><small>W${(raid.waveIndex||0)+1}/${raid.totalWaves||1}</small><i class="raid-card-avatar">${asset('raid-player-main-idle')}</i><div class="raid-card-meters"><span><i style="width:${percent(raid.hp,raid.maxHp)}%"></i></span><span class="enemy"><i style="width:${percent(raid.enemyHp,raid.enemyMaxHp)}%"></i></span></div><strong data-status="${status}">${status}</strong></button>`;
      };
      const importantEvent = row => /CRITICAL|COMBO (?:3|5|10|15|20)|SHIELD|GUARD|BREAK|HEAVY|DOWN|REVIVE|CLEAR|WAVE|SPECIAL|LEGEND/i.test(String(row?.label || ''));
      const eventMarkup = () => {
        const rows = V093_events.filter(importantEvent).slice(0,5);
        if (!rows.length) rows.push({at:Date.now(),name:'SUMUS RAID',label:'BATTLE READY'});
        return rows.map(row=>{const kind=eventKind(row.label),time=new Date(row.at||Date.now()).toLocaleTimeString('ko-KR',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});return `<div class="raid-event-row" data-kind="${kind}"><i></i><time>${time}</time><b>${escapeText(row.name)}</b><strong>${escapeText(row.label)}</strong></div>`}).join('');
      };
      const rankingMarkup = players => ranking(players).slice(0,5).map((player,index)=>`<div class="raid-rank-row"><strong>${index+1}</strong><i>${asset('raid-player-main-idle')}</i><b>${escapeText(player.name)}</b><span>${player.raid?.cleared?'CLEAR':`${playerProgress(player)}%`}</span><div><i style="width:${playerProgress(player)}%"></i></div><em>ACC ${accuracy(player)}%</em><small>MAX ×${Number(player.raid?.maxCombo||player.maxCombo||0)}</small></div>`).join('');
      const teacherMarkup = (player,visual) => {
        const players = state.players || [], connected = players.filter(item=>item.connected!==false).length;
        const invite = window.SUMUS_RAID_SHELLS?.teacherJoinUrl?.() || '';
        return `<header class="raid-teacher-top"><div class="raid-wordmark"><span></span><b>SUMUS RAID</b></div><div class="raid-connected"><small>TOTAL STUDENTS</small><b>${connected} / ${players.length}</b><span>CONNECTED</span></div><div class="raid-live-clock"><small>LIVE</small><b data-raid-battle-clock>00:00</b></div><nav class="raid-broadcast-controls"><button class="primary ${RaidTeacherView.auto?'active':''}" id="raidAuto">AUTO SPOTLIGHT</button><button class="${RaidTeacherView.auto?'':'active'}" id="raidManual">MANUAL PIN</button><button id="raidPause" ${state.race.paused?'disabled':''}>PAUSE</button><button id="raidResume" ${state.race.paused?'':'disabled'}>RESUME</button><button class="danger" id="raidFinish">END RAID</button></nav></header><main class="raid-teacher-main"><section class="raid-spotlight"><aside class="raid-invite-panel"><small>CLASSROOM RAID CODE</small><strong>${escapeText(BattleSession.code)}</strong><p>${escapeText(invite)}</p><button type="button" id="raidCopyUrl">COPY STUDENT URL</button><div class="raid-teacher-qr"></div><span>SCAN TO JOIN</span></aside><div class="raid-broadcast-arena"><header><b>${RaidTeacherView.auto?'AUTO SPOTLIGHT':'MANUAL PIN'}</b><div><strong>${escapeText(player.name)}</strong><small>WAVE ${(visual.waveIndex||0)+1} / ${visual.totalWaves}</small></div><div class="raid-boss-meter"><span><b>${visual.tier.toUpperCase()}</b>${escapeText(visual.monster.name)}</span><div class="raid-meter"><i style="width:${percent(visual.enemyHp,visual.enemyMaxHp)}%"></i></div><small>${formatNumber(visual.enemyHp)} / ${formatNumber(visual.enemyMaxHp)}</small></div></header>${combatArenaMarkup(visual,true)}<footer><div class="raid-spot-player">${asset(RaidAssetDirector.playerId(visual))}<span><b>${escapeText(player.name)}</b><div class="raid-meter player"><i style="width:${percent(visual.hp,visual.maxHp)}%"></i></div><small>HP ${formatNumber(visual.hp)} / ${formatNumber(visual.maxHp)}</small></span></div><div class="raid-spot-combo"><small>COMBO</small><b>${visual.combo}</b></div><div class="raid-spot-wave"><small>WAVE</small><b>${visual.waveIndex+1} / ${visual.totalWaves}</b></div></footer></div></section><aside class="raid-roster"><header><h2>ALL STUDENTS (${players.length})</h2><span>6 × 4 RAID PARTY</span></header><div class="raid-card-grid">${players.map((item,index)=>cardMarkup(item,index,player.id)).join('')}</div></aside></main><footer class="raid-teacher-bottom"><section class="raid-events"><header>LIVE EVENT FEED</header><div>${eventMarkup()}</div></section><section class="raid-ranking"><header>LIVE TOP 5 RANKING</header><div>${rankingMarkup(players)}</div></section></footer><div class="raid-teacher-tip"><b>TEACHER TIP</b><span>Encourage teamwork. Focus on SHIELD, GUARD, and HEAVY attacks.</span></div>`;
      };
      const bindTeacher = root => {
        root.querySelector('#raidAuto')?.addEventListener('click',()=>{RaidTeacherView.auto=true;teacherSignature='';schedule()});
        root.querySelector('#raidManual')?.addEventListener('click',()=>{RaidTeacherView.auto=false;teacherSignature='';schedule()});
        root.querySelector('#raidPause')?.addEventListener('click',()=>{if(!state.race.paused)document.querySelector('#pauseRace')?.click();setTimeout(schedule,0)});
        root.querySelector('#raidResume')?.addEventListener('click',()=>{if(state.race.paused)document.querySelector('#pauseRace')?.click();setTimeout(schedule,0)});
        root.querySelector('#raidFinish')?.addEventListener('click',()=>document.querySelector('#finishRace')?.click());
        root.querySelector('#raidCopyUrl')?.addEventListener('click',async event=>{try{await navigator.clipboard.writeText(window.SUMUS_RAID_SHELLS?.teacherJoinUrl?.()||'');event.currentTarget.textContent='COPIED'}catch(error){toast('학생 URL을 복사하지 못했습니다.','warn')}});
        root.querySelectorAll('[data-raid-player]').forEach(button=>button.addEventListener('click',()=>{RaidTeacherView.auto=false;RaidTeacherView.selectedId=button.dataset.raidPlayer;teacherSignature='';schedule()}));
      };
      const renderTeacher = () => {
        if (AppRole === 'student' || state.arena !== 'raid' || state.screen !== 'race') return;
        const root = RaidShells.teacherRoot();
        const player = state.players.find(item=>item.id===RaidTeacherView.selectedId) || state.players[0];
        if (!player?.raid) return;
        const visual = RaidVisualModel.project(player.raid,preview);
        const signature = JSON.stringify([RaidVisualModel.signature(visual),RaidTeacherView.auto,RaidTeacherView.selectedId,state.race.paused,state.players.map(item=>[item.id,item.connected,item.correct,item.answered,item.raid?.hp,item.raid?.enemyHp,item.raid?.combo,item.raid?.maxCombo,item.raid?.lastEvent,item.raid?.waveIndex,item.raid?.cleared]),V093_events.filter(importantEvent).slice(0,5)]);
        document.body.classList.add('raid-mode','raid-shell-active','raidv-ready');
        if (teacherSignature === signature && root.querySelector('.raid-teacher-top')) return;
        const previous = teacherPrevious?.id === player.id ? teacherPrevious.visual : null;
        teacherSignature = signature;
        root.innerHTML = teacherMarkup(player,visual);
        const sourceQr = document.querySelector('#lobby .qr');
        const targetQr = root.querySelector('.raid-teacher-qr');
        if (sourceQr && targetQr) targetQr.innerHTML = sourceQr.innerHTML;
        RaidAssetDirector.preloadFor(visual);
        RaidAssetDirector.mountAll(root);
        bindTeacher(root);
        emitTransition(root.querySelector('.raid-combat-scene'),previous,visual);
        teacherPrevious = {id:player.id,visual};
        const bumperReason = reasonLabel(visual), bumperKey = `${player.id}|${bumperReason}`;
        if ((player.id !== teacherTarget || bumperKey !== teacherBumperKey) && (Date.now()-teacherBumperAt > 2500 || player.id !== teacherTarget)) {
          teacherTarget = player.id;
          teacherBumperKey = bumperKey;
          teacherBumperAt = Date.now();
          const bumper = document.createElement('div');
          bumper.className = 'raid-broadcast-bumper';
          bumper.innerHTML = `<b>${escapeText(player.name)}</b><small>${escapeText(bumperReason)}</small>`;
          root.appendChild(bumper);
          setTimeout(()=>bumper.remove(),350);
        }
      };

      const render = () => { scheduled=false; AppRole==='student' ? renderStudent() : renderTeacher() };
      const schedule = () => { if(scheduled)return;scheduled=true;requestAnimationFrame(render) };
      new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});
      ['ANSWER_RESULT','QUESTION_ASSIGN','GAME_PAUSE','GAME_RESUME','GAME_FINISH'].forEach(type=>Events.on(type,schedule));
      schedule();
      const audit = () => ({
        build:'V0.9.3C.7', role:AppRole, preview,
        dedicatedStudentShell:!!document.querySelector('.raid-student-shell'),
        dedicatedTeacherScreen:!!document.getElementById('raidTeacherScreen'),
        runRaceVisible:!!document.querySelector('#race.active'),
        assetSlots:document.querySelectorAll('.raidv-asset').length,
        loadedAssets:document.querySelectorAll('.raidv-asset.is-loaded').length,
        fallbacks:document.querySelectorAll('.raidv-asset.is-fallback').length,
        effects:document.querySelectorAll('.raid-damage-fx').length,
        maxEffects:RaidVisualModel.MAX_EFFECT_NODES,
        teacherCards:document.querySelectorAll('.raid-student-card').length,
        visibleTeacherCards:[...document.querySelectorAll('.raid-student-card')].filter(card=>getComputedStyle(card).display!=='none').length,
        answerExposure:/correctAnswer|studentAnswer/i.test(document.getElementById('raidTeacherRoot')?.textContent || ''),
        horizontalOverflow:document.documentElement.scrollWidth>innerWidth,
        verticalOverflow:document.documentElement.scrollHeight>innerHeight
      });
      return Object.freeze({build:'V0.9.3C.7',audit,preview,renderStudent,renderTeacher,schedule});
    })();
    window.SUMUS_RAID_VISUAL = RaidPresentation;
