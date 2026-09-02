    /* V0.9.3C.3 RAID SHELL SEPARATION — shared transport, dedicated presentation roots. */
    const RaidShells = (() => {
      const escapeText = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
      const isRaidStudent = () => AppRole === 'student' && (
        StudentSession?.snapshot?.arena === 'raid' ||
        StudentSession?.player?.raid ||
        RoleParams.get('mode') === 'raid'
      );
      const hideRunTeacherSurface = () => {
        const race = document.getElementById('race');
        const dedicated = document.getElementById('raidTeacherScreen');
        if (!race || !dedicated) return;
        race.classList.remove('active');
        dedicated.classList.add('active');
      };
      const restoreRunTeacherSurface = () => {
        document.getElementById('raidTeacherScreen')?.classList.remove('active');
        document.getElementById('raidLobbyScreen')?.classList.remove('active');
      };
      const teacherRoot = () => {
        let screen = document.getElementById('raidTeacherScreen');
        if (!screen) {
          screen = document.createElement('section');
          screen.id = 'raidTeacherScreen';
          screen.className = 'screen raid-shell-screen';
          screen.innerHTML = '<div id="raidTeacherRoot" class="raid-shell raid-teacher-shell"></div>';
          document.body.appendChild(screen);
        }
        hideRunTeacherSurface();
        return screen.querySelector('#raidTeacherRoot');
      };
      const playerAsset = stateName => {
        const id = `raid-player-main-${stateName || 'idle'}`;
        return typeof RaidAssetDirector === 'undefined' ? '' : RaidAssetDirector.markup(id, 'raid-shell-player-art');
      };
      const raidEntryView = app => {
        const s = StudentSession;
        if ((s.screen === 'finish' || s.screen === 'official') && window.SUMUS_RAID_RESULTS) return window.SUMUS_RAID_RESULTS.renderStudent(s.player || s.official?.player || {});
        const copy = {
          connecting: ['LINKING RAID', '배틀 코드를 확인하고 있습니다.'],
          name: ['RAIDER NAME', '수업에서 사용할 이름을 입력하세요.'],
          waiting: ['RAID LINKED', '선생님이 레이드를 시작할 때까지 기다려 주세요.'],
          countdown: ['RAID START', '전투가 곧 시작됩니다.'],
          finish: ['WORD TAMED', '모든 단어 몬스터를 길들였습니다.'],
          official: ['ALL WORDS TAMED', '최종 레이드 결과가 확정되었습니다.'],
          enter: ['ENTER RAID', '5자리 RAID 코드를 입력하세요.']
        };
        const key = copy[s.screen] ? s.screen : 'enter';
        const [title, subtitle] = copy[key];
        const isName = key === 'name', isEnter = key === 'enter';
        const codeInput = isEnter ? `<input class="raid-entry-input student-code" id="studentCodeInput" inputmode="numeric" pattern="[0-9]*" maxlength="5" placeholder="00000" value="${escapeText(s.battleCode || '')}"><button class="raid-entry-primary" id="studentEnterBattle" ${/^\d{5}$/.test(s.battleCode || '')?'':'disabled'}>ENTER RAID</button>` : '';
        const nameInput = isName ? `<input class="raid-entry-input" id="studentNameInput" maxlength="16" autocomplete="off" placeholder="김민수"><button class="raid-entry-primary" id="studentNameContinue">CONTINUE</button>` : '';
        const assignedRange = [s.player?.rangeFrom,s.player?.rangeTo].filter(Boolean).join(' → ') || (s.player?.units||[]).join(', ') || '선생님 배정 대기';
        const ready = key === 'waiting' ? `<div class="raid-entry-meta"><b>${escapeText(s.player?.name || 'RAIDER')}</b><span>${escapeText(s.snapshot?.bookName || '')}</span><span>RANGE ${escapeText(assignedRange)}</span><span>ROOM ${escapeText(s.battleCode || '')}</span><strong>RAID READY</strong></div>` : '';
        const countdown = key === 'countdown' ? '<b class="raid-entry-countdown" id="studentCountdownValue">READY</b>' : '';
        return `<div class="raid-entry-stage"><div class="raid-entry-sky"></div><div class="raid-entry-art">${playerAsset(key === 'finish' || key === 'official' ? 'special' : 'idle')}</div><div class="raid-entry-copy"><small>SUMUS RAID</small><h1>${title}</h1><p>${subtitle}</p>${codeInput}${nameInput}${ready}${countdown}<div class="student-error">${escapeText(s.error || '')}</div></div></div>`;
      };
      const raidCharacterView = () => {
        const states = ['idle','attack','critical','shield','special','revive','hit','idle'];
        return `<div class="raid-entry-stage character"><div class="raid-entry-sky"></div><div class="raid-entry-copy"><small>SUMUS RAID</small><h1>CHOOSE YOUR STAR</h1><p>모든 선택은 동일한 능력의 RAID 영웅입니다.</p><div class="raid-character-grid">${CharacterIds.map((id,index)=>`<button class="raid-character-choice ${StudentSession.character===id?'active':''}" data-character="${id}">${playerAsset(states[index])}<b>STAR ${index+1}</b></button>`).join('')}</div><button class="raid-entry-primary" id="studentReady">RAID READY</button></div></div>`;
      };
      const questionShell = app => {
        const s = StudentSession, q = s.question || {};
        let answerIndex = 0;
        const question = app.questionRenderer(q).replace(/<small>[A-D]<\/small>/g, () => `<small>${++answerIndex}</small>`);
        const pass = s.snapshot?.config?.passOn ? '<button class="raid-action-pass student-pass" id="studentPass">PASS</button>' : '<span></span>';
        const listen = q.type === 'listen' ? '<button class="raid-action-listen" id="raidStudentListen" type="button">LISTEN</button>' : '<span class="raid-action-hint">ANSWER TO ATTACK</span>';
        const progressed = Math.min(Number(s.player?.questionIndex || 0) + 1, Number(s.player?.assignedTotal || s.player?.questions?.length || 1));
        const assigned = Number(s.player?.assignedTotal || s.player?.questions?.length || progressed);
        return `<div class="raid-shell raid-student-shell" data-raid-screen="question"><div class="raid-pause-overlay" role="status"><b>PAUSED</b><span>선생님이 전투를 잠시 멈췄습니다.</span></div><section id="raidStudentStage" class="raid-student-battle" aria-label="RAID battle stage"></section><section class="raid-question-panel student-question-wrap"><div class="raid-question-content">${question}</div><div class="raid-command-deck"><div class="raid-attack-time"><strong data-raidp-seconds>00</strong><div><b>ATTACK TIME</b><div class="raid-attack-meter"><i></i></div></div><em>${progressed} / ${assigned}</em></div><footer class="raid-student-actions">${listen}${pass}</footer></div></section></div>`;
      };
      const bindRaidExtras = () => {
        document.getElementById('raidStudentListen')?.addEventListener('click', () => {
          const button = document.getElementById('raidStudentListen');
          AudioPronunciationProvider.play(StudentSession.question?.word?.word || '', playing => button?.classList.toggle('playing', playing));
        });
      };
      const renderRaidStudentShell = app => {
        const root = document.getElementById('studentRoot');
        if (!root) return;
        document.body.classList.add('raid-mode','raid-shell-active');
        document.body.classList.remove('raid-run-surface');
        root.innerHTML = StudentSession.screen === 'question'
          ? questionShell(app)
          : `<div class="raid-shell raid-student-shell" data-raid-screen="${escapeText(StudentSession.screen || 'enter')}">${StudentSession.screen === 'character' ? raidCharacterView() : raidEntryView(app)}</div>`;
        app.bindView();
        bindRaidExtras();
        RaidAssetDirector?.mountAll(root);
        window.SUMUS_RAID_VISUAL?.renderStudent?.();
      };
      const teacherJoinUrl = () => {
        const origin = window.SUMUS_PUBLIC_ORIGIN?.() || (location.protocol === 'http:' || location.protocol === 'https:' ? location.origin : 'http://localhost:8720');
        const url = new URL('/', origin);
        url.searchParams.set('role','student');
        url.searchParams.set('code',BattleSession.code);
        url.searchParams.set('mode','raid');
        return url.toString();
      };
      const renderTeacherLobby = () => {
        if (AppRole !== 'teacher' || state.arena !== 'raid' || state.screen !== 'lobby') return;
        let screen = document.getElementById('raidLobbyScreen');
        if (!screen) {
          screen = document.createElement('section');
          screen.id = 'raidLobbyScreen';
          screen.className = 'screen raid-shell-screen';
          document.body.appendChild(screen);
        }
        document.querySelectorAll('.screen.active').forEach(node => node.classList.remove('active'));
        screen.classList.add('active');
        const joined = state.players.length;
        const ready = state.players.filter(player => player.ready).length;
        const connected=state.players.filter(player=>player.connected!==false).length,missing=joined-ready;
        screen.innerHTML = `<div class="raid-shell raid-lobby-shell"><header class="raid-lobby-top"><div class="raid-wordmark"><span></span><b>SUMUS RAID</b><small>CLASSROOM MONSTER BATTLE</small></div><div class="raid-lobby-actions"><button type="button" data-raid-lobby="settings">SETTINGS</button>${missing&&joined?'<button type="button" data-raid-lobby="force">FORCE START</button>':''}<button type="button" class="primary" data-raid-lobby="start" ${joined&&ready===joined?'':'disabled'}>START RAID</button></div></header><main><aside class="raid-join-console"><small>CLASSROOM RAID CODE</small><strong>${escapeText(BattleSession.code)}</strong><p>${escapeText(teacherJoinUrl())}</p><div class="raid-lobby-qr"></div><button type="button" data-raid-lobby="copy">COPY STUDENT URL</button><div class="raid-lobby-readiness"><b>${connected}/${joined} CONNECTED</b><span>${ready}/${joined} READY</span>${missing?`<em>${missing} NOT READY · FORCE START AVAILABLE</em>`:'<em>CLASS READY</em>'}</div></aside><section class="raid-assembly"><header><div><small>RAID PARTY · ${escapeText(state.book?.bookName||'')}</small><h1>Heroes assemble.</h1></div><b>${ready} / ${joined} READY</b></header><div class="raid-party-grid">${state.players.map((player,index)=>{const range=[player.rangeFrom,player.rangeTo].filter(Boolean).join(' → ')||(player.units||[]).join(', ');const status=player.connected===false?'RECONNECTING':player.ready?'RAID READY':'NOT READY';return`<article data-ready="${player.ready?'true':'false'}" data-connected="${player.connected===false?'false':'true'}">${playerAsset('idle')}<b>${escapeText(player.name)}</b><span>${status}</span><em>${escapeText(range||'RANGE PENDING')}</em><small>${index+1}</small></article>`}).join('') || '<div class="raid-party-empty">학생이 코드를 입력하면 RAID 파티에 합류합니다.</div>'}</div></section></main></div>`;
        const oldQr = document.querySelector('#lobby .qr');
        const newQr = screen.querySelector('.raid-lobby-qr');
        if (oldQr && newQr) newQr.innerHTML = oldQr.innerHTML;
        screen.querySelector('[data-raid-lobby="settings"]')?.addEventListener('click', () => showScreen('setup'));
        screen.querySelector('[data-raid-lobby="start"]')?.addEventListener('click', () => document.getElementById('startBattle')?.click());
        screen.querySelector('[data-raid-lobby="force"]')?.addEventListener('click', () => document.getElementById('forceStartBattle')?.click());
        screen.querySelector('[data-raid-lobby="copy"]')?.addEventListener('click', async event => {
          try { await navigator.clipboard.writeText(teacherJoinUrl()); event.currentTarget.textContent = 'COPIED'; }
          catch (error) { toast('학생 URL을 복사하지 못했습니다.','warn'); }
        });
        RaidAssetDirector?.mountAll(screen);
      };
      const installModeSelector = () => {
        const setup = document.querySelector('#setup .setup-grid');
        if (!setup || setup.querySelector('.raid-mode-selector')) return;
        const block = document.createElement('article');
        block.className = 'panel setup-panel wide raid-mode-selector';
        block.innerHTML = '<div class="panel-head"><div><h3>GAME MODE</h3><small>같은 수업 서버에서 서로 다른 게임 shell을 선택합니다.</small></div></div><div class="raid-mode-options"><button type="button" data-raid-mode="run"><b>RUN</b><span>기존 WORD RACE</span></button><button type="button" data-raid-mode="raid"><b>RAID</b><span>MONSTER RPG BATTLE</span></button></div>';
        setup.prepend(block);
        block.addEventListener('click', event => {
          const button = event.target.closest('[data-raid-mode]');
          if (!button) return;
          state.arena = button.dataset.raidMode;
          Storage.save({selectedArena:state.arena});
          renderArena(); updateArenaLabels(); syncModeSelector();
        });
        syncModeSelector();
      };
      const syncModeSelector = () => document.querySelectorAll('[data-raid-mode]').forEach(button => button.classList.toggle('active', button.dataset.raidMode === state.arena));

      const baseStudentRender = StudentApp.render;
      StudentApp.render = function () {
        if (isRaidStudent()) return renderRaidStudentShell(this);
        document.body.classList.remove('raid-mode','raid-shell-active','raidv-ready');
        restoreRunTeacherSurface();
        return baseStudentRender.call(this);
      };
      const baseFeedback = StudentApp.showFeedback;
      StudentApp.showFeedback = function () {
        if (!isRaidStudent()) return baseFeedback.call(this);
        const feedback = StudentSession.feedback;
        if (!feedback) return;
        const raid = feedback.player?.raid || StudentSession.player?.raid || {};
        const node = document.createElement('div');
        node.className = `raid-result-flash ${feedback.result === 'correct' ? 'correct' : feedback.result === 'pass' ? 'pass' : 'wrong'}`;
        node.setAttribute('role','status');
        node.innerHTML = `<b>${raid.cleared ? 'ALL WORDS TAMED' : feedback.result === 'correct' ? 'WORD TAMED' : 'RETRY BATTLE'}</b><span>${feedback.result === 'correct' && feedback.bonus ? `${String(feedback.raidDetail?.grade || 'hit').toUpperCase()} · ${Number(feedback.bonus).toLocaleString('en-US')} DAMAGE` : feedback.reason === 'timeout' ? 'TIMEOUT · HP -10' : feedback.result === 'pass' ? 'PASS · GAUGE +35%' : Number(raid.wrongAttemptsForCurrentQuestion || 0) <= 1 ? 'WARNING · GAUGE +25%' : 'COUNTER · HP -8'}</span>`;
        document.querySelector('.raid-student-shell')?.append(node);
        setTimeout(() => node.remove(), raid.cleared ? 900 : 760);
      };
      installModeSelector();
      return Object.freeze({ isRaidStudent, teacherRoot, hideRunTeacherSurface, restoreRunTeacherSurface, renderRaidStudentShell, renderTeacherLobby, teacherJoinUrl, syncModeSelector });
    })();
    window.SUMUS_RAID_SHELLS = RaidShells;
