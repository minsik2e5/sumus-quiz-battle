// V13.160 검사: 낚시 교환소 영웅 알(진주 800 · 하루 1개), 선생님이 보낸 알도 알 깨기 연출로.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { REEL } from '../public/modules/reel-rules.js';
import { reelSpend, reelView } from './reel.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const throws = fn => { try { fn(); return null; } catch (e) { return e.status || 500; } };

export function runEggMomentChecks(assert) {
  // 영웅 알: 진주 800개, 하루 1개(다음 날 다시).
  const day = 86400000, t0 = Date.parse('2026-10-20T03:00:00Z');
  const p = { reel: { pearls: 2000 } };
  assert(REEL.EPIC_EGG === 800 && reelView(p, t0).epic_left === 1, 'V13.160 낚시 교환소 영웅 알은 진주 800개');
  reelSpend(p, 'epic_egg', t0)();
  assert(p.reel.pearls === 1200 && reelView(p, t0).epic_left === 0 && throws(() => reelSpend(p, 'epic_egg', t0 + 3600000)) === 409, 'V13.160 영웅 알은 하루에 1개');
  assert(reelView(p, t0 + day).epic_left === 1 && typeof reelSpend(p, 'epic_egg', t0 + day) === 'function', 'V13.160 다음 날에는 영웅 알을 다시 바꿀 수 있다(예전: 일주일에 1개)');
  const ui = source('../public/modules/reel.js');
  assert(ui.includes("${v.epic_left ? '오늘 1개' : '내일 또'}") && ui.includes('진주 ${num(REEL.EPIC_EGG)}개 (하루 1개)'), 'V13.160 교환소 안내도 하루 1개');
  // 선생님 선물 알: 상자를 연 뒤 알 상점과 같은 알 깨기 연출(기본 · 영웅 · 전설 · 신화)을 하나씩.
  const moments = source('../public/modules/pet-moments.js'), cel = source('../public/modules/celebrate.js'), lucky = source('../public/modules/lucky.js');
  assert(moments.includes('export async function giftEggShow(egg)') && moments.includes("mythicShow({ mythic: { key: egg.key, gift: true } })") && moments.includes("legendaryShow({ legendary: { key: egg.key, gift: true } })")
    && moments.includes("epicShow({ key: egg.key, from: 'gift' })") && moments.includes("eggRevealHtml(openOverlay('선생님 알'), egg.key"),
    'V13.160 선생님 알은 등급마다 알 상점과 같은 알 깨기 연출(신화 · 전설 · 영웅 · 기본)');
  assert(cel.includes("import { giftEggShow } from './pet-moments.js';") && cel.includes('for (const g of hatch) await giftEggShow(g.egg);') && cel.includes('알 깨 보기'),
    'V13.160 선물 상자를 열면 "알 깨 보기"로 알을 하나씩 깬다');
  assert(lucky.includes("res.legendary.gift ? '선생님이 보내 주신 알에서 전설 펫이 나왔어요!'") && lucky.includes("from === 'gift' ? '선생님이 보내 주신 알에서 영웅 펫이 나왔어요!'"), 'V13.160 등급 연출 문구가 선생님 선물이라고 말한다');
}
