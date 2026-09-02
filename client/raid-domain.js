    /* V0.9.3 RAID domain: deterministic, serializable, and independent of RaceEngine. */
    const RaidFoundation = (() => {
      const CONFIG = Object.freeze({
        maxHp: 100,
        totalHpPerQuestion: 85,
        timing: Object.freeze({
          'choice-en-ko': 6000, 'choice-ko-en': 6000,
          'write-ko': 9000, 'write-en': 12000, spell: 12000,
          scramble: 10000, listen: 8000
        }),
        timingRatio: Object.freeze({ critical: .35, normal: .70 }),
        baseDamage: Object.freeze({ critical: 150, normal: 100, weak: 70 }),
        typeMultiplier: Object.freeze({
          'choice-en-ko': .90, 'choice-ko-en': .90, 'write-ko': 1,
          scramble: 1.05, listen: 1.05, 'write-en': 1.15, spell: 1.15
        }),
        wrongGauge: .25, passGauge: .35, counterDamage: 8, timeoutDamage: 10,
        heavyFailDamage: 18, mercyEnabled: true, mercyTimingBonus: .20
      });

      const STAGE_WEIGHTS = Object.freeze({
        2: [.35, .65], 3: [.20, .25, .55], 4: [.16, .20, .25, .39],
        5: [.12, .16, .18, .22, .32], 6: [.10, .13, .15, .17, .20, .25]
      });
      const LABELS = Object.freeze({
        2: ['COMMON', 'BOSS'], 3: ['COMMON', 'ELITE', 'BOSS'],
        4: ['COMMON', 'ELITE', 'ENHANCED', 'BOSS'],
        5: ['COMMON', 'ELITE', 'ENHANCED', 'ELITE+', 'BOSS'],
        6: ['COMMON', 'ELITE', 'ENHANCED', 'ELITE+', 'MID BOSS', 'FINAL BOSS']
      });
      const deepCopy = value => JSON.parse(JSON.stringify(value));
      const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
      const waveCount = count => count <= 12 ? 2 : count <= 24 ? 3 : count <= 40 ? 4 : count <= 60 ? 5 : 6;
      function planStages(questionCount) {
        const count = Math.max(1, Number(questionCount) || 1), totalWaves = waveCount(count);
        const weights = STAGE_WEIGHTS[totalWaves], labels = LABELS[totalWaves];
        const totalMonsterHp = Math.max(1, Math.round(count * CONFIG.totalHpPerQuestion));
        let assigned = 0;
        const waves = weights.map((weight, index) => {
          const hp = index === weights.length - 1 ? totalMonsterHp - assigned : Math.round(totalMonsterHp * weight);
          assigned += hp;
          return { index, number: index + 1, type: labels[index], hp, maxHp: hp, weight };
        });
        return { questionCount: count, totalWaves, totalMonsterHp, waves };
      }
      function create(questionCount, now = Date.now()) {
        const plan = planStages(questionCount), first = plan.waves[0];
        return {
          schemaVersion: 1, hp: CONFIG.maxHp, maxHp: CONFIG.maxHp,
          enemyType: first.type, enemyHp: first.hp, enemyMaxHp: first.maxHp,
          waveIndex: 0, totalWaves: plan.totalWaves, wavePlan: plan.waves,
          combo: 0, maxCombo: 0, shield: 0, attackStartAt: 0, attackDeadline: 0,
          attackDurationMs: 0, timeoutHitApplied: false, currentQuestionId: '',
          wrongAttemptsForCurrentQuestion: 0, battleState: 'ACTIVE', guardState: null,
          heavyAttackState: null, reviveCount: 0, reviveStreak: 0, reviveQueue: [],
          criticalCount: 0, normalCount: 0, weakCount: 0, totalDamage: 0,
          cleared: false, clearAt: 0, earlyClear: false, consecutiveHitsTaken: 0,
          supportNext: false, stunBonus: false, specialCount: 0, superCriticalCount: 0,
          legendCount: 0, retryQuestionIds: [], lastEvent: 'RAID READY', updatedAt: now
        };
      }
      function durationFor(type, state) {
        const base = CONFIG.timing[type] || 10000;
        return Math.round(base * (state?.supportNext ? 1 + CONFIG.mercyTimingBonus : 1));
      }
      function beginQuestion(state, question, now = Date.now(), options = {}) {
        if (!state || state.cleared) return state;
        const duration = durationFor(question?.type, state);
        state.currentQuestionId = question?.id || '';
        state.wrongAttemptsForCurrentQuestion = 0;
        state.timeoutHitApplied = false;
        state.attackDurationMs = duration;
        state.attackStartAt = options.waitForAudio ? 0 : now;
        state.attackDeadline = options.waitForAudio ? 0 : now + duration;
        state.supportNext = false;
        state.updatedAt = now;
        return state;
      }
      function startListenTimer(state, now = Date.now()) {
        if (!state || state.attackStartAt) return state;
        state.attackDurationMs = durationFor('listen', state);
        state.attackStartAt = now;
        state.attackDeadline = now + state.attackDurationMs;
        state.updatedAt = now;
        return state;
      }
      function takeHit(state, damage, event, now = Date.now()) {
        if (state.shield > 0) {
          state.shield -= 1; state.lastEvent = 'SHIELD BLOCK'; state.consecutiveHitsTaken = 0;
          return { blocked: true, damage: 0 };
        }
        state.hp = Math.max(0, state.hp - damage);
        state.consecutiveHitsTaken += 1;
        if (CONFIG.mercyEnabled && state.consecutiveHitsTaken >= 2) {
          state.supportNext = true; state.consecutiveHitsTaken = 0;
        }
        state.lastEvent = event;
        if (state.hp <= 0) { state.battleState = 'DOWN'; state.reviveStreak = 0; state.lastEvent = 'DOWN'; }
        state.updatedAt = now;
        return { blocked: false, damage };
      }
      function applyTimeout(state, now = Date.now()) {
        if (!state || state.timeoutHitApplied || state.cleared || state.battleState === 'DOWN') return { applied: false };
        state.timeoutHitApplied = true;
        const hit = takeHit(state, CONFIG.timeoutDamage, 'BOSS ATTACK', now);
        state.combo = 0;
        return { applied: true, ...hit };
      }
      function timingGrade(state, now) {
        if (!state.attackStartAt || !state.attackDurationMs) return 'weak';
        const ratio = clamp((now - state.attackStartAt) / state.attackDurationMs, 0, 1);
        return ratio <= CONFIG.timingRatio.critical ? 'critical' : ratio <= CONFIG.timingRatio.normal ? 'normal' : 'weak';
      }
      function advanceWave(state, now) {
        while (state.enemyHp <= 0 && state.waveIndex < state.totalWaves - 1) {
          state.waveIndex += 1;
          const wave = state.wavePlan[state.waveIndex];
          state.enemyType = wave.type; state.enemyHp = wave.hp; state.enemyMaxHp = wave.maxHp;
          state.guardState = state.waveIndex === state.totalWaves - 1 ? { active: true } : null;
          state.lastEvent = `WAVE ${state.waveIndex + 1}`;
        }
        if (state.enemyHp <= 0 && state.waveIndex === state.totalWaves - 1) {
          state.enemyHp = 0; state.cleared = true; state.battleState = 'CLEAR'; state.clearAt = now; state.lastEvent = 'BOSS CLEAR';
        }
      }
      function applyComboRewards(state) {
        const events = [];
        if (state.combo === 5) { state.shield += 1; events.push('SHIELD'); }
        if (state.combo === 10) { state.specialCount += 1; events.push('SPECIAL ATTACK'); }
        if (state.combo === 15) { state.superCriticalCount += 1; events.push('SUPER CRITICAL'); }
        if (state.combo === 20) { state.legendCount += 1; events.push('LEGEND COMBO'); }
        return events;
      }
      function correct(state, type, now = Date.now()) {
        const grade = timingGrade(state, now);
        state[`${grade}Count`] += 1; state.combo += 1; state.maxCombo = Math.max(state.maxCombo, state.combo);
        state.consecutiveHitsTaken = 0;
        const comboEvents = applyComboRewards(state);
        if (state.battleState === 'REVIVE' || state.battleState === 'DOWN') {
          state.battleState = 'REVIVE'; state.reviveStreak += 1; state.lastEvent = `REVIVE ${state.reviveStreak}/2`;
          if (state.reviveStreak >= 2) {
            state.reviveCount += 1; state.hp = state.reviveCount === 1 ? 40 : state.reviveCount === 2 ? 30 : 20;
            state.battleState = 'ACTIVE'; state.reviveStreak = 0; state.lastEvent = 'REVIVE';
          }
          return { grade, damage: 0, comboEvents, revived: state.battleState === 'ACTIVE' };
        }
        if (state.heavyAttackState?.active) {
          state.heavyAttackState.progress += 1;
          if (state.heavyAttackState.progress >= 2) {
            state.heavyAttackState = { active: false, progress: 2, cancelled: true };
            state.stunBonus = true; state.lastEvent = 'HEAVY ATTACK CANCEL';
          } else state.lastEvent = 'HEAVY ATTACK 1/2';
        }
        if (state.guardState?.active) {
          state.guardState = { active: false, perfect: grade === 'critical' };
          if (grade === 'critical') state.stunBonus = true;
          state.lastEvent = grade === 'critical' ? 'PERFECT BREAK' : 'GUARD BREAK';
          return { grade, damage: 0, guardBreak: true, comboEvents };
        }
        let damage = Math.round(CONFIG.baseDamage[grade] * (CONFIG.typeMultiplier[type] || 1));
        if (state.combo >= 3) damage = Math.round(damage * 1.10);
        if (state.combo === 10) damage += 200;
        if (state.combo === 15) damage += 125;
        if (state.combo === 20) damage += 200;
        if (state.stunBonus) { damage = Math.round(damage * 1.20); state.stunBonus = false; }
        state.enemyHp -= damage; state.totalDamage += damage; state.lastEvent = grade.toUpperCase();
        advanceWave(state, now);
        return { grade, damage, comboEvents, cleared: state.cleared };
      }
      function wrong(state, questionId, now = Date.now()) {
        state.combo = 0; state.wrongAttemptsForCurrentQuestion += 1;
        if (!state.retryQuestionIds.includes(questionId)) state.retryQuestionIds.push(questionId);
        if (state.heavyAttackState?.active) {
          state.heavyAttackState = { active: false, progress: state.heavyAttackState.progress, failed: true };
          const hit = takeHit(state, CONFIG.heavyFailDamage, 'HEAVY ATTACK HIT', now);
          return { advance: true, heavyFailed: true, ...hit };
        }
        if (state.wrongAttemptsForCurrentQuestion === 1) {
          const shift = Math.round(state.attackDurationMs * CONFIG.wrongGauge);
          state.attackDeadline = Math.max(now, state.attackDeadline - shift); state.lastEvent = 'GAUGE +25%';
          return { advance: false, gaugeAdded: .25 };
        }
        return { advance: true, counter: true, ...takeHit(state, CONFIG.counterDamage, 'COUNTER ATTACK', now) };
      }
      function pass(state, questionId, now = Date.now()) {
        state.combo = 0;
        if (!state.retryQuestionIds.includes(questionId)) state.retryQuestionIds.push(questionId);
        const shift = Math.round(state.attackDurationMs * CONFIG.passGauge);
        state.attackDeadline = Math.max(now, state.attackDeadline - shift); state.lastEvent = 'PASS · GAUGE +35%';
        return { advance: true, gaugeAdded: .35 };
      }
      function activateGuard(state) { state.guardState = { active: true }; state.lastEvent = 'GUARD'; return state; }
      function activateHeavy(state) { state.heavyAttackState = { active: true, progress: 0 }; state.lastEvent = 'HEAVY ATTACK 0/2'; return state; }
      function snapshot(state) { return deepCopy(state); }
      function restore(saved) { return saved ? deepCopy(saved) : null; }
      return { CONFIG, planStages, create, beginQuestion, startListenTimer, applyTimeout, timingGrade, correct, wrong, pass, activateGuard, activateHeavy, snapshot, restore };
    })();
    if (typeof module !== 'undefined' && module.exports) module.exports = RaidFoundation;
