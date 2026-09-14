import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export const hashToken = s => createHash('sha256').update(s).digest('hex');
export async function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, stored = '') {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) { await derive(password, 'invalid-user-timing', 64); return false; }
  const key = await derive(password, salt, 64), target = Buffer.from(expected, 'hex');
  return key.length === target.length && timingSafeEqual(key, target);
}
export const publicProfile = p => {
  const { password_hash, password, ...safe } = p;
  return safe;
};
// Optional existing Supabase Auth integration. A local password is never substituted
// after a configured Supabase sign-in fails. Legacy profiles remain authoritative.
export async function supabaseLogin(username, password) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  const email = username.includes('@') ? username : `${username}@${process.env.AUTH_DOMAIN || 'students.sumus.local'}`;
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Object.assign(new Error('아이디 또는 비밀번호를 확인해주세요.'), { status: 401 });
  const auth = await response.json();
  const r = await fetch(`${url}/rest/v1/profiles?id=eq.${auth.user.id}&select=*`, { headers: { apikey: key, Authorization: `Bearer ${auth.access_token}` }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('계정 프로필을 불러올 수 없습니다.');
  const [profile] = await r.json();
  if (!profile?.active || !['student', 'teacher'].includes(profile.role)) throw Object.assign(new Error('사용할 수 없는 계정입니다.'), { status: 403 });
  return { profile: publicProfile(profile), accessToken: auth.access_token };
}
