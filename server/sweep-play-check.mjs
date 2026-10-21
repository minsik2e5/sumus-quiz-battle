// V13.168 놀이터 점검(낚시터 · 짝 맞추기 · 몬스터 사냥)에서 찾아 고친 것.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STANDARD_PET_KEYS, EPIC_PET_KEYS } from '../public/modules/core.js';
import { huntMap, huntMeet, huntThrow, huntView } from './hunt.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const half = () => .5;

export async function runSweepPlayChecks(assert, expectStatus) {
  const t0 = Date.parse('2026-10-20T03:00:00Z'); // 화요일 12:00 KST
  const other = STANDARD_PET_KEYS.find(k => k !== 'dog');
  const petSpot = key => ({ id: 'petspot', kind: 'pet', key, tier: 'pet', form: 1, cell: 8, x: 50, y: 50 });

  /* ---------- 사냥: 만나는 동안 그 펫이 다른 곳에서 먼저 생김 ---------- */
  {
    // 지도를 다시 열면(만나기 다시 누름) 자리와 만남이 같은 새 펫이고, 잡으면 그 펫이 생긴다.
    const p = { pets: [{ key: 'dog' }], hunt: { gold: 1 } };
    huntMap(p, t0, half);
    p.hunt.map.spots.push(petSpot(other));
    huntMeet(p, 'petspot', t0 + 1000, half);
    p.pets.push({ key: other }); // 알 상점에서 같은 펫이 나왔다
    const again = huntMeet(p, 'petspot', t0 + 2000, half);
    assert(again.key !== other && p.hunt.live.key === again.key, 'V13.168 사냥: 만나는 펫이 알에서 먼저 생기면 지도 자리와 만남(live)이 같은 못 만난 펫으로 바뀐다(화면 · 던지기가 다른 펫이었다)');
    const r = huntThrow(p, { id: 'sweep-throw-1', spot: 'petspot', ball: 'gold', now: t0 + 9000, random: half });
    assert(r.caught && r.new_pet && r.key === again.key && p.pets.some(x => x.key === again.key) && p.hunt.gold === 0,
      'V13.168 사냥: 그 펫을 황금 공으로 잡으면 화면에 보인 새 펫이 생긴다(예전: 이미 있는 펫을 잡아 황금 공만 사라짐)');
  }
  {
    // 지도를 다시 열지 않고 바로 던져도 같은 등급의 못 만난 펫으로 바꿔 잡는다.
    const p = { pets: [{ key: 'dog' }], hunt: { basic: 1 } };
    huntMap(p, t0, half);
    p.hunt.map.spots.push(petSpot(other));
    huntMeet(p, 'petspot', t0 + 1000, half);
    p.pets.push({ key: other });
    const r = huntThrow(p, { id: 'sweep-throw-2', spot: 'petspot', ball: 'basic', now: t0 + 9000, random: () => 0 });
    assert(r.caught && r.new_pet && r.key !== other && !EPIC_PET_KEYS.includes(r.key) && p.pets.filter(x => x.key === r.key).length === 1,
      'V13.168 사냥: 지도를 다시 열지 않고 던져도 이미 있는 펫 대신 같은 등급의 못 만난 펫을 잡는다');
  }
  {
    // 그 등급 펫을 다 모았으면 공을 쓰지 않고 막는다(409), 지도를 다시 열면 그 자리는 사라진다.
    const p = { pets: STANDARD_PET_KEYS.map(key => ({ key })), hunt: { basic: 2 } };
    huntMap(p, t0, half);
    p.hunt.map.spots.push(petSpot('dog'));
    p.hunt.live = { spot: 'petspot', kind: 'pet', key: 'dog', tier: 'pet', at: t0, throws: 0 };
    await expectStatus(409, async () => huntThrow(p, { id: 'sweep-throw-3', spot: 'petspot', ball: 'basic', now: t0 + 9000, random: half }), 'V13.168 사냥: 기본 펫을 다 모았는데 펫 자리에 던지면 409');
    assert(p.hunt.basic === 2 && !(p.hunt.done || []).length, 'V13.168 사냥: 그때 공은 그대로(영수증도 없음)');
    huntMap(p, t0 + 10000, half);
    assert(!p.hunt.map.spots.some(s => s.id === 'petspot') && !p.hunt.live, 'V13.168 사냥: 지도를 다시 열면 그 펫 자리와 만남은 사라진다');
  }

  /* ---------- 사냥: 만나는 동안 4시간 지도 슬롯이 바뀜(한국 시간 12:00) ---------- */
  {
    const before = Date.parse('2026-10-20T02:59:00Z'); // 11:59 KST
    const p = { pets: [{ key: 'dog' }], hunt: { gold: 1, basic: 1 } };
    const spot = huntMap(p, before, half).spots[0].id;
    huntMeet(p, spot, before + 1000, half);
    const after = before + 2 * 60000; // 12:01 KST: 다음 슬롯
    const r = huntThrow(p, { id: 'sweep-throw-4', spot, ball: 'gold', now: after, random: half });
    const v = huntView(p, after);
    assert(r.caught && Array.isArray(v.spots) && v.spots.length >= 3 && !v.spots.some(s => s.id === spot),
      'V13.168 사냥: 슬롯이 바뀐 뒤 던져 만남이 끝나도 지도가 새 슬롯으로 채워진다(예전: spots null → 지도가 비어 "조용해요"만)');
    const p2 = { pets: [{ key: 'dog' }], hunt: { basic: 2 } };
    const spot2 = huntMap(p2, before, half).spots[0].id;
    huntMeet(p2, spot2, before + 1000, half);
    const r2 = huntThrow(p2, { id: 'sweep-throw-5', spot: spot2, ball: 'basic', now: after, random: () => .99 });
    const v2 = huntView(p2, after);
    assert(!r2.caught && !r2.fled && Array.isArray(v2.spots) && v2.spots.some(s => s.id === spot2) && v2.live?.spot === spot2,
      'V13.168 사냥: 슬롯이 바뀐 뒤 던져 빠져나와도(만나는 중) 지도는 새 슬롯이고 만나는 몬스터는 남는다(도망 버튼 뒤 빈 지도 방지)');
  }

  /* ---------- 짝 맞추기: 결과 화면 비교 문구 ---------- */
  {
    const src = source('../public/modules/match-game.js');
    assert(/const diffLine = record && prev && ms < prev \?/.test(src) && src.includes(": record && !prev ? '첫 기록이에요!'"),
      'V13.168 짝 맞추기: 순위 신기록이어도 내 최고(의심 기록 포함)보다 느리면 "내 최고보다 -0.50초 빨라요"가 아니라 "내 최고까지 0.50초"');
  }
}
