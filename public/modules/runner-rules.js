// V13.241 펫 대행진(크라우드 러너) 규칙. 화면(public/modules/runner.js)과 서버(server/runner.mjs)가 같은 파일을 쓴다.
// 구성안 docs/pet-runner-plan.md. 서버는 화면이 보낸 조종 기록(input)으로 같은 판을 다시 돌려 별 · 남은 정령을 정한다.
//   - 무리 = 숫자 n 하나 + 가운데 좌우 cx. 정령 하나하나 · 탄 · 파편은 화면 연출이라 여기에 없다.
//   - 고정 틱 50ms. 난수는 판 씨앗(mulberry32)만 쓰고, 움직임은 삼각파(더하기 · 곱하기)로만 → 브라우저 · 서버 결과가 같다(Math.sin 없음).
//   - 판 흐름: run(달리기) → card(카드 3장 중 1장, 틱 안 씀) → rescue(구출 컷인 22틱) → run → siege(공성전) → done.
// 조종 기록: { s: [틱, 목표 좌우(−100~100), …] 바뀐 틱만, h: [틱, …] 공성전 누름이 바뀐 틱(처음은 뗌), c: [카드1, 카드2] }

export const RUNNER = {
  TICK: 50, DT: 0.05,
  SPEED: 10, STEER: 10, ROAD: 4,      // 달리기 10단위/초 · 좌우 따라가기 10단위/초 · 길 폭 ±4
  STAGES: 25,                          // ①단계에서 연 스테이지(하늘 다리). 지도는 100까지.
  MAX_STAGE: 100,
  SHOOT_RANGE: 26,
  RESCUE_TICKS: 22, SIEGE_MAX_TICKS: 600, PET_SIEGE: 0.15,
  STAR_R2: 0.1,                        // 별 2 기준(남은 비율). 별 3 기준은 스테이지 표(STAGE_TABLE)
  // 보상 · 막기(서버)
  COIN_DAILY: 40, BOX_COINS: 10, RAID_COINS: 30, STAR_NEW: 5, STAR_AGAIN: 2,
  PLAYS_DAILY: 300, OPEN_MS: 10 * 60000, MIN_RATIO: 0.9, INPUT_MAX: 4096,
  CHEER_STEP: 0.1, CHEER_MAX: 0.3, CHEER_EVERY: 3,
  BOARD_TOP: 10, BOARD_CACHE_MS: 60000
};
// 펫 등급 세기(CLAUDE.md: 기본 ≈ 영웅 < 전설(+6%) < 신화(+6%), 한정은 기본 정도). 필살기 크기에 곱한다.
export const PET_MUL = { basic: 1, epic: 1, limited: 1, legendary: 1.06, mythic: 1.12 };
export const PET_SKILL = {
  flame: { name: '화염 돌파', text: '앞 바위를 모두 태워요' },
  water: { name: '물대포', text: '앞 장애물을 멈추고 바위를 깎아요' },
  ice: { name: '얼음 다리', text: '잠깐 아무 피해도 안 받아요' },
  leaf: { name: '덩굴 그물', text: '다음 나쁜 문을 좋은 문으로' },
  earth: { name: '바위 방패', text: '다음 충돌 한 번을 막아요' },
  wind: { name: '돌풍', text: '정령이 늘어나요' },
  toxic: { name: '독안개', text: '앞 바위가 약해져요' },
  star: { name: '별똥', text: '성을 크게 깎아요' }
};
export const CARDS = {
  add: { name: n => `정령 +${n}`, tag: '정령' },
  mul: { name: () => '정령 ×1.3', tag: '정령' },
  fire: { name: () => '사격 ×1.5', tag: '강화' },
  shield: { name: () => '방패', tag: '보호' },
  luck: { name: () => '행운 문', tag: '문' },
  magnet: { name: () => '자석', tag: '정령' },
  power: { name: () => '대포 위력 ×2', tag: '대포' },
  rapid: { name: () => '연사 대포', tag: '대포' },
  petup: { name: () => '펫 각성', tag: '펫' },
  crack: { name: () => '수정 금', tag: '펫' }
};
export const cardName = c => CARDS[c?.[0]]?.name(c[1]) || '';

