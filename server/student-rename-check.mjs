// V13.199.1 검사: 선생님 학생 관리 창(teacher-enhancements.js)에서 학생 이름을 바꾼다(닉네임 요청 등).
// 서버(PATCH /students/:id display_name)는 V13.141부터 있었지만, 실제로 쓰는 창에 이름 칸이 없었다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

export async function runStudentRenameChecks(assert) {
  const ui = source('../public/teacher-enhancements.js');
  assert(ui.includes('<input name="display_name" value="${esc(p.display_name)}" required minlength="2" maxlength="40"') && ui.includes('if (name && name !== p.display_name) payload.display_name = name;'),
    'V13.199.1 학생 관리 창(계정 관리)에 이름 칸이 있고, 바뀐 때만 보낸다');
  const state = emptyState(), now = Date.now(), hash = await passwordHash('QaRename12!');
  state.profiles.push({ id: 'qa-rt', username: 'qa-rt', display_name: '선생님', role: 'teacher', active: true, password_hash: hash, school_ids: ['danwon-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'danwon-high', created_at: now });
  state.profiles.push({ id: 'qa-rs', username: 'qa-rs', display_name: '홍길동', role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, created_at: now });
  const token = u => service(state, 'POST', '/login', { username: u, password: 'QaRename12!', division: 'high' }, null).then(r => r._cookie);
  const tt = await token('qa-rt'), ts = await token('qa-rs');
  const me = state.profiles.find(x => x.id === 'qa-rs');
  await service(state, 'PATCH', '/students/qa-rs', { display_name: '  블라드러워 ', class_name: '고1A', school_id: 'danwon-high', active: true }, tt);
  assert(me.display_name === '블라드러워' && me.class_name === '고1A', 'V13.199.1 선생님이 바꾼 이름이 저장된다(앞뒤 빈칸은 뺀다)');
  const short = await service(state, 'PATCH', '/students/qa-rs', { display_name: '가', class_name: '고1A', school_id: 'danwon-high' }, tt).then(() => 200, e => e.status);
  const self = await service(state, 'PATCH', '/students/qa-rs', { display_name: '내맘대로' }, ts).then(() => 200, e => e.status);
  assert(short === 400 && self === 403 && me.display_name === '블라드러워', 'V13.199.1 이름은 2자 이상, 학생은 스스로 바꿀 수 없다(선생님만)');
}
