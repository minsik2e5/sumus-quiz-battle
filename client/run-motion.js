    /* V0.9.2B RUN MOTION UPGRADE
       Presentation-only motion director layered after V0.9.2A.
       Reads race state/DOM to stage animation; never mutates scoring, distance,
       rank, question lifecycle, transport, reconnect, or finish rules. */
    const V092B_MOTION = Object.freeze({ build: 'V0.9.2B', reduced: matchMedia('(prefers-reduced-motion: reduce)').matches });
    document.documentElement.dataset.sumusMotion = V092B_MOTION.build;
    document.body.classList.add('v092b-motion');

    const V092B_motionStyle = document.createElement('style');
    V092B_motionStyle.dataset.sumusMotion = V092B_MOTION.build;
    V092B_motionStyle.textContent = `
      :root{--v092b-snap:cubic-bezier(.16,1,.3,1);--v092b-bounce:cubic-bezier(.34,1.56,.64,1)}
      body.v092b-motion #raceStage{scale:1;transition:scale .24s var(--v092b-snap),filter .6s ease,background .6s ease;transform-origin:38% 58%}
      body.v092b-motion #raceStage[data-v092b-countdown="READY"]{scale:.985;filter:saturate(.8) brightness(.7)}
      body.v092b-motion #raceStage[data-v092b-countdown="3"]{scale:.992;filter:saturate(.84) brightness(.76)}
      body.v092b-motion #raceStage[data-v092b-countdown="2"]{scale:.997;filter:saturate(.9) brightness(.84)}
      body.v092b-motion #raceStage[data-v092b-countdown="1"]{scale:1;filter:saturate(.96) brightness(.94)}
      body.v092b-motion #raceStage[data-v092b-countdown="GO!"]{scale:1;filter:saturate(1.04) brightness(1.02)}
      body.v092b-motion #countdown .count-number{transform-origin:center;animation:v092bCountIn .18s var(--v092b-snap) both}
      body.v092b-motion #countdown .count-number.race{animation:v092bGo .28s var(--v092b-bounce) both;color:var(--v092-primary,#2de6c4)}
      body.v092b-motion #race.v092b-go-impact .race-shell-v2{animation:v092bGoShake .12s linear 1}

      body.v092b-motion #race .runner-v3 .entity-svg{--v092b-lean:0deg;animation:v092bRunCycle .32s steps(8,end) infinite;transform-origin:55% 84%;will-change:transform}
      body.v092b-motion #race .runner-v3 .leg-front,
      body.v092b-motion #race .runner-v3 .arm-back{animation:v092bLimb .32s ease-in-out infinite alternate;transform-origin:center}
      body.v092b-motion #race .runner-v3 .leg-back,
      body.v092b-motion #race .runner-v3 .arm-front{animation:v092bLimb .32s ease-in-out infinite alternate-reverse;transform-origin:center}
      body.v092b-motion #raceStage.v092b-counting .runner-v3 .entity-svg{animation:v092bTension .18s steps(2,end) infinite}
      body.v092b-motion #raceStage.v092b-counting .runner-v3 .leg-front,
      body.v092b-motion #raceStage.v092b-counting .runner-v3 .leg-back,
      body.v092b-motion #raceStage.v092b-counting .runner-v3 .arm-front,
      body.v092b-motion #raceStage.v092b-counting .runner-v3 .arm-back{animation:none!important}
      body.v092b-motion #raceStage[data-v092b-countdown="1"] .runner-v3 .entity-svg{--v092b-lean:-5deg}
      body.v092b-motion #raceStage[data-v092b-countdown="GO!"] .runner-v3 .entity-svg{animation:v092bSprintStart .24s var(--v092b-snap) both}

      body.v092b-motion #race .runner-v3.v092b-boosting .entity-svg{--v092b-lean:-6deg;animation-duration:.24s}
      body.v092b-motion #race .runner-v3.v092b-boosting .leg-front,
      body.v092b-motion #race .runner-v3.v092b-boosting .leg-back,
      body.v092b-motion #race .runner-v3.v092b-boosting .arm-front,
      body.v092b-motion #race .runner-v3.v092b-boosting .arm-back{animation-duration:.24s}
      body.v092b-motion #race .runner-v3.v092b-dip .entity-svg{animation:v092bDip .24s var(--v092b-snap) 1}
      body.v092b-motion .v092b-boost-trails{position:absolute;left:-28px;top:42%;width:50px;height:32px;pointer-events:none;z-index:-1}
      body.v092b-motion .v092b-boost-trails i{position:absolute;right:0;width:15px;height:2px;border-radius:99px;background:#f5f7fa;opacity:0;animation:v092bTrail .2s linear both}
      body.v092b-motion .v092b-boost-trails i:nth-child(1){top:3px;animation-delay:0ms}.v092b-boost-trails i:nth-child(2){top:11px;animation-delay:18ms}.v092b-boost-trails i:nth-child(3){top:20px;animation-delay:36ms}.v092b-boost-trails i:nth-child(4){top:28px;animation-delay:54ms}
      body.v092b-motion .runner-v3.v092b-combo-5 .v092b-boost-trails i{background:var(--v092-primary,#2de6c4);box-shadow:0 0 9px #2de6c466}
      body.v092b-motion .v092b-combo-ring{position:absolute;left:44%;bottom:2%;width:52%;height:13%;border:1px solid #d9f7ff55;border-radius:50%;opacity:0;scale:.65;pointer-events:none;transition:opacity .18s ease,scale .18s var(--v092b-snap)}
      body.v092b-motion .runner-v3.v092b-combo-3 .v092b-combo-ring{opacity:.25;scale:1}
      body.v092b-motion .runner-v3.v092b-combo-5 .v092b-combo-ring{border-color:#2de6c480;box-shadow:0 0 12px #2de6c440}

      body.v092b-motion #raceStage:before{content:"";position:absolute;inset:54% 0 0;z-index:4;pointer-events:none;background:repeating-linear-gradient(90deg,transparent 0 42px,#ffffff12 43px 45px,transparent 46px 96px);background-size:220px 100%;opacity:.16;animation:v092bGroundFlow .95s linear infinite}
      body.v092b-motion #raceStage.v092b-final:before{animation-duration:.76s;opacity:.22}
      body.v092b-motion #raceStage.v092b-final{background:linear-gradient(#38223d 0 34%,#70453c 34% 45%,#395c56 45% 54%,#29363a 54% 100%)!important;filter:saturate(1.07) contrast(1.03)}
      body.v092b-motion #raceStage.v092b-final .far-layer,
      body.v092b-motion #raceStage.v092b-final .mid-layer{filter:sepia(.12) saturate(1.2);transition:filter .6s ease}
      body.v092b-motion #race.v092b-final .hud-progress-bar{height:8px}
      body.v092b-motion #race.v092b-final .race-hud{min-height:86px;background:linear-gradient(90deg,#15111df5,#382018f5 50%,#15111df5)}
      body.v092b-motion #race.v092b-final .ranking-mini{max-height:286px}
      body.v092b-motion .v092b-final-banner{position:absolute;left:50%;top:17%;z-index:30;translate:-50% 0;padding:10px 19px;border:1px solid #f0b42988;border-radius:999px;background:#15111eea;color:#fff4c7;font-weight:950;letter-spacing:.18em;font-size:13px;box-shadow:0 0 22px #f0b42940;pointer-events:none;animation:v092bFinalBanner 2.5s var(--v092b-snap) both}

      body.v092b-motion .rank-row.v092b-rank-flip strong{animation:v092bRankFlip .14s var(--v092b-snap) both}
      body.v092b-motion .runner-v3.v092b-rank-flash .nameplate{animation:v092bNameFlash .35s ease 1}
      body.v092b-motion .v092b-overtake-lines{position:absolute;right:68%;top:38%;width:72px;height:32px;pointer-events:none}
      body.v092b-motion .v092b-overtake-lines i{position:absolute;right:0;width:58px;height:1px;background:#f5f7fa88;animation:v092bOvertake .12s linear both}
      body.v092b-motion .v092b-overtake-lines i:nth-child(1){top:5px}.v092b-overtake-lines i:nth-child(2){top:15px;width:70px}.v092b-overtake-lines i:nth-child(3){top:25px;width:48px}
      body.v092b-motion .v092b-call-queue{position:absolute;right:18px;top:calc(16px + 245px);z-index:26;max-width:260px;padding:9px 12px;border:1px solid #ffffff25;border-radius:9px;background:#07121bea;color:#e8eef2;font-size:12px;font-weight:800;box-shadow:0 10px 24px #0006;opacity:0;translate:12px 0;pointer-events:none}
      body.v092b-motion .v092b-call-queue.show{animation:v092bCall 1.2s var(--v092b-snap) both}

      body.v092b-motion .runner-v3.v092b-finished .nameplate{filter:grayscale(1);opacity:.56;border-color:#7c8aa066!important;color:#aab2bd!important}
      body.v092b-motion .runner-v3.v092b-finished .entity-svg{animation:v092bCelebrateOut .4s var(--v092b-snap) both}
      body.v092b-motion .v092b-ribbon{position:absolute;left:50%;top:30%;width:5px;height:18px;border-radius:2px;background:var(--v092-primary,#2de6c4);pointer-events:none;animation:v092bRibbon .3s ease-out both}
      body.v092b-motion .v092b-ribbon:nth-of-type(2n){background:#f0b429}

      body.v092b-motion #results .podium-slot[data-place="2"]{animation:v092bPodium .52s .08s var(--v092b-bounce) both}
      body.v092b-motion #results .podium-slot[data-place="3"]{animation:v092bPodium .52s .48s var(--v092b-bounce) both}
      body.v092b-motion #results .podium-slot[data-place="1"]{animation:v092bPodium .58s .88s var(--v092b-bounce) both}
      body.v092b-motion #results .podium-slot[data-place="1"] .podium-block{box-shadow:0 0 32px rgba(240,180,41,.25)}

      @keyframes v092bRunCycle{0%,100%{transform:translateY(0) rotate(var(--v092b-lean))}25%{transform:translateY(-4px) rotate(var(--v092b-lean))}50%{transform:translateY(0) rotate(var(--v092b-lean))}75%{transform:translateY(4px) rotate(var(--v092b-lean))}}
      @keyframes v092bLimb{to{transform:rotate(10deg)}}
      @keyframes v092bTension{0%,100%{transform:translate(0,0) rotate(var(--v092b-lean))}50%{transform:translate(1px,-1px) rotate(var(--v092b-lean))}}
      @keyframes v092bSprintStart{0%{transform:translateY(2px) rotate(-15deg)}100%{transform:translateY(0) rotate(0deg)}}
      @keyframes v092bDip{0%,100%{transform:translateY(0)}50%{transform:translateY(2px) rotate(1deg)}}
      @keyframes v092bTrail{0%{opacity:0;transform:translateX(8px) scaleX(.6)}30%{opacity:.55}100%{opacity:0;transform:translateX(-26px) scaleX(1.35)}}
      @keyframes v092bCountIn{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
      @keyframes v092bGo{0%{opacity:0;transform:scale(1.2)}35%{opacity:1}100%{opacity:0;transform:scale(1)}}
      @keyframes v092bGoShake{0%,100%{translate:0 0}25%{translate:-4px 0}55%{translate:4px 0}80%{translate:-2px 0}}
      @keyframes v092bGroundFlow{to{background-position:-220px 0}}
      @keyframes v092bFinalBanner{0%{opacity:0;translate:-62% 0}10%,80%{opacity:1;translate:-50% 0}100%{opacity:0;translate:-42% 0}}
      @keyframes v092bRankFlip{0%{opacity:1;transform:translateY(0)}49%{opacity:0;transform:translateY(-8px)}50%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:none}}
      @keyframes v092bNameFlash{0%,100%{border-color:#ffffff3b}45%{border-color:#2de6c4}}
      @keyframes v092bOvertake{from{opacity:.5;transform:scaleX(.6)}to{opacity:0;transform:translateX(-26px) scaleX(1.15)}}
      @keyframes v092bCall{0%{opacity:0;translate:12px 0}12%,78%{opacity:1;translate:0 0}100%{opacity:0;translate:-6px 0}}
      @keyframes v092bCelebrateOut{0%{transform:translate(0,0) rotate(0)}45%{transform:translate(10px,-12px) rotate(-7deg)}100%{transform:translate(30px,-18px) rotate(2deg);filter:saturate(.4)}}
      @keyframes v092bRibbon{from{opacity:1;transform:translate(0,0) rotate(0)}to{opacity:0;transform:translate(var(--vx),var(--vy)) rotate(var(--vr))}}
      @keyframes v092bPodium{from{opacity:0;translate:0 54px;scale:.92}to{opacity:1;translate:0 0;scale:1}}

      @media(prefers-reduced-motion:reduce){
        body.v092b-motion #raceStage,body.v092b-motion #race .runner-v3 .entity-svg,body.v092b-motion #race .runner-v3 [class*=leg],body.v092b-motion #race .runner-v3 [class*=arm],body.v092b-motion #raceStage:before{animation:none!important;transition:none!important;scale:1!important;filter:none!important}
        body.v092b-motion .v092b-final-banner,body.v092b-motion .v092b-call-queue{animation-duration:.01ms!important}
      }
    `;
    document.head.appendChild(V092B_motionStyle);

    const V092B_stats = { countdownStages: [], boostEvents: 0, dipEvents: 0, rankEvents: 0, finalSprintEntries: 0, finishEvents: 0 };
    const V092B_prev = new Map();
    const V092B_prevRank = new Map();
    const V092B_finishSeen = new Set();
    const V092B_callQueue = [];
    let V092B_callBusy = false;
    let V092B_finalEntered = false;
    let V092B_lastCountdown = '';

    const V092B_runner = (id) => document.querySelector(`#runners [data-runner="${CSS.escape(String(id))}"]`);
    const V092B_ensureRing = (runner) => {
      if (!runner || runner.querySelector('.v092b-combo-ring')) return;
      const ring = document.createElement('span');
      ring.className = 'v092b-combo-ring';
      runner.appendChild(ring);
    };
    const V092B_trail = (runner) => {
      if (!runner || V092B_MOTION.reduced) return;
      runner.querySelector('.v092b-boost-trails')?.remove();
      const trails = document.createElement('span');
      trails.className = 'v092b-boost-trails';
      trails.innerHTML = '<i></i><i></i><i></i><i></i>';
      runner.appendChild(trails);
      setTimeout(() => trails.remove(), 260);
    };
    const V092B_overtakeLines = (runner) => {
      if (!runner || V092B_MOTION.reduced) return;
      const lines = document.createElement('span');
      lines.className = 'v092b-overtake-lines';
      lines.innerHTML = '<i></i><i></i><i></i>';
      runner.appendChild(lines);
      setTimeout(() => lines.remove(), 180);
    };
    const V092B_ribbons = (runner) => {
      if (!runner || V092B_MOTION.reduced) return;
      for (let index = 0; index < 7; index += 1) {
        const bit = document.createElement('i');
        bit.className = 'v092b-ribbon';
        bit.style.setProperty('--vx', `${-34 + Math.random() * 76}px`);
        bit.style.setProperty('--vy', `${-42 + Math.random() * 58}px`);
        bit.style.setProperty('--vr', `${-120 + Math.random() * 240}deg`);
        bit.style.left = `${40 + Math.random() * 24}%`;
        bit.style.top = `${24 + Math.random() * 30}%`;
        runner.appendChild(bit);
        setTimeout(() => bit.remove(), 360);
      }
    };
    const V092B_queueCall = (text) => {
      if (!text) return;
      V092B_callQueue.push(text);
      if (V092B_callBusy) return;
      const play = () => {
        const next = V092B_callQueue.shift();
        if (!next) { V092B_callBusy = false; return; }
        V092B_callBusy = true;
        const stage = document.getElementById('raceStage');
        if (!stage) { V092B_callBusy = false; return; }
        let call = stage.querySelector('.v092b-call-queue');
        if (!call) {
          call = document.createElement('div');
          call.className = 'v092b-call-queue';
          stage.appendChild(call);
        }
        call.textContent = next;
        call.classList.remove('show');
        requestAnimationFrame(() => call.classList.add('show'));
        setTimeout(() => { call.classList.remove('show'); V092B_callBusy = false; play(); }, 1230);
      };
      play();
    };
    const V092B_enterFinal = () => {
      if (V092B_finalEntered) return;
      V092B_finalEntered = true;
      V092B_stats.finalSprintEntries += 1;
      document.getElementById('raceStage')?.classList.add('v092b-final');
      document.getElementById('race')?.classList.add('v092b-final');
      const stage = document.getElementById('raceStage');
      if (stage && !stage.querySelector('.v092b-final-banner')) {
        const banner = document.createElement('div');
        banner.className = 'v092b-final-banner';
        banner.textContent = 'FINAL SPRINT';
        stage.appendChild(banner);
        setTimeout(() => banner.remove(), 2700);
      }
    };
    const V092B_syncCountdown = () => {
      const value = document.querySelector('#countdown .count-number')?.textContent?.trim() || '';
      if (!value || value === V092B_lastCountdown) return;
      V092B_lastCountdown = value;
      if (!['READY', '3', '2', '1', 'GO!'].includes(value)) return;
      V092B_stats.countdownStages.push(value);
      const stage = document.getElementById('raceStage');
      if (stage) {
        stage.dataset.v092bCountdown = value;
        stage.classList.toggle('v092b-counting', ['3', '2', '1'].includes(value));
      }
      if (value === 'GO!') {
        stage?.classList.remove('v092b-counting');
        const race = document.getElementById('race');
        race?.classList.add('v092b-go-impact');
        setTimeout(() => race?.classList.remove('v092b-go-impact'), 150);
        setTimeout(() => { if (stage?.dataset.v092bCountdown === 'GO!') delete stage.dataset.v092bCountdown; }, 360);
      }
    };

    const V092B_tick = () => {
      try {
        V092B_syncCountdown();
        const players = Array.isArray(state?.players) ? state.players : [];
        const worldLength = Math.max(1, Number(state?.race?.worldLength) || 1);
        let leaderProgress = 0;
        players.forEach((player) => {
          const id = String(player.id);
          const runner = V092B_runner(id);
          if (!runner) return;
          V092B_ensureRing(runner);
          const distance = Number(player.worldDistance ?? player.distance ?? 0) || 0;
          const combo = Number(player.combo || 0);
          const wrong = Number(player.wrong || 0);
          const pass = Number(player.pass || 0);
          const questionProgress = Number(player.questionIndex || 0) / Math.max(1, Number(player.questions?.length || player.assignedTotal || 1));
          leaderProgress = Math.max(leaderProgress, questionProgress, distance / worldLength);
          const before = V092B_prev.get(id);
          if (before) {
            if (distance > before.distance + .01 && !player.finished) {
              V092B_stats.boostEvents += 1;
              runner.classList.remove('v092b-boosting');
              requestAnimationFrame(() => runner.classList.add('v092b-boosting'));
              V092B_trail(runner);
              setTimeout(() => runner.classList.remove('v092b-boosting'), 245);
            }
            if (wrong > before.wrong || pass > before.pass) {
              V092B_stats.dipEvents += 1;
              runner.classList.remove('v092b-dip');
              requestAnimationFrame(() => runner.classList.add('v092b-dip'));
              setTimeout(() => runner.classList.remove('v092b-dip'), 250);
            }
          }
          runner.classList.toggle('v092b-combo-3', combo >= 3);
          runner.classList.toggle('v092b-combo-5', combo >= 5);
          if (player.finished && !V092B_finishSeen.has(id)) {
            V092B_finishSeen.add(id);
            V092B_stats.finishEvents += 1;
            runner.classList.add('v092b-finished');
            V092B_ribbons(runner);
            V092B_queueCall(`${player.name || 'PLAYER'} · #${player.finishRank || V092B_finishSeen.size} FINISH`);
          }
          V092B_prev.set(id, { distance, wrong, pass, combo });
        });

        const order = Array.isArray(state?.race?.order) ? state.race.order.map(String) : [];
        order.forEach((id, index) => {
          const rank = index + 1;
          const previous = V092B_prevRank.get(id);
          if (previous && previous !== rank) {
            V092B_stats.rankEvents += 1;
            const row = document.querySelector(`[data-rank-player="${CSS.escape(id)}"]`);
            const runner = V092B_runner(id);
            if (rank <= 3 || previous <= 3) {
              row?.classList.remove('v092b-rank-flip');
              runner?.classList.remove('v092b-rank-flash');
              requestAnimationFrame(() => { row?.classList.add('v092b-rank-flip'); runner?.classList.add('v092b-rank-flash'); });
              setTimeout(() => { row?.classList.remove('v092b-rank-flip'); runner?.classList.remove('v092b-rank-flash'); }, 380);
            } else if (rank < previous) {
              const player = players.find((item) => String(item.id) === id);
              V092B_queueCall(`${player?.name || 'PLAYER'} · ${rank}위로 상승`);
            }
            if (rank < previous) V092B_overtakeLines(runner);
          }
          V092B_prevRank.set(id, rank);
        });
        if (state?.race?.finalSprint || leaderProgress >= .8) V092B_enterFinal();
      } catch (error) {
        if (RoleParams?.get?.('debug') === '1') console.warn('[V0.9.2B motion]', error);
      }
      requestAnimationFrame(V092B_tick);
    };

    const V092B_countObserver = new MutationObserver(V092B_syncCountdown);
    const V092B_countNode = document.getElementById('countdown');
    if (V092B_countNode) V092B_countObserver.observe(V092B_countNode, { childList: true, characterData: true, subtree: true, attributes: true });
    requestAnimationFrame(V092B_tick);

    window.SUMUS_MOTION_BUILD = V092B_MOTION;
    window.SUMUS_MOTION_AUDIT = Object.freeze({
      snapshot: () => ({
        build: V092B_MOTION.build,
        countdownStages: [...V092B_stats.countdownStages],
        boostEvents: V092B_stats.boostEvents,
        dipEvents: V092B_stats.dipEvents,
        rankEvents: V092B_stats.rankEvents,
        finalSprintEntries: V092B_stats.finalSprintEntries,
        finishEvents: V092B_stats.finishEvents,
        finalSprintActive: Boolean(V092B_finalEntered),
        queuedCalls: V092B_callQueue.length
      })
    });
