    /* V0.9.2B.1 PREMIUM DIRECTOR PASS
       Presentation-only stadium/readability layer. No gameplay objects or engine
       methods are replaced; only decorative DOM/CSS is added to the RUN surface. */
    const V092B1_PREMIUM = Object.freeze({ build: 'V0.9.2B.1' });
    document.documentElement.dataset.sumusPremium = V092B1_PREMIUM.build;
    document.body.classList.add('v092b1-premium');

    const V092B1_style = document.createElement('style');
    V092B1_style.dataset.sumusPremium = V092B1_PREMIUM.build;
    V092B1_style.textContent = `
      body.v092b1-premium #raceStage{isolation:isolate;overflow:hidden}
      body.v092b1-premium .v092b1-stadium-depth{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden}
      body.v092b1-premium .v092b1-stadium-depth .roof{position:absolute;left:-5%;right:-5%;top:-4%;height:19%;background:linear-gradient(180deg,#020911e8,#071522dd 72%,transparent);clip-path:polygon(0 0,100% 0,95% 58%,79% 80%,21% 80%,5% 58%);border-bottom:1px solid #ffffff18}
      body.v092b1-premium .v092b1-stadium-depth .crowd{position:absolute;left:0;right:0;top:24%;height:17%;opacity:.68;background:radial-gradient(circle at 8px 7px,#dbe9ee55 0 2px,transparent 2.4px) 0 0/17px 13px,linear-gradient(#0b1a27,#07131e);mask-image:linear-gradient(90deg,transparent,#000 7% 93%,transparent);border-top:1px solid #ffffff12;border-bottom:1px solid #ffffff18}
      body.v092b1-premium .v092b1-stadium-depth .ribbon{position:absolute;left:0;right:0;top:39.5%;height:4%;display:flex;align-items:center;justify-content:center;background:linear-gradient(90deg,#06121d,#12312e 45% 55%,#06121d);border-block:1px solid #2de6c438;color:#dffbf5;font:900 10px/1 Pretendard,system-ui,sans-serif;letter-spacing:.34em;text-indent:.34em;white-space:nowrap;opacity:.9}
      body.v092b1-premium .v092b1-light{position:absolute;top:3%;width:74px;height:118px;border-left:3px solid #65748166;transform-origin:bottom center}
      body.v092b1-premium .v092b1-light:before{content:"";position:absolute;left:-23px;top:0;width:45px;height:16px;border:2px solid #8fa0ac88;border-radius:3px;background:repeating-linear-gradient(90deg,#dbe7eb 0 5px,#40515d 5px 8px);box-shadow:0 11px 25px #d9f7ff18}
      body.v092b1-premium .v092b1-light.left{left:7%;rotate:-9deg}.v092b1-light.right{right:7%;rotate:9deg;scale:-1 1}
      body.v092b1-premium #raceStage.v092b-final .v092b1-stadium-depth .ribbon{background:linear-gradient(90deg,#0b1019,#513020 45% 55%,#0b1019);border-color:#f0b42955;color:#fff0be;transition:background .6s ease,border-color .6s ease,color .6s ease}
      body.v092b1-premium #raceStage.v092b-final .v092b1-stadium-depth .crowd{filter:sepia(.18) saturate(1.2);transition:filter .6s ease}

      body.v092b1-premium .track-v2{background:repeating-linear-gradient(0deg,#ffffff0b 0 1px,transparent 1px 15px),repeating-linear-gradient(90deg,transparent 0 118px,#ffffff09 119px 121px),linear-gradient(180deg,#28333b,#4b4041 54%,#252f36)!important;border-top-color:#f4fbff!important;box-shadow:0 -8px 24px #0008,inset 0 1px #ffffff18!important}
      body.v092b1-premium .track-v2:after{content:"";position:absolute;inset:8% 0 0;background:linear-gradient(90deg,transparent 0 20%,#ffffff08 34%,transparent 48% 100%);opacity:.65;pointer-events:none}
      body.v092b1-premium .track-fence{filter:brightness(.72) saturate(.65);opacity:.8!important}
      body.v092b1-premium .finish-gate{z-index:18!important;filter:drop-shadow(0 10px 16px #000a)!important}
      body.v092b1-premium .finish-top{min-width:126px!important;background:#07131df5!important;border:2px solid #f5f7fa!important;color:#fff!important;font-size:12px!important;letter-spacing:.22em!important}
      body.v092b1-premium .finish-post{filter:contrast(1.18) brightness(.9)!important}

      body.v092b1-premium #race .runner-v3 .entity-svg{width:116%;height:116%;margin-left:-8%;margin-top:-7%}
      body.v092b1-premium #race .race-world.v092a-count-solo .runner-v3 .entity-svg{width:124%;height:124%;margin-left:-12%;margin-top:-12%}
      body.v092b1-premium #race .race-world.v092a-count-small .runner-v3 .entity-svg{width:120%;height:120%;margin-left:-10%;margin-top:-9%}
      body.v092b1-premium #race .race-world.v092a-count-full .runner-v3 .entity-svg,
      body.v092b1-premium #race .race-world.v092a-count-crowded .runner-v3 .entity-svg{width:128%;height:128%;margin-left:-14%;margin-top:-13%}
      body.v092b1-premium #race .runner-v3 .nameplate{min-width:0;max-width:120px;padding:4px 8px!important;border-left:3px solid var(--v092b-id-accent,#2de6c4)!important;border-top-color:#ffffff2a!important;border-right-color:#ffffff20!important;border-bottom-color:#ffffff20!important;background:#06121bea!important;box-shadow:0 6px 16px #0008!important;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}
      body.v092b1-premium #race .race-world.v092a-count-full .nameplate,
      body.v092b1-premium #race .race-world.v092a-count-crowded .nameplate{max-width:92px;padding:3px 6px!important;font-size:11.5px!important}
      body.v092b1-premium #race .runner-v3[data-v092a-rank="1"] .nameplate{border-left-color:#f0b429!important}
      body.v092b1-premium #race .runner-v3[data-v092a-rank="2"] .nameplate{border-left-color:#c7cdd6!important}
      body.v092b1-premium #race .runner-v3[data-v092a-rank="3"] .nameplate{border-left-color:#c77b44!important}

      body.v092b1-premium .race-hud{background:linear-gradient(90deg,#040c14fa,#0c1c2bfa 45%,#091724fa)!important;border-bottom:1px solid #2de6c42b!important;box-shadow:0 8px 24px #0007!important}
      body.v092b1-premium .ranking-mini{background:#06121bf2!important;border:1px solid #ffffff22!important;border-top:3px solid #2de6c4!important;box-shadow:0 14px 30px #0009!important;backdrop-filter:blur(9px)}
      body.v092b1-premium .ranking-mini-head{background:#0a1825d9;letter-spacing:.13em}
      body.v092b1-premium .ranking-mini .rank-row{background:linear-gradient(90deg,#ffffff05,transparent);border-radius:6px!important}
      body.v092b1-premium .ranking-mini .rank-row[data-v092a-rank="1"]{background:linear-gradient(90deg,#f0b42918,transparent)!important}
      body.v092b1-premium .scoreboard{background:#06121bf4!important;border-color:#f0b42955!important;box-shadow:0 7px 18px #0008!important}
      body.v092b1-premium .broadcast-call{background:#06121bf2!important;border-color:#2de6c43f!important;box-shadow:0 10px 24px #0008!important}

      @media(max-width:1200px){body.v092b1-premium #race .runner-v3 .nameplate{max-width:104px}.v092b1-stadium-depth .ribbon{font-size:9px!important}}
      @media(max-width:900px){body.v092b1-premium #race .runner-v3 .entity-svg{width:112%;height:112%;margin-left:-6%;margin-top:-5%}}
      @media(prefers-reduced-motion:reduce){body.v092b1-premium #raceStage.v092b-final .v092b1-stadium-depth .ribbon,body.v092b1-premium #raceStage.v092b-final .v092b1-stadium-depth .crowd{transition:none!important}}
    `;
    document.head.appendChild(V092B1_style);

    const V092B1_accents = ['#2de6c4','#58b8ff','#f2a544','#a98cff','#f16f8f','#7bd56f','#e3d15f','#5bd7cf'];
    const V092B1_ensureDepth = () => {
      const stage = document.getElementById('raceStage');
      if (!stage || stage.querySelector('.v092b1-stadium-depth')) return;
      const depth = document.createElement('div');
      depth.className = 'v092b1-stadium-depth';
      depth.setAttribute('aria-hidden', 'true');
      depth.innerHTML = '<div class="roof"></div><div class="v092b1-light left"></div><div class="v092b1-light right"></div><div class="crowd"></div><div class="ribbon">SUMUS ACADEMY · VOCABULARY RUN · SUMUS ACADEMY · VOCABULARY RUN</div>';
      stage.prepend(depth);
    };
    const V092B1_decorateRunners = () => {
      document.querySelectorAll('#runners > .runner-v3').forEach((runner, index) => {
        runner.style.setProperty('--v092b-id-accent', V092B1_accents[index % V092B1_accents.length]);
      });
    };
    V092B1_ensureDepth();
    V092B1_decorateRunners();
    const V092B1_runners = document.getElementById('runners');
    if (V092B1_runners) new MutationObserver(V092B1_decorateRunners).observe(V092B1_runners, { childList: true });
    window.SUMUS_PREMIUM_BUILD = V092B1_PREMIUM;
