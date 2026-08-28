    /* V0.9.1 authoritative data boundary. Raw source objects are never mutated. */
    const V091 = Object.freeze({
      build: 'V0.9.1',
      version: '0.9.1-release-candidate',
      publicOrigin: 'https://sumus-quiz-battle-public-v083.onrender.com',
      coldStartWindowMs: 45000
    });
    const V091_BOOK_POLICY = Object.freeze({
      'common-english2-ybm-park-2022': { forceSection: 'READING' },
      'common-english2-ybm-kim-2022': { forceSection: 'READING' },
      'incheon-g1-sep-2025-selected': { preserveSection: true }
    });
    const V091_cloneBook = (sourceBook) => {
      const policy = V091_BOOK_POLICY[sourceBook.id] || { preserveSection: true };
      return {
        ...sourceBook,
        words: sourceBook.words.map((sourceWord) => ({
          ...sourceWord,
          section: policy.forceSection || sourceWord.section
        }))
      };
    };
    V090_AUTHORITATIVE_BOOKS.forEach((sourceBook) => {
      const exact = V091_cloneBook(sourceBook);
      const index = BUILT_IN_BOOKS.findIndex((book) => book.id === exact.id);
      if (index >= 0) BUILT_IN_BOOKS.splice(index, 1, exact);
      else BUILT_IN_BOOKS.push(exact);
    });
    try {
      window.SUMUS_BUILD = { build: V091.build, version: V091.version, commit: String(window.SUMUS_COMMIT || 'dev').slice(0, 7) };
      document.title = 'SUMUS QUIZ BATTLE V0.9.1 RELEASE CANDIDATE';
    } catch (e) {}
