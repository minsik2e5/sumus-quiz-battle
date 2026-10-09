// Release checks for V13.119 전투 효과 2탄 (public/modules/battle-fx.js + the hooks in battle.js + v13119.css):
// element attacks, skill cut-in, shield/heal/power-up/poison, combo ranks, speed lines, edge glows.
// The effects are presentation only; here we check the element table, the cap on live pieces (run on a
// tiny fake DOM), and that every hook keeps the player's "less motion" setting.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHARACTERS } from '../public/modules/core.js';
import { ELEMENTS, PET_ELEMENT, elementOf, paletteOf, FX2_MAX, FX2_CAP, tierOf, fxCap, SIGNATURE_KEYS, fxSignature, fxLunge, fxRecoil, COMBO_RANKS, comboRank, auraLevel, fxShot, fxImpact, fxSkillCutIn, fxShield, fxHeal, fxPowerUp, fxToxic, fxSpeedLines, fxRank, fxEdge } from '../public/modules/battle-fx.js';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

// A tiny DOM: just what battle-fx.js touches.
function fakeDom() {
  const make = () => {
    const el = { children: [], dataset: {}, style: { props: {}, setProperty(k, v) { this.props[k] = v; } }, className: '', innerHTML: '', attrs: {}, animations: 0,
      setAttribute(k, v) { this.attrs[k] = v; }, animate() { el.animations++; return {}; }, remove() { if (el.parent) el.parent.children = el.parent.children.filter(c => c !== el); },
      appendChild(child) { child.parent = el; el.children.push(child); },
      querySelectorAll(selector) { return selector === '[data-fx]' ? el.children.filter(c => 'fx' in c.dataset) : []; },
      querySelector(selector) { if (selector.startsWith('#')) return el.children.find(c => c.id === selector.slice(1)) || null; return el.__inner?.[selector] || null; } };
    return el;
  };
  const realDocument = globalThis.document, realSetTimeout = globalThis.setTimeout;
  globalThis.document = { createElement: () => { const el = make(); Object.defineProperty(el, 'innerHTML', { get() { return el._html || ''; }, set(v) { el._html = v; el.__inner = { '.fx2-cut-band': make(), '.fx2-cut-dim': make(), '.fx2-cut-pet': make() }; } }); return el; } };
  globalThis.setTimeout = () => 0;
  return { arena: make(), restore() { globalThis.document = realDocument; globalThis.setTimeout = realSetTimeout; } };
}

