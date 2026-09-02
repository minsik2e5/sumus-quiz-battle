    /* V0.9.3C.5 RAID learning results — pure, serializable projections. */
    const RaidResultsModel = (() => {
      const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
      const percent = (part, total) => total > 0 ? Math.round(part / total * 100) : 0;
      const rows = player => Object.values(player?.raidLearning?.words || {});
      const outcomeCounts = player => {
        const source = player?.raidLearning?.counts || {};
        const correct = number(source.correct), wrong = number(source.wrong);
        const pass = number(source.pass), timeout = number(source.timeout);
        return { correct, wrong, pass, timeout, total: correct + wrong + pass + timeout };
      };
      const retryRows = player => rows(player)
        .filter(row => number(row.wrong) + number(row.pass) + number(row.timeout) > 0)
        .map(row => ({
          id: String(row.id || ''), word: String(row.word || ''),
          meaning: String(row.meaning || ''), expected: String(row.expected || ''),
          wrong: number(row.wrong), pass: number(row.pass), timeout: number(row.timeout),
          correct: number(row.correct), resolved: number(row.correct) > 0,
          status: number(row.timeout) ? 'TIMEOUT' : number(row.pass) ? 'PASS' : 'WRONG'
        }))
        .sort((a, b) => (b.timeout + b.pass + b.wrong) - (a.timeout + a.pass + a.wrong) || a.word.localeCompare(b.word));
      const student = player => {
        const counts = outcomeCounts(player), raid = player?.raid || {};
        const assigned = number(player?.assignedTotal);
        const progressed = Math.min(assigned, number(player?.questionIndex));
        const finished = !!player?.finished || !!player?.raidSessionEnded;
        const cleared = !!raid.cleared;
        return {
          id: String(player?.id || ''), name: String(player?.name || ''), assigned,
          progressed, ...counts, accuracy: percent(counts.correct, counts.total),
          maxCombo: number(raid.maxCombo ?? player?.maxCombo), reviveCount: number(raid.reviveCount),
          wavesCleared: cleared ? number(raid.totalWaves) : Math.min(number(raid.totalWaves), number(raid.waveIndex)),
          totalWaves: number(raid.totalWaves), cleared, finished,
          incomplete: finished && !cleared, partial: !!player?.raidManualEnd && !cleared,
          retryCount: counts.wrong + counts.pass + counts.timeout,
          retryWords: retryRows(player), connected: player?.connected !== false
        };
      };
      const classroom = players => {
        const list = (players || []).map(student);
        const completed = list.filter(row => row.finished).length;
        const cleared = list.filter(row => row.cleared).length;
        const attempts = list.reduce((sum, row) => sum + row.total, 0);
        const correct = list.reduce((sum, row) => sum + row.correct, 0);
        return {
          students: list.length, completed, cleared, incomplete: list.length - cleared,
          averageAccuracy: percent(correct, attempts),
          averageProgress: list.length ? Math.round(list.reduce((sum, row) => sum + percent(row.progressed, row.assigned), 0) / list.length) : 0,
          maxCombo: list.reduce((max, row) => Math.max(max, row.maxCombo), 0),
          reviveCount: list.reduce((sum, row) => sum + row.reviveCount, 0),
          retryBurden: list.reduce((sum, row) => sum + row.retryCount, 0), attempts, correct
        };
      };
      const publicResult = player => ({ ...student(player), retryWords: retryRows(player) });
      return Object.freeze({ outcomeCounts, retryRows, student, classroom, publicResult });
    })();
    if (typeof window !== 'undefined') window.SUMUS_RAID_RESULTS_MODEL = RaidResultsModel;
    if (typeof module !== 'undefined' && module.exports) module.exports = RaidResultsModel;
