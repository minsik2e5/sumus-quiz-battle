// V13.213 검사: 이벤트 알 — 가을 이벤트 알의 표시 이름을 '이벤트 알'로 바꾸고, 특별 한정 펫 3마리도 함께 넣는다.
// 내부 키(autumn) · 구매 기록(autumn_egg)은 그대로, 판매는 특별 펫 기간(12/31)까지, 영웅 결과의 특별 10% 경로도 그대로 둔다.
import { readFileSync } from 'node:fs';
import { SEASONS, seasonKeys, seasonOnSale, seasonsInEpic, seasonsOver } from '../public/modules/core.js';
import { openEgg, limitedFromEpic } from './rewards.mjs';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const kst = t => Date.parse(t + '+09:00');
const AUTUMN = ['pumpkincat', 'ghost', 'riceball', 'tissue', 'glue'], SPECIAL = ['hachiware', 'usagi', 'chiikawa', 'furuhonya', 'kurimanju', 'momonga', 'rakko', 'shisa'];

export async function runEventEggChecks(assert) {
  const E = SEASONS.autumn;
  /* ---------- 이름 · 가격 · 기간 ---------- */
  assert(E.egg === '이벤트 알' && E.badge === '이벤트 한정' && E.shop_mark === '🎁' && E.mark === '🎃' && E.price === 600 && E.start === '2026-10-01' && E.end === '2026-12-31' && /12월 31일/.test(E.until) && E.after_rate === 5,
    'V13.213 이벤트 알: 이름 "이벤트 알" · 배지 "이벤트 한정" · 600코인 그대로 · 12/31까지 판매');
  assert(seasonOnSale(kst('2026-11-30T23:59:00'))?.id === 'autumn' && seasonOnSale(kst('2026-12-15T12:00:00'))?.egg === '이벤트 알' && seasonOnSale(kst('2026-12-31T23:59:00'))?.id === 'autumn' && seasonOnSale(kst('2027-01-01T00:00:00')) === null,
    'V13.213 이벤트 알은 한국 시간 12/31 밤까지 팔고 1/1부터 안 판다');
  assert(!seasonsOver(kst('2026-12-31T23:59:00')).length && seasonsOver(kst('2027-01-01T00:00:00')).join() === 'autumn,special',
    'V13.213 두 시즌 모두 1/1부터 지난 시즌(영웅 알에 숨음)이 된다');

  /* ---------- 알 풀: 13마리 중 아직 없는 친구 (V13.219: 특별 5마리 더) ---------- */
  const sale = seasonOnSale(kst('2026-11-20T12:00:00'));
  assert(sale.keys.length === 13 && [...AUTUMN, ...SPECIAL].every(k => sale.keys.includes(k)) && new Set(sale.keys).size === 13 && seasonKeys('autumn').join() === AUTUMN.join() && seasonKeys('special').join() === SPECIAL.join(),
    'V13.213 · V13.219 이벤트 알 풀은 가을 5마리 + 특별 8마리 = 13마리(중복 없음), 시즌 소속(limited)은 그대로');
  const now = kst('2026-11-20T12:00:00');
  const kid = (...keys) => ({ pets: [{ key: 'dog' }, ...keys.map(key => ({ key }))] });
  const miss = p => sale.keys.filter(k => !p.pets.some(x => x.key === k));
  // 균등: random 값에 따라 남은 목록의 같은 칸이 나온다.
  const picks = sale.keys.map((_, i) => { const p = kid(); return openEgg(p, { season: 'autumn', missing: miss(p), price: 600, random: () => (i + .5) / 13, now }).key; });
  assert(picks.join() === sale.keys.join(), 'V13.213 이벤트 알은 남은 친구 중 균등하게 하나를 준다');
  const p = kid(...AUTUMN, ...SPECIAL.filter(k => k !== 'chiikawa')); const left = miss(p);
  const got = openEgg(p, { season: 'autumn', missing: left, price: 600, random: () => .99, now });
  assert(left.join() === 'chiikawa' && got.key === 'chiikawa' && got.limited && p.pets.at(-1).limited && p.purchases[0].item === 'autumn_egg' && p.purchases[0].price === 600 && !got.mythic,
    'V13.213 이미 가진 친구는 다시 안 나오고, 특별 펫도 한정 표시 · 옛 구매 기록 이름(autumn_egg)으로 저장된다');
  const full = kid(...sale.keys);
  assert(miss(full).length === 0, 'V13.213 · V13.219 13마리를 다 모으면 살 친구가 없다');
  // 옛 기록: 가을 이벤트 알로 산 기록과 이미 가진 특별 펫(영웅 결과로 얻은 것)이 그대로 동작한다.
  const old = { pets: [{ key: 'dog' }, { key: 'ghost', limited: true }, { key: 'usagi', limited: true }], purchases: [{ item: 'autumn_egg', key: 'ghost', price: 600 }, { item: 'epic_egg', key: 'usagi', price: 800, limited: true }] };
  assert(miss(old).length === 11 && !miss(old).includes('ghost') && !miss(old).includes('usagi'), 'V13.213 옛 구매 기록 · 이미 가진 특별 펫은 이벤트 알 풀에서 빠진다');

  /* ---------- 영웅 결과 경로 ---------- */
  assert(seasonsInEpic(kst('2026-11-04T00:00:00')).map(x => `${x.id}:${x.rate}`).join() === 'special:10' && seasonsInEpic(kst('2026-12-31T23:59:00')).map(x => `${x.id}:${x.rate}`).join() === 'special:10'
    && SPECIAL.includes(limitedFromEpic(kid(), () => 0, now)) && limitedFromEpic(kid(...SPECIAL), () => 0, now) === null
    && seasonsInEpic(kst('2027-01-01T00:00:00')).map(x => `${x.id}:${x.rate}`).join() === 'autumn:5,special:5',
    'V13.213 판매 중에도 특별 펫은 영웅 결과 10%(가을 펫은 안 나옴), 1/1부터는 두 시즌 모두 after_rate 5%로 영웅 알에 숨는다');

  /* ---------- 화면 · 서버 문구 ---------- */
  const arcade = source('../public/modules/arcade.js'), moments = source('../public/modules/pet-moments.js'), service = source('./service.mjs'), book = source('../public/modules/petbook.js');
  assert(arcade.includes("esc(s.badge || `${s.name} 한정`)") && arcade.includes('이벤트 펫 13마리(가을 5 · 특별 8) 중 못 만난 친구') && arcade.includes('이벤트 펫 13마리를 다 모았어요') && !arcade.includes('가을 이벤트 펫을 다 모았어요'),
    'V13.213 · V13.219 놀이터 알 상점: 배지 "이벤트 한정"과 13마리 안내');
  assert(moments.includes("mark: s.shop_mark || s.mark") && moments.includes('${e.mark || \'🎁\'}') && moments.includes('이벤트 한정</b>') && moments.includes('이벤트 한정 펫(호박냥') && moments.includes('우사기 · 후루혼야 · 쿠리만쥬 · 모몽가 · 랏코 · 시사)') && !moments.includes('가을 이벤트 한정 펫(할로윈'),
    'V13.213 알 가게 창: 이벤트 알 탭은 🎁, 설명은 13마리 이벤트 한정 펫');
  assert(service.includes("const season = body.kind === 'season' ? seasonOnSale(Date.now()) : null;") && service.includes('${season.egg}의 한정 펫을 모두 모았어요!') && book.includes('${seasonOnSale().egg} ${num(seasonOnSale().price)}코인'),
    'V13.213 서버는 판매 중인 알의 풀(seasonOnSale().keys)로 팔고, 다 모으면 이벤트 알 이름으로 알린다 · 도감도 판매 중 알 이름');
}
