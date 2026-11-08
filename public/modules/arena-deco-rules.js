// V13.235 펫 아레나 경기장 꾸미기(구성안 docs/pet-arena-v2-plan.md 6장 7번). 새 재화 없음: 이긴 횟수(코인 판 승리 누적)로 열린다.
//   화면(arena-deco.js) · 서버(server/arena-deco.mjs) · 방(cloudflare/arena-room.mjs)이 같이 쓰는 목록.
//   칸 4가지: bg 경기장 배경 · rg 링(바닥 원) · en 입장 효과(상대에게도 보인다) · ps 승리 포즈.
//   고른 것은 프로필 games.arena.dc { bg, rg, en, ps }(약 60바이트)에 남고, 판 시작 요청에 실어 보내면 서버가 열렸는지 본다(안 열린 것은 거부).
//   그림(주문서 68)이 오면 ARENA_ART로 같은 자리가 그림으로 바뀌고, 없으면 CSS로 완성된 모습을 그린다.
// 몇 승에 무엇이 열리나(선생님이 정할 점, 추천안): 첫 주(하루 코인 판 5판)에 2~3개, 한 달쯤 꾸준히 하면 거의 다.
export const DECO = {
  bg: [
    { k: 'auto', n: '무작위', d: '광장 · 숲 · 밤 중 하나', w: 0, icon: '🎲' },
    { k: 'plaza', n: '벚꽃 광장', d: '기본 경기장', w: 0, icon: '🌸' },
    { k: 'forest', n: '숲속 경기장', d: '기본 경기장', w: 0, icon: '🌳' },
    { k: 'night', n: '밤의 경기장', d: '기본 경기장', w: 0, icon: '🌙' },
    { k: 'sky', n: '구름 위 하늘 정원', d: '떠다니는 섬 · 무지개', w: 5, icon: '☁️' },
    { k: 'glacier', n: '얼음 동굴', d: '반짝이는 얼음 기둥 · 오로라', w: 15, icon: '🧊' },
    { k: 'volcano', n: '화산 분화구', d: '흐르는 용암 · 불티', w: 30, icon: '🌋' },
    { k: 'galaxy', n: '별빛 은하', d: '우주 한가운데 별자리 무대', w: 60, icon: '🌌' }
  ],
  rg: [
    { k: 'basic', n: '기본 링', d: '하얀 테두리', w: 0, icon: '⚪' },
    { k: 'flower', n: '꽃 고리', d: '꽃잎이 도는 링', w: 3, icon: '🌼' },
    { k: 'rune', n: '마법진', d: '천천히 도는 빛나는 글무늬', w: 10, icon: '🔮' },
    { k: 'gold', n: '황금 링', d: '반짝이는 금테 · 별 장식', w: 25, icon: '🏅' },
    { k: 'star', n: '별자리 링', d: '별이 이어지는 은하 링', w: 45, icon: '✨' }
  ],
  en: [
    { k: 'basic', n: '기본 등장', d: '살짝 뛰어 들어와요', w: 0, icon: '👟' },
    { k: 'smoke', n: '연기 펑!', d: '하얀 연기 속에서 짠', w: 2, icon: '💨' },
    { k: 'thunder', n: '번개 낙하', d: '번개와 함께 쾅!', w: 8, icon: '⚡' },
    { k: 'flame', n: '불꽃 기둥', d: '불기둥이 솟아올라요', w: 20, icon: '🔥' },
    { k: 'rainbow', n: '무지개 포털', d: '무지개 문이 열려요', w: 40, icon: '🌈' }
  ],
  ps: [
    { k: 'basic', n: '폴짝', d: '기뻐서 폴짝', w: 0, icon: '😊' },
    { k: 'jump', n: '공중 돌기', d: '높이 뛰어 한 바퀴', w: 4, icon: '🤸' },
    { k: 'spin', n: '별빛 회전', d: '빙글빙글 별이 쏟아져요', w: 12, icon: '💫' },
    { k: 'crown', n: '왕관 세리머니', d: '왕관 · 꽃가루 · 스포트라이트', w: 35, icon: '👑' }
  ]
};
export const DECO_SLOTS = ['bg', 'rg', 'en', 'ps'];
export const DECO_KO = { bg: '경기장', rg: '링', en: '입장 효과', ps: '승리 포즈' };
export const DECO_DEF = { bg: 'auto', rg: 'basic', en: 'basic', ps: 'basic' };
// 기본 경기장 3개(무작위가 고르는 것) · 그림 이름(주문서 65 · 68, public/assets/arena/<이름>.webp).
export const BASE_BG = ['plaza', 'forest', 'night'];
export const decoItem = (slot, k) => DECO[slot]?.find(x => x.k === k) || null;
export const decoArt = { bg: k => `bg-${k}`, rg: k => `ring-${k}`, en: k => `entry-${k}` };

// 알려진 칸 · 알려진 이름만 남긴다(없으면 빈 객체). 열렸는지는 보지 않는다(decoLocked가 본다).
export function cleanDeco(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const s of DECO_SLOTS) { const k = String(raw[s] ?? '').slice(0, 12); if (decoItem(s, k)) out[s] = k; }
  return out;
}
// 고른 것 중 아직 안 열린 것: [{ slot, k, n, w }]. wins: 코인 판 승리 누적.
export const decoLocked = (dc, wins) => Object.entries(cleanDeco(dc)).map(([s, k]) => ({ slot: s, ...decoItem(s, k) })).filter(x => x.w > Number(wins || 0)).map(x => ({ slot: x.slot, k: x.k, n: x.n, w: x.w }));
// 열린 것만 남기고 기본값으로 채운 꾸미기(화면 · 방이 그대로 쓴다).
export function decoFull(dc, wins = Infinity) {
  const c = cleanDeco(dc), out = {};
  for (const s of DECO_SLOTS) { const x = decoItem(s, c[s]); out[s] = x && x.w <= wins ? x.k : DECO_DEF[s]; }
  return out;
}
// 경기장 배경 이름: 무작위면 씨앗으로 기본 3개 중 하나(예전과 같은 seed % 3).
export const decoBg = (bg, seed = 0) => !bg || bg === 'auto' || !decoItem('bg', bg) ? BASE_BG[Math.abs(Number(seed) || 0) % 3] : bg;
// 다음에 열리는 것(꾸미기 탭 막대): { slot, k, n, w, left } | null.
export function decoNext(wins) {
  const all = DECO_SLOTS.flatMap(s => DECO[s].map(x => ({ slot: s, ...x }))).filter(x => x.w > wins).sort((a, b) => a.w - b.w);
  return all[0] ? { slot: all[0].slot, k: all[0].k, n: all[0].n, w: all[0].w, left: all[0].w - wins } : null;
}
