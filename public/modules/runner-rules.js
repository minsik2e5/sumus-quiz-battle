// V13.241 펫 대행진(크라우드 러너) 규칙. 화면(public/modules/runner.js)과 서버(server/runner.mjs)가 같은 파일을 쓴다.
// 구성안 docs/pet-runner-plan.md. 서버는 화면이 보낸 조종 기록(input)으로 같은 판을 다시 돌려 별 · 남은 정령을 정한다.
//   - 무리 = 숫자 n 하나 + 가운데 좌우 cx. 적 무리도 숫자 하나(hp). 정령 하나하나 · 탄 · 파편은 화면 연출이라 여기에 없다.
//   - 고정 틱 50ms. 난수는 판 씨앗(mulberry32)만 쓰고, 움직임은 삼각파(더하기 · 곱하기)로만 → 브라우저 · 서버 결과가 같다(Math.sin 없음).
//   - 판 흐름: run(달리기) → card(카드 3장 중 1장, 틱 안 씀) → rescue(구출 컷인 22틱) → run → siege(공성전) → done.
// V13.242(규칙 2판, "너무 무난하다"): 숫자 벽 · 적 무리 정면 충돌 · 움직이는 문 · 바뀌는 문 · 위험한 짝(×3 옆 톱날, −N 뒤 ×2) · 피버 타임 ·
//   테마 장애물(사막 모래 소용돌이 · 얼음 미끄럼 · 화산 불기둥) · 정령 강화 · 스테이지 26~100. 맵은 쉼 → 긴장 → 폭발 리듬.
//   다음 단계로 둔 것(거대 몬스터 돌진 · 좁은 다리 · 공성전 수비)은 NEXT_TYPES 이름만 열어 두고, 규칙은 모르는 물체를 건너뛴다.
// 조종 기록: { s: [틱, 목표 좌우(−100~100), …] 바뀐 틱만, h: [틱, …] 공성전 누름이 바뀐 틱(처음은 뗌), c: [카드1, 카드2] }

export const RUNNER = {
  TICK: 50, DT: 0.05,
  SPEED: 10, STEER: 10, ROAD: 4,      // 달리기 10단위/초 · 좌우 따라가기 10단위/초 · 길 폭 ±4
  RULES: 2,                            // 규칙 판 번호: 판을 열 때 적고, 다른 판의 규칙으로 연 판은 끝을 받지 않는다(기록 · 별은 그대로)
  STAGES: 100,                         // 1~25 하늘 다리 · 26~50 사막 · 51~75 얼음 협곡 · 76~100 화산
  MAX_STAGE: 100,
  SHOOT_RANGE: 26,
  RESCUE_TICKS: 22, SIEGE_MAX_TICKS: 600, PET_SIEGE: 0.15,
  STAR_R2: 0.1,                        // 별 2 기준(남은 비율). 별 3 기준은 스테이지 표(STAGE_TABLE)
  // 피버: 가장 좋은 문을 3번 연달아 고르면 6초 동안 달리기 ×1.3 · 사격 ×2(그 동안은 연속 수를 세지 않음)
  FEVER_STREAK: 3, FEVER_TICKS: 120, FEVER_SPEED: 1.3, FEVER_FIRE: 2,
  // 적 무리: 34단위 앞에서 달려오기 시작(5단위/초, 내 쪽으로 2단위/초 휨). 사격은 1/4만 들어감(방패 → 거의 늘 부딪쳐 싸움). 부딪히면 틱마다 양쪽이 같이 깎인다.
  FOE_WAKE: 34, FOE_SPEED: 5, FOE_STEER: 2, FOE_ARMOR: 0.25,
  // 숫자 벽: 길 전체를 막는다. 사격으로 깎거나 부딪쳐 남은 HP만큼 잃고 뚫는다. 틈으로 지나가면 벽 HP와 상관없이 틈에 안 들어가는 정령만 잃는다
  //   (많이 깎았으면 부딪치는 게, 덜 깎았으면 틈이 이득 — 고르는 재미).
  GAP_W: 2.2, GAP_SQUEEZE: 0.6,
  // 보상 · 막기(서버)
  COIN_DAILY: 40, BOX_COINS: 10, RAID_COINS: 30, STAR_NEW: 5, STAR_AGAIN: 2,
  PLAYS_DAILY: 300, OPEN_MS: 10 * 60000, MIN_RATIO: 0.9, INPUT_MAX: 4096,
  CHEER_STEP: 0.1, CHEER_MAX: 0.3, CHEER_EVERY: 3,
  BOARD_TOP: 10, BOARD_CACHE_MS: 60000
};
// 다음 단계로 둔 물체(구성안 11장 ③ 이후): 거대 몬스터 돌진 · 좁은 다리 · 공성전 수비. 맵 생성기는 아직 만들지 않고, 규칙 · 화면은 모르는 물체를 건너뛴다.
export const NEXT_TYPES = ['giant', 'bridge', 'defend'];
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
  pierce: { name: () => '관통탄', tag: '강화' },
  shield: { name: () => '방패', tag: '보호' },
  guard: { name: () => '선봉 방패', tag: '보호' },
  luck: { name: () => '행운 문', tag: '문' },
  magnet: { name: () => '자석', tag: '정령' },
  power: { name: () => '대포 위력 ×2', tag: '대포' },
  rapid: { name: () => '연사 대포', tag: '대포' },
  petup: { name: () => '펫 각성', tag: '펫' },
  crack: { name: () => '수정 금', tag: '펫' }
};
// 카드 설명(화면): 한 줄
export const CARD_TEXT = {
  add: '바로 정령이 늘어요', mul: '지금 정령 ×1.3', fire: '사격이 1.5배 세져요', pierce: '다음 줄까지 반만큼 뚫어요', shield: '톱날 · 망치 · 불기둥 피해 반',
  guard: '적 무리와 싸울 때 25% 덜 잃어요', luck: '다음 좋은 문 +50%', magnet: '깬 바위만큼 정령이 붙어요', power: '대포 한 발이 2배', rapid: '대포를 1.5배 빨리',
  petup: '펫 필살기 1.5배', crack: '수정이 잘 깨져요'
};
export const cardName = c => CARDS[c?.[0]]?.name(c[1]) || '';

