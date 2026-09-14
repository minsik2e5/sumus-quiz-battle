import { randomUUID } from 'node:crypto';
import { passwordHash } from './auth.mjs';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const str = (value, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function selfSignup(state, body) {
  if (process.env.DISABLE_SELF_SIGNUP === 'true') fail('현재는 학생 회원가입을 받지 않고 있어요.', 403);

  const displayName = str(body.display_name, 40);
  const username = str(body.username, 40).toLowerCase();
  const password = String(body.password || '');
  const school = str(body.school, 20);
  const className = str(body.class_name, 30);

  if (!displayName || displayName.length < 2) fail('이름을 2자 이상 입력해주세요.');
  if (!/^[a-z0-9_.-]{3,40}$/.test(username)) fail('아이디는 영문 소문자·숫자 3~40자로 입력해주세요.');
  if (state.profiles.some(profile => profile.username === username)) fail('이미 사용 중인 아이디예요.', 409);
  if (password.length < 8 || password.length > 128) fail('비밀번호는 8~128자로 입력해주세요.');
  if (!['단원고', '선부고'].includes(school)) fail('학교를 선택해주세요.');
  if (!['고1A', '고1B'].includes(className)) fail('반을 선택해주세요.');

  const student = {
    id: randomUUID(),
    role: 'student',
    username,
    password_hash: await passwordHash(password),
    display_name: displayName,
    class_name: className,
    school,
    active: true,
    created_at: Date.now()
  };

  state.profiles.push(student);
  return { ok: true, username: student.username, class_name: className };
}
