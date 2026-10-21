// V13.154 낚싯대 강화 검사(선생님 결정: 5단계 · 진주로 강화 · 물고기 등급 확률은 그대로 · 반 전체 낚시 제외).
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ROD, FIGHT, rodOf, rodLevel, rodPerks, reelRoll } from '../public/modules/reel-rules.js';
import { reelView, reelCast, reelLand, reelRodUp } from './reel.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const throws = fn => { try { fn(); return null; } catch (e) { return e.status || 500; } };

export function runRodChecks(assert) {
  // 규칙: 5단계, 단계마다 조금씩 좋아진다, 비용 합계 4,300 진주.
  const L = ROD.LEVELS;
  assert(ROD.MAX === 5 && L.length === 5 && [2, 3, 4, 5].reduce((n, l) => n + ROD.COST[l], 0) === 4300 && rodLevel(0) === 1 && rodLevel(9) === 5 && rodOf(undefined).level === 1, 'V13.154 낚싯대는 1~5단계, 강화 비용 200 · 500 · 1,200 · 2,400 진주');
  assert(L.every((x, i) => !i || (x.reel > L[i - 1].reel && x.tension < L[i - 1].tension && x.snap > L[i - 1].snap && x.skill > L[i - 1].skill)) && L[4].reel === 1.25 && L[4].snap === 1.2 && L[0].snap === .75,
    'V13.154 단계가 오를수록 감는 속도 · 빨간 칸 버티기 · 특기 게이지가 좋아지고 텐션은 덜 오른다(1단계는 예전과 같음)');
  assert(rodPerks(1).every(x => x.now && x.next) && rodPerks(5).every(x => x.now && !x.next), 'V13.154 강화 창의 "지금 → 다음" 설명, 5단계는 다음이 없다');
  // 서버: 진주로 한 단계씩, 모자라면 · 최고면 막는다.
  const p = { reel: { pearls: 150 } };
  assert(reelView(p).rod === 1 && reelView(p).rod_next === 200 && throws(() => reelRodUp(p)) === 400 && p.reel.pearls === 150, 'V13.154 진주가 모자라면 강화하지 않는다');
  p.reel.pearls = 5000;
  const ups = [2, 3, 4, 5].map(() => reelRodUp(p));
  assert(ups.map(x => x.rod).join() === '2,3,4,5' && p.reel.pearls === 700 && reelView(p).rod_next === null && throws(() => reelRodUp(p)) === 409, 'V13.154 강화는 한 단계씩, 5단계에서 멈춘다');
  // 물고기는 낚싯대와 상관없이 같은 확률(던지기 · 미끼 · 속성만). 최소 파이팅 시간은 감는 속도만큼 줄여서 본다.
  const q = { reel: { bait: 2, rod: 5 } };
  const c = reelCast(q, { id: 'cast-1', cast: 'good', now: 0, seed: 7 });
  assert(q.reel.live.rod === 5 && JSON.stringify(reelRoll(7, 'good')) === JSON.stringify({ key: q.reel.live.key, rarity: q.reel.live.rarity, kg: q.reel.live.kg }) && c.fight, 'V13.154 던질 때 낚싯대 단계를 남기고, 잡히는 물고기는 낚싯대와 상관없다');
  const min = FIGHT[q.reel.live.rarity].min, fast = Math.ceil(min / 1.25) - 1500 + 50;
  const landed = reelLand(q, { id: 'cast-1', result: 'caught', now: fast });
  assert(landed.caught, 'V13.154 5단계 낚싯대는 최소 파이팅 시간을 감는 속도(1.25배)만큼 줄여서 본다');
  // 화면: 파이팅에 낚싯대 값을 쓰고, 코드 낚싯대 · 릴 색이 단계마다 바뀌며, 그림 31을 쓴다. 반 전체 낚시는 쓰지 않는다.
  const ui = source('../public/modules/reel.js');
  assert(['(40 + pull * 22) * rod.tension * dt', '/ Math.pow(pull, .35) * rod.reel : 0;', 'f.dist -= f.reelV * dt', 'f.skill + 7 * rod.skill * dt', 'if (f.redFor > rod.snap) return lose('].every(x => ui.includes(x)) && ui.includes('function paintRod()') && ui.includes('data-rl="rod"') && ui.includes("api('/reel/rod', { from: myRod().level })"),
    'V13.154 파이팅에 낚싯대 값(텐션 · 감기 · 특기 · 빨간 칸)을 쓰고, 강화하면 낚싯대 색이 바로 바뀐다');
  const pub = new URL('../public/assets/fishing/', import.meta.url);
  const art = [2, 3, 4, 5].flatMap(t => [`pov-rod-t${t}`, `pov-reel-t${t}`]).concat([1, 2, 3, 4, 5].map(t => `icon-rod-${t}`), ['fx-upgrade', 'fx-hammer', 'stamp-tier', 'bg-forge']);
  assert(art.every(n => existsSync(new URL(`${n}.webp`, pub))) && ui.includes("...[1, 2, 3, 4, 5].map(t => `icon-rod-${t}`), 'fx-upgrade', 'fx-hammer', 'stamp-tier', 'bg-forge',"), 'V13.154 그림 31(단계별 낚싯대 · 아이콘 · 강화 연출 · 작업대 배경)이 있고 화면이 쓴다');
  assert(/#rl-rod-ico>\.rl-art\{position:static;display:block;width:38px;height:38px/.test(source('../public/v13154.css')) && ui.includes('<span id="rl-rod-ico">'), 'V13.156 옆 메뉴 낚싯대 아이콘 그림은 38px(span 안이라 .rl-ico>.rl-art가 안 먹던 것)');
  assert(!/ROD|rodOf/.test(source('../public/modules/party.js')) && source('./service.mjs').includes("if (path === '/reel/rod' && method === 'POST')"), 'V13.154 반 전체 낚시(교실 게임)는 낚싯대 강화를 쓰지 않는다, 강화는 /reel/rod');
}
