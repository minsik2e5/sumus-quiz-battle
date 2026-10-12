import { randomUUID, randomInt } from 'node:crypto';
import { passwordHash } from './auth.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const str = (value, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export const CLASS_BY_DIVISION = { middle: ['중2', '중3'], high: ['고1A', '고1B'] };

// V13.141 반별 가입 코드. 학생은 코드를 넣어야만 가입할 수 있고, 코드가 학교·반을 정한다.
// 코드는 state.signupCodes에만 있고 서버에서만 비교한다(학생·가입 화면 응답에는 나가지 않는다).
// 헷갈리는 글자(0·O·1·I·L)는 뺐다.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const SIGNUP_CODE_LENGTH = 6;
export const SIGNUP_CODE_MESSAGE = '가입 코드를 확인해 주세요.';
export const SIGNUP_CODE_FAIL_MAX = 20;
export const SIGNUP_CODE_FAIL_WINDOW_MS = 30 * 60000;
export const normalizeSignupCode = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
const schoolClasses = school => CLASS_BY_DIVISION[school?.division] || [];

export function newSignupCode(state) {
  const used = new Set((state.signupCodes || []).map(item => item.code));
  for (;;) {
    const code = Array.from({ length: SIGNUP_CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    if (!used.has(code)) return code;
  }
}

// 처음 배포 때(state에 signupCodes가 없을 때) 기존 반마다 켜진 코드를 하나씩 만들어 둔다.
// 선생님이 학생 관리 화면에서 보고 나눠 준다.
export function seedSignupCodes(state, now = Date.now()) {
  state.signupCodes = [];
  for (const school of state.schools || []) {
    if (school.active === false) continue;
    for (const className of schoolClasses(school)) {
      state.signupCodes.push({ school_id: school.id, class_name: className, code: newSignupCode(state), active: true, created_at: now, updated_at: now });
    }
  }
  return state.signupCodes;
}

// 선생님 화면용: 맡은 학교의 반마다 한 줄(코드가 아직 없는 반도 보여 준다).
export function signupCodeRows(state, schools) {
  return schools.flatMap(school => schoolClasses(school).map(className => {
    const entry = (state.signupCodes || []).find(item => item.school_id === school.id && item.class_name === className);
    return { school_id: school.id, school: school.name, class_name: className, code: entry?.code || '', active: Boolean(entry?.code && entry.active), updated_at: entry?.updated_at || null };
  }));
}

// 선생님: 새 코드 만들기(옛 코드는 바로 못 쓴다) 또는 켜기/끄기.
export function updateSignupCode(state, school, className, { regenerate = false, active } = {}) {
  if (!schoolClasses(school).includes(className)) fail('반을 확인해 주세요.');
  if (!Array.isArray(state.signupCodes)) state.signupCodes = [];
  let entry = state.signupCodes.find(item => item.school_id === school.id && item.class_name === className);
  const now = Date.now();
  if (!entry) {
    if (!regenerate) fail('먼저 새 코드를 만들어 주세요.', 409);
    entry = { school_id: school.id, class_name: className, code: '', active: true, created_at: now, updated_at: now };
    state.signupCodes.push(entry);
  }
  if (regenerate) { entry.code = newSignupCode(state); entry.active = true; }
  if (typeof active === 'boolean') entry.active = active;
  entry.updated_at = now;
  return signupCodeRows(state, [school]).find(row => row.class_name === className);
}

// 코드가 맞고 켜져 있고 학교도 쓰는 중일 때만 학교·반을 돌려준다. 아니면 모두 같은 문구.
export function resolveSignupCode(state, rawCode) {
  const code = normalizeSignupCode(rawCode);
  const entry = code.length === SIGNUP_CODE_LENGTH ? (state.signupCodes || []).find(item => item.code === code) : null;
  const school = entry?.active ? state.schools.find(item => item.id === entry.school_id && item.active !== false) : null;
  if (!school || !schoolClasses(school).includes(entry.class_name)) throw Object.assign(new Error(SIGNUP_CODE_MESSAGE), { status: 400, signupCode: true });
  return { school, class_name: entry.class_name };
}

// 가입 화면의 "확인": 학교 이름과 반만 알려 준다(코드나 다른 반 정보는 보내지 않는다).
export function checkSignupCode(state, body) {
  if (process.env.DISABLE_SELF_SIGNUP === 'true') fail('현재는 학생 회원가입을 받지 않고 있어요.', 403);
  const { school, class_name } = resolveSignupCode(state, body?.code);
  return { ok: true, school: school.name, class_name, division: school.division };
}

// 틀린 가입 코드는 같은 기기(주소)에서 30분에 20번까지. 맞은 시도는 세지 않는다.
// rates는 서버의 요청 제한 표(Map: 이름 → 시각 목록)다. 돌려준 함수에 오류를 넘기면 틀린 코드만 센다.
export function signupCodeGuard(rates, address) {
  const key = `${address}:signup-code`;
  const list = (rates.get(key) || []).filter(time => time > Date.now() - SIGNUP_CODE_FAIL_WINDOW_MS);
  if (list.length >= SIGNUP_CODE_FAIL_MAX) throw Object.assign(new Error('가입 코드를 여러 번 틀렸어요. 30분 후 다시 시도해 주세요.'), { status: 429 });
  return error => {
    if (error?.signupCode) { list.push(Date.now()); rates.set(key, list); }
  };
}

export async function selfSignup(state, body) {
  if (process.env.DISABLE_SELF_SIGNUP === 'true') fail('현재는 학생 회원가입을 받지 않고 있어요.', 403);

  const displayName = str(body.display_name, 40);
  const username = str(body.username, 40).toLowerCase();
  const password = String(body.password || '');
  // 학교·반은 가입 코드로만 정한다(보낸 school_id·class_name은 쓰지 않는다).
  const { school, class_name: className } = resolveSignupCode(state, body.code);

  if (!displayName || displayName.length < 2) fail('이름을 2자 이상 입력해주세요.');
  if (!/^[a-z0-9_.-]{3,40}$/.test(username)) fail('아이디는 영문 소문자·숫자 3~40자로 입력해주세요.');
  if (state.profiles.some(profile => profile.username === username)) fail('이미 사용 중인 아이디예요.', 409);
  if (password.length < 8 || password.length > 128) fail('비밀번호는 8~128자로 입력해주세요.');

  const student = {
    id: randomUUID(),
    role: 'student',
    username,
    password_hash: await passwordHash(password),
    display_name: displayName,
    class_name: className,
    division: school.division,
    school_id: school.id,
    school: school.name,
    active: true,
    self_signup: true,
    created_at: Date.now()
  };

  state.profiles.push(student);
  return { ok: true, username: student.username, school: school.name, class_name: className, division: school.division };
}
