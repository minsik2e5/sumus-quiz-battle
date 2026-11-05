// V13.218 검사: 선생님 펫 선물(POST /teacher/gifts kind:'pet'). 선생님만 · 이 학교 학생만 · 없는 펫 거부 · 전체/반/학생 고르기 ·
// 열면 그 펫 · 이미 가진 펫은 선생님 알과 같은 규칙(GIFT_EGG_FULL_COINS코인) · 전설/신화 학교 소식 · 코인 잔액 그대로 · 300명 제한 ·
// 이미 가진 학생 미리 보기는 보기 전용 GET.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHARACTERS, ACTIVE_PET_KEYS, GIFT_PET_KEYS, giftPetOk, giftPetTier, giftPetGroup, GIFT_PET_GROUPS, LEGENDARY_PET_KEYS, MYTHIC_PET_KEYS, EPIC_PET_KEYS, LIMITED_PET_KEYS, SERIES_PET_KEYS, SERIES_DONE_COINS, LEGEND_EGG_EPIC_NEED, seasonsOver } from '../public/modules/core.js';
import { GIFT_EGG_FULL_COINS } from '../public/modules/rewards.js';
import { giftsWaiting, openGifts, giveGift, giftEggPick, rewardIncome } from './rewards.mjs';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';
import { READ_POSTS, VIEW_POSTS } from './mutation-coordinator.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const DAY = 86400000;
const status = async fn => { try { await fn(); return 200; } catch (e) { return e.status || 500; } };