// 처음 도전 때 깰 확률 · 별 3 확률(선생님, "처음에 너무 쉽다" 뒤): 1(튜토리얼) 95% · 2~5 80% · 6~25 68%(보스 바로 다음 75%) · 보스 성 10 · 20은 50%,
// 별 3은 각각 절반쯤. 26~(아직 안 연 곳): 26~50 70% · 51~75 55% · 76~100 40%, 별 3은 25 · 15 · 8%, 보스는 15%p 낮게 · 다음은 10%p 쉽게.
export function stageTarget(s) {
  if (s <= RUNNER.STAGES) {
    const clear = s === 1 ? 0.95 : s <= 5 ? 0.8 : s % 10 === 0 ? 0.5 : s % 10 === 1 ? 0.75 : 0.68;
    return { clear, three: Math.round(clear * 50) / 100 };
  }
  const band = s <= 5 ? [0.98, 0.7] : s <= 25 ? [0.85, 0.4] : s <= 50 ? [0.7, 0.25] : s <= 75 ? [0.55, 0.15] : [0.4, 0.08];
  let [clear, three] = band;
  if (s % 10 === 0) { clear -= 0.15; three = Math.max(0.03, three - 0.15); }
  else if (s > 10 && s % 10 === 1) { clear = Math.min(0.98, clear + 0.1); three = Math.min(0.75, three + 0.1); }
  return { clear, three };
}
export const isBoss = s => s % 10 === 0;
export const theme = s => s <= 25 ? 'sky' : s <= 50 ? 'desert' : s <= 75 ? 'ice' : 'volcano';
// 시작 정령(강화 없음). 응원 정령(같은 스테이지 3연패마다 +10%, 최대 +30%)은 cheer로 곱한다.
export const baseStart = s => 10 + Math.floor((s - 1) / 5) * 2;
export const cheerOf = fails => Math.min(RUNNER.CHEER_MAX, Math.floor(Math.max(0, fails) / RUNNER.CHEER_EVERY) * RUNNER.CHEER_STEP);

// 스테이지 표 [성 HP, 별 3 기준 남은 비율 %, 위험 세기 %](바위 HP · 나쁜 문 · 톱날 · 망치 피해에 곱함). server/runner-sim.mjs가 "처음 도전하는 학생" 흉내 봇으로 맞춘 값(목표는 stageTarget).
// 맵 생성기를 바꾸면 node server/runner-sim.mjs tune 으로 다시 만들고, server/runner-check.mjs가 확률을 확인한다.
export const STAGE_TABLE = [[105,59,70],[181,47,100],[246,26,100],[261,22,85],[354,29,100],[224,20,100],[281,29,100],[291,23,85],[151,24,100],[365,30,100],[246,39,100],[329,35,85],[354,32,100],[308,43,85],[286,30,100],[656,42,100],[228,30,100],[375,47,100],[500,24,100],[652,25,100],[229,38,70],[433,27,85],[601,20,70],[360,39,85],[486,29,100],[501,35,100],[454,46,100],[549,31,85],[339,38,70],[678,55,85],[332,47,85],[638,42,70],[589,33,100],[699,40,85],[434,62,100],[648,39,100],[547,27,70],[478,43,100],[442,50,85],[879,33,85],[686,37,42],[708,42,70],[739,39,70],[1027,46,55],[1005,35,70],[835,43,70],[686,43,70],[1251,42,55],[791,51,85],[911,54,85],[755,41,85],[835,27,70],[1160,59,70],[1115,30,85],[1302,40,70],[1274,36,70],[1059,56,55],[1209,46,70],[821,45,85],[1786,51,55],[1482,31,55],[1124,49,70],[1321,27,70],[1858,39,42],[1614,39,55],[2111,50,55],[1378,38,55],[1974,40,42],[834,42,55],[1485,52,85],[903,57,55],[1888,25,42],[2488,47,42],[971,43,55],[1792,30,55],[1358,42,70],[2263,50,42],[944,57,42],[1606,32,42],[3597,42,55],[3058,36,42],[2301,27,42],[1865,33,42],[1691,33,55],[2100,34,42],[1998,49,42],[2643,22,32],[3104,49,55],[2336,55,42],[1903,36,55],[2048,45,42],[1786,52,32],[2951,23,42],[2383,37,42],[2539,51,32],[3872,33,32],[3212,33,55],[5475,44,24],[3254,29,42],[2246,56,32]];

