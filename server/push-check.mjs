// Release checks for V13.77: installing the app (PNG icons, manifest, the /install guide, the
// in-app browser hand-off) and 알림 (web push: keys, encryption, routes, evening reminders).
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service, runEveningReminders } from './service.mjs';
import { DAY_MS } from './competition.mjs';
import { dayKey } from '../public/modules/core.js';
import { createVapidKeys, vapidHeader, encryptPayload, sendPush, cleanSubscription, b64u, unb64u } from './push.mjs';
import { dropEndpoints, NOTICE_MAX } from './notify.mjs';

const file = path => fileURLToPath(new URL(path, import.meta.url));
const source = path => readFileSync(file(path), 'utf8');
const subtle = globalThis.crypto.subtle;
const te = new TextEncoder(), td = new TextDecoder();
const pngSize = path => { const b = readFileSync(file(path)); return b.toString('ascii', 1, 4) === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };

async function hkdf(salt, ikm, info, length) {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}
// What the phone does (RFC 8291) — decrypting proves the server encrypted it for this phone.
async function decryptAsPhone(body, phone) {
  const salt = body.slice(0, 16), rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0), idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen), cipher = body.slice(21 + idlen);
  const peer = await subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: peer }, phone.privateKey, 256));
  const info = new Uint8Array([...te.encode('WebPush: info\0'), ...phone.publicRaw, ...asPublic]);
  const ikm = await hkdf(phone.auth, shared, info, 32);
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const aes = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, cipher));
  return { rs, idlen, text: td.decode(plain.slice(0, plain.lastIndexOf(2))), delimiter: plain.at(-1) };
}
async function fakePhone(host = 'fcm.googleapis.com') {
  const pair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publicRaw = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const id = b64u(crypto.getRandomValues(new Uint8Array(12)));
  return { privateKey: pair.privateKey, publicRaw, auth, subscription: { endpoint: `https://${host}/fcm/send/${id}`, keys: { p256dh: b64u(publicRaw), auth: b64u(auth) } } };
}

