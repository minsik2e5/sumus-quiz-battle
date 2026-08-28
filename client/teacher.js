    /* Teacher-owned state serialization and refresh recovery. */
    let V091_roomStateReceived = false;
    let V091_restoreApplied = false;
    const V091_serializablePlayer = (player) => {
      const copy = {};
      Object.entries(player || {}).forEach(([key, value]) => {
        if (key === 'el' || key === 'rankEl' || typeof value === 'function') return;
        copy[key] = value;
      });
      return copy;
    };
    const V091_teacherState = () => ({
      schemaVersion: 1,
      battleId: BattleSession.id,
      battleCode: BattleSession.code,
      arena: state.arena,
      bookId: state.book?.bookId || '',
      rangeMode: state.rangeMode,
      selectedUnits: [...(state.selectedUnits || [])],
      rangeOptions: (state.rangeOptions || []).map((row) => ({ ...row, units: [...(row.units || [])] })),
      config: { ...state.config, questionTypes: [...(state.config.questionTypes || [])] },
      screen: state.screen,
      players: state.players.map(V091_serializablePlayer),
      race: {
        running: !!state.race.running,
        paused: !!state.race.paused,
        pauseStartedAt: +state.race.pauseStartedAt || 0,
        finalSprint: !!state.race.finalSprint,
        order: [...(state.race.order || [])],
        cameraX: +state.race.cameraX || 0,
        cameraTarget: +state.race.cameraTarget || 0,
        worldLength: +state.race.worldLength || 260,
        showAllRanks: !!state.race.showAllRanks
      },
      savedAt: Date.now()
    });
    const V091_saveTeacherState = () => LocalTransport.send('SERVER_SAVE_TEACHER_STATE', {
      battleId: BattleSession.id,
      battleCode: BattleSession.code,
      state: V091_teacherState()
    });
    const V091_renderRestoredState = () => {
      updateArenaLabels();
      const pauseButton = $('#pauseRace');
      if (pauseButton) pauseButton.textContent = state.race.paused ? 'RESUME' : 'PAUSE';
      renderDataSummary();
      renderUnits();
      renderRangeRows();
      renderLobby();
      if (state.screen === 'race') {
        showScreen('race');
        RaceEngine.renderArenaScene();
        RaceEngine.renderRunners();
        state.race.stage = $('#raceStage');
        state.race.layers = $$('[data-parallax]');
        RaceEngine.rank();
        RaceEngine.updateHud();
        if (state.race.running) RaceEngine.frame();
      } else if (state.screen === 'results') {
        renderResults();
        showScreen('results');
      } else if (state.screen === 'setup') showScreen('setup');
      else showScreen('lobby');
    };
    const V091_restoreTeacherState = (saved) => {
      if (!saved || saved.battleId !== BattleSession.id || saved.battleCode !== BattleSession.code) return false;
      if (!BUILT_IN_BOOKS.some((book) => book.id === saved.bookId)) return false;
      const savedPlayers = Array.isArray(saved.players) ? saved.players : [];
      const savedRaceActive = !!saved.race?.running || !!saved.race?.paused;
      // An empty setup screen is not a live classroom session. Restoring it on the
      // next visit makes a deliberate new CREATE BATTLE look stuck in yesterday's
      // setup. Keep recovery for real lobby/race sessions, but start clean from an
      // abandoned pre-lobby setup.
      if (saved.screen === 'setup' && savedPlayers.length === 0 && !savedRaceActive) return false;
      setBook(saved.bookId, { notify: false });
      state.arena = saved.arena || state.arena;
      state.rangeMode = saved.rangeMode || 'same';
      state.selectedUnits = (saved.selectedUnits || []).filter((unit) => state.units.includes(unit));
      state.rangeOptions = (saved.rangeOptions || []).map((row) => ({ ...row, units: (row.units || []).filter((unit) => state.units.includes(unit)) }));
      state.rangeOptionBookId = saved.bookId;
      state.config = { ...state.config, ...(saved.config || {}), questionTypes: [...(saved.config?.questionTypes || state.config.questionTypes)] };
      state.players = savedPlayers.map((player) => ({ ...player, questions: (player.questions || []).map((question) => ({ ...question })) }));
      Object.assign(state.race, saved.race || {});
      state.screen = saved.screen || 'lobby';
      try { V083_save(); } catch (e) {}
      V091_renderRestoredState();
      V091_restoreApplied = true;
      toast('교사 화면을 새로고침 전 경기 상태로 복구했습니다.');
      return true;
    };
    const V091_previousSnapshot = battleSnapshot;
    battleSnapshot = function (targetClientId = '') {
      const snapshot = V091_previousSnapshot(targetClientId);
      const payload = snapshot?.payload || snapshot;
      if (payload) { payload.build = V091.build; payload.commit = String(window.SUMUS_COMMIT || '').slice(0, 7); }
      return snapshot;
    };
    const V091_previousTeacherHandle = TeacherBridge.handle;
    TeacherBridge.handle = function (message) {
      if (message?.type === 'SERVER_ROOM_STATE') {
        V091_roomStateReceived = true;
        V091_restoreTeacherState(message.payload?.state || message.payload?.snapshot);
        return;
      }
      return V091_previousTeacherHandle.call(this, message);
    };
    const V091_previousPublish = TeacherBridge.publish.bind(TeacherBridge);
    TeacherBridge.publish = function (targetClientId = '') {
      try { LocalTransport.ensureBattleRegistration?.(); } catch (e) {}
      const result = V091_previousPublish(targetClientId);
      if (!targetClientId) V091_saveTeacherState();
      return result;
    };
    const V091_previousAnswer = TeacherBridge.answer.bind(TeacherBridge);
    TeacherBridge.answer = function (payload) {
      const result = V091_previousAnswer(payload);
      setTimeout(V091_saveTeacherState, 0);
      return result;
    };
    ['GAME_PAUSE', 'GAME_RESUME', 'GAME_FINISH'].forEach((type) => Events.on(type, () => setTimeout(V091_saveTeacherState, 0)));
    window.SUMUS_TEACHER_AUDIT = { snapshot: V091_teacherState, restoreApplied: () => V091_restoreApplied };
