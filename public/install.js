// V13.77 설치 안내 (/install): 휴대폰 종류에 맞는 설치 방법, 안드로이드 한 번에 설치, 친구에게
// 보여 줄 QR코드. ?qr=1 은 교실 TV용 큰 QR 화면이에요.
import qrcode from '/vendor/qrcode.mjs';

const $ = s => document.querySelector(s);
const ua = navigator.userAgent;
const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const link = location.origin + '/install';

export function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: 'QR코드: ' + text });
}

if (new URLSearchParams(location.search).get('qr') === '1') {
  document.body.classList.add('tv');
  $('#page').innerHTML = `<div class="tv-qr">${qrSvg(link)}</div><h1>휴대폰 카메라로 찍어 SUMUS VOCA 설치</h1><p>${link.replace(/^https?:\/\//, '')}</p>`;
} else {
  if (standalone) $('#installed').hidden = false;
  const show = tab => {
    for (const b of document.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    for (const p of document.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== tab;
  };
  for (const b of document.querySelectorAll('[data-tab]')) b.onclick = () => show(b.dataset.tab);
  show(ios ? 'ios' : 'android');
  // Safari on iPhone says "Safari" and nothing app-specific (Chrome says CriOS, Kakao KAKAOTALK…).
  if (ios && (/CriOS|FxiOS|EdgiOS|KAKAOTALK|NAVER|Instagram|FBAN|Line\//i.test(ua) || !/Safari/i.test(ua))) $('#ios-not-safari').hidden = false;

  let prompt = null;
  addEventListener('beforeinstallprompt', event => { event.preventDefault(); prompt = event; $('#install-now').hidden = false; });
  addEventListener('appinstalled', () => { $('#install-now').hidden = true; $('#android-done').hidden = false; });
  $('#install-now').onclick = async () => {
    if (!prompt) return;
    prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    prompt = null;
    $('#install-now').hidden = true;
    if (choice?.outcome === 'accepted') $('#android-done').hidden = false;
  };

  $('#qr').innerHTML = qrSvg(link);
  $('#link').textContent = link.replace(/^https?:\/\//, '');
  $('#copy-link').onclick = async () => {
    try { await navigator.clipboard.writeText(link); $('#copy-link').textContent = '복사했어요!'; }
    catch { window.prompt('이 주소를 복사하세요', link); }
  };
  // Installing on Android needs this page to be controlled by the app's service worker.
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
}
