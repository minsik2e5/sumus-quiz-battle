// V13.120 던전 엔진 (docs/dungeon-design.md 2~8번): 같은 학년 2~3명이 실시간으로 같이 싸우는
// "기말고사 지옥" 던전의 규칙만 담는다. 전송도 시계도 없다. battle-engine.js처럼 모든 함수가 `now`(ms)를
// 받고 방에 보낼 이벤트를 돌려주므로, 다음 세션의 DungeonRoom(Durable Object), 시뮬레이션
// (server/dungeon-sim.mjs), 검사(server/dungeon-check.mjs)가 같은 방식으로 돌린다.
// 상태는 평범한 JSON이라 메시지 사이에 저장할 수 있고, 무작위도 상태 안의 씨앗(seed)으로만 뽑는다.
// 정답 판정과 방 시계가 여기(서버)에 있어서 폰은 선택 번호만 보낸다(야차전 방식).
//
// 수치는 server/dungeon-sim.mjs 시뮬레이션으로 3명 첫 도전 클리어율 60% · 35% · 10%에 맞춘 뒤,
// 선생님 요청으로 제한 시간을 모두 1초 줄였다(52% · 18% · 1%).
// 코인은 이 엔진이 정하지 않는다(서버가 문제 수와 난이도로 계산한다. 수치는 확인 뒤 기록·보상 세션에서).
import { elementOf } from '../public/modules/battle-fx.js';

export const DUNGEON = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 3,
  POOL_MIN: 120,        // 입장 조건: 문제 풀(범위 + 보충) 120단어 이상
  INTRO_MS: 4000,       // 입장 연출(문 열림)
  REST_MS: 6000,        // 층 사이 휴식(고정, 기록 시간에 들어간다)
  REVEAL_MS: 900,       // 한 문제를 푼 뒤 다음 문제까지
  MIN_LIMIT_MS: 2500,   // 어떤 경우에도 한 문제에 이보다 짧게 주지 않는다
  MAX_HP: 100,          // 학생(펫) 체력
  HIT: 10,              // 정답 한 번의 기본 피해 (몬스터 체력표의 "정답 1개")
  SPEED_BONUS: 0.5,     // 남은 시간 비율 × 0.5 만큼 더 (가장 빠르면 ×1.5)
  COMBO_STEP: 5,        // 5연속마다 콤보 단계 +1
  COMBO_UP: 0.1,        // 단계마다 피해 +10%
  COMBO_MAX: 1.5,       // 콤보 배율 상한
  ELEMENT_BONUS: 1.3,   // 서로 다른 속성 3마리면 모든 피해 +30% (battle-fx.js elementOf)
  GAUGE_PER_PLAYER: 6,  // 파티 게이지 = 파티원 수 × 6 정답
  SPECIAL_HITS: 3,      // 합동 필살기 = 파티원 수 × 3 정답만큼의 피해
  REVIVE_STREAK: 3,     // 동료가 3연속 정답이면 기절한 친구가 부활
  REVIVE_HP: 0.4,       // 그때 체력 40%
  FLOOR_REVIVE_HP: 0.3, // 층이 바뀔 때 기절자는 체력 30%로 부활
  RETRY_GAP: 8,         // 틀린 단어는 같은 판에서 8문제 뒤에 다시 나온다
  AUTO_MS: 4000,        // 끊긴 학생의 펫은 4초마다 자동 공격
  AUTO_HIT: 0.5,        // 자동 공격 피해 (정답의 절반)
  DROP_MS: 90000,       // 끊긴 지 90초가 지나면 그 학생만 포기(보상 제외)
  // 보스 킬러 골렘
  PHASE2_AT: 0.6,       // 체력 60% 아래: 빨간펜 채점
  PHASE3_AT: 0.3,       // 체력 30% 아래: 핵 노출
  MARK_EVERY_MS: 16000, // 채점 표적을 고르는 주기
  MARK_NEED: 3,         // 표적은 다음 3문제를 연속으로 맞혀야 막는다
  MARK_HIT: 2,          // 채점에 실패하면 그 문제의 피격이 2배
  CORE_MS: 15000,       // 핵이 열려 있는 시간
  CORE_GAP_MS: 5000,    // 핵이 닫힌 뒤 다시 열리기까지
  CORE_PER_PLAYER: 3,   // 핵 목표 = 서 있는 파티원 수 × 3 정답
  BREAK_SHARE: 0.15,    // 브레이크: 보스 최대 체력의 15% 피해
  RAGE_MS: 1000,        // 분노: 제한 시간 1초 단축
  RAGE_HIT: 1.25,       // 분노: 피격 +25%
  // 2명이면 몬스터 체력 ×0.6, 피격 ×0.6. 설계 초안(체력 ×0.7만)으로는 2인 클리어율이 3인의 절반
  // 아래였다(기절한 친구를 살려 줄 동료가 한 명뿐이라서). 2인도 3인과 거의 같은 클리어율이 되게 맞췄다.
  DUO_HP: 0.6,
  DUO_HIT: 0.6,
  // 끝없는(만점) 모드: 5층마다 보스, 6층부터 층마다 체력 +6%, 제한 시간 −0.1초(최소 3초)
  ENDLESS_BOSS_EVERY: 5,
  ENDLESS_HP_GROW: 1.06,
  ENDLESS_LIMIT_STEP: 100,
  ENDLESS_LIMIT_MIN: 3000
};

