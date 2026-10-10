// V13.77 Web Push (알림) without any outside service or secret to set up:
// - the VAPID key pair is made once by the server and kept in the state (state.push.vapid);
// - each message is encrypted for the phone (RFC 8291, aes128gcm) and signed (RFC 8292, ES256);
// - the phone's push service (Google, Apple, Mozilla) delivers it.
// Uses only WebCrypto, so it runs the same on Cloudflare Workers and Node.

const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();

export const b64u = bytes => {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const unb64u = text => {
  const s = String(text || '').replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
};
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};
async function hkdf(salt, ikm, info, length) {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

// { public_key: base64url raw P-256 point (the browser's applicationServerKey), private_jwk }
export async function createVapidKeys() {
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return {
    public_key: b64u(await subtle.exportKey('raw', pair.publicKey)),
    private_jwk: await subtle.exportKey('jwk', pair.privateKey),
    created_at: Date.now()
  };
}

// RFC 8292: "vapid t=<JWT>, k=<public key>" for the push service of this endpoint.
export async function vapidHeader(endpoint, vapid, subject, now = Date.now()) {
  const header = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const key = await subtle.importKey('jwk', vapid.private_jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64u(signature)}, k=${vapid.public_key}`;
}

// RFC 8291 (aes128gcm, one record): the body only this subscription can read.
export async function encryptPayload(text, subscription) {
  const uaPublic = unb64u(subscription.keys.p256dh);
  const authSecret = unb64u(subscription.keys.auth);
  const local = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await subtle.exportKey('raw', local.publicKey));
  const peer = await subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: peer }, local.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(te.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const aes = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(te.encode(text), new Uint8Array([2]))));
  const head = new Uint8Array(21);
  head.set(salt, 0);
  new DataView(head.buffer).setUint32(16, 4096);
  head[20] = asPublic.length;
  return concat(head, asPublic, cipher);
}

export const PUSH_TTL_SEC = 12 * 3600;
// One message to one subscription. Returns { ok, gone, status }; gone = the phone unsubscribed
// (404/410), so the server forgets it.
export async function sendPush(subscription, message, vapid, { subject, fetchImpl = fetch, ttl = PUSH_TTL_SEC } = {}) {
  const body = await encryptPayload(JSON.stringify(message), subscription);
  const headers = {
    Authorization: await vapidHeader(subscription.endpoint, vapid, subject),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(ttl),
    Urgency: message.urgent ? 'high' : 'normal'
  };
  // A topic replaces an older message with the same topic still waiting on the push service.
  if (message.tag && /^[A-Za-z0-9_-]{1,32}$/.test(message.tag)) headers.Topic = message.tag;
  try {
    // V13.129: 응답이 없는 푸시 서버 하나가 묶음 보내기와 저녁 알림을 붙잡지 않게 8초에서 끊는다.
    const res = await fetchImpl(subscription.endpoint, { method: 'POST', headers, body, signal: AbortSignal.timeout(8000) });
    return { ok: res.status >= 200 && res.status < 300, gone: res.status === 404 || res.status === 410, status: res.status };
  } catch (error) {
    return { ok: false, gone: false, status: 0, error: error?.message };
  }
}

// Only the push services browsers really use, so a stored "subscription" can never make the
// server call an arbitrary address.
const PUSH_HOSTS = /^(?:fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com|push\.services\.mozilla\.com)$/i;
export function cleanSubscription(raw) {
  const endpoint = String(raw?.endpoint || '');
  let url;
  try { url = new URL(endpoint); } catch { return null; }
  if (url.protocol !== 'https:' || !PUSH_HOSTS.test(url.hostname) || endpoint.length > 1000) return null;
  const p256dh = String(raw?.keys?.p256dh || ''), auth = String(raw?.keys?.auth || '');
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) return null;
  return { endpoint, keys: { p256dh, auth } };
}
