// V13.182 검사: 전설 알(docs/legend-egg-design.md). 영웅 20마리 보상(한 번 · 소급), 전설 보유자는 코인 + 칭호,
// 열면 갖고 있지 않은 전설 하나(신화 없음), 상점 15,000코인(학생당 1개), 하단 문구, 응답에 미리보기 없음.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EPIC_PET_KEYS, LEGENDARY_PET_KEYS, MYTHIC_PET_KEYS, CHARACTERS, LEGEND_EGG_EPIC_NEED, LEGEND_EGG_PRICE, LEGEND_EGG_COINS, EPIC_EGG_PRICE, EPIC_EGG_LEGENDARY_RATE } from '../public/modules/core.js';
import { LEGENDARY_RATE, LEGENDARY_PITY, MYTHIC_RATE, GIFT_EGG_ODDS } from '../public/modules/rewards.js';
import { TITLES, titleUnlocked, titleCoins } from '../public/modules/titles.js';
import { grantLegendEgg, legendEggOpen, legendEggBuy, legendEggView, epicCount, rewardIncome, setMythicRandom } from './rewards.mjs';
import { createCompetition } from './competition.mjs';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const throws = fn => { try { fn(); return null; } catch (e) { return e.status || 500; } };
const DAY = 86400000;
const epics = n => EPIC_PET_KEYS.slice(0, n).map(key => ({ key, epic: true, acquired_at: 1 }));

