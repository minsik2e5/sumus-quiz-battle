    /* V0.8.4 PUBLIC STABLE HOTFIX
       · student link + QR always resolve to the public HTTPS origin (never LAN / localhost / :8720)
       · real scannable QR of the public student URL (replaces the old DEMO QR placeholder)
       · share UI: copy / open / Web Share / enlarge QR
       · build+commit badge and teacher⇄student version mismatch warning
       · WebSocket reconnect on pageshow / visibilitychange (iPhone Safari, in-app browsers)
       Does NOT touch range logic, vocabulary data, or the existing battle relay protocol. */
    const V084 = {
      version: '0.9.1-release-candidate',
      build: 'V0.9.1',
      commit: (typeof window !== 'undefined' && window.SUMUS_COMMIT) ? String(window.SUMUS_COMMIT).slice(0, 7) : 'dev',
      publicOrigin: 'https://sumus-quiz-battle-public-v083.onrender.com'
    };
    try { window.SUMUS_BUILD = { build: V084.build, commit: V084.commit, version: V084.version }; } catch (e) {}

    /* ---- public origin resolution -------------------------------------------------
       On the real public server (https, non-local host) the current origin IS the
       public origin students must use, so we keep it. Only when the teacher page is
       opened locally (file / localhost / LAN IP) do we fall back to the fixed public
       origin, so a student link can never carry a 192.168.x.x / localhost / :port host. */
    const V084_isLocalHost = (h) => {
      if (!h) return true;
      h = String(h).replace(/^\[|\]$/g, '').toLowerCase();
      return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0' ||
        h.endsWith('.local') ||
        /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(h);
    };
    // Production policy: every displayed/shared student link uses this one audited
    // origin. A proxy host, preview domain, LAN address, or local port must not leak.
    const V084_publicOrigin = () => V084.publicOrigin;
    const V084_code = () => (typeof BattleSession !== 'undefined' && BattleSession.code) ? String(BattleSession.code) : '';
    const V084_studentUrl = () => {
      const u = new URL(V084_publicOrigin().replace(/\/+$/, '') + '/');
      u.searchParams.set('role', 'student');
      const c = V084_code();
      if (c) u.searchParams.set('code', c);
      return u.toString();
    };
    const V084_teacherUrl = () => {
      const u = new URL(V084_publicOrigin().replace(/\/+$/, '') + '/');
      u.searchParams.set('role', 'teacher');
      return u.toString();
    };

    /* ---- real QR ------------------------------------------------------------------ */
    const V084_qrSvg = (text, cell, margin) => {
      try {
        if (!window.SUMUS_QR) return '';
        const q = window.SUMUS_QR(0, 'M');
        q.addData(String(text));
        q.make();
        return q.createSvgTag({ cellSize: cell || 5, margin: (margin == null ? 2 : margin), scalable: true });
      } catch (e) { return ''; }
    };

    /* ---- clipboard / share -------------------------------------------------------- */
    const V084_copy = async (text) => {
      try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
      try {
        const t = document.createElement('textarea');
        t.value = text; t.setAttribute('readonly', '');
        t.style.position = 'fixed'; t.style.top = '-1000px'; t.style.opacity = '0';
        document.body.appendChild(t); t.select(); t.setSelectionRange(0, text.length);
        const ok = document.execCommand('copy'); t.remove(); return !!ok;
      } catch (e) { return false; }
    };
    const V084_toast = (msg, kind) => { try { toast(msg, kind); } catch (e) {} };

    /* ---- styles ------------------------------------------------------------------- */
    try {
      const st = document.createElement('style');
      st.textContent = `
        .qr.v084-real{background:#fff!important;padding:8px;display:flex;align-items:center;justify-content:center}
        .qr.v084-real:after{content:none!important;display:none!important}
        .qr.v084-real svg{width:100%;height:100%;display:block}
        .v084-tools{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
        .v084-tools button{min-height:42px;padding:0 13px;border-radius:10px;border:1px solid #5ce0de55;background:#0c3037;color:#a6f6ee;font-weight:900;font-size:12px;cursor:pointer;flex:1 1 auto}
        .v084-tools button.primary{background:#12454b;border-color:#5ce0de88;color:#c9fbf5}
        .v084-tools button:active{transform:translateY(1px)}
        .v084-badge{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:5px 9px;border:1px solid #5de4a844;border-radius:999px;background:#5de4a80c;color:#87efba;font-size:9px;font-weight:950}
        .v084-buildtag{position:fixed;left:10px;bottom:9px;z-index:60;font:700 9px/1 ui-monospace,monospace;letter-spacing:.06em;color:#5f7c88;background:#06121ab8;border:1px solid #ffffff12;border-radius:7px;padding:5px 8px;pointer-events:none;opacity:.72}
        .v084-mismatch{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:120;max-width:min(92vw,520px);padding:11px 15px;border-radius:12px;background:#3a1720;border:1px solid #ff8a97aa;color:#ffd7dc;font-weight:800;font-size:13px;box-shadow:0 16px 44px #0009;text-align:center}
        .v084-mismatch button{margin-left:10px;padding:5px 11px;border-radius:8px;border:0;background:#ff8a97;color:#3a1720;font-weight:950;cursor:pointer}
        .v084-modal{position:fixed;inset:0;z-index:140;display:none;align-items:center;justify-content:center;background:#04101788;backdrop-filter:blur(4px)}
        .v084-modal.open{display:flex}
        .v084-modal-card{background:#fff;border-radius:20px;padding:22px;width:min(88vw,420px);text-align:center;box-shadow:0 30px 80px #000b}
        .v084-modal-card .v084-qrbig{width:min(74vw,340px);height:min(74vw,340px);margin:0 auto 12px}
        .v084-modal-card .v084-qrbig svg{width:100%;height:100%}
        .v084-modal-card code{display:block;word-break:break-all;font-size:11px;color:#0b2830;margin:4px 0 14px}
        .v084-modal-card .v084-close{min-height:46px;width:100%;border:0;border-radius:12px;background:#0d2b31;color:#bff6ef;font-weight:950;font-size:15px;cursor:pointer}
        .v084-kakao{margin:10px 0;padding:11px 13px;border:1px solid #f2d16b66;border-radius:12px;background:#221d0a;color:#f6e2a1;font-size:12px;font-weight:700;line-height:1.5}
        .v084-kakao button{margin-top:8px;width:100%;min-height:44px;border:0;border-radius:10px;background:#f2d16b;color:#221d0a;font-weight:950;cursor:pointer}
        @media(max-width:520px){.v084-tools button{flex:1 1 100%}}
      `;
      document.head.appendChild(st);
    } catch (e) {}

    /* ---- large-QR modal ----------------------------------------------------------- */
    const V084_ensureModal = () => {
      let m = document.getElementById('v084Modal');
      if (m) return m;
      m = document.createElement('div');
      m.id = 'v084Modal'; m.className = 'v084-modal';
      m.innerHTML = `<div class="v084-modal-card"><div class="v084-qrbig" id="v084QrBig"></div><code id="v084QrUrl"></code><button class="v084-close" type="button">닫기</button></div>`;
      document.body.appendChild(m);
      m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('.v084-close')) m.classList.remove('open'); });
      return m;
    };
    const V084_showBigQr = () => {
      const url = V084_studentUrl();
      const m = V084_ensureModal();
      const big = m.querySelector('#v084QrBig'), code = m.querySelector('#v084QrUrl');
      if (big) big.innerHTML = V084_qrSvg(url, 8, 2);
      if (code) code.textContent = url;
      m.classList.add('open');
    };

    /* ---- teacher access UI (code panel) ------------------------------------------- */
    const V084_renderAccessUI = () => {
      if (typeof AppRole !== 'undefined' && AppRole !== 'teacher') return;
      const label = document.getElementById('studentUrlLabel');
      if (!label) return;
      const url = V084_studentUrl();
      label.textContent = url;

      // real QR into the old placeholder
      const qr = document.querySelector('.qr');
      if (qr) {
        const svg = V084_qrSvg(url, 4, 2);
        if (svg) { qr.classList.add('v084-real'); qr.innerHTML = svg; qr.title = url; }
      }

      // network label
      const netLabel = document.getElementById('networkModeLabel');
      if (netLabel) netLabel.textContent = '학생 인터넷 접속 · Wi-Fi/LTE/5G 모두 가능';

      // tools row (idempotent) — replaces any earlier tool rows we own
      const host = label.parentElement || label;
      document.querySelectorAll('.v084-tools, .v082-access-row').forEach((n) => n.remove());
      const row = document.createElement('div');
      row.className = 'v084-tools';
      const canShare = typeof navigator !== 'undefined' && !!navigator.share;
      row.innerHTML =
        `<button type="button" class="primary" data-v084="copy">학생 링크 복사</button>` +
        `<button type="button" data-v084="open">학생 링크 열기</button>` +
        `<button type="button" data-v084="qr">QR 크게 보기</button>` +
        (canShare ? `<button type="button" data-v084="share">공유</button>` : '');
      host.appendChild(row);

      const badge = document.createElement('div');
      badge.className = 'v084-badge';
      badge.textContent = `PUBLIC · ${V084.build}`;
      row.after(badge);

      row.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-v084]'); if (!b) return;
        const action = b.dataset.v084;
        const link = V084_studentUrl();
        if (action === 'copy') {
          const ok = await V084_copy(link);
          if (ok) { const o = b.textContent; b.textContent = '복사 완료 ✓'; V084_toast('학생 링크를 복사했습니다.'); setTimeout(() => (b.textContent = o), 1400); }
          else V084_toast('링크를 길게 눌러 복사해 주세요.', 'warn');
        } else if (action === 'open') {
          window.open(link, '_blank', 'noopener');
        } else if (action === 'qr') {
          V084_showBigQr();
        } else if (action === 'share') {
          try { await navigator.share({ title: 'SUMUS QUIZ BATTLE', text: `배틀 코드 ${V084_code()} · 아래 링크로 접속하세요`, url: link }); }
          catch (err) { if (!/abort/i.test(String(err && err.name))) { const ok = await V084_copy(link); if (ok) V084_toast('공유를 사용할 수 없어 링크를 복사했습니다.'); } }
        }
      });
    };

    /* chain after any earlier updateStudentUrl override (v082) */
    if (typeof TeacherBridge !== 'undefined' && TeacherBridge.updateStudentUrl) {
      const V084_prevUpdate = TeacherBridge.updateStudentUrl.bind(TeacherBridge);
      TeacherBridge.updateStudentUrl = function () {
        try { V084_prevUpdate(); } catch (e) {}
        V084_renderAccessUI();
      };
    }

    /* ---- build badge + version mismatch ------------------------------------------- */
    try {
      const tag = document.createElement('div');
      tag.className = 'v084-buildtag';
      tag.textContent = `${V084.build} · ${V084.commit}`;
      const put = () => { if (!document.body.contains(tag)) document.body.appendChild(tag); };
      if (document.body) put(); else window.addEventListener('DOMContentLoaded', put);
    } catch (e) {}

    // teacher: publish our build inside the battle snapshot
    if (typeof battleSnapshot === 'function') {
      const V084_prevSnapshot = battleSnapshot;
      battleSnapshot = function (targetClientId = '') {
        const snap = V084_prevSnapshot(targetClientId);
        const p = (snap && snap.payload) ? snap.payload : snap;
        if (p) { p.build = V084.build; p.commit = V084.commit; }
        return snap;
      };
    }

    // student: compare received build with our own
    let V084_mismatchShown = false;
    const V084_checkBuild = (snap) => {
      if (typeof AppRole !== 'undefined' && AppRole !== 'student') return;
      const b = snap && snap.build;
      if (!b || b === V084.build || V084_mismatchShown) return;
      V084_mismatchShown = true;
      try {
        const bar = document.createElement('div');
        bar.className = 'v084-mismatch';
        bar.innerHTML = `교사와 학생 버전이 다릅니다 (교사 ${b} · 학생 ${V084.build}).<button type="button">새로고침</button>`;
        bar.querySelector('button').addEventListener('click', () => location.reload());
        document.body.appendChild(bar);
      } catch (e) {}
    };
    if (typeof StudentApp !== 'undefined' && StudentApp.handle) {
      const V084_prevStudentHandle = StudentApp.handle;
      StudentApp.handle = function (message) {
        const r = V084_prevStudentHandle.call(this, message);
        try {
          const p = (message && message.payload) || {};
          if (p.build) V084_checkBuild(p);
          else if (StudentSession && StudentSession.snapshot) V084_checkBuild(StudentSession.snapshot);
        } catch (e) {}
        return r;
      };
    }

    /* ---- reconnect on resume (iPhone Safari / in-app browsers) --------------------- */
    const V084_reconnect = () => {
      try {
        if (typeof LocalTransport === 'undefined') return;
        if (typeof LocalTransport.useWebSocket === 'function' && LocalTransport.useWebSocket() === false) return;
        const s = LocalTransport.socket;
        if (!s || s.readyState === 2 /*CLOSING*/ || s.readyState === 3 /*CLOSED*/) LocalTransport.connect();
      } catch (e) {}
    };
    window.addEventListener('pageshow', () => setTimeout(() => { V084_reconnect(); V084_renderAccessUI(); }, 0));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') V084_reconnect(); });

    /* ---- in-app browser (KakaoTalk) hint for students ----------------------------- */
    try {
      const ua = navigator.userAgent || '';
      const inApp = /KAKAOTALK/i.test(ua);
      if (inApp && typeof AppRole !== 'undefined' && AppRole === 'student') {
        const showHint = () => {
          if (document.querySelector('.v084-kakao')) return;
          const enter = document.querySelector('.student-view');
          if (!enter) return;
          const box = document.createElement('div');
          box.className = 'v084-kakao';
          const target = location.href;
          box.innerHTML = `카카오톡 안에서는 일부 기능이 제한될 수 있어요.<br>문제가 있으면 오른쪽 아래 메뉴로 <b>Safari/Chrome에서 열기</b>를 눌러 주세요.<button type="button">기본 브라우저로 열기</button>`;
          box.querySelector('button').addEventListener('click', () => {
            if (/iphone|ipad|ipod/i.test(ua)) location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(target);
            else location.href = 'intent:' + target.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end';
          });
          enter.prepend(box);
        };
        window.addEventListener('DOMContentLoaded', showHint);
        setTimeout(showHint, 400);
      }
    } catch (e) {}

    /* first paint for teacher */
    try { V084_renderAccessUI(); } catch (e) {}
    window.SUMUS_V084 = V084;
