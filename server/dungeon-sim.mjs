// V13.126 던전 밸런스 시뮬레이션: 진짜 던전 엔진(server/dungeon-engine.mjs)을 가상 시계로 돌린다.
// 학생 모형(아래 student)은 monster-sim.mjs와 같은 방식이다: 아는 단어는 1.3~3.5초 안에 맞히고,
// 모르는 단어는 2.5~6초 뒤에 찍는다. 보기가 많을수록 조금 느리다. 틀린 단어는 정답을 본 뒤 절반쯤 외운다.
// V13.130 영어 쓰기: 아는 단어도 철자까지 쓰는 건 80%만, 1.1초 + 글자당 0.26~0.44초 걸린다. 못 쓰는 단어는
// 1.5~4초 안에 틀린 글자 3번으로 끝난다. 영어 고르기는 뜻 고르기와 같은 속도로 본다.
// "3명 첫 도전"은 반 학생 분포(아는 비율 평균 82%, 속도 개인차)에서 뽑은 세 명이 그 등급컷을 처음 하는 판이다.
// `node server/dungeon-sim.mjs [판 수]`는 등급컷 × 인원(2인/3인) 클리어율과 시간, 층별 실패 위치를 표로 찍는다.
// 출시 검사(dungeon-check.mjs)는 고정 씨앗으로 `clearRate`를 돌려 목표 클리어율에서 벗어나지 않는지 본다.
import { createDungeon, join, ready, answer, settle, tick, nextWake, floorSpec, DUNGEON, FLOORS, CUTS, GRADE_EXTRA_MS } from './dungeon-engine.mjs';

