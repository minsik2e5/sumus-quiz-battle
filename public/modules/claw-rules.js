import { seeded } from './fishing-rules.js';
import { CLAW_DOLLS, CLAW_ART } from './claw-art.js';

// V13.180 인형뽑기(놀이터). 구성안 docs/claw-machine-design.md(선생님 승인 추천안).
// 집게권(공부로만) 1장 = 한 판: 조준 30초(연출 중 멈춤) · 인형 20개 · 집게 3번. 인형은 12지 동물 봉제 인형(도감 수집품)뿐이다:
//   진짜 펫 · 알은 절대 나오지 않는다(펫 경제를 지킨다). 인형 하나에 작은 코인(하루 상한)과 도감 칸.
// 판 배치(어느 인형이 어디에)는 서버가 판 id로 정하고, 집게가 잡는지 · 놓치는지도 서버가 정한다(server/claw.mjs).
//   화면(claw.js)은 시작 → 내린 위치 → 서버 결과 순서로 연출만 한다.
// 밸런스 목표: 하루 가치 열심 약 26 · 보통 약 8코인(낚시 · 몬스터 사냥의 약 ¼: 같은 공부 활동에서 따로 나오는 자원이라).

export const CLAW = {
  SOURCES: ['practice', 'attend', 'match'], // 곳마다 하루 1장(연습 끝내기 10문제 이상 · 출석 · 짝 맞추기 별 3) → 하루 최대 3장
  MIN_PRACTICE: 10,
  TICKET_MAX: 6,               // 보관 상한(이월된다)
  TIME: 30,                    // 한 판 조준 시간(초). 집게 연출 중에는 멈춘다
  DOLLS: 20,                   // 한 판 인형 수
  DROPS: 3,                    // 한 판 집게 수
  R: 0.085,                    // 인형 반지름(바닥 좌표 0~1 기준)
  AIM: { perfect: 0.35, good: 0.7, edge: 1 }, // 집게 중심 ~ 인형 중심 거리 ÷ R
  GRAB: { perfect: 38, good: 26, edge: 10 },  // 잡힐 확률(%)
  PITY: 5, PITY_MAX: 20,       // 닿았는데 놓칠 때마다 다음 집게 +5%p(최대 +20, edge는 절반). 뽑으면 0
  GOLD_ROUND: 25,              // 판마다 황금 인형이 1개 있을 확률(%), 맨 위층
  GOLD_X: 0.5,                 // 황금 인형 잡힐 확률 배수
  JACKPOT: 4,                  // 뽑을 때 옆 인형이 같이 딸려 나올 확률(%)
  SLIP: { lift: 60, chute: 15, loose: 25 }, // 놓침 모양(연출만 다르다)
  COIN: 6, GOLD_COIN: 20,      // 인형 · 황금 인형 하나에 코인
  COIN_DAILY: 30,              // 하루 코인 상한(넘어도 인형 · 도감은 그대로)
  BOOK_BONUS: 100,             // 도감 12종 완성 코인(한 번)
  FIRST_MS: 1200,              // 판 시작 뒤 첫 집게까지 최소
  GAP_MS: 4000,                // 앞 집게 뒤 다음 집게까지 최소(연출 길이)
  ANIM_MS: 4500,               // 집게 연출 하나의 길이(판 마감 계산용)
  GRACE_MS: 15000,             // 시간이 끝난 뒤 남은 집게(하나에 5초)와 네트워크 여유
  // 조준 비율 상한(몬스터 사냥 QUALITY_GUARD와 같은 생각): 최근 WINDOW번 중 perfect가 PERFECT 이상이면 이번 perfect → good,
  //   perfect + good가 TOP 이상이면 → edge. MIN번 전에는 보지 않는다. 좌표를 꾸며 늘 한가운데를 보내도 이득이 막히고,
  //   잘하는 학생(perfect 40% · good 35%)은 거의 걸리지 않는다(검사).
  GUARD: { WINDOW: 20, MIN: 8, PERFECT: 0.7, TOP: 0.95 },
  PREVIEW: 6                   // 교사 미리보기 계정: 들어올 때마다 집게권을 채운다
};
// 도감 순서 = 12지 순서(p.claw.b 배열 순서). 그림: public/assets/claw/doll-<key>{,-grab,-fall,-joy}.webp
export const DOLL_KEYS = ['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'sheep', 'monkey', 'rooster', 'dog', 'pig'];
export const DOLLS = {
  rat: { ko: '쪼꼬 쥐', animal: '쥐' }, ox: { ko: '음메 소', animal: '소' }, tiger: { ko: '어흥 호랑이', animal: '호랑이' },
  rabbit: { ko: '깡총 토끼', animal: '토끼' }, dragon: { ko: '미르 용', animal: '용' }, snake: { ko: '스르르 뱀', animal: '뱀' },
  horse: { ko: '따각 말', animal: '말' }, sheep: { ko: '몽실 양', animal: '양' }, monkey: { ko: '끼끼 원숭이', animal: '원숭이' },
  rooster: { ko: '꼬꼬 닭', animal: '닭' }, dog: { ko: '멍멍 강아지', animal: '개' }, pig: { ko: '꿀꿀 돼지', animal: '돼지' }
};
export const dollName = (k, gold = false) => `${gold ? '황금 ' : ''}${DOLLS[k]?.ko || '인형'}`;
// 그림 게이트: 네 자세가 다 있는 인형만 나온다(build:assets가 claw-art.js를 만든다). 기계 · 집게 그림과 인형 6종 이상이 있어야 열린다.
export const dollReady = (k, ready = CLAW_DOLLS) => DOLL_KEYS.includes(k) && ready.has(k);
export const CLAW_NEEDS = ['machine', 'claw-open', 'claw-closed', 'claw-grip-back', 'claw-grip-front'];
export const clawOpen = (dolls = CLAW_DOLLS, art = CLAW_ART) => CLAW_NEEDS.every(n => art.has(n)) && DOLL_KEYS.filter(k => dolls.has(k)).length >= 6;
export const roundEnds = at => Number(at) + CLAW.TIME * 1000 + CLAW.DROPS * CLAW.ANIM_MS + CLAW.GRACE_MS;

// 더미 모양 틀(20자리: x 왼→오, y 뒤→앞, z 층). 앞 왼쪽(x < 0.34, y > 0.25)은 배출구라 비운다.
//   물리 대신 미리 다듬은 겹침 배치: 서버와 화면이 늘 같은 자리를 본다(구성안 §9).
const TEMPLATE = [
  [0.14, 0.12, 0], [0.38, 0.1, 0], [0.58, 0.08, 0], [0.8, 0.12, 0], [0.47, 0.42, 0], [0.68, 0.38, 0], [0.9, 0.42, 0],
  [0.42, 0.78, 0], [0.62, 0.74, 0], [0.84, 0.8, 0], [0.24, 0.08, 0], [0.98, 0.7, 0],
  [0.48, 0.22, 1], [0.7, 0.2, 1], [0.58, 0.58, 1], [0.8, 0.6, 1], [0.32, 0.12, 1],
  [0.6, 0.36, 2], [0.72, 0.5, 2], [0.5, 0.48, 2]
];
// 판 id → 정수 씨앗.
export function roundSeed(id) {
  let h = 2166136261;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
// 판 배치(판 id와 그림 있는 인형으로 정해진다). i: 자리 번호, k: 인형, g: 황금 1, x · y: 바닥(0~1), z: 층, r: 기울기, s: 크기.
export function roundLayout(id, ready = DOLL_KEYS.filter(k => dollReady(k))) {
  const keys = ready.length ? ready : DOLL_KEYS, rand = seeded(roundSeed(id));
  const pick = () => keys[Math.min(keys.length - 1, Math.floor(rand() * keys.length))];
  const round3 = v => Math.round(v * 1000) / 1000;
  const dolls = TEMPLATE.slice(0, CLAW.DOLLS).map(([x, y, z], i) => ({
    i, k: pick(), g: 0, x: round3(Math.min(0.99, Math.max(0.02, x + (rand() - 0.5) * 0.04))), y: round3(Math.min(0.98, Math.max(0.03, y + (rand() - 0.5) * 0.05))), z,
    r: Math.round((rand() - 0.5) * 36), s: round3(0.92 + rand() * 0.16)
  }));
  if (rand() * 100 < CLAW.GOLD_ROUND) { const top = dolls.filter(d => d.z === 2); top[Math.floor(rand() * top.length) % top.length].g = 1; }
  return dolls;
}
// 집게가 닿는 인형: 반지름 안에서 가장 위층, 같은 층이면 가장 가까운 것. won: 이미 뽑힌 자리 비트.
export function touchAt(dolls, x, y, won = 0) {
  let best = null;
  for (const d of dolls) {
    if (won & (1 << d.i)) continue;
    const dist = Math.hypot(x - d.x, y - d.y) / (CLAW.R * d.s);
    if (dist > CLAW.AIM.edge) continue;
    if (!best || d.z > best.d.z || (d.z === best.d.z && dist < best.dist)) best = { d, dist };
  }
  if (!best) return { aim: 'miss', doll: null, dist: null };
  const aim = best.dist <= CLAW.AIM.perfect ? 'perfect' : best.dist <= CLAW.AIM.good ? 'good' : 'edge';
  return { aim, doll: best.d, dist: best.dist };
}
// 잡힐 확률(0~1).
export function grabChance(aim, { pity = 0, gold = false } = {}) {
  const base = CLAW.GRAB[aim];
  if (!base) return 0;
  const p = (base + (aim === 'edge' ? pity / 2 : pity)) / 100;
  return Math.min(0.9, p * (gold ? CLAW.GOLD_X : 1));
}
// 조준 비율 상한. log: 최근 조준 글자열('p' · 'g' · 'e' · 'm').
export function guardAim(aim, log = '') {
  const G = CLAW.GUARD, recent = String(log).slice(-G.WINDOW);
  if (aim !== 'perfect' && aim !== 'good') return aim;
  if (recent.length < G.MIN) return aim;
  const share = re => (recent.match(re) || []).length / recent.length;
  let a = aim;
  if (a === 'perfect' && share(/p/g) >= G.PERFECT) a = 'good';
  if (share(/[pg]/g) >= G.TOP) a = 'edge';
  return a;
}
export const AIM_CODE = { perfect: 'p', good: 'g', edge: 'e', miss: 'm' };
// 집게 하나의 결과. r1 · r2 · r3: 0~1 난수(서버가 만든다).
export function rollDrop(aim, { pity = 0, gold = false } = {}, r1, r2, r3) {
  if (aim === 'miss') return { result: 'miss', slip: 'loose', grip: 0, jackpot: false };
  const win = r1 < grabChance(aim, { pity, gold });
  if (win) return { result: 'win', slip: null, grip: 72 + Math.floor(r2 * 28), jackpot: r3 * 100 < CLAW.JACKPOT };
  const s = r2 * 100, slip = s < CLAW.SLIP.lift ? 'lift' : s < CLAW.SLIP.lift + CLAW.SLIP.chute ? 'chute' : 'loose';
  const grip = slip === 'lift' ? 35 + Math.floor(r3 * 25) : slip === 'chute' ? 55 + Math.floor(r3 * 15) : 10 + Math.floor(r3 * 20);
  return { result: 'slip', slip, grip, jackpot: false };
}
export const nextPity = (pity, result) => result === 'win' ? 0 : result === 'slip' ? Math.min(CLAW.PITY_MAX, Number(pity || 0) + CLAW.PITY) : Number(pity || 0);
// 대박: 뽑힌 인형 바로 옆(같은 층 이하, 2R 안) 인형 하나가 딸려 나온다.
export function jackpotBuddy(dolls, target, won = 0) {
  let best = null;
  for (const d of dolls) {
    if (d.i === target.i || (won & (1 << d.i)) || d.z > target.z) continue;
    const dist = Math.hypot(d.x - target.x, d.y - target.y);
    if (dist <= CLAW.R * 2.2 && (!best || dist < best.dist)) best = { d, dist };
  }
  return best?.d || null;
}
// 뽑힌 자리 둘레 인형이 내려앉는 방향(화면 연출용).
export function settleNudges(dolls, target, won = 0) {
  return dolls.filter(d => d.i !== target.i && !(won & (1 << d.i)) && d.z >= target.z && Math.hypot(d.x - target.x, d.y - target.y) <= CLAW.R * 2)
    .map(d => ({ i: d.i, dx: Math.round((target.x - d.x) * 0.3 * 1000) / 1000, dy: Math.round((target.y - d.y) * 0.3 * 1000) / 1000 }));
}

// 밸런스 시뮬레이션(검사가 부른다: server/claw-check.mjs). 조준 비율 aim = [perfect, good, edge](나머지 miss).
//   학생은 황금 인형이 있으면 먼저 노린다. 칭호 코인은 titles.js의 등급 코인과 같다(첫 인형 10 · 수집가 30 · 장인 60 · 황금 손 30 · 집게의 전설 120).
export const CLAW_TITLE_COINS = { claw1: 10, claw6: 30, claw12: 60, clawgold: 30, claw100: 120 };
export function clawSim({ days = 30, rounds = 3, aim = [0.4, 0.35, 0.15], seed = 1 } = {}) {
  const rand = seeded(seed), book = new Set(), gold = new Set(), titles = new Set();
  let pity = 0, dolls = 0, golds = 0, coins = 0, bonus = 0, titleCoins = 0;
  const title = k => { if (!titles.has(k)) { titles.add(k); titleCoins += CLAW_TITLE_COINS[k]; } };
  for (let day = 0; day < days; day++) {
    let today = 0;
    const pay = n => { const c = Math.min(n, CLAW.COIN_DAILY - today); today += c; coins += c; };
    for (let r = 0; r < rounds; r++) {
      let goldHere = rand() * 100 < CLAW.GOLD_ROUND;
      for (let n = 0; n < CLAW.DROPS; n++) {
        const x = rand(), a = x < aim[0] ? 'perfect' : x < aim[0] + aim[1] ? 'good' : x < aim[0] + aim[1] + aim[2] ? 'edge' : 'miss';
        const g = goldHere && a !== 'miss';
        const res = rollDrop(a, { pity, gold: g }, rand(), rand(), rand());
        pity = nextPity(pity, res.result);
        if (res.result !== 'win') continue;
        const got = [{ k: Math.floor(rand() * 12), g }];
        if (res.jackpot) got.push({ k: Math.floor(rand() * 12), g: false });
        for (const d of got) {
          dolls++;
          if (d.g) { goldHere = false; golds++; gold.add(d.k); pay(CLAW.GOLD_COIN); title('clawgold'); } else { book.add(d.k); pay(CLAW.COIN); }
          title('claw1');
          if (book.size >= 6) title('claw6');
          if (book.size >= 12 && !titles.has('claw12')) { title('claw12'); bonus += CLAW.BOOK_BONUS; }
          if (dolls >= 100) title('claw100');
        }
      }
    }
  }
  return { dolls, golds, coins, bonus, titleCoins, kinds: book.size, goldKinds: gold.size, complete: book.size >= 12 };
}
export function clawSimAverage(opts, runs = 3000) {
  const sum = { dolls: 0, golds: 0, coins: 0, bonus: 0, titleCoins: 0, complete: 0 };
  for (let s = 1; s <= runs; s++) { const r = clawSim({ ...opts, seed: s * 7919 }); for (const k of Object.keys(sum)) sum[k] += Number(r[k]); }
  return Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, Math.round(v / runs * 100) / 100]));
}
// 하루 가치(코인어치): 인형 코인 + 칭호 코인 + 도감 완성 보너스를 날 수로 나눈다.
export const clawDayValue = (r, days = 30) => Math.round((r.coins + r.titleCoins + r.bonus) / days * 10) / 10;