export async function runPetGiftChecks(assert) {
  // ---- 고를 수 있는 펫: 만날 수 있는 모든 펫(기본 · 영웅 · 전설 · 신화 · 한정 · 특별 · 시리즈), 은퇴 펫은 아님
  assert(GIFT_PET_KEYS === ACTIVE_PET_KEYS && !giftPetOk('phoenix') && !giftPetOk('nope') && !giftPetOk(undefined), 'V13.218 펫 선물 목록은 만날 수 있는 펫 전부(은퇴 · 없는 펫 제외)');
  const groups = new Set(GIFT_PET_KEYS.map(giftPetGroup));
  assert(['basic', 'epic', 'legendary', 'mythic', 'limited', 'special', 'series'].every(g => groups.has(g)) && GIFT_PET_KEYS.every(key => GIFT_PET_GROUPS.some(([g]) => g === giftPetGroup(key))), 'V13.218 기본 · 영웅 · 전설 · 신화 · 한정 · 특별 · 시리즈 묶음이 모두 있고 모든 펫이 한 묶음에 든다');
  assert(giftPetTier('tyranno') === 'legendary' && giftPetTier(LEGENDARY_PET_KEYS[0]) === 'legendary' && giftPetTier(MYTHIC_PET_KEYS[0]) === 'mythic' && giftPetTier(EPIC_PET_KEYS[0]) === 'epic', 'V13.218 등급: 시리즈는 시리즈 등급, 나머지는 petTier');

  // ---- 규칙(함수): 이미 가진 펫 = 선생님 알에서 새 펫이 나올 수 없을 때와 같은 결과
  {
    const now = Date.now();
    const has = { role: 'student', pets: [{ key: 'dog', first: true }] };
    giveGift(has, { id: 'g1', kind: 'pet', pet: 'dog', from: 't', fromName: '김 선생님', now });
    const waitView = giftsWaiting(has);
    assert(waitView.length === 1 && waitView[0].kind === 'pet' && !JSON.stringify(waitView).includes('"dog"'), 'V13.218 열기 전에는 어떤 펫인지 보이지 않는다');
    const [dup] = openGifts(has, now);
    const all = { role: 'student', pets: ACTIVE_PET_KEYS.map(key => ({ key })) };
    giveGift(all, { id: 'g2', kind: 'egg', from: 't', fromName: '김 선생님', now });
    const [eggFull] = openGifts(all, now);
    assert(giftEggPick(all) === null && eggFull.full && eggFull.amount === GIFT_EGG_FULL_COINS && dup.full && dup.amount === eggFull.amount && dup.had === 'dog' && !dup.egg && has.pets.length === 1 && has.gift_box.total === all.gift_box.total,
      'V13.218 이미 가진 펫을 받으면 선생님 알 중복(펫을 다 모은 학생)과 같은 규칙: 펫 대신 GIFT_EGG_FULL_COINS코인, 펫은 늘지 않는다');
    assert(rewardIncome(has) >= GIFT_EGG_FULL_COINS && rewardIncome(has) === rewardIncome(all), 'V13.218 중복 코인은 알 중복 코인과 같은 곳(gift_box.total)으로 잔액에 들어간다');
    const nopet = { role: 'student', pets: [] };
    giveGift(nopet, { id: 'g3', kind: 'pet', pet: 'cat', from: 't', now });
    assert(!giftsWaiting(nopet).length && !openGifts(nopet, now).length && !nopet.pets.length, 'V13.218 첫 펫을 고르기 전에는 알 선물처럼 기다린다(첫 펫 자리를 차지하지 않는다)');
    let threw = false; try { giveGift(nopet, { id: 'g4', kind: 'pet', pet: 'phoenix', from: 't', now }); } catch (e) { threw = e.status === 400; }
    assert(threw, 'V13.218 giveGift도 없는 · 은퇴 펫을 거부한다');
    // 시리즈 마지막 한 마리 → 시리즈 보상(일반 획득과 같다), 영웅 20번째 → 전설 알 셈에 들어간다(키로 센다).
    const ser = { role: 'student', pets: [{ key: 'dog', first: true }, ...SERIES_PET_KEYS.slice(1).map(key => ({ key, series: 'bugdino' }))] };
    giveGift(ser, { id: 'g5', kind: 'pet', pet: SERIES_PET_KEYS[0], from: 't', now });
    const [s1] = openGifts(ser, now);
    assert(s1.egg?.key === SERIES_PET_KEYS[0] && ser.pets.at(-1).series === 'bugdino' && ser.series_done?.coins === SERIES_DONE_COINS, 'V13.218 선물로 시리즈를 다 모으면 시리즈 완성 보상(일반 획득과 같다)');
  }

  // ---- 서버 경로
  const state = emptyState(), hash = await passwordHash('QaPetGift1!'), now = Date.now();
  const base = { role: 'student', active: true, school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, avatar_key: 'dog', created_at: now - 9 * DAY };
  const kid = (id, cls, pets = [{ key: 'dog', first: true, acquired_at: now - 9 * DAY }], extra = {}) => ({ ...base, id, username: id, display_name: id, class_name: cls, pets, ...extra });
  state.profiles.push(
    { id: 'qa-pg-t', username: 'qa_pg_t', display_name: '김민식', role: 'teacher', active: true, password_hash: hash, school_ids: ['danwon-high'], division_ids: ['high'], active_division: 'high', active_school_id: 'danwon-high', created_at: now - 9 * DAY },
    kid('qa-pg-a', '고1A', [{ key: 'dog', first: true, acquired_at: 1 }, { key: 'cat', acquired_at: 2 }]),
    kid('qa-pg-b', '고1A'),
    kid('qa-pg-c', '고1B', [{ key: 'dog', first: true, acquired_at: 1 }, ...EPIC_PET_KEYS.slice(1, LEGEND_EGG_EPIC_NEED).map(key => ({ key, epic: true, acquired_at: 2 }))]),
    kid('qa-pg-x', '고1A', undefined, { school_id: 'gangseo-high', school: '강서고' })
  );
  for (let i = 0; i < 301; i++) state.profiles.push(kid(`qa-pg-m${i}`, '고1M'));
  const login = async (username, role) => (await service(state, 'POST', '/login', { username, password: 'QaPetGift1!', division: 'high', ...(role ? { role } : {}) }, null))._cookie;
  const tok = { t: await login('qa_pg_t', 'teacher'), a: await login('qa-pg-a'), b: await login('qa-pg-b'), c: await login('qa-pg-c'), x: await login('qa-pg-x') };
  const prof = id => state.profiles.find(x => x.id === id);
  const balance = async who => (await service(state, 'GET', '/rewards', {}, tok[who])).points_balance;
  const send = (body, who = 't') => service(state, 'POST', '/teacher/gifts', body, tok[who]);
  const open = who => service(state, 'POST', '/gifts/open', {}, tok[who]);

  assert(await status(() => send({ kind: 'pet', pet_key: 'cat', student_ids: ['qa-pg-b'] }, 'a')) === 403, 'V13.218 학생은 펫 선물을 보낼 수 없다(403)');
  assert(await status(() => service(state, 'GET', '/teacher/gifts/pet-owners', { pet_key: 'cat' }, tok.a)) === 403, 'V13.218 학생은 미리 보기도 못 본다(403)');
  assert(await status(() => send({ kind: 'pet', pet_key: 'nope', student_ids: ['qa-pg-b'] })) === 400 && await status(() => send({ kind: 'pet', pet_key: 'phoenix', student_ids: ['qa-pg-b'] })) === 400 && await status(() => send({ kind: 'pet', student_ids: ['qa-pg-b'] })) === 400 && !prof('qa-pg-b').gift_box, 'V13.218 없는 · 은퇴 · 빈 pet_key는 거부(아무에게도 안 간다)');

  // 미리 보기: 이 학교에서 그 펫을 가진 학생 id(다른 학교 제외), GET이라 아무것도 쓰지 않는다.
  const before = JSON.stringify(state.profiles.map(x => x.gift_box || null));
  const owners = await service(state, 'GET', '/teacher/gifts/pet-owners', { pet_key: 'dog' }, tok.t);
  assert(owners.owners.includes('qa-pg-a') && owners.owners.includes('qa-pg-b') && !owners.owners.includes('qa-pg-x') && JSON.stringify(state.profiles.map(x => x.gift_box || null)) === before, 'V13.218 이미 가진 학생 미리 보기: 이 학교만, 쓰기 없음');
  assert(!READ_POSTS.has('/api/teacher/gifts/pet-owners') && !VIEW_POSTS.has('/api/teacher/gifts/pet-owners'), 'V13.218 미리 보기는 GET(READ_POSTS · VIEW_POSTS에 넣을 필요 없음)');

  // 학생 고르기: 다른 학교 학생은 빠진다. a는 cat이 있고 b는 없다.
  const balA = await balance('a'), balB = await balance('b');
  const r1 = await send({ kind: 'pet', pet_key: 'cat', student_ids: ['qa-pg-a', 'qa-pg-b', 'qa-pg-x'], note: '잘했어요' });
  assert(r1.sent === 2 && r1.kind === 'pet' && r1.pet_key === 'cat' && r1.pet_name === CHARACTERS.cat.ko && r1.amount === 0 && r1.total === 0 && !prof('qa-pg-x').gift_box, 'V13.218 학생 고르기: 다른 학교 학생은 빠진다');
  assert(r1.gifts_sent[0].kind === 'pet' && r1.gifts_sent[0].pet_name === CHARACTERS.cat.ko && r1._push[0].to.length === 2 && !r1._push[0].body.includes(CHARACTERS.cat.ko), 'V13.218 보낸 기록에 펫 이름 · 푸시는 받는 학생에게(펫 이름은 열 때 알게)');
  assert(await balance('a') === balA && await balance('b') === balB, 'V13.218 보내는 순간 코인 잔액은 그대로');
  const boot = await service(state, 'GET', '/bootstrap', {}, tok.b);
  assert(boot.gifts?.length === 1 && boot.gifts[0].kind === 'pet' && !JSON.stringify(boot.gifts).includes('"cat"'), 'V13.218 홈의 선물 상자: 펫 선물이 보이지만 어떤 펫인지는 열 때');
  const ob = await open('b');
  const petB = prof('qa-pg-b').pets.find(x => x.key === 'cat');
  assert(ob.gifts[0].kind === 'pet' && ob.gifts[0].egg?.key === 'cat' && ob.gifts[0].egg.pick && ob.gifts[0].from_name === '김민식' && ob.gifts[0].note === '잘했어요' && petB?.gift && petB.pick && ob.profile && ob.stats && ob.coins === 0 && await balance('b') === balB, 'V13.218 열면 그 펫이 내 펫에 들어온다(메모 · 보낸 선생님 · 코인 잔액 그대로)');
  const oa = await open('a');
  assert(oa.gifts[0].full && oa.gifts[0].had === 'cat' && oa.coins === GIFT_EGG_FULL_COINS && prof('qa-pg-a').pets.filter(x => x.key === 'cat').length === 1 && await balance('a') === balA + GIFT_EGG_FULL_COINS, 'V13.218 이미 가진 학생은 알 중복과 같이 GIFT_EGG_FULL_COINS코인(펫은 그대로 한 마리)');
  assert((await open('b')).gifts.length === 0, 'V13.218 두 번 열어도 한 번만');

  // 반 전체 · 학교 전체
  const r2 = await send({ kind: 'pet', pet_key: 'rabbit', class_name: '고1B' });
  assert(r2.sent === 1 && prof('qa-pg-c').gift_box.log.at(-1).pet === 'rabbit' && !prof('qa-pg-b').gift_box.log.some(g => g.pet === 'rabbit'), 'V13.218 반 전체: 그 반 학생만');
  assert(await status(() => send({ kind: 'pet', pet_key: 'rabbit', class_name: '고1M' })) === 400 && !prof('qa-pg-m0').gift_box, 'V13.218 한 번에 300명까지(301명 반은 거부)');
  assert(await status(() => send({ kind: 'pet', pet_key: 'rabbit', all: true })) === 400, 'V13.218 학교 전체도 300명 제한(이 학교는 304명)');
  for (let i = 0; i < 301; i++) prof(`qa-pg-m${i}`).active = false;
  const r3 = await send({ kind: 'pet', pet_key: 'hamster', all: true });
  assert(r3.sent === 3 && ['qa-pg-a', 'qa-pg-b', 'qa-pg-c'].every(id => prof(id).gift_box.log.some(g => g.pet === 'hamster')) && !prof('qa-pg-x').gift_box, 'V13.218 학교 전체: 이 학교 활동 학생만');

  // 영웅 20번째(선물) → 전설 알 셈, 전설 · 신화 → 학교 소식 '선생님 선물'
  const epic20 = EPIC_PET_KEYS[0];
  await send({ kind: 'pet', pet_key: epic20, student_ids: ['qa-pg-c'] });
  await open('c');
  assert(prof('qa-pg-c').pets.some(x => x.key === epic20 && x.epic) && prof('qa-pg-c').legend_egg?.e20, 'V13.218 선물한 영웅도 영웅 20마리 전설 알 셈에 들어간다');
  await send({ kind: 'pet', pet_key: LEGENDARY_PET_KEYS[0], student_ids: ['qa-pg-b'] });
  const ol = await open('b');
  assert(ol.gifts.some(g => g.egg?.key === LEGENDARY_PET_KEYS[0] && g.egg.tier === 'legendary') && JSON.stringify(ol.legend_news || '').includes('선생님 선물') && prof('qa-pg-b').lucky?.legend_key === LEGENDARY_PET_KEYS[0], 'V13.218 전설 펫 선물은 학교 소식("선생님 선물")');
  await send({ kind: 'pet', pet_key: MYTHIC_PET_KEYS[0], student_ids: ['qa-pg-b'] });
  const om = await open('b');
  assert(om.gifts.some(g => g.egg?.tier === 'mythic') && prof('qa-pg-b').pets.some(x => x.key === MYTHIC_PET_KEYS[0] && x.mythic) && JSON.stringify(om.legend_news || '').includes('선생님 선물'), 'V13.218 신화 펫 선물도 학교 소식("선생님 선물")');
  // 판매가 끝난 한정 펫도 줄 수 있다(지금 시즌 펫이든 지난 시즌 펫이든).
  const lim = LIMITED_PET_KEYS[0];
  await send({ kind: 'pet', pet_key: lim, student_ids: ['qa-pg-b'] });
  const olim = await open('b');
  assert(olim.gifts[0].egg?.key === lim && prof('qa-pg-b').pets.some(x => x.key === lim && x.limited) && Array.isArray(seasonsOver()), 'V13.218 한정 펫(판매 기간과 상관없이)도 선물할 수 있다');

  // ---- 화면
  const app = source('../public/app.js'), cel = source('../public/modules/celebrate.js'), moments = source('../public/modules/pet-moments.js'), svc = source('./service.mjs');
  assert(app.includes('data-gk="pet"') && app.includes("api(`/teacher/gifts/pet-owners?pet_key=${encodeURIComponent(key)}`)") && app.includes("{ kind: 'pet', pet_key: pet, note:") && app.includes('이미 가진 학생 ${num(had)}명') && app.includes("g.kind === 'pet' ? `🐾 ${esc(g.pet_name"), 'V13.218 선생님 선물 창: 펫 고르기 · 미리 보기 GET · 보낸 기록 "🐾 ○○ 펫"');
  assert(app.includes('GIFT_PET_GROUPS.map(') && app.includes('id="gift-pq"') && app.includes("avatar(key, { size: 'mini' })"), 'V13.218 펫 목록: 등급별 묶음 · 이름 검색 · 그림');
  assert(cel.includes("const petGift = g => g.kind === 'egg' || g.kind === 'pet';") && cel.includes('giftEggShow(g.egg, g.from_name)') && moments.includes('egg.pick') && moments.includes("if (egg.tier === 'mythic') { await mythicShow("), 'V13.218 학생: 알 선물과 같은 깨기 연출(등급별 연출 그대로) + "○○ 선생님의 선물"');
  assert(svc.includes("where = g => g.kind === 'pet' ? '선생님 선물' : '선생님 알 선물'") && svc.includes("path === '/teacher/gifts/pet-owners' && method === 'GET'"), 'V13.218 서버: 학교 소식 문구 · 미리 보기는 GET');
}
