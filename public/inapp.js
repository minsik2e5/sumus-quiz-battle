// V13.77: 카카오톡·인스타그램 같은 앱 안의 브라우저에서는 앱 설치, 알림, 발음 듣기가 안 돼요.
// 카카오톡은 기본 브라우저로 바로 넘기고, 안드로이드의 다른 앱은 크롬으로 넘깁니다. 넘길 수
// 없는 곳(아이폰의 다른 앱)이나 넘어가지 않았을 때는 "브라우저로 열기" 안내를 보여줘요.
(function () {
  var ua = navigator.userAgent || '';
  var kakao = /KAKAOTALK/i.test(ua);
  var inApp = kakao || /Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|DaumApps|everytimeApp|Whale\/.*inapp|; wv\)/i.test(ua);
  if (!inApp) return;
  var ios = /iPhone|iPad|iPod/i.test(ua), android = /Android/i.test(ua);
  var here = location.href;
  var tried = false;
  try { tried = sessionStorage.getItem('sumus:inapp-escape') === '1'; sessionStorage.setItem('sumus:inapp-escape', '1'); } catch (e) {}
  if (!tried) {
    if (kakao) { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(here); }
    else if (android) { location.href = 'intent://' + here.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(here) + ';end'; }
  }
  function guide() {
    if (document.getElementById('inapp-guide')) return;
    var box = document.createElement('div');
    box.id = 'inapp-guide';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', '브라우저로 열기 안내');
    var where = ios ? '오른쪽 아래 <b>⋯</b> 또는 <b>공유</b> 버튼 → <b>Safari로 열기</b>' : '오른쪽 위 <b>⋮</b> 버튼 → <b>다른 브라우저로 열기</b>(크롬)';
    box.innerHTML = '<div class="inapp-card"><b class="inapp-title">브라우저에서 열어 주세요</b>' +
      '<p>' + (kakao ? '카카오톡' : '이 앱') + ' 안에서는 앱 설치와 알림, 발음 듣기가 안 돼요.</p>' +
      '<p class="inapp-where">' + where + '</p>' +
      '<button type="button" id="inapp-copy">주소 복사하기</button>' +
      '<button type="button" id="inapp-close" class="inapp-quiet">그냥 여기서 볼게요</button></div>';
    box.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:grid;place-items:end center;padding:16px;background:rgba(15,30,25,.55);font-family:system-ui,-apple-system,sans-serif';
    var css = document.createElement('style');
    css.textContent = '#inapp-guide .inapp-card{width:100%;max-width:420px;margin-bottom:env(safe-area-inset-bottom,0);padding:22px 20px 16px;border-radius:22px;background:#fff;color:#16241f;box-shadow:0 18px 40px rgba(0,0,0,.25)}' +
      '#inapp-guide .inapp-title{display:block;font-size:19px;letter-spacing:-.02em;margin-bottom:6px}#inapp-guide p{margin:0 0 10px;font-size:14px;line-height:1.55;color:#51625c}' +
      '#inapp-guide .inapp-where{padding:10px 12px;border-radius:12px;background:#eefaf5;color:#07614a}#inapp-guide button{display:block;width:100%;margin-top:8px;padding:13px;border:0;border-radius:14px;background:#10b981;color:#fff;font-size:15px;font-weight:800}' +
      '#inapp-guide .inapp-quiet{background:none;color:#6c7c77;font-weight:600}';
    document.head.appendChild(css);
    document.body.appendChild(box);
    document.getElementById('inapp-close').onclick = function () { box.remove(); };
    document.getElementById('inapp-copy').onclick = function () {
      var done = function () { document.getElementById('inapp-copy').textContent = '복사했어요! 브라우저 주소창에 붙여 넣으세요'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(here).then(done, function () { prompt('이 주소를 복사하세요', here); });
      else prompt('이 주소를 복사하세요', here);
    };
  }
  // Still here after the hand-off (or no hand-off possible): show how to open it.
  var show = function () { if (document.visibilityState !== 'hidden') guide(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(show, tried ? 0 : 1200); });
  else setTimeout(show, tried ? 0 : 1200);
})();
