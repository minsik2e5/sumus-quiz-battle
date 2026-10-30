// V13.201 검사: 곤충 · 공룡 알 NEW 표시(시리즈 펫이 없는 학생, 정해진 날까지)와 다 모은 보상(특별 테두리 + 500코인, 한 번).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FRAMES, unlocked, seriesComplete, seriesEggNew, SERIES_NEW_UNTIL, SERIES_DONE_COINS, SERIES_PET_KEYS } from '../public/modules/core.js';
import { seriesEggBuy, seriesEggView, rewardIncome } from './rewards.mjs';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

export async function runSeriesRewardChecks(assert) {
  // ---- NEW
  const before = Date.parse(`${SERIES_NEW_UNTIL}T12:00:00+09:00`), after = before + 2 * 86400000;
  assert(seriesEggNew({ ready: true, owned: 0 }, before) && !seriesEggNew({ ready: true, owned: 1 }, before) && !seriesEggNew({ ready: true, owned: 0 }, after) && !seriesEggNew(null, before) && !seriesEggNew({ ready: false, owned: 0 }, before),
    `V13.201 NEW는 시리즈 펫이 하나도 없는 학생에게 ${SERIES_NEW_UNTIL}까지만`);
  const pm = source('../public/modules/pet-moments.js'), arcade = source('../public/modules/arcade.js'), student = source('../public/modules/student.js');
  assert(pm.includes(`k === 'series' && seriesNewNow ? '<em class="egg-tab-new">NEW</em>'`) && arcade.includes(`seriesEggNew(se) ? '<em class="egg-tab-new">NEW</em>'`) && student.includes(`알 상점\${seriesEggNew(A.data.series_egg) ? '<em class="egg-tab-new">NEW</em>' : ''}`),
    'V13.201 NEW 배지: 알 상점 창 탭 · 놀이터 알 칸 · 홈 펫 카드의 알 상점 버튼');

  // ---- 다 모은 보상
  assert(SERIES_DONE_COINS === 500 && FRAMES.bugdino?.series === 'bugdino' && FRAMES.bugdino.name === '곤충 · 공룡 탐험대', 'V13.201 다 모은 보상: 특별 테두리 곤충 · 공룡 탐험대 + 500코인');
  const all = SERIES_PET_KEYS.map(key => ({ key }));
  assert(!unlocked(FRAMES.bugdino, { level: 99, pets: all.slice(1) }) && unlocked(FRAMES.bugdino, { level: 1, pets: all }) && seriesComplete(all) && !seriesComplete(all.slice(0, 11)), 'V13.201 테두리는 12마리를 다 모은 학생만(레벨과 상관없이)');
  const p = { id: 's', role: 'student', pets: [{ key: 'dog' }] };
  const got = [];
  for (let i = 0; i < 12; i++) got.push(seriesEggBuy(p, 99999, { random: () => .5, now: 1000 + i }));
  assert(got.slice(0, 11).every(r => !r.done) && got[11].done?.coins === 500 && got[11].done.frame === 'bugdino' && p.series_done.coins === 500 && rewardIncome(p) === 500 && seriesEggView(p).reward.got === 1011,
    'V13.201 12번째(마지막) 알에서만 보상, 코인은 잔액에 들어가고(rewardIncome) 받은 때가 남는다');

  // ---- 서버 경로: 테두리 끼우기
  const state = emptyState(), now = Date.now(), hash = await passwordHash('QaSeries12!');
  state.profiles.push({ id: 'qa-sr', username: 'qa-sr', display_name: '탐험', role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, avatar_key: 'dog', avatar_accessory: 'none', avatar_frame: 'basic', avatar_title: 'rookie', pets: [{ key: 'dog', first: true, acquired_at: now - 86400000 }], gift_box: { total: 20000 }, created_at: now - 86400000 });
  const token = (await service(state, 'POST', '/login', { username: 'qa-sr', password: 'QaSeries12!', division: 'high' }, null))._cookie;
  const call = (method, path, body = {}) => service(state, method, path, body, token);
  const style = { avatar_key: 'dog', avatar_accessory: 'none', avatar_frame: 'bugdino', avatar_title: 'rookie' };
  assert(await call('POST', '/profile/style', style).then(() => false, e => e.status === 400), 'V13.201 다 모으기 전에는 테두리를 끼울 수 없다');
  let last;
  for (let i = 0; i < 12; i++) last = await call('POST', '/shop/egg', { kind: 'series' });
  const me = state.profiles.find(x => x.id === 'qa-sr');
  assert(last.done?.coins === 500 && last.series_egg.reward.got && me.activity.at(-1).t.includes('시리즈 완성!'), 'V13.201 서버 경로: 마지막 알에서 보상 · 활동 기록에 시리즈 완성');
  await call('POST', '/profile/style', { ...style, avatar_key: me.avatar_key });
  assert(me.avatar_frame === 'bugdino', 'V13.201 다 모은 뒤에는 테두리를 끼울 수 있다');
  assert(pm.includes('export function seriesDoneShow(A, res)') && pm.includes('if (res.done) await seriesDoneShow(A, res);') && student.includes("item.series ? '곤충 · 공룡 12마리 모으면 열려요'"), 'V13.201 다 모은 순간 축하 창, 꾸미기 테두리 목록에 여는 법');
}
