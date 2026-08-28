    /* Premium arcade-sports presentation layered on the existing race rules. */
    const V091_raceStyle = document.createElement('style');
    V091_raceStyle.textContent = `
      .arena-run .runner-v3{will-change:transform;transition:filter .2s ease}
      .arena-run .runner-v3 .entity-svg{animation:v091Stride .42s steps(2,end) infinite,v091Bob .34s ease-in-out infinite alternate;transform-origin:55% 85%}
      .arena-run .runner-v3 .leg-front,.arena-run .runner-v3 .arm-back{animation:v091Limb .38s ease-in-out infinite alternate;transform-origin:center}
      .arena-run .runner-v3 .leg-back,.arena-run .runner-v3 .arm-front{animation:v091Limb .38s ease-in-out infinite alternate-reverse;transform-origin:center}
      .arena-run .runner-v3.boost .entity-svg,.arena-run .runner-v3.dash .entity-svg{animation-duration:.2s;filter:drop-shadow(-12px 3px 4px #83f4d966)}
      .arena-run .runner-v3.combo-aura:after{content:"";position:absolute;right:65%;top:48%;width:clamp(55px,7vw,120px);height:6px;background:linear-gradient(90deg,transparent,#7ce8cc99,#fff);border-radius:100%;filter:blur(2px);animation:v091Trail .32s linear infinite}
      .rank-row.v091-rank-change{animation:v091Rank .62s cubic-bezier(.18,.86,.24,1)}
      .race-world.final-mode{animation:v091FinalWorld 1.1s ease-in-out infinite alternate}
      .race-world.final-mode .finish-gate{animation:v091FinishGate .58s ease-in-out infinite alternate;filter:drop-shadow(0 0 18px #ffe8a055)}
      #results .podium>*:nth-child(1),#results [data-place="1"]{animation:v091Podium .7s .1s both}
      #results .podium>*:nth-child(2),#results [data-place="2"]{animation:v091Podium .7s .22s both}
      #results .podium>*:nth-child(3),#results [data-place="3"]{animation:v091Podium .7s .34s both}
      #results .podium>*:first-child:after,#results [data-place="1"]:after{content:"CHAMPION";display:block;margin-top:8px;color:#ffe29a;letter-spacing:.18em;font-weight:950;animation:v091Celebrate .7s ease-in-out infinite alternate}
      #race .nameplate{font-size:clamp(15px,1.35vw,25px)!important;letter-spacing:.01em;background:#07131de8;border-color:#ffffff30;box-shadow:0 6px 18px #0008}
      #race .rank-row b{font-size:clamp(14px,1.1vw,21px)}
      @keyframes v091Bob{to{transform:translateY(-4px) rotate(-1deg)}}
      @keyframes v091Stride{50%{filter:brightness(1.08)}}
      @keyframes v091Limb{to{transform:rotate(7deg)}}
      @keyframes v091Trail{to{transform:translateX(-18px);opacity:.15}}
      @keyframes v091Rank{0%{transform:translateX(24px) scale(1.06);background:#f4c96d33}100%{transform:none}}
      @keyframes v091FinalWorld{to{filter:saturate(1.08) contrast(1.04)}}
      @keyframes v091FinishGate{to{transform:scale(1.035)}}
      @keyframes v091Podium{from{opacity:0;transform:translateY(45px) scale(.9)}to{opacity:1;transform:none}}
      @keyframes v091Celebrate{to{transform:translateY(-5px);text-shadow:0 0 15px #ffc85788}}
      @media (prefers-reduced-motion:reduce){.arena-run .runner-v3 .entity-svg,.arena-run .runner-v3 [class*=leg],.arena-run .runner-v3 [class*=arm]{animation:none!important}}
    `;
    document.head.appendChild(V091_raceStyle);
    const V091_previousSetup = RaceEngine.setup.bind(RaceEngine);
    RaceEngine.setup = function () {
      const output = V091_previousSetup();
      state.players.forEach((player, index) => {
        const column = Math.floor(index / Math.max(1, player.laneCount || 1));
        if (!column) return;
        const offset = -column * 32;
        player.startOffset = offset;
        player.displayDistance = offset;
        player.qaPrevDisplay = offset;
        player.moveFrom = offset;
        player.moveTo = offset;
        player.targetDistance = offset;
      });
      return output;
    };
    const V091_previousRaceAnswer = RaceEngine.answer.bind(RaceEngine);
    RaceEngine.answer = function (player, result, responseTime, deferRender) {
      const before = player?.worldDistance || 0;
      const output = V091_previousRaceAnswer(player, result, responseTime, deferRender);
      if (player && result === 'correct') {
        const gain = Math.max(0, (player.worldDistance || 0) - before);
        player.el?.style.setProperty('--v091-acceleration', String(gain));
        player.el?.classList.add('v091-accelerating');
        setTimeout(() => player.el?.classList.remove('v091-accelerating'), 420);
      }
      return output;
    };
    const V091_previousRank = RaceEngine.rank.bind(RaceEngine);
    RaceEngine.rank = function () {
      const oldPositions = new Map((state.race.order || []).map((id, index) => [id, index]));
      const output = V091_previousRank();
      (state.race.order || []).forEach((id, index) => {
        if (oldPositions.has(id) && oldPositions.get(id) !== index) {
          const row = document.querySelector(`[data-rank-player="${CSS.escape(id)}"]`);
          row?.classList.remove('v091-rank-change');
          requestAnimationFrame(() => row?.classList.add('v091-rank-change'));
        }
      });
      return output;
    };
    const V091_previousFinish = RaceEngine.finish.bind(RaceEngine);
    RaceEngine.finish = function () {
      const output = V091_previousFinish();
      document.querySelector('#results')?.classList.add('v091-results-live');
      return output;
    };
