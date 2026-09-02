    /* V0.9.2A VISUAL CLEANUP
       Presentation-only CSS, visual DOM decoration, and debug visibility gating.
       Gameplay, scoring, transport, question lifecycle, and race math stay untouched. */
    const V092A_VISUAL = Object.freeze({ build: 'V0.9.2A', debug: RoleParams.get('debug') === '1' });
    document.documentElement.dataset.sumusVisual = V092A_VISUAL.build;
    document.body.classList.add('v092a-visual');
    document.body.classList.toggle('v092a-debug', V092A_VISUAL.debug);

    const V092A_style = document.createElement('style');
    V092A_style.dataset.sumusVisual = V092A_VISUAL.build;
    V092A_style.textContent = `
      :root{
        --v092-bg:#0a1220;--v092-bg-deep:#07101b;--v092-surface:#101b2e;
        --v092-surface-2:#142238;--v092-line:#ffffff18;--v092-line-strong:#ffffff2b;
        --v092-primary:#2de6c4;--v092-primary-soft:#2de6c418;--v092-gold:#f0b429;
        --v092-success:#33d17a;--v092-danger:#e5484d;--v092-warning:#f2a544;
        --v092-rank-2:#c7cdd6;--v092-rank-3:#c77b44;--v092-text:#f5f7fa;
        --v092-muted:#8c99ad;--v092-card-radius:16px;--v092-button-radius:12px;
        --v092-ease:cubic-bezier(.16,1,.3,1);
      }

      body.v092a-visual{background:var(--v092-bg);color:var(--v092-text);font-family:Pretendard,Inter,"Noto Sans KR",system-ui,sans-serif}
      body.v092a-visual .world-bg{background-color:var(--v092-bg)}
      body.v092a-visual .panel{border-color:var(--v092-line);border-radius:var(--v092-card-radius);background:linear-gradient(150deg,#101d30f5,#0d1929f5);box-shadow:0 12px 30px #00000024}
      body.v092a-visual .topbar{border-bottom-color:var(--v092-line)}
      body.v092a-visual .eyebrow,body.v092a-visual .muted{color:var(--v092-muted)}
      body.v092a-visual .btn{border-radius:var(--v092-button-radius);transition:transform .16s var(--v092-ease),border-color .16s ease,background .16s ease,color .16s ease}
      body.v092a-visual .btn:hover{transform:translateY(-1px);border-color:#2de6c466}
      body.v092a-visual .btn.primary,body.v092a-visual .btn.gold{border-color:#2de6c47a;background:linear-gradient(135deg,#2de6c4,#28cdb6);color:#06151a;box-shadow:none}
      body.v092a-visual .btn.ghost{background:#ffffff07;border-color:var(--v092-line);color:var(--v092-text)}
      body.v092a-visual .btn.danger{background:#35191f;border-color:#e5484d80;color:#ffb6bc}
      body.v092a-visual input,body.v092a-visual select,body.v092a-visual textarea{border-radius:10px}

      /* HOME: retain the established composition, but establish one clear action hierarchy. */
      body.v092a-visual #home .hero-sub:after{display:none!important}
      body.v092a-visual #home .hero-kicker{color:#afbac8}
      body.v092a-visual #home .hero-kicker:before{background:var(--v092-primary);box-shadow:none}
      body.v092a-visual #home .hero-sub{color:var(--v092-primary)}
      body.v092a-visual #home .menu-card{border-color:var(--v092-line);border-radius:var(--v092-card-radius);background:linear-gradient(145deg,#0d1b2bde,#0b1726eb);transition:transform .2s var(--v092-ease),border-color .2s ease,background .2s ease}
      body.v092a-visual #home .menu-card:hover{transform:translateY(-3px);border-color:#ffffff33;background:linear-gradient(145deg,#12263b,#0e1c2d)}
      body.v092a-visual #home .menu-card:first-child{border-color:#2de6c45c;background:linear-gradient(145deg,#12322f,#0d202b)}

      /* SETUP / LOBBY: quieter surfaces and clearer selected states. */
      body.v092a-visual .setup-panel,body.v092a-visual .waiting-room,body.v092a-visual .code-panel{box-shadow:0 14px 34px #00000026}
      body.v092a-visual .preset-card.active,body.v092a-visual .book-card.active,body.v092a-visual [data-range-mode].active{border-color:var(--v092-primary)!important;background:#2de6c412!important;box-shadow:inset 3px 0 0 var(--v092-primary)}
      body.v092a-visual .battle-code{color:var(--v092-primary);text-shadow:none}
      body.v092a-visual .player-card{border-radius:13px;border-color:var(--v092-line);background:#ffffff06}

      /* Production surfaces never expose QA affordances. They remain available with ?debug=1. */
      body.v092a-visual:not(.v092a-debug) .v091-buildtag,
      body.v092a-visual:not(.v092a-debug) .v084-buildtag,
      body.v092a-visual:not(.v092a-debug) .v084-badge,
      body.v092a-visual:not(.v092a-debug) #debugPanel,
      body.v092a-visual:not(.v092a-debug) .demo-speed,
      body.v092a-visual:not(.v092a-debug) #autoRace,
      body.v092a-visual:not(.v092a-debug) #toggleStudent,
      body.v092a-visual:not(.v092a-debug) #studentPreview,
      body.v092a-visual:not(.v092a-debug) #studentLabLauncher,
      body.v092a-visual:not(.v092a-debug) .student-debug,
      body.v092a-visual:not(.v092a-debug) #openStudentTest{display:none!important}
      body.v092a-debug .v091-buildtag{display:block!important}
      body.v092a-debug .v084-badge{display:inline-flex!important}
      body.v092a-debug #home .hero-sub:after{display:inline-block!important}

      /* RUN broadcast readability. */
      body.v092a-visual #race{background:var(--v092-bg-deep)}
      body.v092a-visual .race-shell-v2{grid-template-rows:78px minmax(0,1fr) 62px}
      body.v092a-visual .race-hud{padding:0 28px;background:linear-gradient(90deg,#07111cf7,#0d1c2cf7 50%,#07111cf7);border-bottom:1px solid #2de6c42e;box-shadow:0 10px 28px #00000045}
      body.v092a-visual .live-badge{color:#dce7ec;font-size:10px;letter-spacing:.12em}
      body.v092a-visual .live-dot{background:var(--v092-primary);box-shadow:0 0 0 4px #2de6c414}
      body.v092a-visual .hud-progress>span,body.v092a-visual .hud-leader>span{color:var(--v092-muted);font-size:10px}
      body.v092a-visual .hud-progress b{font-size:28px;font-variant-numeric:tabular-nums}
      body.v092a-visual .hud-progress-bar{height:5px;border-radius:99px;background:#ffffff12}
      body.v092a-visual .hud-progress-bar em{border-radius:inherit;background:linear-gradient(90deg,var(--v092-primary),#77f0d9);box-shadow:none}
      body.v092a-visual .hud-leader b{font-size:16px;color:var(--v092-gold)}
      body.v092a-visual .sound-toggle{border-radius:10px;border-color:var(--v092-line);background:#ffffff08}
      body.v092a-visual .race-world{background:linear-gradient(#16405b 0 36%,#2d6b76 36% 45%,#24594f 45% 54%,#29363a 54% 100%)}
      body.v092a-visual .race-world:after{content:"";position:absolute;inset:0;z-index:5;pointer-events:none;background:linear-gradient(180deg,#06121c12 0 46%,transparent 60%),linear-gradient(90deg,#06121c30,transparent 18% 78%,#06121c3b)}
      body.v092a-visual .track-v2{background:repeating-linear-gradient(0deg,#ffffff0b 0 2px,transparent 2px 18%),linear-gradient(100deg,#3c454b,#6b5553 48%,#343d42);border-top:6px solid #e9fff4;box-shadow:0 -12px 34px #00000080}
      body.v092a-visual .track-fence{opacity:.88}
      body.v092a-visual .scoreboard{border-color:#f0b42966!important;background:#091522f2!important;color:#ffe8aa!important;box-shadow:0 8px 24px #0007}
      body.v092a-visual .finish-gate{filter:drop-shadow(0 10px 18px #0008)}
      body.v092a-visual .finish-top{background:#0a1623!important;border-color:#f5f7fa!important;color:#f5f7fa!important;letter-spacing:.18em!important}
      body.v092a-visual .finish-post{filter:contrast(1.15)}
      body.v092a-visual .race-world.v092a-starting .runners-layer-v2:before{content:"START";position:absolute;left:calc(24% - 16px);top:54%;bottom:0;z-index:8;width:5px;border-inline:2px solid #06121c;background:repeating-linear-gradient(0deg,#fff 0 8px,#07111c 8px 16px);color:#07111c;font-size:9px;font-weight:1000;letter-spacing:.14em;writing-mode:vertical-rl;padding-top:8px;box-shadow:0 0 0 2px #ffffff40}

      body.v092a-visual .runner-v3{width:calc(var(--size) * var(--v092-runner-scale,1.04));height:calc(var(--size) * .9 * var(--v092-runner-scale,1.04))}
      body.v092a-visual .race-world.v092a-count-solo{--v092-runner-scale:1.22}
      body.v092a-visual .race-world.v092a-count-small{--v092-runner-scale:1.10}
      body.v092a-visual .race-world.v092a-count-standard{--v092-runner-scale:1.04}
      body.v092a-visual .race-world.v092a-count-full{--v092-runner-scale:1.035}
      body.v092a-visual .race-world.v092a-count-crowded{--v092-runner-scale:1}
      body.v092a-visual #race .runner-v3 .entity-svg{filter:drop-shadow(0 9px 6px #0008) drop-shadow(0 0 1px #fff9)}
      body.v092a-visual #race .runner-v3 .nameplate{top:var(--name-y,-22px);padding:5px 9px;border:1px solid #ffffff3b;border-radius:8px;background:#07121bf2;color:var(--v092-text);font-size:clamp(13px,1vw,18px)!important;line-height:1.1;box-shadow:0 7px 16px #0009}
      body.v092a-visual #race .race-world.v092a-count-full .nameplate{font-size:13px!important;padding:4px 7px}
      body.v092a-visual #race .race-world.v092a-count-crowded .nameplate{font-size:12px!important;padding:3px 6px}
      body.v092a-visual #race .runner-v3[data-v092a-rank="1"] .nameplate{border-color:#f0b429aa;color:#fff4ce}
      body.v092a-visual #race .runner-v3 .nameplate em{color:var(--v092-warning)}

      body.v092a-visual .ranking-mini{right:18px;top:16px;width:248px;border:1px solid #ffffff25;border-top:3px solid var(--v092-primary);border-radius:12px;background:#07121bee;box-shadow:0 16px 36px #0008;overflow:hidden;backdrop-filter:blur(12px)}
      body.v092a-visual .ranking-mini-head{padding:11px 13px;border-bottom:1px solid var(--v092-line);font-size:10px}
      body.v092a-visual .ranking-mini-head button{color:var(--v092-primary);font-weight:900}
      body.v092a-visual .ranking-mini .ranking-list{padding:5px}
      body.v092a-visual .ranking-mini .rank-row{min-height:38px;padding:7px 8px;border-radius:8px;grid-template-columns:30px 1fr auto;border-bottom:1px solid #ffffff0b}
      body.v092a-visual .ranking-mini .rank-row strong{font-size:16px;font-variant-numeric:tabular-nums}
      body.v092a-visual .ranking-mini .rank-row b{font-size:15px}
      body.v092a-visual .ranking-mini .rank-row>small{color:#aeb9c8;font-variant-numeric:tabular-nums}
      body.v092a-visual .ranking-mini .rank-row[data-v092a-rank="1"]{background:#f0b42912;border-left:3px solid var(--v092-gold)}
      body.v092a-visual .ranking-mini .rank-row[data-v092a-rank="1"] strong{color:var(--v092-gold)}
      body.v092a-visual .ranking-mini .rank-row[data-v092a-rank="2"]{border-left:3px solid var(--v092-rank-2)}
      body.v092a-visual .ranking-mini .rank-row[data-v092a-rank="3"]{border-left:3px solid var(--v092-rank-3)}
      body.v092a-visual .broadcast-call{border-radius:10px;background:#07121bf2;border:1px solid #2de6c44d;color:var(--v092-text);box-shadow:0 12px 30px #0007}
      body.v092a-visual .race-controls{padding:0 22px;background:#07111cf5;border-top-color:#2de6c426}
      body.v092a-visual:not(.v092a-debug) .race-controls{grid-template-columns:1fr auto}
      body.v092a-visual:not(.v092a-debug) .race-controls .footer-actions{grid-column:2;justify-self:end;display:flex}
      body.v092a-visual .race-controls>div:first-child span{color:var(--v092-muted)}
      body.v092a-visual .race-controls>div:first-child b{font-size:12px}

      /* Student play surface: denser HUD, stronger prompt hierarchy, faster scanning. */
      body.v092a-visual.role-student{background:var(--v092-bg-deep)}
      body.v092a-visual .student-app{--student-accent:var(--v092-primary);background:linear-gradient(180deg,#0b1b2b,#07121d)}
      body.v092a-visual .student-shell{background:linear-gradient(180deg,#0c1d2d,#081521);border-color:var(--v092-line)}
      body.v092a-visual .student-top{min-height:52px;padding:10px 16px 8px;background:#091724;border-bottom-color:var(--v092-line)}
      body.v092a-visual .student-brand em{color:var(--v092-primary)}
      body.v092a-visual .student-live{color:var(--v092-success)}
      body.v092a-visual .student-live:before{box-shadow:none}
      body.v092a-visual .student-game-head{padding:8px 16px 7px;background:#0b1927;border-bottom-color:var(--v092-line)}
      body.v092a-visual .student-game-row{font-size:13px}
      body.v092a-visual .student-rank{color:var(--v092-gold)}
      body.v092a-visual .student-mini-row{margin-top:3px}
      body.v092a-visual .student-progress{padding:7px 16px 4px;background:#091724}
      body.v092a-visual .student-progress-line{height:6px}
      body.v092a-visual .student-progress-line i{background:var(--v092-primary)}
      body.v092a-visual .student-question-wrap{padding:12px 16px 14px;background:linear-gradient(180deg,#0b1b2a,#081520)}
      body.v092a-visual .student-question-type{color:#94a3b5;font-size:9px}
      body.v092a-visual .student-prompt{margin:15px 0 18px;font-size:31px;line-height:1.18;letter-spacing:-.025em;color:#fff}
      body.v092a-visual .student-prompt.ko{font-size:24px}
      body.v092a-visual .student-answers{gap:10px;margin-top:0}
      body.v092a-visual .student-answer{min-height:68px;padding:13px 14px;border:1px solid #ffffff1d;border-radius:14px;background:linear-gradient(145deg,#13273a,#0f2132);color:var(--v092-text);font-size:15px;line-height:1.35;font-weight:780;box-shadow:0 5px 14px #0000001f;transition:transform .12s var(--v092-ease),border-color .12s ease,background .12s ease}
      body.v092a-visual .student-answer:hover{border-color:#2de6c45c;background:linear-gradient(145deg,#173044,#12283a)}
      body.v092a-visual .student-answer:active{transform:scale(.985);border-color:var(--v092-primary)}
      body.v092a-visual .student-answer br{display:none}
      body.v092a-visual .student-answer small{display:inline-grid;place-items:center;width:28px;height:28px;margin-right:10px;border:1px solid #2de6c44f;border-radius:8px;background:#2de6c40f;color:var(--v092-primary);font-size:11px;vertical-align:middle}
      body.v092a-visual .student-bottom-actions{padding:10px 0 2px}
      body.v092a-visual .student-pass{width:100%;min-height:50px;border-color:#f2a5446b;border-radius:12px;background:#332315;color:#ffd39a;letter-spacing:.1em}
      body.v092a-visual .student-result-flash{background:#07131cf7!important;backdrop-filter:none}
      body.v092a-visual .student-result-flash.correct{background:radial-gradient(circle at 50% 42%,#1e8f68 0,#0c3f35 28%,#07131c 70%)!important}
      body.v092a-visual .student-result-flash.wrong{background:radial-gradient(circle at 50% 42%,#8e3040 0,#3c1923 30%,#07131c 72%)!important}
      body.v092a-visual .student-result-flash.pass{background:radial-gradient(circle at 50% 42%,#8a5a23 0,#382816 30%,#07131c 72%)!important}
      body.v092a-visual .student-result-flash .mark{font-size:94px;filter:drop-shadow(0 12px 22px #0008)}
      body.v092a-visual .student-result-flash b{font-size:32px;letter-spacing:.01em}
      body.v092a-visual .student-result-flash p{color:#d9e4e9}

      /* Results: hierarchy only; award calculations and sequencing are untouched. */
      body.v092a-visual #results .results-hero{padding:22px 0 32px}
      body.v092a-visual #results .results-hero h1{color:var(--v092-text);letter-spacing:-.04em}
      body.v092a-visual #results .podium{padding:24px 20px 0;border-radius:20px;background:linear-gradient(180deg,#101d30aa,#0b1624);border:1px solid var(--v092-line)}
      body.v092a-visual #results .podium-slot{color:#dfe7ec}
      body.v092a-visual #results .podium-slot[data-place="1"]{color:#fff3c5;transform:scale(1.05)}
      body.v092a-visual #results .podium-slot[data-place="1"] .podium-block{background:linear-gradient(#5b4318,#221b0d);box-shadow:0 0 32px #f0b42925}
      body.v092a-visual #results .podium-slot[data-place="2"] .podium-block{border-top-color:var(--v092-rank-2)!important}
      body.v092a-visual #results .podium-slot[data-place="3"] .podium-block{border-top-color:var(--v092-rank-3)!important}
      body.v092a-visual #results .podium-slot[data-place="2"]:after{content:none!important;display:none!important}
      body.v092a-visual #results .award{border-radius:14px;border-color:var(--v092-line);background:linear-gradient(145deg,#132137,#0e1929);box-shadow:none}
      body.v092a-visual #results .award span{color:var(--v092-muted)}
      body.v092a-visual #results .award b{display:block;margin-top:7px;color:var(--v092-text);font-size:15px}
      body.v092a-visual #results .result-table{border-radius:14px;overflow:hidden;border:1px solid var(--v092-line);background:#0c1725}
      body.v092a-visual #results .result-table tr[data-v092a-rank="1"]{background:#f0b42910}
      body.v092a-visual #results .result-table tr[data-v092a-rank="1"] td:first-child{color:var(--v092-gold);font-size:16px;font-weight:950}
      body.v092a-visual .student-finish>.student-title{color:var(--v092-gold)}
      body.v092a-visual .student-stats{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:22px 0}
      body.v092a-visual .student-stat{padding:11px 7px;border-color:var(--v092-line);background:#ffffff05}
      body.v092a-visual .student-stat:nth-child(1){grid-column:1/3;grid-row:1;padding:16px}
      body.v092a-visual .student-stat:nth-child(4){grid-column:3/5;grid-row:1;padding:16px}
      body.v092a-visual .student-stat:nth-child(2){grid-column:1;grid-row:2}
      body.v092a-visual .student-stat:nth-child(3){grid-column:2;grid-row:2}
      body.v092a-visual .student-stat:nth-child(5){grid-column:3;grid-row:2}
      body.v092a-visual .student-stat:nth-child(6){grid-column:4;grid-row:2}
      body.v092a-visual .student-stat:nth-child(1) b,body.v092a-visual .student-stat:nth-child(4) b{font-size:30px}
      body.v092a-visual .student-stat:nth-child(n+2):not(:nth-child(4)) b{font-size:16px}

      @media(max-width:900px){
        body.v092a-visual .ranking-mini{width:188px;right:8px;top:8px}
        body.v092a-visual .ranking-mini .rank-row{min-height:34px;padding:5px 6px}
      }
      @media(max-width:430px){
        body.v092a-visual .student-shell{border:0}
        body.v092a-visual .student-prompt{font-size:28px}
        body.v092a-visual .student-answer{font-size:14.5px}
      }
      @media(max-height:820px) and (max-width:520px){
        body.v092a-visual .student-top{min-height:48px;padding-block:8px 6px}
        body.v092a-visual .student-game-head{padding-block:6px 5px}
        body.v092a-visual .student-question-wrap{padding-top:8px}
        body.v092a-visual .student-prompt{margin:9px 0 12px;font-size:25px}
        body.v092a-visual .student-answer{min-height:61px;padding:10px 12px}
        body.v092a-visual .student-answer small{width:25px;height:25px}
        body.v092a-visual .student-answers{gap:8px}
        body.v092a-visual .student-pass{min-height:46px}
      }
      @media(prefers-reduced-motion:reduce){
        body.v092a-visual .menu-card,body.v092a-visual .btn,body.v092a-visual .student-answer{transition:none!important}
      }
    `;
    document.head.appendChild(V092A_style);

    const V092A_runnerClasses = ['v092a-count-solo', 'v092a-count-small', 'v092a-count-standard', 'v092a-count-full', 'v092a-count-crowded'];
    const V092A_decorate = () => {
      const stage = document.getElementById('raceStage');
      const runners = [...document.querySelectorAll('#runners > .runner-v3')];
      if (stage) {
        stage.classList.remove(...V092A_runnerClasses);
        const countClass = runners.length <= 1 ? V092A_runnerClasses[0]
          : runners.length <= 8 ? V092A_runnerClasses[1]
            : runners.length <= 18 ? V092A_runnerClasses[2]
              : runners.length <= 20 ? V092A_runnerClasses[3] : V092A_runnerClasses[4];
        stage.classList.add(countClass);
        stage.dataset.v092aRunners = String(runners.length);
        const progress = Number(document.getElementById('avgProgress')?.textContent || 0);
        stage.classList.toggle('v092a-starting', progress <= 0 && runners.length > 0);
      }

      document.querySelectorAll('#ranking .rank-row').forEach((row) => {
        const rank = Math.max(1, Number.parseInt(row.style.order || '0', 10) + 1);
        row.dataset.v092aRank = String(rank);
        const playerId = row.dataset.rankPlayer;
        const runner = playerId ? document.querySelector(`#runners [data-runner="${CSS.escape(playerId)}"]`) : null;
        if (runner) runner.dataset.v092aRank = String(rank);
      });

      const podiumPlaces = [2, 1, 3];
      document.querySelectorAll('#podium > .podium-slot').forEach((slot, index) => {
        slot.dataset.place = String(podiumPlaces[index] || index + 1);
      });
      document.querySelectorAll('#resultsBody > tr').forEach((row, index) => {
        row.dataset.v092aRank = String(index + 1);
      });
    };

    let V092A_decorateQueued = false;
    let V092A_observerCallbacks = 0;
    let V092A_observerRecords = 0;
    let V092A_decorateRuns = 0;
    const V092A_queueDecorate = (records = []) => {
      V092A_observerCallbacks += 1;
      V092A_observerRecords += records.length || 0;
      if (V092A_decorateQueued) return;
      V092A_decorateQueued = true;
      requestAnimationFrame(() => {
        V092A_decorateQueued = false;
        V092A_decorateRuns += 1;
        V092A_decorate();
      });
    };
    const V092A_observer = new MutationObserver(V092A_queueDecorate);
    V092A_observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    V092A_decorate();
    window.SUMUS_VISUAL_BUILD = V092A_VISUAL;
    window.SUMUS_VISUAL_AUDIT = {
      observer: () => ({ callbacks: V092A_observerCallbacks, records: V092A_observerRecords, decorateRuns: V092A_decorateRuns })
    };