export function runBattleFxChecks(assert) {
  /* ---------- the element table ---------- */
  const keys = Object.keys(ELEMENTS);
  assert(keys.length === 8 && keys.every(key => /^#[0-9a-f]{6}$/i.test(ELEMENTS[key].c1) && /^#[0-9a-f]{6}$/i.test(ELEMENTS[key].c2) && /^#[0-9a-f]{6}$/i.test(ELEMENTS[key].c3) && ELEMENTS[key].name), 'V13.115 속성 8가지(불꽃 얼음 물 풀 바위 바람 독 별빛)마다 색 3개와 이름이 있다');
  assert(Object.values(PET_ELEMENT).every(el => ELEMENTS[el]) && keys.every(el => Object.values(PET_ELEMENT).includes(el) || el === 'star'), 'V13.115 모든 펫의 속성은 표에 있고, 별빛을 뺀 7가지는 어떤 펫이 쓴다');
  const allPets = [...Object.keys(CHARACTERS), 'robot'];
  assert(allPets.every(key => ELEMENTS[elementOf(key)]) && elementOf('nobody') === 'star' && elementOf() === 'star' && paletteOf('dragon') === ELEMENTS.flame && elementOf('penguin') === 'ice' && elementOf('otter') === 'water' && elementOf('snake') === 'toxic' && elementOf('owl') === 'wind' && elementOf('bear') === 'earth' && elementOf('deer') === 'leaf', 'V13.115 지금 있는 모든 펫(과 로보)이 속성을 가지고, 모르는 펫은 별빛이다');
  const counts = Object.fromEntries(keys.map(el => [el, allPets.filter(key => elementOf(key) === el).length]));
  assert(keys.filter(el => el !== 'star').every(el => counts[el] >= 2) && Math.max(...Object.values(counts)) <= 11, 'V13.115 불꽃 · 얼음 · 물 · 풀 · 바위 · 바람 · 독이 각각 두 마리 이상의 펫에게 돌아가고 한 속성에 몰리지 않는다(새 펫이 오면 얼음·독이 늘어나요)');
  assert(comboRank(3)?.[1] === 'NICE!' && comboRank(5)?.[1] === 'GREAT!' && comboRank(8)?.[1] === 'AMAZING!' && comboRank(12)?.[1] === 'UNSTOPPABLE!' && !comboRank(4) && !comboRank(2) && COMBO_RANKS.length === 4 && auraLevel(4) === 0 && auraLevel(5) === 1 && auraLevel(8) === 2 && auraLevel(12) === 3 && auraLevel(30) === 3, 'V13.115 콤보 등급 글자는 3 · 5 · 8 · 12번에서 한 번씩, 기운은 5 · 8 · 12에서 커진다');

  /* ---------- on a fake DOM ---------- */
  const dom = fakeDom();
  try {
    const { arena } = dom, at = { x: 100, y: 80 }, to = { x: 240, y: 60 };
    for (const el of keys) {
      const before = arena.children.length;
      fxShot(arena, at, to, el, { big: true });
      fxImpact(arena, to, el, 3);
      const added = arena.children.slice(before);
      assert(added.length >= 8 && added.every(piece => 'fx' in piece.dataset && /^fx2 /.test(piece.className) && piece.animations >= 0), `V13.115 ${ELEMENTS[el].name} 공격과 맞는 순간이 조각으로 그려진다`);
      arena.children.length = 0;
    }
    for (let i = 0; i < 12; i++) { fxImpact(arena, to, 'flame', 3); fxShot(arena, at, to, 'ice', { big: true }); fxHeal(arena, at); fxToxic(arena, to); fxPowerUp(arena, at, 'water'); }
    assert(arena.children.filter(c => 'fx' in c.dataset).length <= FX2_MAX && FX2_MAX === 44, 'V13.115 한꺼번에 그려지는 효과 조각은 44개를 넘지 않는다 (느린 폰을 지켜요)');
    arena.children.length = 0;

    /* ---------- 등급: 영웅 · 전설 · 신화는 더 멋있게 ---------- */
    assert(tierOf({}) === 0 && tierOf({ epic: true }) === 1 && tierOf({ legendary: true }) === 2 && tierOf({ mythic: true }) === 3 && tierOf({ mythic: true, epic: true }) === 3 && tierOf(undefined) === 0 && tierOf(CHARACTERS.dog) === 0 && tierOf(CHARACTERS.penguin) === 1 && tierOf(CHARACTERS.qilin) === 2 && FX2_CAP.join() === '44,52,60,66', 'V13.115 등급: 기본 0 · 영웅 1 · 전설 2 · 신화 3, 효과 조각 상한은 44 · 52 · 60 · 66이다');
    const pieces = rank => { arena.children.length = 0; fxCap(rank); for (let i = 0; i < 14; i++) { fxImpact(arena, to, 'water', 3, rank); fxShot(arena, at, to, 'flame', { big: true, rank }); fxSkillCutIn(arena, { side: 'me', portrait: '', name: 'n', desc: 'd', petName: 'p', el: 'ice', rank }); } return arena.children.filter(c => 'fx' in c.dataset).length; };
    const counts4 = [0, 1, 2, 3].map(pieces);
    assert(counts4.every((n, rank) => n <= FX2_CAP[rank]) && counts4[3] > counts4[0] && counts4[1] >= counts4[0], 'V13.115 등급이 높을수록 한 번에 그려지는 조각이 더 많지만 등급마다 상한(44 · 52 · 60 · 66)을 넘지 않는다');
    fxCap(0);
    const single = rank => { arena.children.length = 0; fxCap(3); fxImpact(arena, to, 'water', 3, rank); return arena.children.length; };
    assert(single(1) > single(0) && single(2) > single(1) && single(3) > single(2) && (arena.children.length = 0, fxShot(arena, at, to, 'flame', { rank: 0 }), arena.children.length) === 4 && (arena.children.length = 0, fxShot(arena, at, to, 'flame', { rank: 2 }), arena.children.length) === 8, 'V13.115 맞는 순간은 영웅이 금빛 고리, 전설이 속성 돔과 별빛, 신화가 무지개 고리를 더 얹고, 공격 흔적은 등급마다 2개씩 길어진다');
    arena.children.length = 0; fxCap(3);
    fxSkillCutIn(arena, { side: 'me', portrait: '', name: 'n', desc: 'd', petName: 'p', el: 'flame', rank: 3 });
    assert(arena.children[0].className.includes(' t3') && arena.children.some(c => c.className.includes('fx2-wash')) && arena.children.filter(c => c.className.includes('fx2-bit star')).length === 11, 'V13.115 신화 스킬 컷인은 t3 테두리 · 화면 전체가 속성 색으로 물드는 효과 · 별 11개가 따라붙는다');
    arena.children.length = 0; fxSkillCutIn(arena, { side: 'op', portrait: '', name: 'n', desc: 'd', petName: 'p', el: 'flame', rank: 0 });
    assert(arena.children.length === 1 && arena.children[0].className.includes(' t0'), 'V13.115 기본 펫의 컷인에는 별도 장식이 없다');
    const sig = {};
    for (const key of SIGNATURE_KEYS) { arena.children.length = 0; fxCap(3); fxSignature(arena, at, to, key); sig[key] = arena.children.length; }
    assert(SIGNATURE_KEYS.join() === 'gumiho,cheongryong,baekho,jujak,hyeonmu' && Object.values(sig).every(n => n >= 2 && n <= 14) && sig.gumiho === 9 && sig.baekho === 3 && sig.jujak === 5, 'V13.115 신화 5종은 필살 연출을 가진다: 구미호 여우불 9개 · 청룡 번개 · 백호 발톱 3줄 · 주작 불기둥 5개 · 현무 파문과 별');
    arena.children.length = 0; fxSignature(arena, at, to, 'nobody');
    assert(arena.children.length === 1 && arena.children[0].className.includes('fx2-prism'), 'V13.115 필살이 없는 펫은 무지개 고리로 대신한다');
    arena.children.length = 0; fxCap(0);
    const mover = { frames: null, animate(frames, opts) { mover.frames = frames; mover.opts = opts; } };
    fxLunge(mover, 1); const lungeFrames = mover.frames; fxRecoil(mover, -1);
    assert(lungeFrames.length === 4 && lungeFrames[1].translate.startsWith('-8px') && lungeFrames[2].translate.startsWith('30px') && lungeFrames[2].scale === '1.12 .92' && mover.frames.length === 4 && mover.frames[1].translate.startsWith('-16px') && mover.frames[1].rotate === '9deg' && (fxLunge(null), fxRecoil(undefined), true), 'V13.115 공격하는 펫은 웅크렸다가 튀어 나가며 납작해지고, 맞은 펫은 뒤로 젖혀지며 기울고 움찔한다 (translate · scale · rotate)');
    fxSkillCutIn(arena, { side: 'me', portrait: '<i></i>', name: '불꽃 숨결', desc: '바로 13 피해', petName: '용이', el: 'flame' });
    const cut = arena.children[0];
    assert(cut && cut.style.props['--c1'] === ELEMENTS.flame.c1 && cut.style.props['--c2'] === ELEMENTS.flame.c2 && cut.style.props['--c3'] === ELEMENTS.flame.c3 && cut.attrs['aria-hidden'] === 'true' && cut.animations === 0 && cut.__inner['.fx2-cut-band'].animations === 1 && cut.__inner['.fx2-cut-dim'].animations === 1, 'V13.115 스킬 컷인은 속성 색을 CSS 변수로 받고(setProperty), 화면 읽기에서는 숨기고, 띠 · 어둡게 · 펫 그림이 따로 움직인다');
    arena.children.length = 0;
    fxShield(arena, at); fxSpeedLines(arena, to, 'wind'); fxRank(arena, at, 'GREAT!', '#ff7a1a');
    assert(arena.children.length === 3 && arena.children[2].innerHTML.includes('GREAT!'), 'V13.115 막기 · 속도선 · 콤보 등급 글자가 그려진다');
    arena.children.length = 0;
    fxEdge(arena, 'low', true); fxEdge(arena, 'low', true); fxEdge(arena, 'fever', true);
    assert(arena.children.length === 2 && arena.children.every(c => c.attrs['aria-hidden'] === 'true' && !('fx' in c.dataset)) && (fxEdge(arena, 'low', false), arena.children.length === 1) && (fxEdge(arena, 'fever', false), arena.children.length === 0), 'V13.115 위험 · 피버 가장자리는 하나씩만 켜지고 끌 수 있으며 조각 수에 들어가지 않는다');
  } finally { dom.restore(); }

  /* ---------- the hooks keep "less motion" ---------- */
  const battle = source('../public/modules/battle.js'), css = source('../public/v13119.css'), build = source('./build-assets.mjs'), fx = source('../public/modules/battle-fx.js');
  assert(/import \{[^}]*elementOf[^}]*fxSkillCutIn[^}]*\} from '\.\/battle-fx\.js'/.test(battle) && battle.includes("const arena = document.getElementById('yb-arena'); if (!arena || reduced()) return;\n  const from = fxCenter(atk, arena)") && battle.includes('const el = attacker?.monster ? null : elementOf(attacker?.pet?.key);') && battle.includes('if (el) fxShot(arena, from, to, el, { big: true, ms: 180, rank });') && battle.includes('fxImpact(arena, to, el, big ? 3 : dmgTier(dmg), rank);') && battle.includes('const rank = el ? tierOf(CHARACTERS[petKey(attacker.pet.key)]) : 0;') && battle.includes('if (rank >= 3 && (skill || crit)) fxSignature(arena, from, to, petKey(attacker.pet.key));') && battle.includes("fxLunge(el, side === 'me' ? 1 : -1)") && battle.includes("fxRecoil(el, side === 'me' ? -1 : 1)") && battle.includes('rank: p.monster ? 0 : tierOf(CHARACTERS[petKey(p.pet?.key)])') && battle.includes("if (big) { fxSpeedLines(arena, to, el); fxPunch(arena, skill ? .06 : .04); }") && battle.includes("if (attacker?.monster) fxAdd(arena, 'fx-claw'"), 'V13.115 공격은 펫 속성의 조각으로 그리고(몬스터는 예전 발톱), 동작 줄이기에서는 strike가 아무것도 그리지 않는다');
  assert(battle.includes("if (arena && !reduced()) fxSkillCutIn(arena, { side, portrait: petArt(p, { size: 'mini' })") && battle.includes('}, reduced() ? 0 : 380);') && battle.includes('skillExtras(side, other, p, e);') && battle.includes('}, reduced() ? 0 : 880);') && battle.includes("const arena = document.getElementById('yb-arena'); if (!arena || reduced()) return;\n  const s = petSkill(p.pet), at = fxCenter(side, arena)") && battle.includes('if (s.guard?.length) fxShield(arena, at,') && battle.includes('if (s.boost?.length) fxPowerUp(arena, at, el);') && battle.includes('if (e.heal) fxHeal(arena, at);'), 'V13.115 스킬은 컷인이 먼저 지나간 뒤(0.38초) 타격이 나가고(0.88초), 회복 · 막기 · 파워업이 그 펫의 스킬에 맞게 나온다. 동작 줄이기에서는 컷인과 덧그림이 없다');
  assert(battle.includes("if (e.guard && !reduced()) later(() => {") && battle.includes('fxShield(arena, at); }, 240);') && battle.includes("const arena = document.getElementById('yb-arena'), at = arena && !reduced() && fxCenter(side, arena); if (at) fxToxic(arena, at);") && battle.includes('const rank = comboRank(s.combo), arena = document.getElementById(\'yb-arena\');') && battle.includes('if (rank && arena && !reduced())') && battle.includes('setAura(auraLevel(s.combo));') && battle.includes('function comboReset() { const s = fxState(); if (!s.combo) return; s.combo = 0; drawCombo(false); setAura(0); }'), 'V13.115 막은 공격 · 독 · 콤보 등급과 기운도 동작 줄이기에서는 그리지 않고, 콤보가 끊기면 기운이 꺼진다');
  assert(battle.includes("fxEdge(document.getElementById('yb-arena'), 'low', p.hp > 0 && pct <= 25 && B.view?.phase !== 'finished')") && battle.includes("fxEdge(document.getElementById('yb-arena'), 'fever', fever);") && battle.includes("key.startsWith('--') ? el.style.setProperty(key, value)") && battle.includes('function sfxShot(el, big = false)') && battle.includes('const SHOT_SFX = {'), 'V13.115 HP 25% 이하 빨간 심장 박동 · 피버 불꽃 가장자리, 옛 효과의 펫 색 변수(--fx)도 이제 적용되고, 속성마다 공격 소리가 다르다');
  assert(css.includes('@media (prefers-reduced-motion:reduce){') && css.includes('.yb-arena .fx2,.fx2-edge.fever{display:none}') && css.includes('.fx2-edge.low{animation:none;opacity:.8}') && css.includes('.fx2-cut{inset:0;z-index:12;overflow:hidden}') && css.includes('.fx2-cut-band{position:absolute;left:-4%;right:-4%') && css.includes('.fx2-cut-pet .avatar-art') && css.includes('pointer-events:none') && css.includes('.yb-pet.fx-aura-3') && build.includes('"v13119.css"'), 'V13.115 CSS: 동작 줄이기에서 새 효과는 숨기고(HP 위험은 움직이지 않는 빨간 테두리), 컷인은 탭을 막지 않고, 묶음 CSS에 들어 있다');
  assert(!/api\(|rewards\.js|localStorage|fetch\(/.test(fx) && fx.includes('export const FX2_MAX = 44;') && fx.includes('live(arena) >= capNow') && fx.includes("el.dataset.fx = '';") && !/\.correct|\.hp\b|state\./.test(fx), 'V13.115 효과 모듈은 서버 · 코인 · 저장소를 건드리지 않고 게임 상태를 읽지 않는다(그리기만 한다)');
  assert(source('../public/sw.js').includes('/modules/battle-fx.js'), 'V13.115 효과 모듈이 앱 캐시에 들어 있다');
}