export async function runLegendEggChecks(assert) {
  // ---- 규칙 숫자 · 기존 확률은 그대로
  assert(LEGEND_EGG_EPIC_NEED === 20 && LEGEND_EGG_PRICE === 15000 && LEGEND_EGG_COINS === 3000 && EPIC_EGG_PRICE === 800, 'V13.182 영웅 20마리 · 상점 15,000코인 · 전설 보유자 3,000코인');
  assert(LEGENDARY_RATE === .5 && LEGENDARY_PITY === 150 && EPIC_EGG_LEGENDARY_RATE === 1 && GIFT_EGG_ODDS.legendary === 1, 'V13.182 기존 전설 확률(코인 뽑기 0.5% · 천장 150 · 영웅 알 1% · 선생님 알 1%)은 그대로');
  assert(LEGENDARY_PET_KEYS.length === 4 && !LEGENDARY_PET_KEYS.includes('phoenix') && CHARACTERS.phoenix.retired, 'V13.182 전설 알 후보는 retired(불새)를 뺀 전설 4종');

  // ---- 19마리는 없음, 20번째에 지급, 한 번만
  const t0 = Date.parse('2026-10-27T03:00:00Z');
  const p = { id: 's1', role: 'student', pets: [{ key: 'dog', first: true }, ...epics(19)] };
  assert(epicCount(p) === 19 && grantLegendEgg(p, t0) === null && !p.legend_egg && !legendEggView(p).due, 'V13.182 영웅 19마리는 지급 없음');
  p.pets.push(epics(20)[19]);
  assert(legendEggView(p).due && grantLegendEgg(p, t0)?.kind === 'egg' && p.legend_egg.wait === 'epic' && p.legend_egg.e20 === t0, 'V13.182 영웅 20번째에 전설 알 1개');
  assert(grantLegendEgg(p, t0 + DAY) === null && grantLegendEgg(p, t0 + 2 * DAY) === null && p.legend_egg.e20 === t0 && !legendEggView(p).due, 'V13.182 다시 확인해도(재접속) 한 번만');
  // 열기 전에는 어떤 전설인지 정해져 있지 않다(기록 · 보기 어디에도 키가 없다).
  assert(!p.legend_egg.key && !JSON.stringify(legendEggView(p)).match(new RegExp(LEGENDARY_PET_KEYS.join('|'))), 'V13.182 열기 전에는 나올 전설이 정해지지도 보이지도 않는다');

  // ---- 열면 갖고 있지 않은 전설 하나, 신화는 나오지 않는다
  setMythicRandom(() => 0); // 신화가 굴려졌다면 반드시 나왔을 운
  try {
    const opened = legendEggOpen(p, { random: () => 0, now: t0 + 5 });
    const pet = p.pets.at(-1);
    assert(opened.legendary?.key === LEGENDARY_PET_KEYS[0] && pet.legendary && !pet.mythic && !p.pets.some(x => MYTHIC_PET_KEYS.includes(x.key)) && p.lucky.legend_key === pet.key && p.lucky.legend_at === t0 + 5 && p.avatar_key === pet.key, 'V13.182 열면 전설 펫(신화 아님) · lucky.legend_key/legend_at 기록');
    assert(!p.legend_egg.wait && throws(() => legendEggOpen(p, { now: t0 + 6 })) === 409, 'V13.182 한 번 열면 끝');
    for (let i = 0; i < 40; i++) {
      const q = { pets: [{ key: 'dog' }, ...epics(20)], legend_egg: { wait: 'epic', e20: 1 } };
      const r = legendEggOpen(q, { random: () => i / 40, now: t0 });
      assert(LEGENDARY_PET_KEYS.includes(r.legendary.key) && !MYTHIC_PET_KEYS.includes(r.legendary.key) && r.legendary.key !== 'phoenix', 'V13.182 전설 알에서는 전설 4종 중 하나만(신화 · 불새 없음)');
    }
    // 그사이 다른 곳에서 전설을 만났다면 알 대신 코인(전설은 학생당 1마리).
    const q = { pets: [{ key: 'dog' }, ...epics(20), { key: 'whale', legendary: true }], legend_egg: { wait: 'epic', e20: 1 } };
    const r = legendEggOpen(q, { random: () => 0, now: t0 });
    assert(r.coins === LEGEND_EGG_COINS && !r.legendary && q.pets.filter(x => LEGENDARY_PET_KEYS.includes(x.key)).length === 1 && rewardIncome(q) === LEGEND_EGG_COINS, 'V13.182 이미 전설이 있으면 알을 열어도 전설은 늘지 않고 코인');
  } finally { setMythicRandom(null); }

  // ---- 전설 보유자: 알 대신 코인 + 칭호, 소급(이미 20마리 넘는 학생)
  const holder = { id: 's2', role: 'student', pets: [{ key: 'dog' }, ...epics(20), { key: 'qilin', legendary: true }] };
  const g = grantLegendEgg(holder, t0);
  assert(g?.kind === 'coins' && g.coins === LEGEND_EGG_COINS && !holder.legend_egg.wait && rewardIncome(holder) === LEGEND_EGG_COINS && grantLegendEgg(holder, t0 + 1) === null && rewardIncome(holder) === LEGEND_EGG_COINS, 'V13.182 전설 보유자는 알 대신 3,000코인(한 번)');

  // ---- 칭호 3개
  let sid = 0;
  const stats = q => createCompetition(emptyState(), t0).titleStats({ id: `t${++sid}`, ...q });
  const hs = stats(holder);
  assert(TITLES['epic-collector'].name === '영웅 수집가' && TITLES['legend-owner'].name === '전설의 주인' && TITLES['epic-dex'].name === '도감 마스터', 'V13.182 칭호 3개(키: epic-collector · legend-owner · epic-dex)');
  assert(TITLES['epic-collector'].goal === LEGEND_EGG_EPIC_NEED && TITLES['epic-dex'].goal === EPIC_PET_KEYS.length && TITLES['epic-dex'].stat === 'epic_pets', 'V13.182 도감 마스터는 영웅 펫 전부(마릿수가 늘면 기준도 따라간다)');
  assert(titleUnlocked('epic-collector', hs) && titleUnlocked('legend-owner', hs) && !titleUnlocked('epic-dex', hs) && titleCoins('legend-owner') > 0, 'V13.182 전설 보유자는 영웅 수집가 + 전설의 주인');
  const s19 = stats({ pets: epics(19) }), all = stats({ pets: [...epics(EPIC_PET_KEYS.length), { key: 'haechi', legendary: true }], legend_egg: { e20: 1, key: 'haechi', open_at: 2 } });
  assert(!titleUnlocked('epic-collector', s19) && !titleUnlocked('legend-owner', s19) && titleUnlocked('epic-dex', all) && titleUnlocked('legend-owner', all) && titleUnlocked('epic-collector', all), 'V13.182 19마리는 칭호 없음, 영웅 전부면 도감 마스터, 전설 알을 열면 전설의 주인');
  assert(!titleUnlocked('legend-owner', stats({ pets: [...epics(20)], legend_egg: { e20: 1, wait: 'epic' } })), 'V13.182 열지 않은 전설 알만으로는 전설의 주인이 아니다');
  const emblems = source('../public/modules/emblems.js');
  assert(['epic-collector', 'legend-owner', 'epic-dex'].every(key => emblems.includes(`'${key}'`)), 'V13.182 칭호 3개는 V13.184에 메달 그림(51-3 · 52-2)이 와서 TITLE_ART에 있다');

  // ---- 상점 15,000코인 · 학생당 1개 · 전설 보유자 거절 · 코인 부족 거절
  const buyer = { pets: [{ key: 'dog' }] };
  assert(throws(() => legendEggBuy(buyer, LEGEND_EGG_PRICE - 1, { now: t0 })) === 400 && !buyer.points_spent, 'V13.182 코인이 부족하면 못 산다');
  setMythicRandom(() => 0);
  try {
    const bought = legendEggBuy(buyer, LEGEND_EGG_PRICE, { random: () => .99, now: t0 });
    assert(bought.legendary?.key === LEGENDARY_PET_KEYS.at(-1) && buyer.points_spent === LEGEND_EGG_PRICE && buyer.purchases[0].item === 'legend_egg' && buyer.purchases[0].price === LEGEND_EGG_PRICE && !buyer.pets.some(x => x.mythic), 'V13.182 상점 전설 알은 15,000코인, 사면 바로 전설 펫(신화 없음)');
  } finally { setMythicRandom(null); }
  assert(throws(() => legendEggBuy(buyer, 99999, { now: t0 })) === 409 && buyer.points_spent === LEGEND_EGG_PRICE, 'V13.182 전설 펫이 이미 있으면 못 산다');
  const once = { pets: [{ key: 'dog' }], legend_egg: { buy: 1, coins: 3000, coins_at: 1 } };
  assert(throws(() => legendEggBuy(once, 99999, { now: t0 })) === 409, 'V13.182 학생당 1개');
  const waiting = { pets: [{ key: 'dog' }, ...epics(20)], legend_egg: { e20: 1, wait: 'epic' } };
  assert(throws(() => legendEggBuy(waiting, 99999, { now: t0 })) === 409 && legendEggView(waiting).can_buy === false, 'V13.182 열지 않은 전설 알이 있으면 사지 않고 먼저 연다');
  // 전설 알을 산 뒤 영웅 20마리를 모으면 알 대신 코인.
  buyer.pets.push(...epics(20));
  assert(grantLegendEgg(buyer, t0 + DAY)?.kind === 'coins' && !buyer.legend_egg.wait, 'V13.182 전설 알을 사서 전설이 있는 학생이 영웅 20마리를 모으면 코인 + 칭호');

  // ---- 서버 경로: 접속할 때 한 번(소급), 응답에 미리보기 없음, 학교 소식
  {
    const state = emptyState(), hash = await passwordHash('QaLegend1!'), now = Date.now();
    const base = { role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, avatar_key: 'dog', created_at: now - 9 * DAY };
    state.profiles.push({ ...base, id: 'qa-le', username: 'qa-le', display_name: '전설', pets: [{ key: 'dog', first: true, acquired_at: now - 9 * DAY }, ...epics(21)] });
    state.profiles.push({ ...base, id: 'qa-le2', username: 'qa-le2', display_name: '친구', pets: [{ key: 'cat', first: true, acquired_at: now - 9 * DAY }] });
    const token = (await service(state, 'POST', '/login', { username: 'qa-le', password: 'QaLegend1!', division: 'high' }, null))._cookie;
    const call = (method, path, body = {}) => service(state, method, path, body, token);
    const me = state.profiles.find(x => x.id === 'qa-le');
    const boot = await call('GET', '/bootstrap');
    assert(boot.legend_egg?.due === true && boot.legend_egg.epic === 21 && boot.legend_egg.need === 20 && !me.legend_egg, 'V13.182 이미 20마리 넘는 학생: 홈 데이터가 받을 차례라고만 알리고(GET은 아무것도 쓰지 않는다)');
    const c1 = await call('POST', '/legend-egg/claim');
    const c2 = await call('POST', '/legend-egg/claim');
    assert(c1.given?.kind === 'egg' && c1.legend_egg.waiting && c2.given === null && me.legend_egg.wait === 'epic', 'V13.182 접속할 때 한 번 소급 지급(두 번째는 없음)');
    const text = JSON.stringify([c1, c2, await call('GET', '/bootstrap')]);
    assert(!LEGENDARY_PET_KEYS.some(key => text.includes(`"${key}"`)), 'V13.182 응답 어디에도 나올 전설이 미리 들어 있지 않다');
    const opened = await call('POST', '/legend-egg/open');
    assert(LEGENDARY_PET_KEYS.includes(opened.legendary?.key) && opened.legend_news && opened.legend_egg.legend && !opened.legend_egg.waiting && opened.stats && opened.profile, 'V13.182 열면 전설 펫 + 학교 소식(announceLegend)');
    assert(await call('POST', '/legend-egg/buy').then(() => false, e => e.status === 409), 'V13.182 전설을 만난 뒤에는 상점에서 못 산다(서버)');
    const shop = (await call('GET', '/bootstrap')).legend_egg;
    assert(shop.can_buy === false && shop.legend === true && shop.price === LEGEND_EGG_PRICE, 'V13.182 알 상점 보기: 전설 보유자는 살 수 없음');
  }

  // ---- 화면: 전설 알 탭 · 하단 문구 · 진행 표시 · 연출
  const ui = source('../public/modules/pet-moments.js'), lucky = source('../public/modules/lucky.js'), app = source('../public/app.js'), svc = source('./service.mjs'), rw = source('./rewards.mjs');
  assert(ui.includes('너무 비싸면 영웅 20명 모으면 줍니다^^') && ui.includes('영웅 ${num(le.epic)} / ${num(le.need)}마리'), 'V13.182 상점 하단 문구와 "영웅 N / 20마리"');
  assert(ui.includes("'<span class=\"legend-egg-done\">전설 펫을 이미 만났어요</span>'") && ui.includes("legend: { name: '전설 알', price: LEGEND_EGG_PRICE }"), 'V13.182 전설이 있으면 버튼 대신 "전설 펫을 이미 만났어요"');
  assert(ui.includes("api(le.waiting ? '/legend-egg/open' : '/legend-egg/buy', {})") && ui.includes("api('/legend-egg/claim', {})") && app.includes('maybeLegendEggMoment(A, petChanged)'), 'V13.182 화면은 열기 · 사기 · 접속 때 한 번 받기만 부른다(서버가 정한다)');
  assert(ui.includes("legendaryShow({ legendary: { key: res.legendary.key, legendEgg:") && lucky.includes("if (legendEgg) box.classList.add('lgx-plus');") && lucky.includes('lgx-pillars') && lucky.includes('lgx-crown'), 'V13.182 전설 알은 전설 연출을 재사용하고 한 겹 더(lgx-plus)');
  // 신화는 운으로만: 전설 알 코드는 mythicRoll을 부르지 않는다.
  const legendCode = rw.slice(rw.indexOf('/* ---------- V13.182 전설 알'), rw.indexOf('/* ---------- V13.82 가위바위보'));
  assert(legendCode.length > 500 && !legendCode.includes('mythicRoll') && MYTHIC_RATE.capsule > 0, 'V13.182 전설 알에서는 신화를 굴리지 않는다');
  assert(svc.includes("legend_egg: teacher ? null : legendEggView(p)") && (svc.match(/grantLegendEgg\(p\)/g) || []).length >= 5, 'V13.182 영웅을 얻는 자리(알 · 선물 알 · 코인 뽑기 · 사냥)와 접속 때만 확인');
  assert(source('./build-assets.mjs').includes('"v13182.css"'), 'V13.182 전설 알 화면 CSS');
}
