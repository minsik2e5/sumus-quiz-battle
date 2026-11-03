// V13.208 검사: 테스트 앱 선생님의 학생 미리보기 계정에 모든 펫을 넣는다(운영은 그대로).
import { readFileSync } from 'node:fs';
import { ACTIVE_PET_KEYS } from '../public/modules/core.js';
import { TEST_APP, applyTestSeed, fillPreviewPets } from './test-seed.mjs';

export async function runTeacherPreviewPetsChecks(assert) {
  const preview = { id: 'teacher-preview:t:s:고1', role: 'student', preview_owner_id: 't', pets: [{ key: 'dog', first: true }] };
  assert(fillPreviewPets(preview, 1) === true && ACTIVE_PET_KEYS.every(key => preview.pets.filter(p => p.key === key).length === 1) && preview.pets[0].first && fillPreviewPets(preview, 2) === false
    && ['hachiware', 'usagi', 'chiikawa', 'tyranno', 'gumiho'].every(key => preview.pets.some(p => p.key === key)),
    'V13.208 미리보기 계정에 지금 있는 모든 펫(특별 · 시리즈 · 신화 포함)을 한 마리씩 넣고, 두 번 넣지 않는다');
  const state = {
    test_seed: TEST_APP.SEED, test_gifts: Object.keys(TEST_APP.GIFTS), schools: [{ id: 'danwon-high' }],
    profiles: [
      { id: 'test-teacher', username: 'tteacher', role: 'teacher' }, { id: 'real-teacher', username: 'kim', role: 'teacher' },
      { id: 'teacher-preview:test-teacher:danwon-high:고1', role: 'student', preview_owner_id: 'test-teacher', pets: [{ key: 'dog', first: true }] },
      { id: 'teacher-preview:real-teacher:danwon-high:고1', role: 'student', preview_owner_id: 'real-teacher', pets: [{ key: 'dog', first: true }] }
    ]
  };
  assert(await applyTestSeed(state, 5) === true && state.profiles[2].pets.length === ACTIVE_PET_KEYS.length && state.profiles[3].pets.length === 1 && await applyTestSeed(state, 6) === false,
    'V13.208 테스트 앱이 켜질 때 테스트 선생님(tteacher · tteacher2)의 미리보기 계정만 채운다');
  const service = readFileSync(new URL('./service.mjs', import.meta.url), 'utf8');
  assert(service.includes('if (state.test_seed) fillPreviewPets(preview);') && service.indexOf('fillPreviewPets(preview)') > service.indexOf("path === '/teacher/student-preview'"),
    'V13.208 미리보기에 들어올 때는 테스트 앱(test_seed가 있는 상태)에서만 펫을 채운다');
}
