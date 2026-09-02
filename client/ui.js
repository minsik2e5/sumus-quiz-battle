    /* Diagnostics, fatal surface, fixed badge, and release-candidate branding. */
    const V091_uiStyle = document.createElement('style');
    V091_uiStyle.textContent = `
      .hero-sub:after{content:"V0.9.1"!important}.qr:after{content:none!important;display:none!important}
      .v091-fatal{position:fixed;inset:18px;z-index:9999;display:grid;place-items:center;background:#170b10f2;border:2px solid #ff6578;border-radius:18px;color:#ffe9ec;padding:24px;text-align:center;font-weight:900}
      .v091-buildtag{position:fixed;left:10px;bottom:9px;z-index:61;font:800 9px/1 ui-monospace,monospace;color:#8cf0c1;background:#06121ae8;border:1px solid #5de4a844;border-radius:7px;padding:6px 9px;pointer-events:none}
    `;
    document.head.appendChild(V091_uiStyle);
    window.addEventListener('error', (event) => {
      if (document.querySelector('.v091-fatal')) return;
      const panel = document.createElement('div');
      panel.className = 'v091-fatal';
      panel.textContent = `게임 초기화 오류가 발생했습니다. 새로고침해 주세요. BUILD ${V091.build} (${event.message || 'unknown'})`;
      document.body.appendChild(panel);
    });
    const V091_previousUpdateUrl = TeacherBridge.updateStudentUrl.bind(TeacherBridge);
    TeacherBridge.updateStudentUrl = function () {
      V091_previousUpdateUrl();
      const badges = [...document.querySelectorAll('.v084-badge')];
      badges.slice(1).forEach((badge) => badge.remove());
      if (badges[0]) badges[0].textContent = `PUBLIC · ${V091.build}`;
    };
    document.querySelector('.v084-buildtag')?.remove();
    const V091_tag = document.createElement('div');
    V091_tag.className = 'v091-buildtag';
    V091_tag.textContent = `${V091.build} · ${String(window.SUMUS_COMMIT || 'dev').slice(0, 7)} · SERVER/WS`;
    document.body.appendChild(V091_tag);