// 정령 강화(구성안 3-3, 기존 코인으로 영구). 값 = base + step × 지금 단계. 다 올리는 데 약 9,000코인.
export const UPGRADES = {
  s: { name: '시작 정령', unit: '+3마리', max: 20, base: 20, step: 10 },
  f: { name: '사격', unit: '+4%', max: 20, base: 20, step: 10 },
  c: { name: '대포 위력', unit: '+5%', max: 20, base: 30, step: 15 },
  d: { name: '방어', unit: '피해 −2%', max: 10, base: 30, step: 15 }
};
export const upCost = (k, lv) => UPGRADES[k] && lv < UPGRADES[k].max ? UPGRADES[k].base + UPGRADES[k].step * lv : null;
export const upClean = up => Object.fromEntries(Object.keys(UPGRADES).map(k => [k, Math.max(0, Math.min(UPGRADES[k].max, Math.floor(Number(up?.[k]) || 0)))]));

// 처음 도전 때 깰 확률 · 별 3 확률(선생님): 1(튜토리얼) 95% · 2~5 80% · 6~25 68%(보스 바로 다음 75%) · 보스 성 10 · 20은 50%, 별 3은 각각 절반쯤.
//   26~50 70% · 51~75 55% · 76~100 40%, 별 3은 25 · 15 · 8%, 보스는 15%p 낮게 · 다음은 10%p 쉽게(구성안 곡선).
export function stageTarget(s) {
  if (s <= 25) {
    const clear = s === 1 ? 0.95 : s <= 5 ? 0.8 : s % 10 === 0 ? 0.5 : s % 10 === 1 ? 0.75 : 0.68;
    return { clear, three: Math.round(clear * 50) / 100 };
  }
  let [clear, three] = s <= 50 ? [0.7, 0.25] : s <= 75 ? [0.55, 0.15] : [0.4, 0.08];
  if (s % 10 === 0) { clear -= 0.15; three = Math.max(0.03, three - 0.08); }
  else if (s % 10 === 1) { clear = Math.min(0.98, clear + 0.1); three = Math.min(0.75, three + 0.05); }
  return { clear: Math.round(clear * 100) / 100, three: Math.round(three * 100) / 100 };
}
export const isBoss = s => s % 10 === 0;
export const theme = s => s <= 25 ? 'sky' : s <= 50 ? 'desert' : s <= 75 ? 'ice' : 'volcano';
export const THEME_NAME = { sky: '하늘 다리', desert: '사막', ice: '얼음 협곡', volcano: '화산' };
// 시작 정령(강화 없음). 응원 정령(같은 스테이지 3연패마다 +10%, 최대 +30%)은 cheer로 곱한다. 강화 시작 정령은 단계마다 +3.
export const baseStart = s => 10 + Math.floor((s - 1) / 5) * 2;
export const cheerOf = fails => Math.min(RUNNER.CHEER_MAX, Math.floor(Math.max(0, fails) / RUNNER.CHEER_EVERY) * RUNNER.CHEER_STEP);

// 스테이지 표 [성 HP, 별 3 기준 남은 비율 %, 위험 세기 %](바위 HP · 나쁜 문 · 벽 · 적 무리 · 톱날 · 망치 피해에 곱함). server/runner-sim.mjs가 "처음 도전하는 학생" 흉내 봇으로 맞춘 값(목표는 stageTarget).
// 맵 생성기를 바꾸면 node server/runner-sim.mjs tune 으로 다시 만들고, server/runner-check.mjs가 확률을 확인한다.
export const STAGE_TABLE = [[98,63,100],[149,62,100],[346,47,32],[276,45,55],[326,58,100],[239,35,55],[433,36,70],[411,33,55],[344,21,42],[329,31,100],[298,40,100],[556,34,55],[539,47,55],[322,42,70],[608,40,100],[442,27,55],[456,33,70],[514,31,55],[488,33,42],[578,27,85],[533,38,70],[1006,50,85],[488,33,55],[921,49,85],[406,35,32],[959,49,100],[649,50,55],[514,38,55],[674,35,42],[693,42,32],[502,57,70],[920,35,55],[392,50,24],[679,52,85],[905,56,55],[752,45,70],[792,41,42],[760,39,85],[958,48,70],[549,39,42],[856,42,24],[1135,34,32],[1345,52,70],[1234,45,70],[880,41,70],[879,56,100],[969,52,70],[1055,49,42],[1213,43,55],[1280,34,70],[1826,46,55],[1516,48,42],[1552,35,85],[1185,35,42],[2428,46,70],[1551,49,85],[1852,57,85],[2019,42,55],[1650,41,55],[1791,27,55],[2318,64,70],[2006,55,70],[1841,45,42],[1085,57,70],[2621,43,85],[1884,31,55],[1621,32,55],[2940,53,70],[1247,34,55],[1527,59,85],[1618,39,55],[2084,46,55],[1734,49,70],[2151,34,70],[1521,60,70],[2813,46,70],[2872,30,100],[2514,51,70],[2251,55,100],[2122,36,85],[2061,29,55],[2306,25,70],[2436,56,70],[3318,56,85],[1834,33,70],[4213,55,100],[2042,51,55],[2006,34,85],[1855,37,70],[2578,59,100],[2745,48,70],[2618,53,70],[2641,41,85],[2160,20,32],[2559,38,55],[2434,32,42],[3485,49,85],[2469,49,55],[2929,49,55],[3906,59,70]];

