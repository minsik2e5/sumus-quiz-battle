import { shuffle, displayEnglish } from './core.js';
import { cardMeaning } from './match-rules.js';

// V13.221 벽 통과(놀이터 미니게임): 무대 위 내 펫 앞으로 구멍 4개(구멍마다 단어 판)가 뚫린 벽이 다가온다.
// 맞는 단어 구멍을 누르면 펫이 그 구멍으로 쏙 통과하고, 틀리거나 시간이 다 되면 벽에 밀려 뒤의 풀장에 풍덩.
// 판(벽 15장: 문제 · 구멍 단어 4개 · 정답 자리)은 서버가 만들고(server/wall.mjs) 끝날 때 서버가 다시 채점해 보상한다.
// 화면은 wall.js. 이 파일은 화면 없이 규칙만 둔다(서버 · 검사가 같이 쓴다).
export const WALL = {
  WALLS: 15,                 // 한 판의 벽
  LIVES: 3,                  // 목숨(다 쓰면 그 자리에서 끝)
  STAGE_EVERY: 5,            // 5장마다 단계가 오른다(빨라진다)
  SPEEDS: [6000, 4500, 3500], // 단계마다 벽이 나타나서 펫에게 닿을 때까지(ms)
  COUNTDOWN_MS: 3000,
  MIN_PICK_MS: 400,          // 벽이 나타나고 이 시간 안에는 구멍이 켜지지 않는다(읽지도 않고 누른 답은 사람이 아니다)
  STARS: [15, 11, 6],        // 통과 수: 15장 모두 3별 · 11장 이상 2별 · 6장 이상 1별
  DAILY: 5,                  // 하루에 코인을 받는 판
  COINS: { 3: 12, 2: 8, 1: 4, 0: 0 }, // 짝 맞추기와 같다(선생님 결정)
  RECORD_COINS: 5,           // 내 최고 점수를 깨면(하루 한 번)
  XP: 6,
  POINTS: 100,               // 통과 한 번
  SPEED_POINTS: 50,          // 빨리 고를수록 최대 +50
  COMBO: [[10, 2], [5, 1.5], [3, 1.2]], // 콤보가 이만큼이면 점수 배수(10콤보는 피버)
  FEVER_AT: 10,
  STALE_MS: 10 * 60000,      // 시작하고 10분이 지나면 그 판은 무효
  SLACK_MS: 2500,            // 서버 시간 확인의 여유(왕복 지연)
  MISSED_MAX: 12,            // 지난 판 헷갈린 단어(먼저 낸다)
  EN_MAX: 16,                // 단어 판에 들어가는 영어 길이
  KO_MAX: 10                 // 단어 판에 들어가는 뜻(첫 갈래) 길이
};
export const WALL_KINDS = {
  mean2en: { label: '이 뜻의 영어는?' },
  en2mean: { label: '이 단어의 뜻은?' }
};

export const stageOf = i => Math.min(WALL.SPEEDS.length - 1, Math.floor(Math.max(0, i) / WALL.STAGE_EVERY));
export const wallMs = i => WALL.SPEEDS[stageOf(i)];
export const wallStars = passes => passes >= WALL.STARS[0] ? 3 : passes >= WALL.STARS[1] ? 2 : passes >= WALL.STARS[2] ? 1 : 0;
export const comboMult = combo => (WALL.COMBO.find(([n]) => combo >= n) || [0, 1])[1];
// 한 번 통과의 점수: 100 + 빨리 고른 만큼(최대 50) × 콤보 배수.
export function passPoints(ms, limit, combo) {
  const quick = Math.round(WALL.SPEED_POINTS * Math.max(0, Math.min(1, 1 - ms / limit)));
  return Math.round((WALL.POINTS + quick) * comboMult(combo));
}

// 단어 판에 쓸 영어 · 뜻(첫 갈래). 판에 안 들어가는 긴 말은 null.
export function wallFace(w) {
  const en = displayEnglish(w?.word || '').trim(), ko = cardMeaning(w?.meaning).replace(/\s*\[[^\]]*\]/g, '').trim(); // '~을 높이다[향상시키다]' → '~을 높이다'
  if (!w?.id || !en || !ko || en.length > WALL.EN_MAX) return null;
  return { id: String(w.id), en, ko, koFits: ko.length <= WALL.KO_MAX };
}
// 헷갈리는 정도: 첫 글자 · 끝 두 글자가 같고 길이가 비슷한 영어일수록 높다(affect / effect).
export function lookAlike(a, b) {
  const x = a.toLowerCase(), y = b.toLowerCase();
  let n = 0;
  if (x[0] === y[0]) n += 2;
  if (x.slice(-2) === y.slice(-2)) n += 1;
  if (Math.abs(x.length - y.length) <= 2) n += 1;
  if (x.slice(0, 3) === y.slice(0, 3)) n += 1;
  return n;
}

