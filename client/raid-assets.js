    /* V0.9.3B.1 canonical RAID asset drop. WebP -> PNG -> original SVG/CSS fallback. */
    const RaidAssetDirector = (() => {
      if (!AssetRegistry.groups.monsters) AssetRegistry.groups.monsters = new Map();
      const rows = [];
      const add = (group, id, folder, label) => {
        const base = `/assets/raid/${folder}/${id}`;
        const descriptor = { group, id, label, sources: [`${base}.webp`, `${base}.png`] };
        rows.push(descriptor);
        AssetRegistry.register(group, id, { kind: 'canonical-image', url: descriptor.sources[0], sources: descriptor.sources, label, fallback: 'svg-css' });
      };
      ['idle','attack','critical','hit','shield','down','revive','special'].forEach(state => add('characters', `raid-player-main-${state}`, 'player', `RAID player ${state}`));
      ['idle','attack','hit','clear'].forEach(state => add('monsters', `raid-common-${state}`, 'common', `COMMON ${state}`));
      ['idle','attack','hit','guard','clear'].forEach(state => add('monsters', `raid-elite-${state}`, 'elite', `ELITE ${state}`));
      ['idle','attack','hit','guard','heavy-charge','clear'].forEach(state => add('monsters', `raid-boss-${state}`, 'boss', `BOSS ${state}`));
      ['hit-normal','hit-weak','hit-critical','shield','guard','guard-break','perfect-break','player-hit','heavy-hit','heavy-charge','heavy-cancel'].forEach(state => add('fx', `raid-fx-${state}`, 'fx', `RAID FX ${state}`));

      const legacyAliases = [
        'raid-player-default','raid-common-spirit','raid-elite-guardian','raid-boss-forgotten-queen',
        'raid-arena-common','raid-arena-elite','raid-arena-boss','raid-fx-hit','raid-fx-critical',
        'raid-fx-guard-break','raid-fx-heavy','raid-fx-revive','raid-fx-clear','raid-ui-broadcast'
      ];
      const descriptor = id => rows.find(row => row.id === id) || null;
      const fallback = id => {
        if (id.startsWith('raid-player-')) return `<svg viewBox="0 0 180 190" aria-hidden="true"><path d="M49 171c4-36 18-58 41-58s38 22 42 58" fill="#24517c" stroke="#91d8ed" stroke-width="4"/><circle cx="90" cy="75" r="38" fill="#efbb8e"/><path d="M50 71c2-39 21-57 42-57 23 0 37 18 42 54-17-10-28-26-33-38-7 17-24 32-51 41Z" fill="#182943"/><path d="M51 61c9-34 28-51 51-49 18 2 31 15 36 37-13-8-25-12-38-12-17 0-33 8-49 24Z" fill="#55c9d7"/><circle cx="77" cy="77" r="4"/><circle cx="104" cy="77" r="4"/><path d="M78 94c8 6 18 6 26 0" fill="none" stroke="#9b4e56" stroke-width="4" stroke-linecap="round"/></svg>`;
        if (id.startsWith('raid-common-')) return `<svg viewBox="0 0 180 180" aria-hidden="true"><path d="M39 102c0-43 19-69 51-69s52 27 52 69c0 35-23 57-52 57s-51-22-51-57Z" fill="#55d7c9" stroke="#d7fff3" stroke-width="5"/><circle cx="72" cy="91" r="7"/><circle cx="108" cy="91" r="7"/><path d="M74 116c10 8 22 8 32 0" fill="none" stroke="#194259" stroke-width="5"/></svg>`;
        if (id.startsWith('raid-elite-')) return `<svg viewBox="0 0 190 190" aria-hidden="true"><path d="M52 165V78c0-34 18-56 43-56s44 22 44 56v87Z" fill="#6f63a7" stroke="#edf4ff" stroke-width="5"/><path d="M67 76h56v27H67Z" fill="#202a50"/><circle cx="80" cy="89" r="4" fill="#70edff"/><circle cx="110" cy="89" r="4" fill="#70edff"/></svg>`;
        if (id.startsWith('raid-boss-')) return `<svg viewBox="0 0 210 210" aria-hidden="true"><path d="M49 187c4-65 21-101 56-101s53 36 57 101Z" fill="#71358c" stroke="#ffbff2" stroke-width="5"/><circle cx="105" cy="72" r="43" fill="#e8a8c3"/><path d="M60 66c3-42 21-61 47-61 25 0 42 18 47 57-14-14-27-24-39-29-10 18-28 29-55 33Z" fill="#462269"/></svg>`;
        return `<span class="raidv-css-fallback" aria-hidden="true"></span>`;
      };
      const markup = (id, className = '') => {
        const item = descriptor(id), sources = item?.sources || [];
        return `<span class="raidv-asset ${className}" data-raid-asset="${id}"><img class="raidv-asset-img" src="${sources[0] || ''}" data-raid-sources="${sources.join('|')}" alt="" draggable="false"><span class="raidv-asset-fallback">${fallback(id)}</span></span>`;
      };
      const mountAll = root => {
        (root || document).querySelectorAll('.raidv-asset:not([data-raid-bound])').forEach(slot => {
          slot.dataset.raidBound = '1';
          const img = slot.querySelector('.raidv-asset-img'); if (!img) return;
          const sources = String(img.dataset.raidSources || '').split('|').filter(Boolean); let index = Math.max(0, sources.indexOf(img.getAttribute('src')));
          const loaded = () => { slot.classList.add('is-loaded'); slot.classList.remove('is-fallback'); };
          const failed = () => { index += 1; if (sources[index]) img.src = sources[index]; else slot.classList.add('is-fallback'); };
          img.addEventListener('load', loaded); img.addEventListener('error', failed);
          if (img.complete) (img.naturalWidth ? loaded : failed)();
        });
      };
      const preloadCache = new Map();
      const preload = ids => [...new Set(ids)].map(id => {
        const item = descriptor(id); if (!item) return Promise.resolve(false);
        if (preloadCache.has(id)) return preloadCache.get(id);
        const task = new Promise(resolve => {
          const img = new Image(); let index = 0;
          img.onload = () => resolve(true);
          img.onerror = () => { index += 1; if (item.sources[index]) img.src = item.sources[index]; else resolve(false); };
          img.src = item.sources[index];
        });
        preloadCache.set(id, task); return task;
      });
      const playerId = visual => {
        const event = String(visual?.lastEvent || '').toUpperCase(), preview = String(visual?.preview || '');
        if (preview === 'player-special' || preview === 'special' || event.includes('SPECIAL') || event.includes('LEGEND')) return 'raid-player-main-special';
        if (preview === 'down' || visual?.primaryState === 'down') return 'raid-player-main-down';
        if (preview === 'revive' || visual?.primaryState === 'revive') return 'raid-player-main-revive';
        if (preview === 'shield' || visual?.primaryState === 'shield') return 'raid-player-main-shield';
        if (['common','elite','boss','elite-guard','boss-guard','boss-heavy','guard','heavy'].includes(preview)) return 'raid-player-main-idle';
        if (preview === 'player-hit' || event.includes('COUNTER') || event.includes('BOSS ATTACK')) return 'raid-player-main-hit';
        if (preview.includes('critical') || event.includes('CRITICAL')) return 'raid-player-main-critical';
        if (preview.includes('attack') || ['NORMAL','WEAK'].includes(event)) return 'raid-player-main-attack';
        return 'raid-player-main-idle';
      };
      const enemyId = visual => {
        const tier = visual?.tier || 'common', preview = String(visual?.preview || ''), event = String(visual?.lastEvent || '').toUpperCase();
        if (visual?.cleared || preview.endsWith('clear')) return `raid-${tier}-clear`;
        if (tier === 'boss' && (visual?.heavy || preview.includes('heavy'))) return 'raid-boss-heavy-charge';
        if (visual?.guard || preview.includes('guard')) return tier === 'common' ? 'raid-common-idle' : `raid-${tier}-guard`;
        if (preview.includes('hit') || ['NORMAL','WEAK'].includes(event) || event.includes('CRITICAL')) return `raid-${tier}-hit`;
        if (preview.includes('attack') || event.includes('COUNTER') || event.includes('BOSS ATTACK')) return `raid-${tier}-attack`;
        return `raid-${tier}-idle`;
      };
      const fxId = (kind, label = '') => {
        const text = String(label).toUpperCase();
        if (kind === 'critical') return 'raid-fx-hit-critical'; if (kind === 'normal') return 'raid-fx-hit-normal'; if (kind === 'weak') return 'raid-fx-hit-weak';
        if (kind === 'shield') return 'raid-fx-shield'; if (kind === 'player-hit') return 'raid-fx-player-hit';
        if (kind === 'guard') return text.includes('PERFECT') ? 'raid-fx-perfect-break' : text.includes('BREAK') ? 'raid-fx-guard-break' : 'raid-fx-guard';
        if (kind === 'heavy') return text.includes('CANCEL') ? 'raid-fx-heavy-cancel' : text.includes('CHARGE') ? 'raid-fx-heavy-charge' : 'raid-fx-heavy-hit';
        return null;
      };
      const preloadFor = visual => preload([
        'raid-player-main-idle','raid-player-main-attack','raid-player-main-hit',playerId(visual),enemyId(visual),
        `raid-${visual?.tier || 'common'}-idle`,`raid-${visual?.tier || 'common'}-attack`,`raid-${visual?.tier || 'common'}-hit`,
        'raid-fx-hit-normal','raid-fx-hit-critical'
      ]);
      preload(['raid-player-main-idle','raid-player-main-attack','raid-player-main-hit','raid-common-idle','raid-elite-idle','raid-boss-idle','raid-fx-hit-normal','raid-fx-hit-critical']);
      return Object.freeze({ assets: rows, legacyAliases, markup, mountAll, fallback, preload, preloadFor, playerId, enemyId, fxId });
    })();
    window.SUMUS_RAID_ASSETS = RaidAssetDirector;