// 등급컷(난이도). 앞 단계를 깨야 다음이 열린다. `hp`: 몬스터 체력 배율, `hit`: 오답·시간 초과 피격.
// 몬스터 체력·제한 시간·피격은 시뮬레이션(server/dungeon-sim.mjs)으로 맞춘 확정값이다.
export const CUTS = {
  c3: { name: '3등급 컷', order: 1, hp: 1.0, hit: 8 },
  c2: { name: '2등급 컷', order: 2, hp: 1.15, hit: 10 },
  c1: { name: '1등급 컷', order: 3, hp: 1.4, hit: 13 },
  max: { name: '만점', order: 4, hp: 1.4, hit: 13 }
};
export const CUT_KEYS = ['c3', 'c2', 'c1', 'max'];

// 층 구성(3인 기준). hp는 "정답 환산"(정답 1개 = DUNGEON.HIT 피해; 속도·콤보 보너스 전). 설계 초안
// 12·14·16·18·20·40은 한 판이 약 4분이라 7~9분이 되게 ×1.8 했고, 피격을 낮춰 클리어율을 맞췄다, limit는 등급컷별 한 문제 제한 시간.
// 피격(hitAdd)은 등급컷 피격에 더한다. 보스는 마지막 줄.
export const FLOORS = [
  { floor: 1, options: 4, limit: { c3: 8000, c2: 7000, c1: 6000 }, hp: 54, hitAdd: 0, bg: '야자 교실' },
  { floor: 2, options: 4, limit: { c3: 7000, c2: 6000, c1: 5000 }, hp: 61, hitAdd: 1, bg: '복도' },
  { floor: 3, options: 5, limit: { c3: 6500, c2: 5500, c1: 4500 }, hp: 68, hitAdd: 2, bg: '과학실' },
  { floor: 4, options: 5, limit: { c3: 6000, c2: 5000, c1: 4000 }, hp: 76, hitAdd: 3, bg: '도서관 서고' },
  { floor: 5, options: 6, limit: { c3: 5500, c2: 4500, c1: 3500 }, hp: 83, hitAdd: 4, bg: '채점실' },
  { floor: 6, options: 6, limit: { c3: 5000, c2: 4000, c1: 3000 }, hp: 173, hitAdd: 5, bg: '보스방', boss: true }
];

// 학년(·범위 난이도)에 따라 조금 더 주는 시간. 파티는 같은 학년이라 파티 안에서는 같다.
export const GRADE_EXTRA_MS = { 중1: 1000, 중2: 800, 중3: 600, 고1: 400, 고2: 200, 고3: 0 };
export const EXTRA_MAX_MS = 1500;

// 일반 몬스터 풀(CODEX_PROMPT_22.md 표). 크기 S·M·L은 앱이 그리는 배율이고, 엔진에서는
// 작은 몬스터가 조금 약하고 큰 몬스터가 조금 단단하다. `trait`는 층마다 하나씩 붙는 특징.
export const SIZE_HP = { S: 0.9, M: 1, L: 1.1 };
export const MONSTERS = {
  nightzombie: { name: '밤샘 좀비', size: 'M', floors: [1, 2], trait: 'yawn' },
  redpenghost: { name: '빨간펜 귀신', size: 'M', floors: [2, 3], trait: 'redx' },
  wrongmummy: { name: '오답노트 미라', size: 'M', floors: [2, 3], trait: 'bandage' },
  testspider: { name: '시험지 거미', size: 'M', floors: [3, 4], trait: 'web' },
  omrreaper: { name: 'OMR 사신', size: 'L', floors: [4, 5], trait: 'reap' },
  chalkangler: { name: '칠판 아귀', size: 'L', floors: [3, 4, 5], trait: 'lure' },
  nightbat: { name: '야자 박쥐', size: 'S', floors: [1, 2], trait: 'swoop' },
  blinkjelly: { name: '깜빡 해파리', size: 'M', floors: [2, 3, 4], trait: 'blink' },
  bagturtle: { name: '책가방 거북', size: 'L', floors: [3, 4, 5], trait: 'shell' },
  cheatninja: { name: '커닝 닌자', size: 'S', floors: [1, 2, 3], trait: 'swap' },
  labskeleton: { name: '과학실 해골', size: 'M', floors: [2, 3, 4], trait: 'rattle' },
  pianofang: { name: '피아노 마귀', size: 'L', floors: [4, 5], trait: 'tempo' },
  homeworkogre: { name: '수행평가 오거', size: 'L', floors: [3, 4, 5], trait: 'stomp' },
  gatehound: { name: '교문 불독', size: 'L', floors: [3, 4, 5], trait: 'guard' },
  sandwitch: { name: '모래시계 마녀', size: 'M', floors: [2, 3, 4], trait: 'sand' }
};
export const BOSS = { key: 'killergolem', name: '킬러 골렘', size: 'boss' };
// 특징: 화면 효과만 있는 것(view에 표시)과 규칙을 조금 바꾸는 것. 정답 보기는 절대 가리지 않는다.
export const TRAITS = {
  yawn: { name: '하품', desc: '가끔 하품을 해서 화면이 흐려져요' },
  redx: { name: '빨간펜 X', desc: '틀리면 다음 문제의 오답 보기 하나에 X가 그어져요' },
  bandage: { name: '붕대 감기', desc: '오답 보기 한 칸을 붕대로 가려요' },
  web: { name: '거미줄', desc: '보기 위에 거미줄이 쳐져요' },
  reap: { name: '마킹 낫', desc: '틀리면 조금 더 아프게 때려요', hit: 1.15 },
  lure: { name: '미끼 불빛', desc: '오답 보기 하나가 반짝여요' },
  swoop: { name: '급강하', desc: '빠르게 날아다녀요' },
  blink: { name: '깜빡깜빡', desc: '문제 글자가 깜빡여요' },
  shell: { name: '등껍질', desc: '정답 피해를 조금 덜 받아요', armor: 0.9 },
  swap: { name: '자리 바꾸기', desc: '보기 순서가 문제마다 크게 섞여요' },
  rattle: { name: '뼈 딸그락', desc: '화면이 살짝 흔들려요' },
  tempo: { name: '빠른 박자', desc: '제한 시간이 0.5초 짧아요', limit: -500 },
  stomp: { name: '쿵쿵', desc: '틀리면 조금 더 아프게 때려요', hit: 1.15 },
  guard: { name: '문지기', desc: '정답 피해를 조금 덜 받아요', armor: 0.9 },
  sand: { name: '모래시계', desc: '제한 시간이 0.5초 짧아요', limit: -500 }
};