/* ---------- 난수 · 움직임 ---------- */
export function mulberry(seed) { let s = seed | 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const stageSeed = s => Math.imul(s + 1013, 2654435761) >>> 0 ^ 0x5eed;
// 삼각파: p(0~1 반복) → −1~1. 0.25에서 1, 0.75에서 −1, 0 · 0.5에서 0을 지난다.
export const tri = p => { const f = p - Math.floor(p); return f < 0.25 ? f * 4 : f < 0.75 ? 2 - f * 4 : f * 4 - 4; };
export const frac = p => p - Math.floor(p);
export const crowdR = n => Math.min(3, 0.4 + 0.21 * Math.sqrt(Math.min(n, 150)));
export const foeR = n => crowdR(n) * 1.15;
const GATE = { '+': (n, v) => n + v, '×': (n, v) => n * v, '−': (n, v) => Math.max(0, n - v) };
export const gateApply = (n, g) => GATE[g[0]](n, g[1]);
export const goodGate = g => g[0] !== '−';
// 움직이는 문: 가운데 칸막이가 좌우로 오간다(sx). 바뀌는 문: sw틱마다 두 칸이 서로 바뀐다. tick은 실수도 된다(화면 보간).
export const gateSplit = (o, tick) => o.mv ? o.mv.amp * tri(tick / o.mv.per + o.mv.ph) : 0;
export const gateSwapped = (o, tick) => !!o.sw && (Math.floor(tick / o.sw) & 1) === 1;
export const gateSides = (o, tick) => gateSwapped(o, tick) ? [o.r, o.l] : [o.l, o.r];
// 불기둥: per틱마다 처음 18%(약 0.4~0.5초) 동안 솟는다.
export const pillarUp = (o, tick) => frac(tick / o.per + o.ph) < 0.18;
const dmgPerTick = (n, fire) => (1 + Math.min(n, 400) * 0.028) * fire;

/* ---------- 맵 생성기(스테이지 번호 → 같은 맵) ---------- */
// 물체: gate{z,l,r,mv?,sw?} · rock{z,x,hp} · wall{z,hp,gap?{x,w}} · foe{z,x,hp,boss?} · saw{z,x0,amp,per} · hammer{z,x,per,ph}
//       whirl{z,x}(사막) · slide{z,len}(얼음) · pillar{z,x,per,ph}(화산) · card{z,cards} · crystal{z,x,hp} · end{z}
// 리듬(쉼 → 긴장 → 폭발): 쉼 = 고르는 재미(좋음/좋음 · 약한 바위), 긴장 = 벽 · 적 무리 · 위험한 짝 · 움직이는/바뀌는 문 · 테마 장애물,
//   폭발 = × 문 · 깨는 맛 바위 줄(피버를 노릴 수 있는 곳). over.hz: 위험 세기 덮어쓰기(난도 맞출 때만).
export function makeMap(stage, over = null) {
  const s = Math.max(1, Math.min(RUNNER.MAX_STAGE, stage | 0)), R = mulberry(stageSeed(s)), d = s / 100, th = theme(s);
  const row = STAGE_TABLE[s - 1], hz = over?.hz ?? (row ? row[2] / 100 : 1);
  const u = (a, b) => a + R() * (b - a), pick = arr => arr[Math.floor(R() * arr.length)];
  const items = [];
  const K = s === 1 ? 18 : s <= 10 ? 36 : s <= 50 ? 42 : 48, GAP = 12;   // 1스테이지는 튜토리얼(달리기 약 22초 + 공성전)
  const cardAt = [Math.floor(K * 0.34), Math.floor(K * 0.67)], crystalAt = Math.floor(K * 0.82);
  let e = baseStart(s), z = 18;
  let nref = 175; for (let i = 0; i < s && i < 60; i++) nref *= 1.03;   // 기준 무리(거듭제곱 함수 대신 곱하기: 엔진마다 끝자리가 같게). 60스테이지 뒤로는 그대로(숫자가 너무 커지지 않게)
  const r5 = v => Math.max(5, Math.round(v / 5) * 5);
  let f = 0; const tgt = () => nref * (0.25 + 0.75 * f);
  const shotW = n => (1 + Math.min(n, 400) * 0.028) * 48, shotF = n => (1 + Math.min(n, 400) * 0.028) * RUNNER.FOE_ARMOR * 32;
  // 좋은 문: 기준선보다 모자라면 ×, 넘치면 작은 +. 나쁜 문은 무리의 15~35%(+ 스테이지가 높을수록 조금 더) × 위험 세기.
  const mulOpt = () => ['×', e < 40 && R() < 0.35 ? 3 : 2];
  const goodOpt = () => (e < tgt() * 0.5 && R() < 0.6) || (s > 1 && e < tgt() * 0.9 && R() < 0.3) ? mulOpt() : ['+', r5(tgt() * u(0.15, 0.35) * (e > tgt() ? 0.5 : 1))];
  const badOpt = (k = 1) => ['−', Math.max(3, Math.round(e * u(0.15, 0.3 + d * 0.25) * hz * k))];
  const smallPlus = () => ['+', r5(tgt() * u(0.04, 0.1))];
  let gates = 0;
  const push = o => { items.push(o); return o; };
  const pair = (a, b, extra = null) => { const [l, r] = R() < 0.5 ? [a, b] : [b, a]; const o = push({ type: 'gate', z, l, r, ...(extra || {}) }); const A = gateApply(e, l), B = gateApply(e, r); e = Math.max(A, B) * 0.85 + Math.min(A, B) * 0.15; gates++; return o; };   // 기대 무리: 대부분 잘 고르는 학생(85%)
  // 문 한 쌍. both = 좋음/좋음(더 큰 쪽 고르기) — 규칙 2판은 나쁜 문을 늘리고 좋음/좋음을 줄였다(쉼 박자에서만 자주).
  const gate = (both = false) => {
    const a = s > 1 && !gates ? ['×', 2] : goodOpt();
    return pair(a, both ? (a[0] === '×' ? ['+', r5(e * u(0.4, 0.8))] : smallPlus()) : badOpt());
  };
  // 바위 HP = 기대 무리 × k. 사격(틱마다 1 + 0.028n)은 다가가는 절반 거리에 무리의 80%쯤을 깎으니, 앞뒤 두 줄도 깰 수 있다.
  const rocks = (k = s <= 5 ? u(0.15, 0.3) : s <= 25 ? u(0.2, 0.42) : u(0.3, 0.5 + d * 0.3), cnt = 1 + Math.floor(R() * (s === 1 ? 1 : s <= 25 ? 2 : 3))) => {
    const xs = cnt === 1 ? [pick([-2, 0, 2])] : cnt === 2 ? pick([[-2.2, 2.2], [-2.4, 0.2], [-0.2, 2.4]]) : [-2.4, 0, 2.4];
    for (const x of xs) push({ type: 'rock', z: z + Math.floor(R() * 3), x, hp: Math.max(5, Math.round(e * k * (cnt === 3 ? 0.6 : 1) * u(0.85, 1.15) * hz)) });
  };
  const saw = (x0 = pick([0, -1.4, 1.4]), amp = u(1.4, 2.6), zz = z) => push({ type: 'saw', z: zz, x0, amp, per: Math.round(u(36, 60) - d * 14) });
  const hammer = () => push({ type: 'hammer', z, x: pick([-1.6, 0, 1.6]), per: Math.round(u(40, 56) - d * 10), ph: Math.floor(R() * 4) / 4 });
  // 숫자 벽: HP = 다가가는 동안 사격으로 깎을 만큼 × 0.85~1 + 무리의 10~30%(높은 스테이지 조금 더) × 위험 세기. 틈은 4스테이지부터 절반.
  const wall = () => {
    const hp = Math.max(10, Math.round(shotW(e * 0.6) * u(0.85, 1) + e * u(0.1, 0.3 + d * 0.2) * hz));   // 사격 몫(조금 덜 불린 무리 기준)은 위험 세기와 상관없이 → 가까이 와서 깨지는 맛
    const gap = s >= 4 && R() < 0.5 ? { x: pick([-2.6, -1.6, 1.6, 2.6]), w: RUNNER.GAP_W } : null;
    push({ type: 'wall', z, hp, ...(gap ? { gap } : {}) });
    const R0 = crowdR(e), squeeze = gap ? Math.floor(e * Math.max(0, 1 - gap.w / 2 / R0) * RUNNER.GAP_SQUEEZE) : Infinity;
    e = Math.max(1, e - Math.min(squeeze, Math.max(0, hp - shotW(e)) * 0.7)); heavy = i0;
  };
  // 적 무리: 숫자 = 사격으로 깎을 만큼 × 0.95~1.1 + 무리의 20~45%(+ 스테이지) × 위험 세기. 보스 성 스테이지는 성 앞에 적 대장(남는 몫 ×1.5).
  const foe = (boss = false) => {
    const hp = Math.max(6, Math.round(shotF(e) * u(0.95, 1.1) + e * u(0.2, 0.45 + d * 0.25) * hz * (boss ? 1.5 : 1)));   // 사격 몫은 무리 그대로 → 거의 늘 부딪쳐 싸운다   // 사격 몫은 그대로 → 거의 늘 부딪쳐 싸운다
    push({ type: 'foe', z, x: pick([-1.4, 0, 1.4]), hp, ...(boss ? { boss: true } : {}) });
    e = Math.max(1, e - Math.max(0, hp - shotF(e)) * 0.8); heavy = i0;
  };
  // 위험한 짝 ①: ×3 옆에 톱날(×3 칸 앞 3.5단위를 톱날이 그 칸 안에서 오간다)
  const sawGate = () => { const side = R() < 0.5 ? -1 : 1, o = pair(['×', 3], smallPlus()); if ((o.l[0] === '×') !== (side < 0)) [o.l, o.r] = [o.r, o.l]; saw(side * 2, u(0.9, 1.3), z - 3.5); };
  // 위험한 짝 ②: −N 뒤에 ×2(같은 쪽). 무리가 크면 −를 먹고 ×2로 가는 쪽이 이득, 작으면 손해 — 순서를 읽는 재미
  const dipGate = () => {
    const side = R() < 0.5 ? -1 : 1, minus = ['−', Math.max(5, Math.round(e * u(0.2, 0.35) * hz))], p1 = smallPlus(), p2 = smallPlus();
    push({ type: 'gate', z, l: side < 0 ? minus : p1, r: side < 0 ? p1 : minus });
    push({ type: 'gate', z: z + GAP * 0.55, l: side < 0 ? ['×', 2] : p2, r: side < 0 ? p2 : ['×', 2] }); gates += 2;
    e = Math.max(e + p1[1] + p2[1], (e - minus[1]) * 2);
  };
  const moveGate = () => pair(goodOpt(), badOpt(), { mv: { amp: u(1.6, 2.4), per: Math.round(u(44, 64) - d * 12), ph: Math.floor(R() * 4) / 4 } });
  const swapGate = () => pair(goodOpt(), badOpt(1.2), { sw: Math.round(u(26, 34) - d * 6) });
  // 테마 장애물(26스테이지부터 테마마다 하나)
  const themed = () => {
    if (th === 'desert') { push({ type: 'whirl', z, x: pick([-1.8, 0, 1.8]) }); if (R() < 0.5) rocks(u(0.2, 0.35), 1); }
    else if (th === 'ice') { push({ type: 'slide', z: z - 4, len: 16 }); saw(pick([-1, 1]), u(2, 2.8)); }
    else if (th === 'volcano') { const x = pick([-1.8, 1.8]); push({ type: 'pillar', z, x, per: Math.round(u(30, 40)), ph: Math.floor(R() * 4) / 4 }); if (R() < 0.6) push({ type: 'pillar', z: z + 5, x: -x, per: Math.round(u(30, 40)), ph: 0.5 }); }
    else hammer();
  };
  // 박자 줄: 쉼 1~2 → 긴장 1~2 → 폭발 1~2를 되풀이(1스테이지는 쉼 · 폭발만)
  const beats = [];
  while (beats.length < K) {
    const rest = s === 1 ? 2 : 1 + (R() < 0.5 ? 1 : 0), ten = s === 1 ? 0 : s <= 3 ? 1 : 1 + (R() < 0.6 ? 1 : 0), boom = 1 + (R() < 0.5 ? 1 : 0);
    for (let i = 0; i < rest; i++) beats.push('rest'); for (let i = 0; i < ten; i++) beats.push('tension'); for (let i = 0; i < boom; i++) beats.push('burst');
  }
  // 긴장 거리 고르기: 스테이지마다 열리는 것 + 무게
  const tensions = [[rocks, 2], [wall, s >= 2 ? 3 : 0], [foe, s >= 3 ? 4 : 0], [saw, s >= 2 ? 1.5 : 0], [hammer, s >= 2 ? 1 : 0], [sawGate, s >= 4 ? 1.5 : 0], [dipGate, s >= 5 ? 1.2 : 0],
    [moveGate, s >= 6 ? 1.3 : 0], [swapGate, s >= 8 ? 1.3 : 0], [themed, s > 25 ? 2.5 : 0]].filter(t => t[1] > 0);
  const tsum = tensions.reduce((a, t) => a + t[1], 0);
  // ×3 · ×2 짝은 무리가 기준선보다 모자랄 때만(넘치면 움직이는 문으로): 숫자가 끝없이 불지 않게
  //   벽 · 적 무리는 판 처음 15%가 지난 뒤부터(무리가 조금 불어난 뒤)
  //   판마다 꼭: 벽 하나(15% 뒤) · 적 무리 하나(30% 뒤) · 8스테이지부터 움직이는/바뀌는 문 하나(45% 뒤) · 26스테이지부터 테마 장애물 하나(55% 뒤). 나머지는 무게대로.
  const seen = { wall: 0, foe: 0, ms: 0, th: 0 }; let heavy = -9, i0 = 0;
  const pickT = () => { let r = R() * tsum; for (const [fn, w] of tensions) { if ((r -= w) <= 0) return fn; } return rocks; };
  const tension = () => {
    let fn = s >= 2 && f >= 0.15 && !seen.wall ? wall : s >= 3 && f >= 0.3 && !seen.foe ? foe : s >= 8 && f >= 0.45 && !seen.ms ? (R() < 0.5 ? moveGate : swapGate) : s > 25 && f >= 0.55 && !seen.th ? themed : pickT();
    if ((fn === sawGate || fn === dipGate) && e > tgt() * 0.9) fn = s >= 6 ? moveGate : gate;
    if ((fn === wall || fn === foe) && (f < 0.15 || i0 - heavy < 2)) fn = rocks;   // 벽 · 적 무리는 바로 이어 붙이지 않는다(사격을 나눠 써야 해서)
    if (fn === wall) seen.wall++; else if (fn === foe) seen.foe++; else if (fn === moveGate || fn === swapGate) seen.ms++; else if (fn === themed) seen.th++;
    return fn === gate ? gate(false) : fn();
  };
  let lastTension = -1;
  for (let i = 0; i < K; i++, z += GAP) {
    f = i / K; i0 = i; e = Math.min(e, tgt() * 1.25);   // 장애물 크기는 기준선 근처 무리에 맞춘다(잘 불린 학생은 그만큼 여유)
    if (i === cardAt[0] || i === cardAt[1]) { push({ type: 'card', z, cards: cardOffer(R, e, i === cardAt[1]) }); continue; }
    if (i === crystalAt) { push({ type: 'crystal', z, x: 0, hp: Math.max(20, Math.round(e * u(0.45, 0.65) * hz)) }); continue; }
    if (i === crystalAt + 1) { push({ type: 'rock', z, x: pick([-1.6, 0, 1.6]), hp: Math.max(40, Math.round(e * u(1.1, 1.4) * hz)) }); continue; }   // 펫 필살기를 보여 줄 큰 바위 하나(못 깨면 피해 감)
    const b = i === 0 ? 'rest' : beats[i];
    if (b === 'rest') { if (i === 0 || R() < 0.7) gate(R() < (s === 1 ? 0.3 : 0.35)); else rocks(u(0.12, 0.25)); }
    else if (b === 'tension') { lastTension = i; tension(); }
    else if (R() < (s === 1 ? 0.6 : 0.65)) gate(false);
    else rocks();
  }
  // 보스 성: 성 앞에 적 대장이 달려온다
  if (isBoss(s)) { foe(true); z += GAP; }
  gate(false);
  z += GAP;
  push({ type: 'end', z });
  items.sort((a, b) => a.z - b.z);
  void lastTension;
  return { stage: s, rules: RUNNER.RULES, hz, theme: th, boss: isBoss(s), start: baseStart(s), len: z, castle: { z: z + 24, hp: row ? row[0] : Math.round(nref * 0.5) }, r3: row ? row[1] / 100 : 0.25, items, expect: Math.round(e) };
}
function cardOffer(R, e, late) {
  const all = [['add', Math.max(10, Math.round(e * 0.3 / 5) * 5)], ['mul', 0], ['fire', 0], ['pierce', 0], ['shield', 0], ['guard', 0], ['luck', 0], ['magnet', 0], ['power', 0], ['rapid', 0], ['petup', 0], ['crack', 0]];
  const pool = late ? all.filter(c => c[0] !== 'crack' && c[0] !== 'petup') : all, out = [];
  while (out.length < 3) { const c = pool[Math.floor(R() * pool.length)]; if (!out.some(x => x[0] === c[0])) out.push(c); }
  return out;
}

/* ---------- 한 판 ---------- */
// opts: { start: 시작 정령(응원 · 강화 포함), pet: { el, mul } | null, up: { s, f, c, d } 강화 단계 }. ev(type, a, b, c, d)는 화면 연출용(서버는 없음).
export function runInit(map, opts = {}) {
  const items = map.items.map(o => ({ ...o, max: o.hp, done: false, hitCd: 0, x: o.type === 'saw' ? o.x0 : o.x }));
  const up = upClean(opts.up);
  return {
    map, items, tick: 0, phase: 'run', z: 0, cx: 0, tx: 0, n: Math.max(1, opts.start ?? map.start), start: 0,
    fire: 1 + up.f * 0.04, shield: 1, power: 1 + up.c * 0.05, def: 1 - up.d * 0.02, rapid: 1, luck: false, magnet: false, petup: 1, crack: 1, pierce: false, foeMul: 1,
    pet: opts.pet || null, petOn: false, guard: 0, block: 0, rescueT: 0, card: null, picks: [],
    streak: 0, fever: 0, fevers: 0, foes: [], clash: null, slide: 0, won: 0,
    castle: { z: map.castle.z, hp: map.castle.hp, max: map.castle.hp, down: false }, pour: 0, hold: false, siegeT: 0,
    broke: 0, lost: 0, stars: 0, left: 0, lo: 0
  };
}
// 부딪힘: 무리 폭의 45% + 바위 반지름. 큰 무리(R 3)도 길 끝(cx ±2.2)으로 가면 가운데 바위를 피한다.
const near = (S, o, R) => Math.abs(o.x - S.cx) < R * 0.45 + 0.76;
const shootable = o => (o.type === 'rock' || o.type === 'crystal' || o.type === 'wall') && !o.done;
const overlapX = (S, o, R) => o.type === 'wall' || Math.abs(o.x - S.cx) < R + 0.95;
// 한 틱. tx = 목표 좌우(−4~4), hold = 공성전 누름. 카드 고르는 중이면 아무것도 안 함(pick을 기다림).
export function runTick(S, tx, hold, ev = null) {
  if (S.phase === 'card' || S.phase === 'done') return S;
  S.tick++;
  if (S.phase === 'rescue') { if (--S.rescueT <= 0) { S.phase = 'run'; petSkill(S, ev); } return S; }
  if (S.phase === 'siege') return siegeTick(S, hold, ev);
  if (S.clash) return clashTick(S, ev);
  const R = crowdR(S.n), DT = RUNNER.DT;
  S.tx = Math.max(-RUNNER.ROAD, Math.min(RUNNER.ROAD, tx));
  // 얼음 미끄럼 위에서는 좌우 따라가기가 30%
  const step = RUNNER.STEER * DT * (S.slide > 0 ? 0.3 : 1), lim = RUNNER.ROAD - R * 0.6;
  S.cx += Math.max(-step, Math.min(step, S.tx - S.cx)); S.cx = Math.max(-lim, Math.min(lim, S.cx));
  const z0 = S.z; S.z += RUNNER.SPEED * DT * (S.fever > 0 ? RUNNER.FEVER_SPEED : 1);
  if (S.guard > 0) S.guard--;
  if (S.slide > 0) S.slide--;
  if (S.fever > 0 && --S.fever === 0) ev?.('feverEnd');
  while (S.lo < S.items.length && S.items[S.lo].z < S.z - 8) S.lo++;
  // 적 무리: 34단위 앞에서 깨어나 달려오며 내 쪽으로 휜다
  for (let i = S.lo; i < S.items.length; i++) { const o = S.items[i]; if (o.z > S.z + RUNNER.FOE_WAKE) break; if (o.type === 'foe' && !o.on && !o.done) { o.on = true; o.pz = o.z; S.foes.push(o); ev?.('foeWake', o); } }
  for (let i = S.foes.length - 1; i >= 0; i--) {
    const o = S.foes[i];
    if (o.done) { S.foes[i] = S.foes[S.foes.length - 1]; S.foes.length--; continue; }
    o.pz -= RUNNER.FOE_SPEED * DT; const st = RUNNER.FOE_STEER * DT; o.x += Math.max(-st, Math.min(st, S.cx - o.x)); o.x = Math.max(-3, Math.min(3, o.x));
  }
  const fire = S.fever > 0 ? S.fire * RUNNER.FEVER_FIRE : S.fire;
  // 자동 사격: 앞 26단위 안, 무리 폭과 겹치는 가장 가까운 줄(앞뒤 3단위)의 바위 · 수정 · 벽 · 적 무리 모두에 같은 피해(적 무리는 반)
  let first = Infinity;
  for (let i = S.lo; i < S.items.length; i++) { const o = S.items[i]; if (o.z > S.z + RUNNER.SHOOT_RANGE) break; if (shootable(o) && o.z > S.z && overlapX(S, o, R)) first = Math.min(first, o.z); }
  for (const o of S.foes) if (!o.done && o.pz > S.z && o.pz <= S.z + RUNNER.SHOOT_RANGE && Math.abs(o.x - S.cx) < R + foeR(o.hp)) first = Math.min(first, o.pz);
  if (first < Infinity) {
    const dmg = dmgPerTick(S.n, fire);
    let second = Infinity;
    for (let i = S.lo; i < S.items.length; i++) {
      const o = S.items[i]; if (o.z > S.z + RUNNER.SHOOT_RANGE) break;
      if (!shootable(o) || o.z <= S.z || !overlapX(S, o, R)) continue;
      if (o.z > first + 3) { second = Math.min(second, o.z); continue; }
      hitObj(S, o, o.type === 'crystal' ? dmg / S.crack : dmg, ev);
    }
    for (const o of S.foes) if (!o.done && o.pz > S.z && o.pz <= first + 3 && Math.abs(o.x - S.cx) < R + foeR(o.hp)) { o.hp -= dmg * RUNNER.FOE_ARMOR; ev?.('shoot', o); if (o.hp <= 0) { o.hp = 0; o.done = true; S.won++; ev?.('foeDown', o); } }
    // 관통탄: 다음 줄에 반만큼
    if (S.pierce && second < Infinity) for (let i = S.lo; i < S.items.length; i++) { const o = S.items[i]; if (o.z > second + 3) break; if (shootable(o) && o.z >= second && overlapX(S, o, R)) hitObj(S, o, (o.type === 'crystal' ? dmg / S.crack : dmg) * 0.5, ev); }
  }
  // 적 무리와 부딪힘 → 정면 충돌(clash)
  for (const o of S.foes) {
    if (o.done) continue;
    const Rf = foeR(o.hp);
    if (o.pz - S.z <= (R + Rf) * 0.5 + 0.4 && Math.abs(o.x - S.cx) < (R + Rf) * 0.8) { S.clash = o; ev?.('clash', o); return S; }
    if (o.pz < S.z - 1.5) { o.done = true; ev?.('foePass', o); }
  }
  for (let i = S.lo; i < S.items.length && S.phase === 'run'; i++) {
    const o = S.items[i]; if (o.z > S.z + 4) break;
    if (o.type === 'gate' && !o.done && z0 < o.z && S.z >= o.z) {
      o.done = true; const sx = gateSplit(o, S.tick), side = S.cx < sx ? -1 : 1, [gl, gr] = gateSides(o, S.tick); let g = side < 0 ? gl : gr; const other = side < 0 ? gr : gl;
      if (S.leafNext && !goodGate(g)) { g = ['+', g[1]]; S.leafNext = false; }
      if (S.luck && goodGate(g)) { g = g[0] === '+' ? ['+', Math.round(g[1] * 1.5)] : g; S.luck = false; }
      const before = S.n; S.n = gateApply(S.n, g); o.took = side; o.got = g;
      // 피버: 가장 좋은 쪽(좋은 문이면서 다른 쪽보다 작지 않음)을 3번 연달아
      const best = goodGate(g) && S.n >= gateApply(before, other);
      if (S.fever > 0) { /* 피버 중에는 세지 않음 */ } else if (best) { if (++S.streak >= RUNNER.FEVER_STREAK) { S.streak = 0; S.fever = RUNNER.FEVER_TICKS; S.fevers++; ev?.('fever'); } } else S.streak = 0;
      ev?.('gate', o, side, g, before);
    } else if ((o.type === 'rock' || o.type === 'crystal') && !o.done && S.z + R * 0.6 >= o.z && near(S, o, R)) {
      o.done = true; let loss = Math.min(S.n, Math.ceil(o.type === 'crystal' ? o.hp * 0.5 : o.hp));
      if (S.guard > 0) loss = 0; else if (S.block > 0) { S.block--; loss = 0; }
      S.n -= loss; S.lost += loss; if (loss) S.streak = 0; ev?.('crash', o, loss);
    } else if (o.type === 'wall' && !o.done && S.z + R * 0.6 >= o.z) {
      o.done = true;
      if (o.gap && Math.abs(S.cx - o.gap.x) < o.gap.w / 2) {   // 좁은 틈: 틈에 안 들어가는 정령만 잃는다(작은 무리는 그대로 쏙)
        const loss = Math.min(S.n, Math.floor(S.n * Math.max(0, 1 - o.gap.w / 2 / R) * RUNNER.GAP_SQUEEZE));
        const got = S.guard > 0 ? 0 : loss; S.n -= got; S.lost += got; ev?.('gap', o, got);
      } else {
        let loss = Math.min(S.n, Math.ceil(o.hp));
        if (S.guard > 0) loss = 0; else if (S.block > 0) { S.block--; loss = 0; }
        S.n -= loss; S.lost += loss; if (loss) S.streak = 0; ev?.('wallCrash', o, loss);
      }
    } else if (o.type === 'saw') {
      o.x = o.x0 + o.amp * tri(S.tick / o.per);
      if (o.stop) continue;
      if (o.hitCd > 0) o.hitCd--;
      else if (Math.abs(o.z - S.z) < R * 0.7 + 0.8 && Math.abs(o.x - S.cx) < R * 0.8 + 0.8) { const loss = hurt(S, Math.ceil((1 + S.n * 0.03) * S.shield * S.map.hz * S.def)); o.hitCd = 3; ev?.('saw', o, loss); }
    } else if (o.type === 'hammer') {
      if (o.stop) continue;
      const a0 = tri((S.tick - 1) / o.per + o.ph), a1 = tri(S.tick / o.per + o.ph);
      if ((a0 < 0) !== (a1 < 0) && Math.abs(o.z - S.z) < R * 0.7 + 0.9 && Math.abs(o.x - S.cx) < R * 0.8 + 0.8) { const loss = hurt(S, Math.ceil((2 + S.n * 0.08) * S.shield * S.map.hz * S.def)); ev?.('hammer', o, loss); }
    } else if (o.type === 'whirl') {
      // 모래 소용돌이: 닿으면 가운데로 끌려가고(초당 3단위) 0.3초마다 조금씩 잃는다
      if (o.stop || Math.abs(o.z - S.z) >= 2.2 || Math.abs(o.x - S.cx) >= 1.3 + R * 0.5) continue;
      const pull = 3 * DT; S.cx += Math.max(-pull, Math.min(pull, o.x - S.cx));
      if (o.hitCd > 0) o.hitCd--; else { const loss = hurt(S, Math.ceil((1 + S.n * 0.035) * S.shield * S.map.hz * S.def)); o.hitCd = 6; ev?.('whirl', o, loss); }
    } else if (o.type === 'slide') {
      if (!o.done && S.z >= o.z) { o.done = true; S.slide = Math.round(o.len / (RUNNER.SPEED * DT)); ev?.('slide', o); }
    } else if (o.type === 'pillar') {
      // 불기둥: 솟는 동안 그 자리에 있으면 한 번(한 주기에 한 번) 크게 잃는다
      if (o.stop) continue;
      const up = pillarUp(o, S.tick);
      if (up && !pillarUp(o, S.tick - 1)) ev?.('erupt', o);
      if (o.hitCd > 0) o.hitCd--;
      else if (up && Math.abs(o.z - S.z) < R * 0.7 + 1 && Math.abs(o.x - S.cx) < R * 0.8 + 1.1) { const loss = hurt(S, Math.ceil((2 + S.n * 0.09) * S.shield * S.map.hz * S.def)); o.hitCd = o.per; ev?.('pillar', o, loss); }
    } else if (o.type === 'card' && !o.done && S.z >= o.z) { o.done = true; S.phase = 'card'; S.card = o; ev?.('card', o); }
    else if (o.type === 'end' && S.z >= o.z) { S.phase = 'siege'; S.start = S.n; S.fever = 0; ev?.('siege'); if (S.petOn) petSiege(S, ev); }
  }
  if (S.n <= 0 && S.phase !== 'done') finish(S, ev);
  return S;
}
function hitObj(S, o, dmg, ev) {
  o.hp -= dmg; ev?.('shoot', o);
  if (o.hp <= 0) { o.hp = 0; o.done = true; if (o.type === 'crystal') rescue(S, o, ev); else if (o.type === 'wall') { S.broke++; ev?.('wallBreak', o); } else breakRock(S, o, ev); }
}
// 정면 충돌: 틱마다 양쪽이 같은 수만큼(작은 쪽의 12%, 최소 2) 깎인다. 내 쪽은 방어 강화 · 선봉 방패 카드만큼 덜 잃는다. 그 동안 무리는 멈춘다.
function clashTick(S, ev) {
  const o = S.clash, k = Math.min(Math.ceil(o.hp), Math.max(2, Math.ceil(Math.min(S.n, o.hp) * 0.12)));
  o.hp -= k;
  const loss = S.guard > 0 ? 0 : Math.min(S.n, Math.ceil(k * S.def * S.foeMul));
  if (S.guard > 0) S.guard--;
  S.n -= loss; S.lost += loss; ev?.('fight', o, k, loss);
  if (o.hp <= 0.0001) { o.hp = 0; o.done = true; S.clash = null; S.won++; ev?.('clashWin', o); }
  if (S.n <= 0) { S.clash = null; finish(S, ev); }
  return S;
}
// 피해를 받으면 피버 연속 수도 끊긴다(실수 없이 3번이어야 피버)
function hurt(S, loss) { if (S.guard > 0) return 0; if (S.block > 0) { S.block--; return 0; } loss = Math.min(S.n, loss); S.n -= loss; S.lost += loss; if (loss) S.streak = 0; return loss; }
function breakRock(S, o, ev) { S.broke++; if (S.magnet) S.n += Math.max(1, Math.round(o.max / 10)); ev?.('break', o); }
export function runPick(S, i, ev = null) {
  if (S.phase !== 'card') return S;
  const c = S.card.cards[Math.max(0, Math.min(2, i | 0))], k = c[0];
  S.picks.push(i | 0);
  if (k === 'add') S.n += c[1]; else if (k === 'mul') S.n = Math.floor(S.n * 1.3); else if (k === 'fire') S.fire *= 1.5; else if (k === 'shield') S.shield = 0.5;
  else if (k === 'pierce') S.pierce = true; else if (k === 'guard') S.foeMul = 0.75;
  else if (k === 'luck') S.luck = true; else if (k === 'magnet') S.magnet = true; else if (k === 'power') S.power *= 2; else if (k === 'rapid') S.rapid *= 1.5;
  else if (k === 'petup') S.petup = 1.5; else if (k === 'crack') S.crack = 1 / 0.6;
  S.phase = 'run'; S.card = null; ev?.('pick', c);
  return S;
}
function rescue(S, o, ev) { S.phase = 'rescue'; S.rescueT = RUNNER.RESCUE_TICKS; S.petOn = !!S.pet; ev?.('rescue', o); }
// 펫 필살기(구출 직후 한 번). 크기 m = 등급 배율 × 펫 각성 카드. 벽도 바위처럼 깎인다(불꽃은 벽을 60% 태움).
function petSkill(S, ev) {
  if (!S.pet) return;
  const m = (S.pet.mul || 1) * S.petup, el = S.pet.el, reach = 40 * m;
  const ahead = (fn, types = ['rock', 'wall']) => { for (let i = S.lo; i < S.items.length; i++) { const o = S.items[i]; if (o.z > S.z + reach) break; if (o.z > S.z && !o.done && types.includes(o.type)) fn(o); } };
  const cut = k => o => { o.hp = Math.max(1, o.hp * (1 - Math.min(0.9, k * m))); };
  if (el === 'flame') ahead(o => { if (o.type === 'wall') cut(0.6)(o); else { o.hp = 0; o.done = true; breakRock(S, o, ev); } });
  else if (el === 'water') ahead(o => { if (o.type === 'rock' || o.type === 'wall') cut(0.6)(o); else o.stop = true; }, ['rock', 'wall', 'saw', 'hammer', 'whirl', 'pillar']);
  else if (el === 'ice') S.guard = Math.round(120 * m);
  else if (el === 'leaf') S.leafNext = true;
  else if (el === 'earth') { S.block = 1; ahead(cut(0.5)); }
  else if (el === 'wind') S.n += Math.round(S.n * 0.15 * m);
  else if (el === 'toxic') ahead(cut(0.7));
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
export const runResult = S => ({ stars: S.stars, clear: S.stars > 0, left: S.left, start: S.start, ticks: S.tick, broke: S.broke, won: S.won, fevers: S.fevers, dmg: Math.round(S.castle.max - S.castle.hp), picks: S.picks.slice() });

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
  const guard = map.len * 2 + RUNNER.RESCUE_TICKS + RUNNER.SIEGE_MAX_TICKS + 600;
  while (S.phase !== 'done' && S.tick < guard) {
    if (S.phase === 'card') { runPick(S, input.c[ci++] ?? 0, ev); continue; }
    while (si < input.s.length && input.s[si] <= S.tick) { tx = input.s[si + 1] / 25; si += 2; }
    while (hi < input.h.length && input.h[hi] <= S.tick) { hold = !hold; hi++; }
    runTick(S, tx, hold, ev);
  }
  if (S.phase !== 'done') finish(S, ev);
  return S;
}
