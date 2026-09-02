    /* Student cold-start UX and attempt-safe question transitions. */
    StudentApp.lookup = function (code) {
      code = String(code || '').trim();
      if (!/^\d{5}$/.test(code)) {
        StudentSession.screen = 'enter';
        StudentSession.error = '5자리 배틀 코드를 입력해 주세요.';
        this.render();
        return;
      }
      StudentSession.battleCode = code;
      StudentSession.screen = 'connecting';
      StudentSession.error = '배틀 서버와 연결하는 중입니다…';
      this.lookupNotFoundCount = 0;
      this.render();
      clearTimeout(this.lookupTimer);
      const startedAt = Date.now();
      let attempt = 0;
      const probe = () => {
        if (StudentSession.screen !== 'connecting') return;
        attempt += 1;
        if (!LocalTransport.connected) LocalTransport.connect();
        LocalTransport.send('BATTLE_LOOKUP', { ...EventPayload.base(), code });
        const elapsed = Date.now() - startedAt;
        if (elapsed >= V091.coldStartWindowMs) {
          StudentSession.screen = 'enter';
          StudentSession.error = '배틀을 찾지 못했습니다. 코드와 교사 연결 상태를 확인해 주세요.';
          this.render();
          return;
        }
        StudentSession.error = elapsed > 9000 && !LocalTransport.connected ? '무료 서버를 깨우는 중입니다… 잠시 기다려 주세요.' : 'Battle Code를 확인하고 있습니다.';
        this.render();
        this.lookupTimer = setTimeout(probe, Math.min(5000, 900 + attempt * 550));
      };
      probe();
    };
    const V091_studentHandle = StudentApp.handle;
    StudentApp.handle = function (message) {
      if (message?.type === 'BATTLE_NOT_FOUND' && StudentSession.screen === 'connecting') {
        this.lookupNotFoundCount = (this.lookupNotFoundCount || 0) + 1;
        if (!LocalTransport.connected || this.lookupNotFoundCount < 3) return;
        clearTimeout(this.lookupTimer);
        StudentSession.screen = 'enter';
        StudentSession.error = '배틀을 찾지 못했습니다. Battle Code를 다시 확인해 주세요.';
        this.render();
        return;
      }
      return V091_studentHandle.call(this, message);
    };
    const V091_acceptSnapshot = StudentApp.acceptSnapshot;
    StudentApp.acceptSnapshot = function (snapshot) {
      this.lookupNotFoundCount = 0;
      StudentSession.error = '';
      return V091_acceptSnapshot.call(this, snapshot);
    };
    StudentApp.resolve = function (payload) {
      if (payload.attemptId !== StudentSession.attemptId || StudentSession.submissionState === 'resolved') return;
      clearTimeout(StudentSession.pendingTimer);
      StudentSession.pendingSubmission = null;
      StudentSession.pendingRetries = 0;
      StudentSession.submissionState = 'resolved';
      StudentSession.player = payload.player;
      StudentSession.rank = payload.rank;
      StudentSession.feedback = payload;
      this.persistSession?.();
      this.showFeedback();
      const resolvedAttemptId = payload.attemptId;
      setTimeout(() => {
        if (StudentSession.attemptId !== resolvedAttemptId) return;
        StudentSession.feedback = null;
        if (!payload.player.finished) { StudentSession.screen = 'waiting'; this.render(); }
      }, 560);
    };
