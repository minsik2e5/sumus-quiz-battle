    /* Replaceable asset boundary. No external hotlinks; fallbacks are code-native. */
    const AssetRegistry = {
      baseUrl: '/assets/',
      groups: { characters: new Map(), arenas: new Map(), fx: new Map(), ui: new Map(), audio: new Map() },
      register(group, id, descriptor) {
        if (!this.groups[group]) throw new Error(`Unknown asset group: ${group}`);
        this.groups[group].set(id, { id, group, ...descriptor });
      },
      resolve(group, id) { return this.groups[group]?.get(id) || null; },
      fallback(group, id) { return { id, group, kind: 'css-svg-fallback', url: '' }; }
    };
    AssetRegistry.register('characters', 'runner', { kind: 'svg', url: '/assets/characters/runner-fallback.svg' });
    AssetRegistry.register('arenas', 'run', { kind: 'css-canvas', url: '' });
    AssetRegistry.register('fx', 'speed-trail', { kind: 'css', url: '' });
    AssetRegistry.register('ui', 'podium', { kind: 'css', url: '' });
    AssetRegistry.register('audio', 'race', { kind: 'web-audio-fallback', url: '' });
    window.SUMUS_ASSETS = AssetRegistry;