/* ---------- 작은 도구 ---------- */
// 상태 안의 씨앗으로 뽑는 무작위(mulberry32). 같은 씨앗이면 같은 판이 나온다.
function rand(state) {
  let a = (state.rng = (state.rng + 0x6D2B79F5) >>> 0);
  a = Math.imul(a ^ (a >>> 15), a | 1); a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}
const pick = (state, list) => list[Math.floor(rand(state) * list.length)];
function shuffle(state, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand(state) * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
function event(state, type, data = {}) { state.seq++; return { type, seq: state.seq, ...data }; }
export const cleanCut = cut => CUTS[cut] ? cut : 'c3';
export const gradeExtraMs = grade => Math.min(EXTRA_MAX_MS, GRADE_EXTRA_MS[grade] ?? 0);

// 등급컷 열림: 3등급 컷은 처음부터, 그다음은 앞 단계를 깨야 열린다. 만점은 세 단계를 모두 깨야 한다.
export function openCuts(cleared = []) {
  const done = new Set(cleared), open = [];
  for (const cut of CUT_KEYS) { open.push(cut); if (!done.has(cut)) break; }
  return open;
}
// 방은 파티원 모두에게 열린 단계까지만 고른다.
export const partyCuts = players => CUT_KEYS.filter(cut => players.every(p => openCuts(p.cleared || []).includes(cut)));

// 문제 풀 보충: 학생이 정한 범위는 그대로 두고, 120단어보다 적으면
// ① 같은 학교·학년에서 이미 푼 앞쪽 범위 ② 추가 단어장 ③ 틀린 단어 반복 순으로 채운다(중복 제외).
export function dungeonPool({ own = [], earlier = [], extra = [], wrong = [] }, min = DUNGEON.POOL_MIN) {
  const seen = new Set(), pool = [];
  const add = (list, source) => { for (const w of list) { if (pool.length >= min && source !== 'own') return; const id = String(w?.word_id ?? w?.id ?? ''); if (!id || seen.has(id)) continue; seen.add(id); pool.push({ ...w, source }); } };
  add(own, 'own'); add(earlier, 'earlier'); add(extra, 'extra');
  // 틀린 단어 반복: 이미 풀에 있는 단어라도 한 번 더 넣는다(같은 판 뒤쪽에서 다시 나오게).
  for (const w of wrong) { if (pool.length >= min) break; if (w?.word_id ?? w?.id) pool.push({ ...w, source: 'wrong' }); }
  return { pool, ok: pool.length >= min, short: Math.max(0, min - pool.length) };
}

/* ---------- 층 ---------- */
const isEndless = state => state.cut === 'max';
const lastFloor = state => isEndless(state) ? Infinity : FLOORS.length;
// 층 번호의 설정(보기 수, 제한 시간, 체력, 피격, 보스 여부). 만점 모드는 1등급 컷 수치에서 이어 간다.
export function floorSpec(cut, floor) {
  cut = cleanCut(cut);
  if (cut !== 'max') { const f = FLOORS[floor - 1]; return { ...f, limit: f.limit[cut] }; }
  const boss = floor % DUNGEON.ENDLESS_BOSS_EVERY === 0;
  const base = floor <= 4 ? FLOORS[floor - 1] : boss ? FLOORS[5] : FLOORS[4];
  const past = Math.max(0, floor - 5);
  return {
    floor, options: base.options, boss, bg: boss ? '보스방' : floor <= 5 ? base.bg : '무한 탑',
    limit: Math.max(Math.min(DUNGEON.ENDLESS_LIMIT_MIN, base.limit.c1), base.limit.c1 - DUNGEON.ENDLESS_LIMIT_STEP * past),
    hp: Math.round(base.hp * DUNGEON.ENDLESS_HP_GROW ** past), hitAdd: base.hitAdd + Math.floor(past / 5)
  };
}
function monsterHp(state, spec, key) {
  const size = spec.boss ? 1 : SIZE_HP[MONSTERS[key].size];
  const duo = state.order.length === 2 ? DUNGEON.DUO_HP : 1;
  return Math.round(spec.hp * DUNGEON.HIT * CUTS[state.cut].hp * size * duo);
}
function pickMonster(state, floor) {
  const used = new Set(state.used_monsters);
  const f = floor <= 5 ? floor : 3 + (floor % 3); // 만점 모드 6층부터는 3~5층 몬스터
  let list = Object.keys(MONSTERS).filter(key => MONSTERS[key].floors.includes(f) && !used.has(key));
  if (!list.length) list = Object.keys(MONSTERS).filter(key => MONSTERS[key].floors.includes(f));
  const key = pick(state, list);
  state.used_monsters.push(key);
  return key;
}

/* ---------- 만들기 · 참가 ---------- */
// 방 하나 = 파티 하나. `cut`: 'c3' | 'c2' | 'c1' | 'max'. `grade`: 같은 학년만 들어온다('중2', '고1' …).
// `seed`: 무작위 씨앗(방이 정한다). 기본 dungeon 이름은 지금 "기말고사 지옥" 하나.
export function createDungeon({ id, cut = 'c3', grade, host, dungeon = 'final-hell', seed = 1, now }) {
  if (!id) throw Error('dungeon needs an id');
  if (!grade) throw Error('dungeon needs a grade');
  return {
    id, dungeon, cut: cleanCut(cut), grade: String(grade), host: host || null, rng: seed >>> 0, seq: 0,
    created_at: now, phase: 'lobby', order: [], players: {},
    floor: 0, monster: null, used_monsters: [], gauge: 0, gauge_max: 0, element_bonus: 1,
    phase_at: null, rest_until: null, intro_until: null,
    started_at: null, finished_at: null, result: null
  };
}

// 참가. player: { id, name, grade, pet: { key, … }, questions: [{ word_id, prompt, meaning, wrong: [5개 이상] }],
// cleared: ['c3', …], bot }. 같은 학년, 최대 3명, 문제 풀 120단어 이상, 이 등급컷이 열린 학생만 들어온다.
export function join(state, player, now) {
  const out = [];
  if (state.phase !== 'lobby') throw Error('이미 시작한 던전입니다.');
  if (!player?.id) throw Error('player needs an id');
  if (state.players[player.id]) { state.players[player.id].connected = true; state.players[player.id].dropped_at = null; return [event(state, 'joined', { pid: player.id, again: true })]; }
  if (state.order.length >= DUNGEON.MAX_PLAYERS) throw Error('파티는 3명까지입니다.');
  if (String(player.grade) !== state.grade) throw Error('같은 학년끼리만 함께할 수 있어요.');
  const questions = Array.isArray(player.questions) ? player.questions.filter(q => q && q.prompt && q.meaning && Array.isArray(q.wrong) && q.wrong.length >= 5) : [];
  if (questions.length < DUNGEON.POOL_MIN) throw Error(`던전 문제 풀이 ${DUNGEON.POOL_MIN}단어 이상이어야 해요.`);
  if (!player.bot && !openCuts(player.cleared || []).includes(state.cut)) throw Error('아직 열리지 않은 등급컷이에요.');
  state.order.push(player.id);
  if (!state.host) state.host = player.id;
  state.players[player.id] = {
    id: player.id, name: String(player.name || '학생').slice(0, 20), pet: player.pet || null, bot: !!player.bot,
    element: elementOf(player.pet?.key), extra_ms: gradeExtraMs(state.grade),
    questions, served: 0, cursor: 0, retry: [],
    ready: !!player.bot, connected: true, dropped_at: null, auto_at: null, out: false,
    hp: DUNGEON.MAX_HP, down: false, combo: 0, best_combo: 0, rescue: 0,
    q: null, next_at: null, mark_left: 0,
    right: 0, wrong: 0, timeouts: 0, answered: 0, damage: 0, downs: 0, revived: 0
  };
  out.push(event(state, 'joined', { pid: player.id, name: state.players[player.id].name }));
  return out;
}

// 준비. 모두 준비하고 2명 이상이면 시작(입장 연출 → 1층).
export function ready(state, pid, now, on = true) {
  const p = state.players[pid];
  if (!p || state.phase !== 'lobby') return [];
  p.ready = !!on;
  const out = [event(state, 'ready', { pid, ready: p.ready })];
  if (state.order.length >= DUNGEON.MIN_PLAYERS && state.order.every(id => state.players[id].ready)) out.push(...begin(state, now));
  return out;
}
function begin(state, now) {
  state.phase = 'intro';
  state.intro_until = now + DUNGEON.INTRO_MS;
  const els = new Set(state.order.map(id => state.players[id].element));
  state.element_bonus = state.order.length === 3 && els.size === 3 ? DUNGEON.ELEMENT_BONUS : 1;
  state.gauge_max = DUNGEON.GAUGE_PER_PLAYER * state.order.length;
  return [event(state, 'intro', { until: state.intro_until, element_bonus: state.element_bonus })];
}

// 나가기(로비에서) / 끊김 / 다시 연결.
export function leave(state, pid, now) {
  if (state.phase !== 'lobby' || !state.players[pid]) return disconnect(state, pid, now);
  state.order = state.order.filter(id => id !== pid);
  delete state.players[pid];
  if (state.host === pid) state.host = state.order[0] || null;
  return [event(state, 'left', { pid })];
}
export function disconnect(state, pid, now) {
  const p = state.players[pid];
  if (!p || !p.connected || p.out) return [];
  p.connected = false; p.dropped_at = now; p.auto_at = now + DUNGEON.AUTO_MS;
  // 끊긴 학생의 문제는 멈춘다(맞지도 않는다). 펫이 자동으로 공격하며 기다린다.
  p.q = null; p.next_at = null;
  return [event(state, 'dropped', { pid })];
}
export function reconnect(state, pid, now) {
  const p = state.players[pid];
  if (!p || p.connected || p.out) return [];
  p.connected = true; p.dropped_at = null; p.auto_at = null;
  const out = [event(state, 'back', { pid })];
  if (state.phase === 'fight' && !p.down) out.push(...serve(state, p, now));
  return out;
}

/* ---------- 문제 ---------- */
const active = state => state.order.map(id => state.players[id]).filter(p => !p.out);
const standing = state => active(state).filter(p => !p.down);
function limitOf(state, p) {
  const spec = floorSpec(state.cut, state.floor);
  const trait = state.monster && TRAITS[state.monster.trait];
  const rage = state.monster?.boss && state.monster.stage === 3 ? DUNGEON.RAGE_MS : 0;
  return Math.max(DUNGEON.MIN_LIMIT_MS, spec.limit + p.extra_ms + (trait?.limit || 0) - rage);
}
function nextWord(state, p) {
  if (p.retry.length && p.retry[0].due <= p.served) return p.retry.shift().q;
  const q = p.questions[p.cursor % p.questions.length];
  p.cursor++;
  return q;
}
function serve(state, p, now) {
  if (p.out || p.down || !p.connected || state.phase !== 'fight') return [];
  const q = nextWord(state, p), n = floorSpec(state.cut, state.floor).options;
  const options = shuffle(state, [q.meaning, ...shuffle(state, q.wrong).slice(0, n - 1)]);
  const answer = options.indexOf(q.meaning);
  const wrongIdx = options.map((_, i) => i).filter(i => i !== answer);
  const trait = state.monster?.trait;
  // 특징: 붕대는 오답 한 칸을 가린다. 빨간펜 X는 바로 앞 문제를 틀렸을 때 오답 한 칸에 X. 정답은 가리지 않는다.
  const covered = trait === 'bandage' ? pick(state, wrongIdx) : null;
  const marked = trait === 'redx' && p.last_wrong ? pick(state, wrongIdx.filter(i => i !== covered)) : null;
  p.served++;
  p.q = { n: p.served, word_id: q.word_id, prompt: q.prompt, options, answer, covered, marked, started_at: now, deadline: now + limitOf(state, p), src: q };
  p.next_at = null;
  return [event(state, 'question', { pid: p.id, n: p.served, deadline: p.q.deadline })];
}

/* ---------- 피해 ---------- */
export function hitDamage({ leftShare = 0, combo = 0, element = 1, armor = 1 }) {
  const speed = 1 + DUNGEON.SPEED_BONUS * Math.max(0, Math.min(1, leftShare));
  const comboMult = Math.min(DUNGEON.COMBO_MAX, 1 + DUNGEON.COMBO_UP * Math.floor(combo / DUNGEON.COMBO_STEP));
  return Math.max(1, Math.round(DUNGEON.HIT * speed * comboMult * element * armor));
}
function damageMonster(state, amount, pid, now, kind) {
  const m = state.monster;
  if (!m || m.hp <= 0) return [];
  const dealt = Math.min(m.hp, amount);
  m.hp -= dealt;
  if (pid && state.players[pid]) state.players[pid].damage += dealt;
  const out = [event(state, 'hit', { pid, kind, damage: dealt, hp: m.hp })];
  if (m.boss) out.push(...bossStage(state, now));
  if (m.hp <= 0) out.push(...monsterDown(state, now));
  return out;
}
function monsterStrike(state, p, now, mult = 1) {
  const spec = floorSpec(state.cut, state.floor), m = state.monster;
  const trait = TRAITS[m.trait];
  const rage = m.boss && m.stage === 3 ? DUNGEON.RAGE_HIT : 1;
  const duo = state.order.length === 2 ? DUNGEON.DUO_HIT : 1;
  const damage = Math.round((CUTS[state.cut].hit + spec.hitAdd) * (trait?.hit || 1) * rage * duo * mult);
  p.hp = Math.max(0, p.hp - damage);
  const out = [event(state, 'struck', { pid: p.id, damage, hp: p.hp })];
  if (p.hp <= 0 && !p.down) {
    p.down = true; p.downs++; p.q = null; p.next_at = null; p.combo = 0; p.mark_left = 0;
    out.push(event(state, 'down', { pid: p.id }));
    if (!standing(state).length) out.push(...finish(state, now, false));
  }
  return out;
}
function addGauge(state, pid, now) {
  state.gauge++;
  if (state.gauge < state.gauge_max) return [];
  state.gauge = 0;
  const amount = Math.round(DUNGEON.SPECIAL_HITS * DUNGEON.HIT * state.order.length * state.element_bonus);
  return [event(state, 'special', { pid, damage: amount }), ...damageMonster(state, amount, null, now, 'special')];
}
function rescue(state, p, now) {
  const fallen = active(state).filter(x => x.down);
  if (!fallen.length) { p.rescue = 0; return []; }
  if (++p.rescue < DUNGEON.REVIVE_STREAK) return [];
  p.rescue = 0;
  const who = fallen[0];
  who.down = false; who.hp = Math.round(DUNGEON.MAX_HP * DUNGEON.REVIVE_HP); who.revived++;
  return [event(state, 'revive', { pid: who.id, by: p.id, hp: who.hp }), ...serve(state, who, now)];
}

/* ---------- 보스 ---------- */
function bossStage(state, now) {
  const m = state.monster, share = m.hp / m.max_hp, out = [];
  if (m.stage === 1 && share <= DUNGEON.PHASE2_AT && m.hp > 0) {
    m.stage = 2; m.mark_at = now + 3000;
    out.push(event(state, 'boss_phase', { stage: 2, name: '빨간펜 채점' }));
  }
  if (m.stage === 2 && share <= DUNGEON.PHASE3_AT && m.hp > 0) {
    m.stage = 3; m.mark = null; m.mark_at = null;
    for (const p of active(state)) p.mark_left = 0;
    m.cores = 1;
    m.core = { open_until: now + DUNGEON.CORE_MS, count: 0, goal: DUNGEON.CORE_PER_PLAYER * Math.max(1, standing(state).length) };
    out.push(event(state, 'boss_phase', { stage: 3, name: '핵 노출' }), event(state, 'core_open', { until: m.core.open_until, goal: m.core.goal }));
  }
  return out;
}
function markTarget(state, now) {
  const m = state.monster, list = standing(state).filter(p => p.connected);
  m.mark_at = now + DUNGEON.MARK_EVERY_MS;
  if (!list.length) return [];
  const target = pick(state, list);
  target.mark_left = DUNGEON.MARK_NEED;
  m.mark = target.id; m.marks++;
  return [event(state, 'mark', { pid: target.id, need: DUNGEON.MARK_NEED })];
}
function coreTick(state, now) {
  const m = state.monster, c = m.core;
  if (c.open_until && now >= c.open_until) {
    c.open_until = null; c.reopen_at = now + DUNGEON.CORE_GAP_MS;
    return [event(state, 'core_close', { broke: false, count: c.count, goal: c.goal })];
  }
  if (!c.open_until && c.reopen_at && now >= c.reopen_at) {
    c.reopen_at = null; c.open_until = now + DUNGEON.CORE_MS; c.count = 0; m.cores++;
    c.goal = DUNGEON.CORE_PER_PLAYER * Math.max(1, standing(state).length);
    return [event(state, 'core_open', { until: c.open_until, goal: c.goal })];
  }
  return [];
}
function coreHit(state, now) {
  const m = state.monster, c = m?.core;
  if (!c?.open_until) return [];
  if (++c.count < c.goal) return [];
  c.open_until = null; c.reopen_at = now + DUNGEON.CORE_GAP_MS; m.breaks++;
  const amount = Math.round(m.max_hp * DUNGEON.BREAK_SHARE);
  return [event(state, 'core_close', { broke: true, count: c.count, goal: c.goal }), event(state, 'break', { damage: amount }), ...damageMonster(state, amount, null, now, 'break')];
}

/* ---------- 층 넘기기 ---------- */
function startFloor(state, now) {
  state.floor++;
  const spec = floorSpec(state.cut, state.floor);
  const key = spec.boss ? BOSS.key : pickMonster(state, state.floor);
  const hp = monsterHp(state, spec, key);
  state.monster = spec.boss
    ? { key, name: BOSS.name, boss: true, trait: null, hp, max_hp: hp, stage: 1, mark: null, mark_at: null, core: null, marks: 0, blocked: 0, breaks: 0, cores: 0 }
    : { key, name: MONSTERS[key].name, boss: false, trait: MONSTERS[key].trait, size: MONSTERS[key].size, hp, max_hp: hp };
  state.phase = 'fight';
  state.phase_at = now;
  const out = [event(state, 'floor', { floor: state.floor, boss: !!spec.boss, monster: key, hp, options: spec.options, bg: spec.bg })];
  for (const p of active(state)) { p.last_wrong = false; if (p.connected) out.push(...serve(state, p, now)); else p.auto_at = now + DUNGEON.AUTO_MS; }
  return out;
}
function monsterDown(state, now) {
  const m = state.monster, out = [event(state, 'defeat', { floor: state.floor, monster: m.key, boss: m.boss })];
  for (const p of active(state)) { p.q = null; p.next_at = null; p.mark_left = 0; }
  if (m.boss && !isEndless(state)) return [...out, ...finish(state, now, true)];
  if (state.floor >= lastFloor(state)) return [...out, ...finish(state, now, true)];
  state.phase = 'rest';
  state.rest_until = now + DUNGEON.REST_MS;
  // 층이 바뀔 때 기절자는 30%로 부활.
  for (const p of active(state)) if (p.down) { p.down = false; p.hp = Math.round(DUNGEON.MAX_HP * DUNGEON.FLOOR_REVIVE_HP); p.revived++; out.push(event(state, 'revive', { pid: p.id, by: null, hp: p.hp })); }
  out.push(event(state, 'rest', { until: state.rest_until, next: state.floor + 1 }));
  return out;
}

/* ---------- 끝 ---------- */
// 결과: 클리어 여부, 시간, 도달 층, 파티원별 정답률·기여도. 봇이 끼거나 포기한 사람이 있으면 기록 제외.
function finish(state, now, cleared) {
  if (state.phase === 'finished') return [];
  state.phase = 'finished';
  state.finished_at = now;
  for (const p of state.order.map(id => state.players[id])) { p.q = null; p.next_at = null; }
  const total = state.order.reduce((s, id) => s + state.players[id].damage, 0) || 1;
  const reached = cleared ? state.floor : Math.max(0, state.floor - 1);
  state.result = {
    cleared, cut: state.cut, grade: state.grade, size: state.order.length,
    floor: state.floor, reached, boss: !!state.monster?.boss,
    time_ms: state.started_at ? now - state.started_at : 0,
    record: cleared || isEndless(state) ? !state.order.some(id => state.players[id].bot || state.players[id].out) : false,
    no_down: state.order.every(id => state.players[id].downs === 0),
    report_id: reportId(state),
    players: state.order.map(id => {
      const p = state.players[id];
      return { id, name: p.name, bot: p.bot, out: p.out, right: p.right, wrong: p.wrong, timeouts: p.timeouts, answered: p.answered,
        accuracy: p.answered ? Math.round(p.right / p.answered * 1000) / 1000 : 0, share: Math.round(p.damage / total * 1000) / 1000,
        best_combo: p.best_combo, downs: p.downs, reward: !p.out && !p.bot };
    })
  };
  return [event(state, 'finished', { result: state.result })];
}
// 결과는 끝날 때 메인 상태 객체에 한 번 보고한다. 같은 방·같은 시작 시각이면 같은 키라 두 번 지급되지 않는다.
export const reportId = state => `dungeon:${state.id}:${state.started_at ?? state.created_at}`;

/* ---------- 답 · 시계 ---------- */
// 학생이 보기를 눌렀다(선택 번호만). `n`: 그 문제 번호(늦게 온 답을 버린다).
export function answer(state, pid, choice, now, n = null) {
  const p = state.players[pid];
  if (state.phase !== 'fight' || !p || !p.q || p.down || p.out) return [];
  if (n !== null && n !== p.q.n) return [];
  if (now > p.q.deadline) return tick(state, now);
  const out = tick(state, now);
  if (state.phase !== 'fight' || !p.q || (n !== null && n !== p.q.n)) return out;
  const c = Number.isInteger(choice) ? choice : typeof choice === 'string' && /^\d{1,2}$/.test(choice) ? Number(choice) : -1;
  if (!Number.isInteger(c) || c < 0 || c >= p.q.options.length || c === p.q.covered) return out;
  return [...out, ...resolve(state, p, c === p.q.answer, now, false)];
}
function resolve(state, p, right, now, timeout) {
  const q = p.q, m = state.monster, out = [];
  p.q = null; p.answered++;
  out.push(event(state, 'answered', { pid: p.id, n: q.n, right, timeout, answer: q.answer }));
  if (right) {
    p.right++; p.combo++; p.best_combo = Math.max(p.best_combo, p.combo); p.last_wrong = false;
    const leftShare = (q.deadline - now) / (q.deadline - q.started_at);
    const armor = TRAITS[m.trait]?.armor || 1;
    out.push(...damageMonster(state, hitDamage({ leftShare, combo: p.combo, element: state.element_bonus, armor }), p.id, now, 'answer'));
    if (state.phase !== 'fight') return out;
    if (p.mark_left > 0 && --p.mark_left === 0 && m.mark === p.id) { m.mark = null; m.blocked++; out.push(event(state, 'mark_blocked', { pid: p.id })); }
    out.push(...addGauge(state, p.id, now));
    if (state.phase !== 'fight') return out;
    out.push(...coreHit(state, now));
    if (state.phase !== 'fight') return out;
    out.push(...rescue(state, p, now));
  } else {
    timeout ? p.timeouts++ : p.wrong++;
    p.combo = 0; p.rescue = 0; p.last_wrong = true;
    p.retry.push({ due: p.served + DUNGEON.RETRY_GAP, q: q.src });
    const marked = p.mark_left > 0 && m.mark === p.id;
    if (marked) { p.mark_left = 0; m.mark = null; out.push(event(state, 'mark_failed', { pid: p.id })); }
    out.push(...monsterStrike(state, p, now, marked ? DUNGEON.MARK_HIT : 1));
  }
  if (state.phase === 'fight' && !p.down && !p.out && p.connected) p.next_at = now + DUNGEON.REVEAL_MS;
  return out;
}

// 시계: 입장 연출 끝, 휴식 끝, 문제 시간 초과, 다음 문제, 끊긴 펫의 자동 공격, 90초 포기, 보스 채점·핵.
export function tick(state, now) {
  const out = [];
  for (let guard = 0; guard < 50; guard++) {
    const step = tickOnce(state, now);
    if (!step.length) break;
    out.push(...step);
  }
  return out;
}
function tickOnce(state, now) {
  if (state.phase === 'intro' && now >= state.intro_until) {
    state.intro_until = null;
    state.started_at = now; // 기록 시계: 1층 시작부터
    return startFloor(state, now);
  }
  if (state.phase === 'rest' && now >= state.rest_until) { state.rest_until = null; return startFloor(state, now); }
  if (state.phase !== 'fight') return [];
  const out = [];
  for (const p of active(state)) {
    if (!p.connected && now >= p.dropped_at + DUNGEON.DROP_MS) {
      p.out = true; p.q = null; p.next_at = null; p.auto_at = null;
      out.push(event(state, 'forfeit', { pid: p.id }));
      if (!standing(state).length) return [...out, ...finish(state, now, false)];
      continue;
    }
    if (!p.connected && !p.down && p.auto_at && now >= p.auto_at) {
      p.auto_at = now + DUNGEON.AUTO_MS;
      out.push(...damageMonster(state, Math.round(DUNGEON.HIT * DUNGEON.AUTO_HIT), p.id, now, 'auto'));
      if (state.phase !== 'fight') return out;
    }
    if (p.q && now >= p.q.deadline) { out.push(...resolve(state, p, false, p.q.deadline, true)); if (state.phase !== 'fight') return out; }
    if (!p.q && p.next_at && now >= p.next_at) out.push(...serve(state, p, now));
  }
  const m = state.monster;
  if (m?.boss && m.stage === 2 && m.mark_at && now >= m.mark_at) {
    // 지난 표적은 다음 주기에 풀린다(끊기거나 기절한 표적이 채점을 계속 붙잡지 않게).
    if (m.mark && state.players[m.mark]) state.players[m.mark].mark_left = 0;
    m.mark = null;
    out.push(...markTarget(state, now));
  }
  if (m?.boss && m.stage === 3 && m.core) out.push(...coreTick(state, now));
  return out;
}

// 다음에 깨워야 할 시각(알람). 할 일이 없으면 null.
export function nextWake(state) {
  if (state.phase === 'intro') return state.intro_until;
  if (state.phase === 'rest') return state.rest_until;
  if (state.phase !== 'fight') return null;
  const times = [];
  for (const p of active(state)) {
    if (p.q) times.push(p.q.deadline);
    else if (p.next_at) times.push(p.next_at);
    if (!p.connected) { times.push(p.dropped_at + DUNGEON.DROP_MS); if (!p.down && p.auto_at) times.push(p.auto_at); }
  }
  const m = state.monster;
  if (m?.boss && m.stage === 2 && m.mark_at) times.push(m.mark_at);
  if (m?.boss && m.stage === 3 && m.core) times.push(m.core.open_until ?? m.core.reopen_at);
  const valid = times.filter(Number.isFinite);
  return valid.length ? Math.min(...valid) : null;
}

/* ---------- 화면에 보낼 것 ---------- */
// 한 학생에게 보내는 상태. 정답 번호와 다른 학생의 문제는 보내지 않는다.
export function view(state, pid, now = null) {
  const me = state.players[pid];
  const m = state.monster;
  return {
    id: state.id, dungeon: state.dungeon, cut: state.cut, cut_name: CUTS[state.cut].name, grade: state.grade, host: state.host,
    phase: state.phase, floor: state.floor, last_floor: Number.isFinite(lastFloor(state)) ? lastFloor(state) : null,
    intro_until: state.intro_until, rest_until: state.rest_until, started_at: state.started_at,
    elapsed_ms: state.started_at ? (state.finished_at ?? now ?? state.started_at) - state.started_at : 0,
    gauge: state.gauge, gauge_max: state.gauge_max, element_bonus: state.element_bonus,
    monster: m ? {
      key: m.key, name: m.name, boss: m.boss, size: m.boss ? 'boss' : m.size, hp: m.hp, max_hp: m.max_hp,
      trait: m.trait ? { key: m.trait, name: TRAITS[m.trait].name, desc: TRAITS[m.trait].desc } : null,
      ...(m.boss ? { stage: m.stage, mark: m.mark, core: m.core ? { open_until: m.core.open_until, reopen_at: m.core.reopen_at, count: m.core.count, goal: m.core.goal } : null } : {})
    } : null,
    players: state.order.map(id => {
      const p = state.players[id];
      return { id, name: p.name, pet: p.pet, element: p.element, bot: p.bot, ready: p.ready, connected: p.connected, out: p.out,
        hp: p.hp, max_hp: DUNGEON.MAX_HP, down: p.down, combo: p.combo, rescue: p.rescue, mark_left: p.mark_left, right: p.right, answered: p.answered };
    }),
    question: me?.q ? { n: me.q.n, prompt: me.q.prompt, options: me.q.options, covered: me.q.covered, marked: me.q.marked, started_at: me.q.started_at, deadline: me.q.deadline } : null,
    result: state.result
  };
}
