    /* V0.9.3B.1 RAID visual model. Pure projection: never mutates gameplay state. */
    const RaidVisualModel = (() => {
      const MAX_EFFECT_NODES = 6;
      const tier = enemyType => {
        const value = String(enemyType || 'COMMON').toUpperCase();
        if (value.includes('BOSS')) return 'boss';
        if (value.includes('ELITE') || value.includes('ENHANCED') || value.includes('GUARD')) return 'elite';
        return 'common';
      };
      const monster = enemyType => ({
        common: { id: 'raid-common-spirit', name: 'MINTLING WORD SPIRIT', label: '꼬마 단어정령' },
        elite: { id: 'raid-elite-guardian', name: 'MEMORY GUARDIAN', label: '기억의 수호자' },
        boss: { id: 'raid-boss-forgotten-queen', name: 'VOID CRIMSON DRAGON', label: '망각의 마룡' }
      }[tier(enemyType)]);
      const arena = enemyType => `raid-arena-${tier(enemyType)}`;
      const timerPhase = ratio => ratio >= .9 ? 'danger' : ratio >= .7 ? 'charge' : ratio >= .35 ? 'alert' : 'safe';
      const primaryState = raid => {
        if (raid?.cleared) return 'clear';
        if (raid?.battleState === 'DOWN') return 'down';
        if (raid?.battleState === 'REVIVE') return 'revive';
        if (raid?.heavyAttackState?.active) return 'heavy';
        if (raid?.guardState?.active) return 'guard';
        if (raid?.shield > 0) return 'shield';
        return 'idle';
      };
      const project = (raid, preview = '') => {
        const source = raid || {};
        const projected = {
          hp: Number(source.hp || 0), maxHp: Number(source.maxHp || 100),
          enemyHp: Number(source.enemyHp || 0), enemyMaxHp: Number(source.enemyMaxHp || 1),
          combo: Number(source.combo || 0), maxCombo: Number(source.maxCombo || 0), shield: Number(source.shield || 0),
          waveIndex: Number(source.waveIndex || 0), totalWaves: Number(source.totalWaves || 1),
          enemyType: String(source.enemyType || 'COMMON'), lastEvent: String(source.lastEvent || 'RAID READY'),
          battleState: String(source.battleState || 'ACTIVE'), cleared: !!source.cleared,
          guard: !!source.guardState?.active, heavy: !!source.heavyAttackState?.active,
          heavyProgress: Number(source.heavyAttackState?.progress || 0),
          heavyFailed: !!source.heavyAttackState?.failed, heavyCancelled: !!source.heavyAttackState?.cancelled,
          wrongAttempts: Number(source.wrongAttemptsForCurrentQuestion || 0),
          timeoutHitApplied: !!source.timeoutHitApplied,
          reviveStreak: Number(source.reviveStreak || 0), reviveCount: Number(source.reviveCount || 0),
          specialCount: Number(source.specialCount || 0), preview: String(preview || '')
        };
        if (preview === 'critical') projected.lastEvent = 'CRITICAL';
        if (preview === 'normal') projected.lastEvent = 'NORMAL';
        if (preview === 'weak') projected.lastEvent = 'WEAK';
        if (preview === 'wrong') projected.lastEvent = 'GAUGE +25%';
        if (preview === 'pass') projected.lastEvent = 'PASS · RETRY';
        if (preview === 'player-hit') projected.lastEvent = 'COUNTER ATTACK';
        if (preview === 'shield') { projected.shield = Math.max(1, projected.shield); projected.lastEvent = 'SHIELD'; }
        if (preview === 'guard') { projected.guard = true; projected.lastEvent = 'GUARD'; }
        if (preview === 'heavy') { projected.heavy = true; projected.heavyProgress = Math.min(1, projected.heavyProgress); projected.lastEvent = 'HEAVY CHARGE'; }
        if (preview === 'down') { projected.hp = 0; projected.battleState = 'DOWN'; projected.lastEvent = 'DOWN'; }
        if (preview === 'revive') { projected.hp = Math.max(20, projected.hp); projected.battleState = 'REVIVE'; projected.lastEvent = 'REVIVE'; }
        if (preview === 'boss' || preview === 'boss-clear') {
          projected.enemyType = 'FINAL BOSS'; projected.waveIndex = Math.max(projected.waveIndex, projected.totalWaves - 1);
        }
        if (preview === 'boss-clear') { projected.cleared = true; projected.enemyHp = 0; projected.lastEvent = 'BOSS CLEAR · WORD TAMED'; }
        if (preview === 'common' || preview === 'common-hit') projected.enemyType = 'COMMON';
        if (preview === 'common') projected.lastEvent = 'RAID READY';
        if (preview === 'common-hit') projected.lastEvent = 'NORMAL';
        if (preview === 'elite' || preview === 'elite-guard') projected.enemyType = 'ELITE';
        if (preview === 'elite') projected.lastEvent = 'RAID READY';
        if (preview === 'elite-guard') { projected.guard = true; projected.lastEvent = 'GUARD'; }
        if (['boss-attack','boss-hit','boss-guard','boss-heavy'].includes(preview)) projected.enemyType = 'FINAL BOSS';
        if (preview === 'boss') projected.lastEvent = 'RAID READY';
        if (preview === 'boss-attack') projected.lastEvent = 'BOSS ATTACK';
        if (preview === 'boss-hit') projected.lastEvent = 'NORMAL';
        if (preview === 'boss-guard') { projected.guard = true; projected.lastEvent = 'GUARD'; }
        if (preview === 'boss-heavy') { projected.heavy = true; projected.heavyProgress = 1; projected.lastEvent = 'HEAVY CHARGE'; }
        if (preview === 'player-attack') projected.lastEvent = 'NORMAL';
        if (preview === 'player-critical') projected.lastEvent = 'CRITICAL';
        if (preview === 'player-special') projected.lastEvent = 'SPECIAL ATTACK';
        projected.tier = tier(projected.enemyType);
        projected.monster = monster(projected.enemyType);
        projected.arena = arena(projected.enemyType);
        projected.primaryState = primaryState({
          ...projected,
          guardState: projected.guard ? { active: true } : null,
          heavyAttackState: projected.heavy ? { active: true } : null
        });
        return projected;
      };
      const signature = visual => JSON.stringify([
        visual.hp, visual.enemyHp, visual.combo, visual.maxCombo, visual.shield, visual.waveIndex,
        visual.enemyType, visual.lastEvent, visual.battleState, visual.cleared,
        visual.guard, visual.heavy, visual.heavyProgress, visual.heavyFailed, visual.heavyCancelled,
        visual.wrongAttempts, visual.timeoutHitApplied, visual.reviveStreak, visual.reviveCount,
        visual.specialCount, visual.preview
      ]);
      return Object.freeze({ MAX_EFFECT_NODES, tier, monster, arena, timerPhase, primaryState, project, signature });
    })();
    if (typeof module !== 'undefined' && module.exports) module.exports = RaidVisualModel;