export async function runPushChecks(assert, expectStatus) {
  /* ---------- crypto ---------- */
  const vapid = await createVapidKeys();
  assert(unb64u(vapid.public_key).length === 65 && unb64u(vapid.public_key)[0] === 4 && vapid.private_jwk.d, 'V13.77 the server makes its own VAPID key pair (no key to set up)');
  const phone = await fakePhone();
  const auth = await vapidHeader(phone.subscription.endpoint, vapid, 'https://sumus.example');
  const [, jwt, k] = auth.match(/^vapid t=([^,]+), k=(.+)$/) || [];
  const [h, c, sig] = jwt.split('.');
  const claims = JSON.parse(td.decode(unb64u(c)));
  const verifyKey = await subtle.importKey('raw', unb64u(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const valid = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifyKey, unb64u(sig), te.encode(`${h}.${c}`));
  assert(valid && k === vapid.public_key && claims.aud === 'https://fcm.googleapis.com' && claims.sub === 'https://sumus.example' && claims.exp * 1000 > Date.now() && claims.exp * 1000 <= Date.now() + 24 * 3600000, 'V13.77 the VAPID signature (ES256) verifies with the public key, for the push service of the phone');
  const message = { title: '📢 공지', body: '내일 단어 시험! 오늘 20개만 연습해요 💪', url: '/?go=home' };
  const body = await encryptPayload(JSON.stringify(message), phone.subscription);
  const opened = await decryptAsPhone(body, phone);
  assert(opened.rs === 4096 && opened.idlen === 65 && opened.delimiter === 2 && JSON.parse(opened.text).body === message.body, 'V13.77 the message is encrypted so only that phone can read it (RFC 8291 aes128gcm, Korean and emoji intact)');
  const other = await fakePhone();
  const wrong = await decryptAsPhone(body, other).then(() => false, () => true);
  assert(wrong, 'V13.77 another phone cannot read it');
  const calls = [];
  const fetchOk = async (url, init) => { calls.push({ url, init }); return { status: 201 }; };
  const okSend = await sendPush(phone.subscription, { ...message, tag: 'notice' }, vapid, { subject: 'https://sumus.example', fetchImpl: fetchOk });
  const sentHeaders = calls[0]?.init.headers || {};
  assert(okSend.ok && calls[0].url === phone.subscription.endpoint && sentHeaders['Content-Encoding'] === 'aes128gcm' && sentHeaders.TTL && sentHeaders.Topic === 'notice' && sentHeaders.Authorization.startsWith('vapid t='), 'V13.77 a push goes to the phone\'s push service with the standard headers');
  const goneSend = await sendPush(phone.subscription, message, vapid, { subject: 'https://sumus.example', fetchImpl: async () => ({ status: 410 }) });
  const downSend = await sendPush(phone.subscription, message, vapid, { subject: 'https://sumus.example', fetchImpl: async () => { throw new Error('offline'); } });
  assert(goneSend.gone && !goneSend.ok && !downSend.gone && !downSend.ok, 'V13.77 a phone that left (410) is marked gone; a network error is not');
  const apple = await fakePhone('web.push.apple.com');
  assert(cleanSubscription(phone.subscription) && cleanSubscription(apple.subscription) && !cleanSubscription({ ...phone.subscription, endpoint: 'https://evil.example/push' }) && !cleanSubscription({ ...phone.subscription, endpoint: 'http://fcm.googleapis.com/x' }) && !cleanSubscription({ endpoint: phone.subscription.endpoint, keys: { p256dh: 'x', auth: 'y' } }), 'V13.77 only real push services (Google, Apple, Mozilla, Microsoft) are accepted, so the server never calls another address');

  /* ---------- routes ---------- */
  const now = Date.now();
  const state = emptyState();
  const hash = await passwordHash('QaPush1!');
  const student = (id, name, cls = '고1A') => ({ id, username: id, display_name: name, role: 'student', active: true, class_name: cls, school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 9 * DAY_MS }], avatar_key: 'dog', created_at: now - 9 * DAY_MS });
  state.profiles.push(
    { id: 'qa-pu-teacher', username: 'qa_pu_teacher', display_name: '알림 선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['danwon-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'danwon-high', created_at: now - 9 * DAY_MS },
    student('qa-pu-a', '가온'), student('qa-pu-b', '나래'), student('qa-pu-c', '다온', '고1B')
  );
  const login = async username => (await service(state, 'POST', '/login', { username, password: 'QaPush1!', division: 'high', role: username.includes('teacher') ? 'teacher' : undefined }, null))._cookie;
  const t = {};
  for (const id of ['qa_pu_teacher', 'qa-pu-a', 'qa-pu-b', 'qa-pu-c']) t[id] = await login(id);
  const before = await service(state, 'GET', '/bootstrap', {}, t['qa-pu-a']);
  assert(before.push?.on === false && before.push.daily === true && before.notice === null, 'V13.77 알림 starts off; the evening reminder is on once 알림 is turned on');
  await expectStatus(409, () => service(state, 'POST', '/push/subscribe', { subscription: phone.subscription }, t['qa-pu-a']), 'V13.77 subscribing needs the server key first');
  await service(state, 'GET', '/push/key', {}, t['qa-pu-a']).catch(() => null);
  assert(!state.push?.vapid, 'V13.77 the key is never made by a GET (GET changes are not saved)');
  const key1 = await service(state, 'POST', '/push/key', {}, t['qa-pu-a']);
  const key2 = await service(state, 'POST', '/push/key', {}, t['qa-pu-b']);
  assert(key1.key === key2.key && state.push.vapid.public_key === key1.key, 'V13.77 one key pair for the whole app, made once');
  const subA = await service(state, 'POST', '/push/subscribe', { subscription: phone.subscription, origin: 'https://evil.example', device: 'Android' }, t['qa-pu-a'], { origin: 'https://sumus.example' });
  assert(subA.push.on && subA._push?.[0]?.to?.[0] === 'qa-pu-a' && subA._push[0].title.includes('알림이 켜졌어요') && state.push.subject === 'https://sumus.example', 'V13.77 turning 알림 on stores the phone and sends a hello');
  await expectStatus(400, () => service(state, 'POST', '/push/subscribe', { subscription: { ...phone.subscription, endpoint: 'https://evil.example/x' } }, t['qa-pu-a']), 'V13.77 a made-up push address is refused');
  const quiet = await service(state, 'POST', '/push/subscribe', { subscription: phone.subscription, quiet: true }, t['qa-pu-a']);
  assert(!quiet._push && state.push.subs['qa-pu-a'].length === 1, 'V13.77 the same phone registering again is quiet and not doubled');
  await service(state, 'POST', '/push/subscribe', { subscription: phone.subscription, quiet: true }, t['qa-pu-b']);
  assert(!state.push.subs['qa-pu-a'] && state.push.subs['qa-pu-b'].length === 1, 'V13.77 a shared phone belongs to whoever turned 알림 on last');
  await service(state, 'POST', '/push/subscribe', { subscription: phone.subscription, quiet: true }, t['qa-pu-a']);
  const phoneB = await fakePhone('web.push.apple.com');
  await service(state, 'POST', '/push/subscribe', { subscription: phoneB.subscription, quiet: true }, t['qa-pu-b']);
  await expectStatus(403, () => service(state, 'POST', '/push/subscribe', { subscription: phone.subscription }, t.qa_pu_teacher), 'V13.77 알림 are for students');
  const off = await service(state, 'POST', '/push/settings', { daily: false }, t['qa-pu-b']);
  assert(off.push.daily === false && off.push.on, 'V13.77 the evening reminder can be turned off alone');
  await service(state, 'POST', '/push/settings', { daily: true }, t['qa-pu-b']);

  // 선생님 공지
  await expectStatus(400, () => service(state, 'POST', '/teacher/notice', { text: '   ' }, t.qa_pu_teacher), 'V13.77 an empty notice is refused');
  await expectStatus(403, () => service(state, 'POST', '/teacher/notice', { text: '안녕' }, t['qa-pu-a']), 'V13.77 only teachers post notices');
  const notice = await service(state, 'POST', '/teacher/notice', { text: '내일 단어 시험 24번까지!'.padEnd(120, '!'), class_name: '고1A' }, t.qa_pu_teacher);
  assert(notice.total === 2 && notice.reach === 2 && notice._push[0].to.sort().join() === 'qa-pu-a,qa-pu-b' && notice.notice.text.length === NOTICE_MAX, 'V13.77 a notice to 고1A reaches its students\' phones (80 characters)');
  const aBoot = await service(state, 'GET', '/bootstrap', {}, t['qa-pu-a']), cBoot = await service(state, 'GET', '/bootstrap', {}, t['qa-pu-c']);
  const tBoot = await service(state, 'GET', '/bootstrap', {}, t.qa_pu_teacher);
  assert(aBoot.notice?.id === notice.notice.id && cBoot.notice === null && tBoot.push_reach === 2 && tBoot.notices_sent?.[0]?.id === notice.notice.id, 'V13.77 the notice shows on the class\'s home screen (not other classes), and the teacher sees how many get 알림');
  state.push.notices.at(-1).at = now - 4 * DAY_MS;
  assert((await service(state, 'GET', '/bootstrap', {}, t['qa-pu-a'])).notice === null, 'V13.77 a notice leaves the home screen after 3 days');
  const allNotice = await service(state, 'POST', '/teacher/notice', { text: '전체 공지' }, t.qa_pu_teacher);
  assert(allNotice.total === 3 && allNotice.reach === 2, 'V13.77 a notice without a class goes to the whole school');

  // Gift and challenge buzz the phones too.
  const gift = await service(state, 'POST', '/teacher/gifts', { amount: 10, student_ids: ['qa-pu-a'], note: '최고!' }, t.qa_pu_teacher);
  assert(gift._push?.[0]?.to?.join() === 'qa-pu-a' && gift._push[0].title.includes('선물'), 'V13.77 a gift sends a notification');
  const svc = source('./service.mjs');
  assert(svc.includes("title: `⚔️ ${p.display_name}의 도전장!`") && svc.includes("url: '/?go=yacha', tag: 'challenge', urgent: true"), 'V13.77 a 도전장 sends a notification to the friend');

  // 저녁 공부 알림
  const reminders = runEveningReminders(state, now);
  assert(reminders.length === 2 && reminders.every(m => m.url === '/?go=practice' && m.tag === 'daily') && reminders.some(m => m.to[0] === 'qa-pu-a' && m.title.includes('몽이가')), 'V13.77 students with 알림 on who have not studied today get one evening reminder');
  assert(runEveningReminders(state, now).length === 0, 'V13.77 only once a day');
  state.push.reminded = {};
  state.sessions.push({ id: 'qa-pu-s1', student_id: 'qa-pu-a', created_at: now, total: 10, correct: 9, mode: 'eng2mean', run_mode: 'practice', school_id: 'danwon-high', school: '단원고', division: 'high' });
  await service(state, 'POST', '/push/settings', { daily: false }, t['qa-pu-b']);
  assert(runEveningReminders(state, now).length === 0, 'V13.77 no reminder after studying today, or with the evening reminder off');
  state.push.reminded = { 'qa-pu-a': dayKey(now - DAY_MS) };
  runEveningReminders(state, now);
  assert(!state.push.reminded['qa-pu-a'], 'V13.77 old reminder days are cleaned up');
  // Phones that left
  assert(dropEndpoints(state, [phone.subscription.endpoint]) && !state.push.subs['qa-pu-a'] && state.push.subs['qa-pu-b'].length === 1 && !dropEndpoints(state, ['https://none']), 'V13.77 a phone the push service says is gone is forgotten');
  await service(state, 'POST', '/push/unsubscribe', { endpoint: phoneB.subscription.endpoint }, t['qa-pu-b']);
  assert(!state.push.subs['qa-pu-b'], 'V13.77 turning 알림 off on a phone forgets it');
  const profileJson = JSON.stringify((await service(state, 'GET', '/bootstrap', {}, t['qa-pu-a'])).profile) + JSON.stringify(tBoot.profiles);
  assert(!profileJson.includes('p256dh') && !JSON.stringify(aBoot).includes('private_jwk'), 'V13.77 phone keys and the server key never reach the browser');

  /* ---------- Cloudflare wiring ---------- */
  const worker = source('../cloudflare/worker.mjs'), wrangler = source('../wrangler.jsonc'), node = source('./index.mjs');
  assert(worker.includes('delete result._push') && worker.includes('this.ctx.waitUntil(this.deliverPush(pushMessages, url.origin)') && worker.includes('dropEndpoints(state, gone)') && worker.includes('async scheduled(controller, env, ctx)') && worker.includes("'/api/internal/evening-push'") && worker.includes('await eveningPushKey(this.env)') && /"crons":\s*\["0 10 \* \* \*"\]/.test(wrangler) && node.includes('delete result._push'), 'V13.77 pushes go out after the save; the daily cron at 19:00 KST sends the evening reminders; _push never reaches a browser');

  /* ---------- install ---------- */
  const manifest = JSON.parse(source('../public/manifest.webmanifest'));
  const icons = manifest.icons.map(i => [i.src, i.sizes, i.purpose, pngSize('../public' + i.src)]);
  assert(manifest.id === '/' && manifest.display === 'standalone' && icons.length === 4 && icons.every(([, sizes, , size]) => size && `${size[0]}x${size[1]}` === sizes) && icons.some(([, , purpose]) => purpose === 'maskable') && manifest.shortcuts?.some(s => s.url === '/?go=yacha'), 'V13.77 the manifest has real PNG icons (192/512, maskable) and shortcuts');
  const index = source('../public/index.html'), install = source('../public/install.html'), installJs = source('../public/install.js'), inapp = source('../public/inapp.js'), sw = source('../public/sw.js');
  assert(index.includes('<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">') && pngSize('../public/icons/apple-touch-icon-180.png')?.[0] === 180 && pngSize('../public/icons/badge-96.png')?.[0] === 96, 'V13.77 iPhone gets a PNG home-screen icon (it cannot use SVG)');
  assert(index.indexOf('/inapp.js') < index.indexOf('/app.js') && install.includes('/inapp.js') && inapp.includes('kakaotalk://web/openExternal?url=') && inapp.includes('package=com.android.chrome') && inapp.includes("sessionStorage.getItem('sumus:inapp-escape')") && inapp.includes('Safari로 열기'), 'V13.77 KakaoTalk and other in-app browsers hand the page to the real browser once, or show how');
  assert(!/<script>(?!<\/script>)/.test(install) && !/<script(?![^>]*\bsrc=)[^>]*>/.test(install) && install.includes('rel="manifest"') && installJs.includes("from '/vendor/qrcode.mjs'") && installJs.includes("get('qr') === '1'") && installJs.includes('beforeinstallprompt') && existsSync(file('../public/vendor/qrcode.mjs')), 'V13.77 /install: steps per phone, one-tap install on Android, a QR code (and a TV view) — no inline script (CSP)');
  assert(sw.includes("url.pathname === '/install'") && sw.includes("addEventListener('push'") && sw.includes("addEventListener('notificationclick'") && sw.includes("badge: '/icons/badge-96.png'") && sw.includes("type: 'sumus-open'"), 'V13.77 the service worker shows notifications, opens the app on the right tab, and leaves /install alone');
  const app = source('../public/app.js'), studentUi = source('../public/modules/student.js'), teacher = source('../public/modules/teacher.js'), pwa = source('../public/pwa.js'), build = source('./build-assets.mjs'), css = source('../public/v1377.css');
  assert(app.includes('async function enablePush(b)') && app.includes("await Notification.requestPermission()") && app.includes("api('/push/subscribe'") && app.includes('function noticeModal()') && app.includes("new URLSearchParams(location.search).get('go')") && app.includes('function checkPushHere()'), 'V13.77 the app turns 알림 on (asking once), posts notices and opens /?go= links');
  assert(studentUi.includes('function meNotify(A)') && studentUi.includes('function noticeBanner(A)') && studentUi.includes('function pushPrompt(A)') && studentUi.includes('needsInstall') && teacher.includes('data-action="notice"') && teacher.includes('data-action="install-qr"') && pwa.includes("location.href = '/install'"), 'V13.77 나 has 알림 settings (iPhone: install first), home shows the notice, the teacher has 공지 and the install QR');
  assert(build.includes('"v1377.css"') && css.includes('.notice-v1377') && css.includes('.me-notify-v1377') && build.includes('install\\.html|vendor\\/.+|icons\\/.+\\.png'), 'V13.77 styles bundled; the install page, QR library and icons load on demand');
}
