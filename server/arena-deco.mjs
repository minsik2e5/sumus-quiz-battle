// V13.236 펫 아레나 경기장 꾸미기(서버). 새 재화 없음: 코인 판 승리 누적(games.arena.cw)으로 열린다.
//   p.games.arena.cw: 코인 판(보상을 받은 판)에서 이긴 수. 처음 쓸 때 지금까지의 승리(wins + live_wins)로 한 번 채운다.
//   p.games.arena.dc: 고른 꾸미기 { bg, rg, en, ps }(약 60바이트, 열린 것만). 판 시작 · 친구 방 열기 · 들어가기 요청에 실어 오면 여기서 본다.
// 렉 방지: 내 프로필 한 칸만 읽고 쓴다(다른 학생을 훑지 않음). 새 상태 묶음 없음(프로필 안 작은 칸, server/perf-budget.mjs profiles).
import { DECO_SLOTS, cleanDeco, decoLocked, decoFull, decoItem, DECO_KO } from '../public/modules/arena-deco-rules.js';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
// 열림에 쓰는 승리 수: 코인 판 승리 누적(없으면 지금까지의 승리).
export const decoWins = a => Math.max(0, Math.floor(Number(a?.cw ?? (Number(a?.wins || 0) + Number(a?.live_wins || 0))) || 0));
// 코인 판에서 이겼을 때(정산 안에서 승리 수를 이미 올린 뒤 부른다): 처음이면 지금까지의 승리로 채우고, 아니면 +1.
export function bumpCoinWin(a) {
  a.cw = a.cw == null ? Number(a.wins || 0) + Number(a.live_wins || 0) : Number(a.cw || 0) + 1;
  return a.cw;
}
// 고른 꾸미기 받기: 안 열린 것이 하나라도 있으면 거부(아무것도 바꾸지 않는다). 받은 칸만 바꾸고 나머지는 그대로.
export function setDeco(a, raw) {
  if (raw == null) return a.dc || null;
  const want = cleanDeco(raw), wins = decoWins(a), locked = decoLocked(want, wins);
  if (locked.length) { const x = locked[0]; fail(`${DECO_KO[x.slot]} '${x.n}'은(는) ${x.w}승부터 열려요. (지금 ${wins}승)`, 403); }
  if (!Object.keys(want).length) return a.dc || null;
  const next = { ...cleanDeco(a.dc), ...want };
  // 기본값은 적지 않는다(작게).
  for (const s of DECO_SLOTS) if (next[s] === undefined || (decoItem(s, next[s])?.w === 0 && (s === 'bg' ? next[s] === 'auto' : next[s] === 'basic'))) delete next[s];
  if (Object.keys(next).length) a.dc = next; else delete a.dc;
  return a.dc || null;
}
// 화면에 보내는 꾸미기: 승리 수 · 고른 것(열린 것만, 기본값 채움).
export const decoView = a => ({ wins: decoWins(a), dc: decoFull(a?.dc, decoWins(a)) });
// 방 · 친구 팀 목록에 싣는 것: 열린 것만(나중에 규칙이 바뀌어도 안 열린 것은 보내지 않는다).
export const decoOf = a => { const f = decoFull(a?.dc, decoWins(a)); return { bg: f.bg, rg: f.rg, en: f.en }; };
