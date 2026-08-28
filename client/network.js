    /* One active WebSocket generation, collision recovery, and fixed-origin identity. */
    try {
      const storedClientId = sessionStorage.getItem('sumus.quiz.v091.clientId');
      if (storedClientId) LocalTransport.clientId = storedClientId;
      else sessionStorage.setItem('sumus.quiz.v091.clientId', LocalTransport.clientId);
    } catch (e) {}
    const V091_newBattleIdentity = () => {
      BattleSession.id = `battle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      BattleSession.code = String(Math.floor(10000 + Math.random() * 90000));
      try {
        localStorage.setItem('sumus.quiz.v06.battleId', BattleSession.id);
        localStorage.setItem('sumus.quiz.v06.battleCode', BattleSession.code);
      } catch (e) {}
      const code = document.getElementById('battleCode');
      if (code) code.textContent = BattleSession.code;
      TeacherBridge.updateStudentUrl?.();
    };
    LocalTransport.socketGeneration = 0;
    LocalTransport.connectWebSocket = function () {
      clearTimeout(this.retryTimer);
      this.manualClose = false;
      const generation = ++this.socketGeneration;
      let socket;
      try { socket = new WebSocket(this.wsUrl()); }
      catch (error) { this.scheduleReconnect(); return; }
      this.socket = socket;
      const active = () => this.socket === socket && this.socketGeneration === generation;
      socket.onopen = () => {
        if (!active()) return;
        this.connected = true;
        this.retryCount = 0;
        this.emitLocal('TRANSPORT_STATUS', { status: 'live', mode: 'websocket' });
        if (AppRole === 'teacher') this.announceBattle();
      };
      socket.onmessage = (event) => {
        if (!active()) return;
        try {
          const message = JSON.parse(event.data);
          const payload = message?.payload || {};
          if (message?.type === 'SERVER_HELLO') {
            this.connected = true;
            this.emitLocal('TRANSPORT_STATUS', { status: 'live', mode: 'websocket', serverTime: payload.serverTime });
          }
          if (message?.type === 'SERVER_CODE_CONFLICT' && AppRole === 'teacher') {
            V091_newBattleIdentity();
            toast('배틀 코드 충돌을 감지해 새 코드로 교체했습니다.', 'warn');
            this.reconnect();
            return;
          }
          if (message?.type === 'SERVER_REGISTERED' && AppRole === 'teacher') {
            setTimeout(() => { if (!V091_roomStateReceived) TeacherBridge.publish(); }, 100);
          }
          this.receive(message);
        } catch (error) { console.warn('[SUMUS V0.9.1] malformed server message ignored'); }
      };
      socket.onerror = () => {};
      socket.onclose = () => {
        if (!active()) return;
        this.connected = false;
        this.socket = null;
        if (!this.manualClose) {
          this.emitLocal('TRANSPORT_STATUS', { status: 'reconnecting', mode: 'websocket' });
          this.scheduleReconnect();
        }
      };
    };
    LocalTransport.announceBattle = function () {
      if (AppRole !== 'teacher') return false;
      return this.send('SERVER_REGISTER_BATTLE', {
        battleId: BattleSession.id,
        battleCode: BattleSession.code,
        build: V091.build,
        commit: String(window.SUMUS_COMMIT || '').slice(0, 40)
      });
    };
    LocalTransport.reconnect = function () {
      this.manualClose = false;
      clearTimeout(this.retryTimer);
      const old = this.socket;
      this.socket = null;
      this.connected = false;
      ++this.socketGeneration;
      try { old?.close(); } catch (e) {}
      setTimeout(() => this.connectWebSocket(), 180);
    };
