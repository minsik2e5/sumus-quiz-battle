    /* V0.9.3C.5.1 RAID CONTINUATION: recovery, pause, and result navigation hardening. */
    const RaidC5Continuation = (() => {
      const LEGACY_RECOVERY_GRACE_MS = 1400;
      let latestTeacherInteractionAt = 0;
      let ignoredRecoveryCount = 0;
      let lobbyReturnCount = 0;

      const isRaidRecovery = (saved, currentArena) => saved?.arena === 'raid' || currentArena === 'raid';
      const shouldIgnoreRecovery = (saved, interactionAt, now = Date.now(), currentArena = '') => {
        if (!interactionAt || !isRaidRecovery(saved, currentArena)) return false;
        const savedAt = Number(saved?.savedAt || 0);
        if (savedAt) return savedAt < interactionAt;
        return now - interactionAt <= LEGACY_RECOVERY_GRACE_MS;
      };
      const markTeacherInteraction = (at = Date.now()) => { latestTeacherInteractionAt = Math.max(latestTeacherInteractionAt, Number(at) || 0); };

      const install = () => {
        if (typeof document === 'undefined' || typeof window === 'undefined') return;
        ['pointerdown', 'keydown', 'change'].forEach(type => document.addEventListener(type, event => {
          if (AppRole === 'teacher' && event.isTrusted) markTeacherInteraction();
        }, true));

        const previousTeacherHandle = TeacherBridge.handle;
        TeacherBridge.handle = function(message) {
          if (message?.type === 'SERVER_ROOM_STATE') {
            const saved = message.payload?.state || message.payload?.snapshot;
            if (shouldIgnoreRecovery(saved, latestTeacherInteractionAt, Date.now(), state.arena)) {
              ignoredRecoveryCount += 1;
              return;
            }
          }
          return previousTeacherHandle.call(this, message);
        };

        // Capture delegation survives result-shell rerenders and suppresses the
        // legacy direct binding, guaranteeing one PLAYER_RETURN_LOBBY message.
        document.addEventListener('click', event => {
          const button = event.target?.closest?.('#studentReturnLobby');
          if (!button || AppRole !== 'student' || state.arena !== 'raid') return;
          event.preventDefault();
          event.stopImmediatePropagation();
          lobbyReturnCount += 1;
          LocalTransport.send('PLAYER_RETURN_LOBBY', {
            ...EventPayload.base(StudentSession.playerId),
            reconnectToken: StudentSession.reconnectToken,
            deviceId: DeviceIdentity.id
          });
        }, true);
      };

      const audit = () => Object.freeze({
        build: 'V0.9.3C.5.1',
        latestTeacherInteractionAt,
        ignoredRecoveryCount,
        lobbyReturnCount
      });
      return Object.freeze({ LEGACY_RECOVERY_GRACE_MS, isRaidRecovery, shouldIgnoreRecovery, markTeacherInteraction, install, audit });
    })();
    if (typeof window !== 'undefined') {
      RaidC5Continuation.install();
      window.SUMUS_RAID_C5_CONTINUATION = RaidC5Continuation;
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = RaidC5Continuation;