// 작은 씨앗 무작위(mulberry32): 같은 씨앗이면 같은 결과.
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = random => { let u = 0, v = 0; while (!u) u = random(); while (!v) v = random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// 시뮬레이션용 단어 풀(140단어, 뜻 오답 5개 · 영어 오답 5개씩). 영어는 쓰기 문제가 나오게 알파벳 4~9글자.
const ABC = 'abcdefghijklmnopqrstuvwxyz';
const simWord = i => { let w = '', x = i + 27; while (x > 0) { w += ABC[x % 26]; x = Math.floor(x / 26); } for (let k = 0; w.length < 4 + (i % 6); k++) w += ABC[(i * 7 + k * 3) % 26]; return w; };
export const SIM_WORDS = Array.from({ length: 140 }, (_, i) => ({ word_id: 'w' + i, prompt: simWord(i), meaning: '뜻' + i, wrong: [1, 2, 3, 4, 5].map(k => '뜻' + ((i + k * 17) % 140)), wrong_en: [1, 2, 3, 4, 5].map(k => simWord((i + k * 23) % 140)) }));
export const SPELL_RECALL = 0.8;
const PETS = ['dog', 'cat', 'dragon', 'penguin', 'panda', 'snake', 'bear', 'otter', 'owl', 'fox', 'rabbit', 'shark', 'koala', 'hedgehog', 'wolf', 'qilin'];
const GRADES = Object.keys(GRADE_EXTRA_MS);

// 학생 한 명: know(아는 단어 비율), speed(1보다 크면 느림). 반 학생 분포: 아는 비율 평균 0.82(표준편차 0.09).
export function student(random, { know = null, speed = null } = {}) {
  return { know: know ?? clamp(0.82 + gauss(random) * 0.09, 0.5, 0.99), speed: speed ?? clamp(1 + gauss(random) * 0.18, 0.65, 1.5), learned: new Set() };
}

// 한 판. party: 학생 모형 배열(2~3명). 돌려주는 것: 클리어 여부, 시간, 도달 층, 기절 수.
export function run(cut, party, random = Math.random, { grade = null, pets = null } = {}) {
  const g = grade || GRADES[Math.floor(random() * GRADES.length)];
  const s = createDungeon({ id: 'sim', cut, grade: g, seed: Math.floor(random() * 2 ** 31), now: 0 });
  const knows = new Map();
  party.forEach((st, i) => {
    const pid = 'p' + i;
    const order = SIM_WORDS.slice().sort(() => random() - 0.5);
    join(s, { id: pid, name: pid, grade: g, pet: { key: (pets?.[i]) || PETS[Math.floor(random() * PETS.length)] }, questions: order, cleared: ['c3', 'c2', 'c1'] }, 0);
    knows.set(pid, new Map(SIM_WORDS.map(w => [w.word_id, random() < st.know])));
  });
  party.forEach((_, i) => ready(s, 'p' + i, 0));
  const plans = new Map(); // pid -> { n, at, choice }
  const plan = (pid, st) => {
    const q = s.players[pid].q;
    if (!q || plans.get(pid)?.n === q.n) return;
    const known = knows.get(pid).get(q.word_id) || st.learned.has(q.word_id);
    const slip = random() < 0.03;
    if (q.kind === 'spell') {
      const can = known && !slip && random() < SPELL_RECALL;
      const at = q.started_at + (can ? 1100 + q.word.length * (260 + random() * 180) : 1500 + random() * 2500) * st.speed;
      plans.set(pid, { n: q.n, at, spell: true, word: q.word_id, right: can });
      return;
    }
    const n = q.options.length, slow = st.speed * (1 + 0.08 * (n - 4));
    let at, choice;
    if (known && !slip) { at = q.started_at + (1300 + random() * 2200) * slow; choice = q.answer; }
    else {
      at = q.started_at + (2500 + random() * 3500) * slow;
      const can = q.options.map((_, i) => i).filter(i => i !== q.covered && i !== q.marked);
      choice = can[Math.floor(random() * can.length)];
    }
    plans.set(pid, { n: q.n, at, choice, word: q.word_id, right: choice === q.answer });
  };
  let guard = 0;
  while (s.phase !== 'finished' && guard++ < 200000) {
    party.forEach((st, i) => { const pid = 'p' + i; if (s.players[pid].q) plan(pid, st); else plans.delete(pid); });
    const wake = nextWake(s);
    let next = null;
    for (const [pid, p] of plans) if (s.players[pid].q?.n === p.n && p.at < s.players[pid].q.deadline && (!next || p.at < next.p.at)) next = { pid, p };
    if (next && (wake === null || next.p.at <= wake)) {
      plans.delete(next.pid);
      if (next.p.spell) settle(s, next.pid, next.p.right, next.p.at, next.p.n);
      else answer(s, next.pid, next.p.choice, next.p.at, next.p.n);
      if (!next.p.right && random() < 0.5) party[Number(next.pid.slice(1))].learned.add(next.p.word);
    } else if (wake !== null) {
      for (const [pid, p] of plans) if (s.players[pid].q && s.players[pid].q.deadline <= wake && random() < 0.5) party[Number(pid.slice(1))].learned.add(p.word);
      tick(s, wake);
    } else break;
  }
  const r = s.result || {}, m = s.monster?.boss ? s.monster : null;
  return { boss: m ? { marks: m.marks, blocked: m.blocked, cores: m.cores, breaks: m.breaks, stage: m.stage, ms: s.finished_at - s.phase_at } : null, cleared: !!r.cleared, time_ms: r.time_ms || 0, floor: s.floor, downs: s.order.reduce((n, id) => n + s.players[id].downs, 0), accuracy: r.players ? r.players.reduce((n, p) => n + p.accuracy, 0) / r.players.length : 0 };
}

// 클리어율: 반 학생 분포에서 `size`명을 뽑아 처음 도전하는 판 `n`번.
export function clearRate(cut, size = 3, n = 400, seed = 11) {
  const random = seeded(seed * 7919 + CUTS[cut].order * 131 + size);
  let cleared = 0, time = 0, timeN = 0, fails = Array(FLOORS.length + 1).fill(0);
  const boss = { n: 0, marks: 0, blocked: 0, cores: 0, breaks: 0, ms: 0 };
  for (let i = 0; i < n; i++) {
    const party = Array.from({ length: size }, () => student(random));
    const r = run(cut, party, random);
    if (r.boss && r.cleared) { boss.n++; for (const k of ['marks', 'blocked', 'cores', 'breaks', 'ms']) boss[k] += r.boss[k]; }
    if (r.cleared) { cleared++; time += r.time_ms; timeN++; } else fails[r.floor]++;
  }
  return { rate: cleared / n, avg_ms: timeN ? time / timeN : 0, fails: fails.map(f => f / n), boss };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2] || 600);
  const mmss = ms => `${Math.floor(ms / 60000)}:${String(Math.round(ms / 1000) % 60).padStart(2, '0')}`;
  console.log('층별 수치');
  console.log('층   보기  제한(3/2/1등급 컷)     체력(3인·3등급, 정답 환산)  3인 HP(3/2/1)        2인 HP(3/2/1)       피격(3/2/1)');
  for (const f of FLOORS) {
    const hp = (cut, size) => Math.round(f.hp * DUNGEON.HIT * CUTS[cut].hp * (size === 2 ? DUNGEON.DUO_HP : 1)); // (M 크기 기준. S ×0.9, L ×1.1)
    console.log(`${f.boss ? '보스' : f.floor + '층 '}  ${f.options}    ${['c3', 'c2', 'c1'].map(c => (floorSpec(c, f.floor).limit / 1000).toFixed(1)).join(' / ').padEnd(20)}  ${String(f.hp).padEnd(26)}  ${['c3', 'c2', 'c1'].map(c => hp(c, 3)).join(' / ').padEnd(19)}  ${['c3', 'c2', 'c1'].map(c => hp(c, 2)).join(' / ').padEnd(18)}  ${['c3', 'c2', 'c1'].map(c => CUTS[c].hit + f.hitAdd).join(' / ')} (2인 ×${DUNGEON.DUO_HIT})`);
  }
  console.log(`\n클리어율 (반 학생 분포에서 뽑은 파티의 첫 도전, 판 ${n}번씩)`);
  console.log('등급컷     인원  클리어   평균 시간   실패한 층(1·2·3·4·5·보스)');
  const bosses = [];
  for (const cut of ['c3', 'c2', 'c1']) for (const size of [3, 2]) {
    const r = clearRate(cut, size, n);
    bosses.push([cut, size, r.boss]);
    console.log(`${CUTS[cut].name.padEnd(7)}  ${size}인   ${String(Math.round(r.rate * 100)).padStart(4)}%    ${mmss(r.avg_ms).padStart(6)}     ${r.fails.slice(1).map(x => Math.round(x * 100) + '%').join(' · ')}`);
  }
  console.log(`\n보스 킬러 골렘 (깬 판 평균): 2페이즈 ${DUNGEON.PHASE2_AT * 100}% · 3페이즈 ${DUNGEON.PHASE3_AT * 100}%, 채점 ${DUNGEON.MARK_EVERY_MS / 1000}초마다 ${DUNGEON.MARK_NEED}연속(실패 피격 ×${DUNGEON.MARK_HIT}), 핵 ${DUNGEON.CORE_MS / 1000}초 · 목표 서 있는 인원 × ${DUNGEON.CORE_PER_PLAYER} · 브레이크 ${DUNGEON.BREAK_SHARE * 100}%`);
  console.log('등급컷     인원  보스전 시간  채점 표적  막음   핵 열림  브레이크');
  for (const [cut, size, b] of bosses) if (b.n) console.log(`${CUTS[cut].name.padEnd(7)}  ${size}인   ${mmss(b.ms / b.n).padStart(6)}     ${(b.marks / b.n).toFixed(1).padStart(5)}    ${(b.marks ? Math.round(b.blocked / b.marks * 100) : 0).toString().padStart(3)}%   ${(b.cores / b.n).toFixed(1).padStart(5)}    ${(b.breaks / b.n).toFixed(1).padStart(5)}`);
}
