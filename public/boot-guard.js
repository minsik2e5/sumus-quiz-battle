// Shows a reload button if the app has not replaced the boot screen within 8s.
// Lives in its own file because the CSP (script-src 'self') blocks inline scripts
// and inline onclick handlers.
window.__SUMUS_BOOT_TIMER__ = setTimeout(function () {
  var app = document.getElementById('app');
  if (!app || !app.querySelector('.boot')) return;
  app.innerHTML = '<div class="boot boot-recovery"><b>SUMUS VOCA</b><span>화면을 불러오지 못했어요.</span><button type="button" id="boot-reload">다시 불러오기</button></div>';
  document.getElementById('boot-reload').addEventListener('click', function () { location.reload(); });
}, 8000);