// 벽 하나: 정답 단어 + 같은 범위의 헷갈리는 단어 3개. 영어도 뜻도 서로 겹치지 않는다.
function dealWall(face, faces, kind, random) {
  const used = new Set([face.en.toLowerCase()]), usedKo = new Set([face.ko]);
  const cands = faces.filter(f => f.id !== face.id && !used.has(f.en.toLowerCase()) && !usedKo.has(f.ko) && (kind === 'mean2en' || f.koFits))
    .map(f => ({ f, score: lookAlike(face.en, f.en) + random() * 2.5 }))
    .sort((a, b) => b.score - a.score);
  const decoys = [];
  for (const { f } of cands) {
    if (used.has(f.en.toLowerCase()) || usedKo.has(f.ko)) continue;
    used.add(f.en.toLowerCase()); usedKo.add(f.ko); decoys.push(f);
    if (decoys.length === 3) break;
  }
  if (decoys.length < 3) return null;
  const opts = shuffle([face, ...decoys], random);
  return {
    id: face.id, kind,
    prompt: kind === 'mean2en' ? face.ko : face.en,
    options: opts.map(f => kind === 'mean2en' ? f.en : f.ko),
    answer: opts.indexOf(face)
  };
}

// 한 판(벽 15장). missed(지난 판 헷갈린 단어 id)를 먼저, 나머지는 섞어서. 범위가 15단어보다 작으면 다시 섞어 이어 낸다
// (바로 앞 벽과 같은 단어는 피한다). 문제 유형은 섞기: 뜻 → 영어 · 영어 → 뜻을 무작위로(같은 유형이 3번 넘게 이어지지 않게).
// 정답 자리는 같은 자리가 3번 이어지지 않게 다시 섞는다. 단어가 모자라면 빈 목록.
export function dealWalls(words, { missed = [], random = Math.random } = {}) {
  const seen = new Set(), faces = [];
  for (const w of words || []) {
    const f = wallFace(w);
    if (!f || seen.has(f.en.toLowerCase())) continue;
    seen.add(f.en.toLowerCase()); faces.push(f);
  }
  if (new Set(faces.map(f => f.ko)).size < 4) return [];
  const miss = new Set((missed || []).map(String).slice(0, WALL.MISSED_MAX));
  const order = [...shuffle(faces.filter(f => miss.has(f.id)), random), ...shuffle(faces.filter(f => !miss.has(f.id)), random)];
  const queue = [...order];
  const walls = [];
  let guard = 0;
  while (walls.length < WALL.WALLS && guard++ < WALL.WALLS * 20) {
    if (!queue.length) queue.push(...shuffle(faces, random));
    const face = queue.shift();
    if (walls.at(-1)?.id === face.id && faces.length > 1) { queue.push(face); continue; }
    const last = walls.slice(-3).map(x => x.kind);
    let kind = random() < .5 ? 'mean2en' : 'en2mean';
    if (last.length === 3 && last.every(k => k === kind)) kind = kind === 'mean2en' ? 'en2mean' : 'mean2en';
    if (!face.koFits) kind = 'mean2en';
    let wall = dealWall(face, faces, kind, random);
    if (!wall && kind === 'en2mean') wall = dealWall(face, faces, 'mean2en', random);
    if (!wall) continue;
    // 같은 정답 자리가 3번 이어지지 않게.
    const prev = walls.slice(-2).map(x => x.answer);
    for (let n = 0; n < 6 && prev.length === 2 && prev.every(a => a === wall.answer); n++) {
      const order2 = shuffle([0, 1, 2, 3], random), opts = order2.map(i => wall.options[i]);
      wall = { ...wall, options: opts, answer: order2.indexOf(wall.answer) };
    }
    walls.push({ ...wall, ms: wallMs(walls.length) });
  }
  return walls.length === WALL.WALLS ? walls : [];
}

// 채점(서버 · 화면이 같이 쓴다). answers: 벽마다 정답 자리, picks: [[고른 자리(-1 = 시간 끝), 걸린 ms], …].
// 목숨을 다 쓰면 거기서 끝(뒤의 고른 답은 보지 않는다). 너무 빨리(MIN_PICK_MS 전) 고른 답과 시간이 넘은 답은 놓친 것.
export function gradeWalls(answers, picks) {
  let lives = WALL.LIVES, combo = 0, best = 0, score = 0, passes = 0, played = 0, playedMs = 0;
  const marks = [];
  for (let i = 0; i < Math.min(answers.length, (picks || []).length) && lives > 0; i++) {
    const limit = wallMs(i), raw = picks[i] || [];
    const pick = Number.isInteger(raw[0]) ? raw[0] : -1, ms = Math.max(0, Math.min(limit, Math.round(Number(raw[1]) || 0)));
    const ok = pick >= 0 && pick <= 3 && pick === answers[i] && ms >= WALL.MIN_PICK_MS && Number(raw[1]) <= limit;
    played++; playedMs += pick < 0 ? limit : ms;
    if (ok) { combo++; best = Math.max(best, combo); passes++; score += passPoints(ms, limit, combo); }
    else { combo = 0; lives--; }
    marks.push(ok ? 1 : 0);
  }
  const over = lives <= 0 || played >= WALL.WALLS;
  return { passes, lives, combo: best, score, played, playedMs, marks, over, stars: wallStars(passes) };
}
