    /* Range invariants shared by UI and tests. */
    const V091_rangeUnits = (from, to) => {
      const start = state.units.indexOf(from);
      const end = state.units.indexOf(to);
      if (start < 0 || end < start) return [];
      return state.units.slice(start, end + 1);
    };
    const V091_assertRangeOptions = () => {
      if (state.rangeMode !== 'individual') return true;
      return (state.rangeOptions || []).every((row) => {
        const expected = V091_rangeUnits(row.from, row.to);
        return expected.length && expected.join('\0') === (row.units || []).join('\0');
      });
    };
    window.SUMUS_RANGE_AUDIT = {
      check: V091_assertRangeOptions,
      players: () => state.players.map((player) => ({ id: player.id, name: player.name, units: [...(player.units || [])], rangeFrom: player.rangeFrom, rangeTo: player.rangeTo })),
      poolForPlayer: (id) => {
        const player = state.players.find((candidate) => candidate.id === id);
        return player ? QuizEngine.buildPool(player, { shufflePool: false }).map((word) => ({ word: word.word, unit: word.unit })) : [];
      }
    };
