// V13.141 반별 가입 코드 검사. 바뀐 규칙마다 하나씩:
// 코드 없이·틀린 코드·꺼진 코드 가입 실패, 맞는 코드면 학교·반 자동, 코드를 바꾸면 옛 코드 실패,
// 응답에 코드가 새지 않음, 틀린 코드 제한(같은 기기 30분 20번), 옛 state 마이그레이션, 화면.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState, migrateState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';
import { selfSignup, checkSignupCode, signupCodeGuard, SIGNUP_CODE_MESSAGE, SIGNUP_CODE_FAIL_MAX, CLASS_BY_DIVISION } from './signup.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const codeOf = (state, schoolId, className) => state.signupCodes.find(item => item.school_id === schoolId && item.class_name === className)?.code;

export async function runSignupCodeChecks(assert, expectStatus) {
  const state = emptyState();
  const pairs = state.schools.flatMap(school => (CLASS_BY_DIVISION[school.division] || []).map(className => `${school.id}|${className}`));
  assert(state.signupCodes.length === pairs.length && pairs.every(pair => state.signupCodes.some(item => `${item.school_id}|${item.class_name}` === pair && item.active)), 'V13.141 새 state는 학교·반마다 켜진 가입 코드가 하나씩 있다');
  assert(state.signupCodes.every(item => /^[A-HJKMNP-Z2-9]{6}$/.test(item.code)) && new Set(state.signupCodes.map(item => item.code)).size === state.signupCodes.length, 'V13.141 가입 코드는 서로 다른 6자리 영문·숫자(헷갈리는 0·O·1·I·L 없음)');

  /* ---------- 코드 없이 · 틀린 코드 · 꺼진 코드 ---------- */
  const base = { display_name: '코드학생', password: 'CodeJoin123!' };
  const codeFail = async (body, label) => {
    let error = null;
    try { await selfSignup(state, body); } catch (caught) { error = caught; }
    assert(error?.status === 400 && error.message === SIGNUP_CODE_MESSAGE && error.signupCode === true, label);
  };
  await codeFail({ ...base, username: 'nocode_a', school_id: 'gangseo-high', class_name: '고1A', division: 'high' }, 'V13.141 코드 없이는 (학교·반을 보내도) 가입이 안 된다');
  await codeFail({ ...base, username: 'nocode_b', code: 'ZZZZZZ' }, 'V13.141 틀린 코드로는 가입이 안 된다');
  await codeFail({ ...base, username: 'nocode_c', code: 'ABC' }, 'V13.141 길이가 다른 코드로는 가입이 안 된다');
  const gangseoA = codeOf(state, 'gangseo-high', '고1A');
  state.signupCodes.find(item => item.code === gangseoA).active = false;
  await codeFail({ ...base, username: 'nocode_d', code: gangseoA }, 'V13.141 꺼진 반 코드로는 가입이 안 된다');
  state.signupCodes.find(item => item.code === gangseoA).active = true;
  assert(!state.profiles.length, 'V13.141 실패한 가입은 계정을 남기지 않는다');

  /* ---------- 맞는 코드: 학교·반 자동 ---------- */
  const checked = checkSignupCode(state, { code: gangseoA.toLowerCase() });
  assert(checked.school === '강서고' && checked.class_name === '고1A' && checked.division === 'high', 'V13.141 코드 확인은 "강서고 · 고1A"(소문자로 넣어도 된다)');
  const joined = await selfSignup(state, { ...base, username: 'code_join', code: ` ${gangseoA} `, school_id: 'wonil-middle', class_name: '중2', division: 'middle' });
  const student = state.profiles.find(item => item.username === 'code_join');
  assert(joined.ok && joined.school === '강서고' && joined.class_name === '고1A' && joined.division === 'high', 'V13.141 맞는 코드로 가입하면 학교·반이 코드로 정해진다');
  assert(student.school_id === 'gangseo-high' && student.class_name === '고1A' && student.division === 'high' && student.self_signup === true, 'V13.141 보낸 학교·반은 무시하고 코드의 학교·반으로 저장한다(가입 표시 포함)');
  const login = await service(state, 'POST', '/login', { username: 'code_join', password: 'CodeJoin123!', role: 'student', division: joined.division }, null);
  assert(Boolean(login._cookie), 'V13.141 코드로 가입한 학생은 바로 로그인된다');

  /* ---------- 응답에 코드가 새지 않음 ---------- */
  const codes = state.signupCodes.map(item => item.code);
  const leaks = value => { const text = JSON.stringify(value); return codes.filter(code => text.includes(code)); };
  const studentBoot = await service(state, 'GET', '/bootstrap', {}, login._cookie);
  assert(!leaks(joined).length && !leaks(checked).length && !leaks(studentBoot).length && studentBoot.signup_codes == null, 'V13.141 가입·코드 확인·학생 첫 화면 응답에는 어떤 가입 코드도 없다');

  /* ---------- 선생님: 표, 새 코드, 켜기/끄기 ---------- */
  state.profiles.push({ id: 'code-teacher', role: 'teacher', username: 'code_teacher', password_hash: await passwordHash('CodeTeacher123!'), display_name: '코드 선생님', active: true, created_at: Date.now() });
  const teacher = await service(state, 'POST', '/login', { username: 'code_teacher', password: 'CodeTeacher123!', role: 'teacher', division: 'high' }, null);
  const teacherBoot = await service(state, 'GET', '/bootstrap', {}, teacher._cookie);
  const highRows = state.schools.filter(school => school.division === 'high').length * 2;
  assert(teacherBoot.signup_codes?.length === highRows && teacherBoot.signup_codes.every(row => row.code && row.active && row.school) && teacherBoot.signup_codes.some(row => row.code === gangseoA), 'V13.141 선생님 첫 화면에는 지금 부서(고등부) 학교의 반별 가입 코드 표가 있다');
  assert(!teacherBoot.signup_codes.some(row => row.school_id === 'wonil-middle'), 'V13.141 다른 부서(중등부) 코드는 고등부 표에 없다');
  await service(state, 'PATCH', '/teacher/school', { school_id: 'gangseo-high' }, teacher._cookie);
  const joinedRow = (await service(state, 'GET', '/bootstrap', {}, teacher._cookie)).profiles.find(item => item.id === student.id);
  assert(joinedRow?.self_signup === true && joinedRow.created_at > Date.now() - 60000, 'V13.141 선생님 학생 목록에 새로 가입한 학생이 가입 표시와 함께 온다(최근 7일 세기용)');
  await expectStatus(403, () => service(state, 'POST', '/teacher/signup-codes', { school_id: 'gangseo-high', class_name: '고1A', regenerate: true }, login._cookie), 'V13.141 학생은 가입 코드를 바꿀 수 없다');
  await expectStatus(403, () => service(state, 'POST', '/teacher/signup-codes', { school_id: 'wonil-middle', class_name: '중2', regenerate: true }, teacher._cookie), 'V13.141 선생님은 지금 부서의 학교 코드만 바꾼다');
  const renewed = await service(state, 'POST', '/teacher/signup-codes', { school_id: 'gangseo-high', class_name: '고1A', regenerate: true }, teacher._cookie);
  assert(renewed.code.code && renewed.code.code !== gangseoA && renewed.code.active && codeOf(state, 'gangseo-high', '고1A') === renewed.code.code, 'V13.141 새 코드 만들기는 그 반 코드를 바꾸고 켠다');
  await codeFail({ ...base, username: 'old_code', code: gangseoA }, 'V13.141 코드를 바꾸면 옛 코드로는 가입이 안 된다');
  const second = await selfSignup(state, { ...base, username: 'new_code', code: renewed.code.code });
  assert(second.class_name === '고1A' && second.school === '강서고', 'V13.141 새 코드로는 가입된다');
  const off = await service(state, 'POST', '/teacher/signup-codes', { school_id: 'gangseo-high', class_name: '고1A', active: false }, teacher._cookie);
  assert(off.code.active === false && off.code.code === renewed.code.code, 'V13.141 끄기는 코드를 그대로 두고 가입만 막는다');
  await codeFail({ ...base, username: 'off_code', code: renewed.code.code }, 'V13.141 선생님이 끈 반에는 가입이 안 된다');
  await service(state, 'POST', '/teacher/signup-codes', { school_id: 'gangseo-high', class_name: '고1A', active: true }, teacher._cookie);
  state.signupCodes = state.signupCodes.filter(item => !(item.school_id === 'seonbu-high' && item.class_name === '고1B'));
  const noCodeRow = (await service(state, 'GET', '/bootstrap', {}, teacher._cookie)).signup_codes.find(row => row.school_id === 'seonbu-high' && row.class_name === '고1B');
  assert(noCodeRow && !noCodeRow.code && noCodeRow.active === false, 'V13.141 코드가 없는 반도 표에 나오고 가입은 막혀 있다');
  await expectStatus(409, () => service(state, 'POST', '/teacher/signup-codes', { school_id: 'seonbu-high', class_name: '고1B', active: true }, teacher._cookie), 'V13.141 코드가 없는 반은 켜기 전에 새 코드를 만든다');
  await expectStatus(400, () => service(state, 'POST', '/teacher/signup-codes', { school_id: 'gangseo-high', class_name: '중2', regenerate: true }, teacher._cookie), 'V13.141 학교에 없는 반은 코드를 만들 수 없다');

  /* ---------- 새로 가입한 학생: 이름·반 바로 고치기 ---------- */
  const fixed = await service(state, 'PATCH', `/students/${student.id}`, { display_name: '김코드', class_name: '고1B' }, teacher._cookie);
  assert(fixed.display_name === '김코드' && fixed.class_name === '고1B', 'V13.141 선생님은 새로 가입한 학생의 이름과 반을 바로 고친다');
  await expectStatus(400, () => service(state, 'PATCH', `/students/${student.id}`, { display_name: ' ' }, teacher._cookie), 'V13.141 빈 이름으로는 고칠 수 없다');

  /* ---------- 틀린 코드 제한: 같은 기기 30분 20번 ---------- */
  const rates = new Map();
  const wrong = Object.assign(new Error(SIGNUP_CODE_MESSAGE), { signupCode: true });
  for (let i = 0; i < 5; i++) signupCodeGuard(rates, '1.1.1.1')(Object.assign(new Error('이미 사용 중인 아이디예요.'), { status: 409 }));
  for (let i = 0; i < SIGNUP_CODE_FAIL_MAX; i++) signupCodeGuard(rates, '1.1.1.1')(wrong);
  let limited = null;
  try { signupCodeGuard(rates, '1.1.1.1'); } catch (error) { limited = error; }
  assert(SIGNUP_CODE_FAIL_MAX === 20 && limited?.status === 429 && /30분/.test(limited.message), 'V13.141 틀린 가입 코드는 같은 기기에서 30분에 20번까지(코드 말고 다른 실패는 세지 않는다)');
  let other = null;
  try { signupCodeGuard(rates, '2.2.2.2'); } catch (error) { other = error; }
  assert(!other, 'V13.141 다른 기기는 따로 센다');
  rates.set('1.1.1.1:signup-code', rates.get('1.1.1.1:signup-code').map(time => time - 31 * 60000));
  let later = null;
  try { signupCodeGuard(rates, '1.1.1.1'); } catch (error) { later = error; }
  assert(!later, 'V13.141 30분이 지나면 다시 넣을 수 있다');
  const worker = source('../cloudflare/worker.mjs'), local = source('./index.mjs');
  for (const [name, src] of [['운영', worker], ['로컬', local]]) {
    assert(src.includes("url.pathname === '/api/signup' || url.pathname === '/api/signup/check'") && src.includes('signupCodeGuard(') && src.includes('withCodeCount(() => selfSignup(state, body))') && src.includes('withCodeCount(() => checkSignupCode('), `V13.141 ${name} 서버는 가입과 코드 확인에서 틀린 코드를 센다`);
  }
  assert(worker.includes("OPEN_POST_PATHS = new Set(['/api/login', '/api/signup', '/api/signup/check'])"), 'V13.141 코드 확인은 로그인 없이 쓸 수 있다(운영)');

  /* ---------- 옛 state 마이그레이션 ---------- */
  const old = emptyState();
  delete old.signupCodes;
  old.profiles.push({ id: 'legacy', role: 'student', username: 'legacy', display_name: '옛학생', class_name: '중3', school_id: 'wonil-middle', school: '원일중', active: true });
  assert(migrateState(old) === true && Array.isArray(old.signupCodes) && old.signupCodes.length === pairs.length && old.signupCodes.every(item => item.active && /^[A-HJKMNP-Z2-9]{6}$/.test(item.code)), 'V13.141 코드가 없던 옛 state는 처음 배포 때 반마다 켜진 코드를 하나씩 만든다(가입이 막힌 채로 시작하지 않는다)');
  const firstCodes = JSON.stringify(old.signupCodes);
  migrateState(old);
  assert(JSON.stringify(old.signupCodes) === firstCodes, 'V13.141 마이그레이션을 다시 해도 코드는 바뀌지 않는다');
  const cleared = { ...emptyState(), signupCodes: [] };
  migrateState(cleared);
  assert(cleared.signupCodes.length === 0, 'V13.141 이미 코드 목록이 있는 state(비어 있어도)는 다시 만들지 않는다');

  /* ---------- 화면 ---------- */
  const app = source('../public/app.js'), teacherJs = source('../public/modules/teacher.js');
  const view = app.slice(app.indexOf('function signupView('), app.indexOf('function loginView('));
  assert(!/danwon-high|seonbu-high|gangseo-high|wonil-middle|name="school_id"|name="class_name"/.test(view), 'V13.141 가입 화면에는 고정 학교 목록·학교·반 고르는 칸이 없다');
  const checkHandler = view.slice(view.indexOf("$('#signup-code-check').onclick"), view.indexOf("$('[data-back-login]')"));
  assert(checkHandler.includes('const button = e.currentTarget;') && checkHandler.includes('buttonBusy(button, false)') && !checkHandler.includes('buttonBusy(e.currentTarget'), 'V13.141 코드 확인 버튼은 확인이 끝나면 다시 눌린다(await 뒤 e.currentTarget은 비어 있음)');
  assert(view.includes('name="code"') && view.includes("api('/signup/check'") && view.includes('${found.school} · ${found.class_name}'), 'V13.141 가입 화면은 코드 칸과 확인(학교 · 반 표시)이 있다');
  assert(teacherJs.includes('function signupCodePanel(') && teacherJs.includes('data-signup-code-new') && teacherJs.includes('data-signup-code-toggle') && teacherJs.includes('새 코드 만들기'), 'V13.141 선생님 학생 관리에 반별 가입 코드 표(새 코드 만들기·켜기/끄기)');
  assert(teacherJs.includes('새로 가입한 학생 ${num(joined.length)}명') && teacherJs.includes('data-student-quick="new"') && teacherJs.includes('data-new-student-save'), 'V13.141 선생님 첫 화면의 "새로 가입한 학생 N명"을 누르면 이름·반을 바로 고치는 목록');
  assert(app.includes("api('/teacher/signup-codes'") && app.includes("if (d.go === 'students' && d.studentQuick !== undefined) A.studentQuick = d.studentQuick;"), 'V13.141 코드 표 버튼과 첫 화면 버튼이 연결돼 있다');
}
