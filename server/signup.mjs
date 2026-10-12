import { randomUUID } from 'node:crypto';
import { passwordHash } from './auth.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const str = (value, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const CLASS_BY_DIVISION = { middle: ['중2', '중3'], high: ['고1A', '고1B'] };
const divisionLabel = division => division === 'middle' ? '중등부' : '고등부';
const normalizedSchool = value => str(value, 80).replace(/\s+/g, '');

export async function selfSignup(state, body) {
  if (process.env.DISABLE_SELF_SIGNUP === 'true') fail('현재는 학생 회원가입을 받지 않고 있어요.', 403);

  const displayName = str(body.display_name, 40);
  const username = str(body.username, 40).toLowerCase();
  const password = String(body.password || '');
  const schoolRef = str(body.school_id || body.school, 80);
  const schoolKey = normalizedSchool(schoolRef);
  const school = state.schools.find(item => item.active !== false && (
    item.id === schoolRef ||
    normalizedSchool(item.name) === schoolKey ||
    normalizedSchool(item.full_name) === schoolKey
  ));
  const className = str(body.class_name, 30);
  const requestedDivision = ['middle', 'high'].includes(str(body.division, 12)) ? str(body.division, 12) : null;

  if (!displayName || displayName.length < 2) fail('이름을 2자 이상 입력해주세요.');
  if (!/^[a-z0-9_.-]{3,40}$/.test(username)) fail('아이디는 영문 소문자·숫자 3~40자로 입력해주세요.');
  if (state.profiles.some(profile => profile.username === username)) fail('이미 사용 중인 아이디예요.', 409);
  if (password.length < 8 || password.length > 128) fail('비밀번호는 8~128자로 입력해주세요.');
  if (!school) fail('학교를 선택해주세요.');
  const division = school.division || (/중학교$/.test(school.full_name || '') ? 'middle' : 'high');
  if (requestedDivision && requestedDivision !== division) fail(`${divisionLabel(requestedDivision)} 학교를 선택해주세요.`);
  if (!CLASS_BY_DIVISION[division]?.includes(className)) fail(`${divisionLabel(division)} 반을 선택해주세요.`);

  const student = {
    id: randomUUID(),
    role: 'student',
    username,
    password_hash: await passwordHash(password),
    display_name: displayName,
    class_name: className,
    division,
    school_id: school.id,
    school: school.name,
    active: true,
    created_at: Date.now()
  };

  state.profiles.push(student);
  return { ok: true, username: student.username, class_name: className, division };
}