/* ---------- 난수 · 움직임 ---------- */
export function mulberry(seed) { let s = seed | 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const stageSeed = s => Math.imul(s + 1013, 2654435761) >>> 0 ^ 0x5eed;
// 삼각파: p(0~1 반복) → −1~1. 0.25에서 1, 0.75에서 −1, 0 · 0.5에서 0을 지난다.
export const tri = p => { const f = p - Math.floor(p); return f < 0.25 ? f * 4 : f < 0.75 ? 2 - f * 4 : f * 4 - 4; };
export const crowdR = n => Math.min(3, 0.4 + 0.21 * Math.sqrt(Math.min(n, 150)));
const GATE = { '+': (n, v) => n + v, '×': (n, v) => n * v, '−': (n, v) => Math.max(0, n - v) };
export const gateApply = (n, g) => GATE[g[0]](n, g[1]);
export const goodGate = g => g[0] !== '−';
const dmgPerTick = (n, fire) => (1 + Math.min(n, 400) * 0.028) * fire;

/* ---------- 맵 생성기(스테이지 번호 → 같은 맵) ---------- */
// 물체: gate{z,l,r} · rock{z,x,hp} · saw{z,x0,amp,per} · hammer{z,x,per,ph} · card{z,cards} · crystal{z,x,hp} · end{z}
// over.hz: 위험 세기 덮어쓰기(난도 맞출 때만). 보통은 스테이지 표의 값.
export function makeMap(stage, over = null) {
  const s = Math.max(1, Math.min(RUNNER.MAX_STAGE, stage | 0)), R = mulberry(stageSeed(s)), d = s / 100;
  const row = STAGE_TABLE[s - 1], hz = over?.hz ?? (row ? row[2] / 100 : 1);
  const u = (a, b) => a + R() * (b - a), pick = arr => arr[Math.floor(R() * arr.length)];
  const items = [];
  const K = s === 1 ? 18 : s <= 10 ? 36 : s <= 50 ? 44 : 52, GAP = 12;   // 1스테이지는 튜토리얼(달리기 약 22초 + 공성전)
  const cardAt = [Math.floor(K * 0.34), Math.floor(K * 0.67)], crystalAt = Math.floor(K * 0.82);
  let e = baseStart(s), z = 18;
  let nref = 175; for (let i = 0; i < s; i++) nref *= 1.03;   // 기준 무리: 5스테이지 공성전 약 200 · 25스테이지 약 370(숫자가 크게 불어나는 맛)   // 거듭제곱 함수 대신 곱하기(엔진마다 끝자리가 같게)
  const r5 = v => Math.max(5, Math.round(v / 5) * 5);
  // 기대 무리 e가 판 진행(f)에 맞춘 기준선 tgt를 따라가게: 모자라면 × 문, 넘치면 작은 + 문(숫자가 끝없이 불지 않게)
  let f = 0; const tgt = () => nref * (0.25 + 0.75 * f);
  const goodOpt = () => (e < tgt() * 0.5 && R() < 0.6) || (s > 1 && e < tgt() * 0.9 && R() < 0.3) ? ['×', e < 40 && R() < 0.35 ? 3 : 2] : ['+', r5(tgt() * u(0.15, 0.35) * (e > tgt() ? 0.5 : 1))];
  const badOpt = () => ['−', Math.max(3, Math.round(e * u(0.1, 0.25 + d * 0.25) * hz))];
  let gates = 0;
  const gate = () => {
    // 좋음/좋음 고르기 쌍은 2스테이지부터 자주, 2스테이지부터 첫 문에 ×2
    const both = R() < (s === 1 ? 0.15 : 0.42) + d * 0.2, a = s > 1 && !gates++ ? ['×', 2] : goodOpt(), b = both ? (a[0] === '×' ? ['+', r5(e * u(0.4, 0.8))] : ['+', r5(tgt() * u(0.04, 0.1))]) : badOpt();
    const [l, r] = R() < 0.5 ? [a, b] : [b, a];
    items.push({ type: 'gate', z, l, r });
    e = Math.max(gateApply(e, l), gateApply(e, r));
  };
  // 바위 HP = 기대 무리 × k. 사격(틱마다 1 + 0.028n)은 다가가는 절반 거리에 무리의 80%쯤을 깎으니, 앞뒤 두 줄도 깰 수 있다.
  const rocks = (k = s <= 5 ? u(0.15, 0.3) : s <= 25 ? u(0.2, 0.42) : u(0.3, 0.5 + d * 0.3)) => {
    // 1~2개는 늘 틈이 있다(피하거나 깨거나 고르기). 길을 다 막는 3개 줄은 26스테이지부터, 대신 약하게.
    const cnt = 1 + Math.floor(R() * (s === 1 ? 1 : s <= 25 ? 2 : 3)), xs = cnt === 1 ? [pick([-2, 0, 2])] : cnt === 2 ? pick([[-2.2, 2.2], [-2.4, 0.2], [-0.2, 2.4]]) : [-2.4, 0, 2.4];
    for (const x of xs) items.push({ type: 'rock', z: z + Math.floor(R() * 3), x, hp: Math.max(5, Math.round(e * k * (cnt === 3 ? 0.6 : 1) * u(0.85, 1.15) * hz)) });
  };
  for (let i = 0; i < K; i++, z += GAP) {
    f = i / K;
    if (i === cardAt[0] || i === cardAt[1]) { items.push({ type: 'card', z, cards: cardOffer(R, e, i === cardAt[1]) }); continue; }
    if (i === crystalAt) { items.push({ type: 'crystal', z, x: 0, hp: Math.max(20, Math.round(e * u(0.45, 0.65) * hz)) }); continue; }
    if (i === crystalAt + 1) { items.push({ type: 'rock', z, x: pick([-1.6, 0, 1.6]), hp: Math.max(40, Math.round(e * u(1.1, 1.4) * hz)) }); continue; }   // 펫 필살기를 보여 줄 큰 바위 하나(못 깨면 피해 감)
    // 2스테이지부터 톱날 · 망치
    const w = s === 1 ? [0.6, 1, 1, 1] : s <= 5 ? [0.42, 0.66, 0.84, 1] : [0.42 - d * 0.1, 0.68 - d * 0.1, 0.84 - d * 0.04, 1];
    const t = R();
    if (i === 0 || t < w[0]) gate();
    else if (t < w[1]) rocks();
    else if (t < w[2]) items.push({ type: 'saw', z, x0: pick([0, -1.4, 1.4]), amp: u(1.4, 2.6), per: Math.round(u(36, 60) - d * 14) });
    else items.push({ type: 'hammer', z, x: pick([-1.6, 0, 1.6]), per: Math.round(u(40, 56) - d * 10), ph: Math.floor(R() * 4) / 4 });
  }
  gate();
  z += GAP;
  items.push({ type: 'end', z });
  items.sort((a, b) => a.z - b.z);
  return { stage: s, hz, theme: theme(s), boss: isBoss(s), start: baseStart(s), len: z, castle: { z: z + 24, hp: row ? row[0] : Math.round(nref * 0.5) }, r3: row ? row[1] / 100 : 0.25, items, expect: Math.round(e) };
}
function cardOffer(R, e, late) {
  const all = [['add', Math.max(10, Math.round(e * 0.3 / 5) * 5)], ['mul', 0], ['fire', 0], ['shield', 0], ['luck', 0], ['magnet', 0], ['power', 0], ['rapid', 0], ['petup', 0], ['crack', 0]];
  const pool = late ? all.filter(c => c[0] !== 'crack' && c[0] !== 'petup') : all, out = [];
  while (out.length < 3) { const c = pool[Math.floor(R() * pool.length)]; if (!out.some(x => x[0] === c[0])) out.push(c); }
  return out;
}

/* ---------- 한 판 ---------- */
// opts: { start: 시작 정령(응원 포함), pet: { el, mul } | null }. ev(type, a, b, c)는 화면 연출용(서버는 없음).
export function runInit(map, opts = {}) {
  const items = map.items.map(o => ({ ...o, max: o.hp, done: false, hitCd: 0, x: o.type === 'saw' ? o.x0 : o.x }));
  return {
    map, items, tick: 0, phase: 'run', z: 0, cx: 0, tx: 0, n: Math.max(1, opts.start ?? map.start), start: 0,
    fire: 1, shield: 1, power: 1, rapid: 1, luck: false, magnet: false, petup: 1, crack: 1,
    pet: opts.pet || null, petOn: false, guard: 0, block: 0, rescueT: 0, card: null, picks: [],
    castle: { z: map.castle.z, hp: map.castle.hp, max: map.castle.hp, down: false }, pour: 0, hold: false, siegeT: 0,
    broke: 0, lost: 0, stars: 0, left: 0, lo: 0
  };
}
// 부딪힘: 무리 폭의 45% + 바위 반지름. 큰 무리(R 3)도 길 끝(cx ±2.2)으로 가면 가운데 바위를 피한다.
const near = (S, o, R) => Math.abs(o.x - S.cx) < R * 0.45 + 0.76;
// 한 틱. tx = 목표 좌우(−4~4), hold = 공성전 누름. 카드 고르는 중이면 아무것도 안 함(pick을 기다림).
export function runTick(S, tx, hold, ev = null) {
  if (S.phase === 'card' || S.phase === 'done') return S;
  S.tick++;
  if (S.phase === 'rescue') { if (--S.rescueT <= 0) { S.phase = 'run'; petSkill(S, ev); } return S; }
  if (S.phase === 'siege') return siegeTick(S, hold, ev);
  const R = crowdR(S.n), DT = RUNNER.DT;
  S.tx = Math.max(-RUNNER.ROAD, Math.min(RUNNER.ROAD, tx));
  const step = RUNNER.STEER * DT, lim = RUNNER.ROAD - R * 0.6;
  S.cx += Math.max(-step, Math.min(step, S.tx - S.cx)); S.cx = Math.max(-lim, Math.min(lim, S.cx));
  const z0 = S.z; S.z += RUNNER.SPEED * DT;
  if (S.guard > 0) S.guard--;
  while (S.lo < S.items.length && S.items[S.lo].z < S.z - 8) S.lo++;
  // 자동 사격: 앞 26단위 안, 무리 폭과 겹치는 가장 가까운 줄(앞뒤 3단위)의 바위 · 수정 모두에 같은 피해
  let first = Infinity;
  for (let i = S.lo; i < S.items.length; i++) { const o = S.items[i]; if (o.z > S.z + RUNNER.SHOOT_RANGE) break; if ((o.type === 'rock' || o.type === 'crystal') && !o.done && o.z > S.z && Math.abs(o.x - S.cx) < R + 0.95) first = Math.min(first, o.z); }
  if (first < Infinity) {
    const dmg = dmgPerTick(S.n, S.fire);
    for (let i = S.lo; i < S.items.length; i++) {
      const o = S.items[i]; if (o.z > first + 3) break;
      if ((o.type !== 'rock' && o.type !== 'crystal') || o.done || o.z <= S.z || Math.abs(o.x - S.cx) >= R + 0.95) continue;
      o.hp -= o.type === 'crystal' ? dmg / S.crack : dmg; ev?.('shoot', o);
      if (o.hp <= 0) { o.hp = 0; o.done = true; if (o.type === 'crystal') rescue(S, o, ev); else breakRock(S, o, ev); }
    }
  }
  for (let i = S.lo; i < S.items.length && S.phase === 'run'; i++) {
    const o = S.items[i]; if (o.z > S.z + 4) break;
    if (o.type === 'gate' && !o.done && z0 < o.z && S.z >= o.z) {
      o.done = true; const side = S.cx < 0 ? -1 : 1; let g = side < 0 ? o.l : o.r;
      if (S.leafNext && !goodGate(g)) { g = ['+', g[1]]; S.leafNext = false; }
      if (S.luck && goodGate(g)) { g = g[0] === '+' ? ['+', Math.round(g[1] * 1.5)] : g; S.luck = false; }
      const before = S.n; S.n = gateApply(S.n, g); o.took = side; ev?.('gate', o, side, g, before);
    } else if ((o.type === 'rock' || o.type === 'crystal') && !o.done && S.z + R * 0.6 >= o.z && near(S, o, R)) {
      o.done = true; let loss = Math.min(S.n, Math.ceil(o.type === 'crystal' ? o.hp * 0.5 : o.hp));
      if (S.guard > 0) loss = 0; else if (S.block > 0) { S.block--; loss = 0; }
      S.n -= loss; S.lost += loss; ev?.('crash', o, loss);
    } else if (o.type === 'saw') {
      o.x = o.x0 + o.amp * tri(S.tick / o.per);
      if (o.stop) continue;
      if (o.hitCd > 0) o.hitCd--;
      else if (Math.abs(o.z - S.z) < R * 0.7 + 0.8 && Math.abs(o.x - S.cx) < R * 0.8 + 0.8) { const loss = hurt(S, Math.ceil((1 + S.n * 0.03) * S.shield * S.map.hz)); o.hitCd = 3; ev?.('saw', o, loss); }
    } else if (o.type === 'hammer') {
      if (o.stop) continue;
      const a0 = tri((S.tick - 1) / o.per + o.ph), a1 = tri(S.tick / o.per + o.ph);
      if ((a0 < 0) !== (a1 < 0) && Math.abs(o.z - S.z) < R * 0.7 + 0.9 && Math.abs(o.x - S.cx) < R * 0.8 + 0.8) { const loss = hurt(S, Math.ceil((2 + S.n * 0.08) * S.shield * S.map.hz)); ev?.('hammer', o, loss); }
    } else if (o.type === 'card' && !o.done && S.z >= o.z) { o.done = true; S.phase = 'card'; S.card = o; ev?.('card', o); }
    else if (o.type === 'end' && S.z >= o.z) { S.phase = 'siege'; S.start = S.n; ev?.('siege'); if (S.petOn) petSiege(S, ev); }
  }
  if (S.n <= 0 && S.phase !== 'done') finish(S, ev);
  return S;
}
function hurt(S, loss) { if (S.guard > 0) return 0; if (S.block > 0) { S.block--; return 0; } loss = Math.min(S.n, loss); S.n -= loss; S.lost += loss; return loss; }
function breakRock(S, o, ev) { S.broke++; if (S.magnet) S.n += Math.max(1, Math.round(o.max / 10)); ev?.('break', o); }
export function runPick(S, i, ev = null) {
  if (S.phase !== 'card') return S;
  const c = S.card.cards[Math.max(0, Math.min(2, i | 0))], k = c[0];
  S.picks.push(i | 0);
  if (k === 'add') S.n += c[1]; else if (k === 'mul') S.n = Math.floor(S.n * 1.3); else if (k === 'fire') S.fire *= 1.5; else if (k === 'shield') S.shield = 0.5;
  else if (k === 'luck') S.luck = true; else if (k === 'magnet') S.magnet = true; else if (k === 'power') S.power *= 2; else if (k === 'rapid') S.rapid *= 1.5;
  else if (k === 'petup') S.petup = 1.5; else if (k === 'crack') S.crack = 1 / 0.6;
  S.phase = 'run'; S.card = null; ev?.('pick', c);
  return S;
}
function rescue(S, o, ev) { S.phase = 'rescue'; S.rescueT = RUNNER.RESCUE_TICKS; S.petOn = !!S.pet; ev?.('rescue', o); }
// 펫 필살기(구출 직후 한 번). 크기 m = 등급 배율 × 펫 각성 카드
function petSkill(S, ev) {
  if (!S.pet) return;
  const m = (S.pet.mul || 1) * S.petup, el = S.pet.el, reach = 40 * m;
  const ahead = (fn, types = ['rock']) => { for (let i = S.lo; i < S.items.length; i++) { const o = S.items[i]; if (o.z > S.z + reach) break; if (o.z > S.z && !o.done && types.includes(o.type)) fn(o); } };
  if (el === 'flame') ahead(o => { o.hp = 0; o.done = true; breakRock(S, o, ev); });
  else if (el === 'water') ahead(o => { if (o.type === 'rock') o.hp = Math.max(1, o.hp * (1 - Math.min(0.9, 0.6 * m))); else o.stop = true; }, ['rock', 'saw', 'hammer']);
  else if (el === 'ice') S.guard = Math.round(120 * m);
  else if (el === 'leaf') S.leafNext = true;
  else if (el === 'earth') { S.block = 1; ahead(o => { o.hp = Math.max(1, o.hp * (1 - Math.min(0.9, 0.5 * m))); }); }
  else if (el === 'wind') S.n += Math.round(S.n * 0.15 * m);
  else if (el === 'toxic') ahead(o => { o.hp = Math.max(1, o.hp * (1 - Math.min(0.9, 0.7 * m))); });
  ev?.('skill', el, m);
}
function petSiege(S, ev) {
  const m = (S.pet.mul || 1) * S.petup, f = Math.min(0.6, (RUNNER.PET_SIEGE + (S.pet.el === 'star' ? 0.2 : 0)) * m), c = S.castle;
  const hit = Math.round(c.max * f); c.hp = Math.max(1, c.hp - hit); ev?.('petSiege', hit);
}
function siegeTick(S, hold, ev) {
  const c = S.castle; S.siegeT++; S.hold = !!hold;
  if (hold && S.n > 0 && !c.down) {
    // 쏟는 속도(마리/초): 성 HP를 약 6초에 깎을 만큼(최소 6 · 최대 20 + 0.06n). 결과(별 · 남은 정령)는 속도와 상관없고 길이만 정한다.
    S.pour += Math.max(6, Math.min(20 + S.n * 0.06, c.max / (6 * S.power))) * S.rapid * RUNNER.DT;
    const k = Math.min(S.n, Math.floor(S.pour));
    if (k > 0) { S.pour -= k; S.n -= k; c.hp = Math.max(0, c.hp - k * S.power); ev?.('pour', k); }
    if (c.hp <= 0) { c.down = true; ev?.('fall'); return finish(S, ev); }
  }
  if (S.n <= 0 || S.siegeT >= RUNNER.SIEGE_MAX_TICKS) return finish(S, ev);
  return S;
}
function finish(S, ev) {
  const c = S.castle, ratio = S.start > 0 ? S.n / S.start : 0;
  S.stars = c.down ? (ratio >= S.map.r3 ? 3 : ratio >= RUNNER.STAR_R2 ? 2 : 1) : 0;
  S.left = S.n; S.phase = 'done'; ev?.('done', S.stars);
  return S;
}
export const runResult = S => ({ stars: S.stars, clear: S.stars > 0, left: S.left, start: S.start, ticks: S.tick, broke: S.broke, dmg: Math.round(S.castle.max - S.castle.hp), picks: S.picks.slice() });

/* ---------- 조종 기록 ---------- */
// 화면: rec = recorder(); 매 틱 rec.tick(S.tick, tx, hold) → rec.pick(i) → rec.out()
export function recorder() {
  const s = [], h = [], c = []; let lq = 0, lh = false;
  return {
    tick(t, tx, hold) { const q = Math.max(-100, Math.min(100, Math.round(tx * 25))); if (q !== lq) { s.push(t, q); lq = q; } if (!!hold !== lh) { h.push(t); lh = !!hold; } },
    pick(i) { c.push(i | 0); },
    out: () => ({ s: s.slice(), h: h.slice(), c: c.slice() })
  };
}
export const quantTx = tx => Math.max(-100, Math.min(100, Math.round(tx * 25))) / 25;
// 기록이 올바른 모양인지(서버). 틱은 늘어나기만, 값은 정수 범위.
export function cleanInput(raw) {
  const ok = a => Array.isArray(a) && a.every(v => Number.isInteger(v));
  if (!raw || typeof raw !== 'object' || !ok(raw.s) || !ok(raw.h) || !ok(raw.c) || raw.s.length % 2 || raw.c.length > 2) return null;
  const lim = RUNNER.SIEGE_MAX_TICKS + 4000;
  for (let i = 0; i < raw.s.length; i += 2) if (raw.s[i] < 0 || raw.s[i] > lim || (i && raw.s[i] < raw.s[i - 2]) || Math.abs(raw.s[i + 1]) > 100) return null;
  for (let i = 0; i < raw.h.length; i++) if (raw.h[i] < 0 || raw.h[i] > lim || (i && raw.h[i] < raw.h[i - 1])) return null;
  if (raw.c.some(v => v < 0 || v > 2)) return null;
  return { s: raw.s, h: raw.h, c: raw.c };
}
// 다시 돌리기(서버 · 검사 · 봇). 기록의 틱 값은 "그 틱을 돌리기 전에 정한 값"이다(화면도 같은 순서).
export function replay(map, opts, input, ev = null) {
  const S = runInit(map, opts); let si = 0, hi = 0, ci = 0, tx = 0, hold = false;
  const guard = map.len * 2 + RUNNER.RESCUE_TICKS + RUNNER.SIEGE_MAX_TICKS + 200;
  while (S.phase !== 'done' && S.tick < guard) {
    if (S.phase === 'card') { runPick(S, input.c[ci++] ?? 0, ev); continue; }
    while (si < input.s.length && input.s[si] <= S.tick) { tx = input.s[si + 1] / 25; si += 2; }
    while (hi < input.h.length && input.h[hi] <= S.tick) { hold = !hold; hi++; }
    runTick(S, tx, hold, ev);
  }
  if (S.phase !== 'done') finish(S, ev);
  return S;
}
