// V13.191 검사: 인형뽑기 퀄리티업(docs/claw-upgrade-design.md). ① near-miss 놓침 연출 ② 반 소식.
//   서버 규칙(확률 · 보상 · 하루 상한 · 집게권)은 그대로, 놓침 연출은 서버 결과와 늘 맞고(잡힘에는 놓침 연출 없음),
//   소식은 트리거 · 하루 상한 · 비공개 · 미리보기 제외 · 같은 반만 · 저장 크기 상한, 응답에 정답 힌트 없음.
import { readFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CLAW, DOLL_KEYS, rollDrop } from '../public/modules/claw-rules.js';
import { missPlan, planExtraMs, NEAR_FX, NEAR_LEVELS, NEAR_EXTRA_MAX } from '../public/modules/claw-fx.js';
import { SOUND_KEYS } from '../public/modules/sound.js';
import { clawStart, clawDrop } from './claw.mjs';
import { CLAW_NEWS, clawNewsKind, postClawNews, clawNewsFor } from './claw-news.mjs';
import { emptyState } from './state.mjs';
import { passwordHash } from './auth.mjs';
import { service } from './service.mjs';

const source = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const DAY = 86400000;
const seeded = s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

export async function runClawUpgradeChecks(assert) {
  const t0 = Date.parse('2026-10-28T03:00:00Z');

  /* ---------- 0. 서버 규칙은 그대로 ---------- */
  assert(JSON.stringify({ g: CLAW.GRAB, s: CLAW.SLIP, c: [CLAW.COIN, CLAW.GOLD_COIN, CLAW.COIN_DAILY, CLAW.BOOK_BONUS], t: [CLAW.TICKET_MAX, CLAW.DROPS, CLAW.TIME, CLAW.PITY, CLAW.PITY_MAX, CLAW.GOLD_ROUND, CLAW.GOLD_X, CLAW.JACKPOT, CLAW.GAP_MS, CLAW.ANIM_MS] })
    === JSON.stringify({ g: { perfect: 38, good: 26, edge: 10 }, s: { lift: 60, chute: 15, loose: 25 }, c: [6, 20, 30, 100], t: [6, 3, 30, 5, 20, 25, 0.5, 4, 4000, 4500] }),
    'V13.191 퀄리티업은 연출 · 소식만: 잡힐 확률 · 놓침 모양 비율 · 코인 · 하루 상한 · 집게권 · 연출 시간 숫자는 그대로');
  const server = source('./claw.mjs');
  assert(!server.includes('claw-fx') && !server.includes('claw-news') && !source('../public/modules/claw-rules.js').includes('claw-fx'), 'V13.191 서버 판정(claw.mjs · claw-rules.js)은 연출 표를 보지 않는다(연출이 결과를 바꿀 수 없음)');

  /* ---------- 1. 놓침 연출 = 서버 결과 ---------- */
  {
    const rand = seeded(7), bad = [];
    let counts = Object.fromEntries(NEAR_LEVELS.map(l => [l, 0])), maxExtra = 0;
    for (let i = 0; i < 20000; i++) {
      const aim = ['perfect', 'good', 'edge', 'miss'][Math.floor(rand() * 4)];
      const roll = rollDrop(aim, { pity: Math.floor(rand() * 21) }, rand(), rand(), rand());
      const res = { ...roll, aim, target: aim === 'miss' ? null : 3 };
      for (const reduced of [false, true]) {
        const plan = missPlan(res, { reduced });
        if (res.result === 'win') { if (plan !== null) bad.push(['win', res]); continue; }
        if (!plan) { bad.push(['none', res]); continue; }
        if (!reduced) counts[plan.level]++;
        maxExtra = Math.max(maxExtra, planExtraMs(plan));
        if (res.result === 'miss' && (plan.level !== 'air' || plan.held)) bad.push(['air', res]);
        if (res.result === 'slip' && (!plan.held || plan.level === 'air')) bad.push(['held', res]);
        if (plan.level === 'heart' && !(res.slip === 'chute' || ['perfect', 'good'].includes(res.aim))) bad.push(['heart-far', res]);
        if (res.result === 'slip' && res.slip === 'lift' && ['perfect', 'good'].includes(res.aim) && plan.level !== 'heart') bad.push(['near-lift', res]);
        if (reduced && (plan.hitStop || plan.shake || plan.slow !== 1 || plan.slowMs)) bad.push(['reduced', res]);
      }
    }
    assert(!bad.length, `V13.191 놓침 연출은 서버 결과 그대로: 잡힘(win)에는 놓침 연출이 없고(null), 허공(miss)은 인형을 들지 않으며, 놓침(slip)은 인형을 든다 (어긋남 ${bad.length}개 ${JSON.stringify(bad[0] || '')})`);
    assert(NEAR_LEVELS.every(l => counts[l] > 0), `V13.191 네 단계(허공 · 살짝 걸림 · 미끄러짐 · 심쿵)가 모두 나온다 ${JSON.stringify(counts)}`);
    assert(maxExtra <= NEAR_EXTRA_MAX && NEAR_EXTRA_MAX + 3300 <= CLAW.ANIM_MS, `V13.191 놓침 연출이 늘리는 시간은 ${maxExtra}ms(상한 ${NEAR_EXTRA_MAX}ms): 집게 하나 연출(ANIM_MS ${CLAW.ANIM_MS}) 안에 든다`);
    const near = missPlan({ result: 'slip', slip: 'lift', aim: 'perfect', grip: 55, target: 1 }), far = missPlan({ result: 'slip', slip: 'lift', aim: 'edge', grip: 40, target: 1 }), air = missPlan({ result: 'miss', aim: 'miss', grip: 0, target: null });
    assert(near.level === 'heart' && near.hitStop >= 50 && near.hitStop <= 100 && near.slow < 1 && near.shake.px <= 6 && near.shake.ms <= 250 && near.delay >= 150 && near.text.includes('아깝다') && near.badge
      && far.level === 'slip' && far.hitStop < near.hitStop && far.particles < near.particles && far.shake.px < near.shake.px
      && air.level === 'air' && !air.hitStop && !air.shake && !air.sounds.includes('claw-aww'),
      'V13.191 조준이 가까우면 더 아슬아슬(멈춤 50~100ms · 슬로모션 · 짧은 흔들림 6px 이하 · 한 박자 늦은 "아깝다!" · 꼬리표), 멀면 약하게, 허공은 멈춤 · 흔들림 없이');
    assert(Object.values(NEAR_FX).every(f => !f.shake || (f.shake.px <= 6 && f.shake.ms <= 250)) && NEAR_LEVELS.every(l => missPlan({ result: 'slip', slip: 'lift', aim: 'good', target: 1 }, { reduced: true }).text),
      'V13.191 흔들림은 과하지 않게(6px · 0.25초 이하), 동작 줄이기에도 문구로 같은 뜻을 전한다');

    // 실제 서버 결과(clawDrop)로 한 번 더: 같은 결과 → 같은 단계.
    const p = { id: 's', role: 'student', pets: [{ key: 'dog' }], claw: { t: 3 } };
    const st = clawStart(p, { id: 'r-up-000001', now: t0 });
    const top = st.round.dolls.find(d => d.z === 2);
    const r = clawDrop(p, { id: 'd-up-000001', round: st.round.id, n: 0, x: top.x, y: top.y, now: t0 + 5000, random: (() => { const q = [0.99, 0.1, 0.5]; return () => q.shift() ?? 0.5; })() });
    const plan = missPlan(r);
    assert(r.result === 'slip' && r.slip === 'lift' && plan.held && plan.level === (['perfect', 'good'].includes(r.aim) ? 'heart' : 'slip') && !('dolls' in r) && !('x' in r),
      'V13.191 실제 집게 응답(clawDrop)으로 만든 연출이 서버 결과와 같고, 응답에 판 배치 · 좌표 힌트가 없다');
  }

  /* ---------- 2. 반 소식 ---------- */
  {
    const win = (o = {}) => ({ result: 'win', doll: { k: 'tiger', g: 0 }, extra: null, fresh_keys: [], complete: false, ...o });
    assert(clawNewsKind(win({ doll: { k: 'tiger', g: 1 } }), 3) === 'gold' && clawNewsKind(win({ extra: { k: 'ox', g: 0 } }), 3) === 'jackpot'
      && clawNewsKind(win({ complete: true, doll: { k: 'pig', g: 1 } }), 12) === 'complete' && clawNewsKind(win({ fresh_keys: ['tiger'] }), 6) === 'book'
      && clawNewsKind(win({ fresh_keys: ['tiger', 'ox'] }), 7) === 'book' && clawNewsKind(win({ fresh_keys: ['tiger'] }), 5) === null && clawNewsKind(win({ fresh_keys: ['g-tiger'] }), 6) === null
      && clawNewsKind(win(), 6) === null && clawNewsKind({ result: 'slip' }, 6) === null && clawNewsKind({ ...win({ doll: { k: 'tiger', g: 1 } }), again: true }, 3) === null,
      'V13.191 소식 트리거: 황금 인형 · 대박(두 개) · 도감 완성 · 도감 6번째 새 인형(넘는 순간 한 번)만, 놓침 · 다시 보낸 집게는 없음');

    const state = emptyState(), now = t0;
    const school = state.schools.find(s => s.division === 'high') || state.schools[0];
    const mk = (id, extra = {}) => { const x = { id, role: 'student', active: true, display_name: `학생${id}`, class_name: '고1A', division: school.division, school_id: school.id, school: school.name, pets: [{ key: 'dog' }], ...extra }; state.profiles.push(x); return x; };
    const a = mk('a'), b = mk('b', { class_name: '고1B' }), other = mk('c', { class_name: '고2A' }), priv = mk('d', { ranking_public: false }), prev = mk('e', { preview_owner_id: 't' });
    const gold = win({ doll: { k: 'tiger', g: 1 } });
    const n1 = postClawNews(state, a, school, gold, { kinds: 3, now, id: 'n1' });
    assert(n1 && n1.t === '학생a 학생이 황금 어흥 호랑이 인형을 뽑았어요!' && postClawNews(state, priv, school, gold, { kinds: 3, now, id: 'np' }) === null && postClawNews(state, prev, school, gold, { kinds: 3, now, id: 'nv' }) === null,
      'V13.191 "OO 학생이 황금 인형을 뽑았어요!", 비공개 학생 · 선생님 미리보기 계정은 소식을 만들지 않는다');
    const seenB = clawNewsFor(state, b, school, now + 60000), seenOther = clawNewsFor(state, other, school, now + 60000);
    assert(seenB.length === 1 && seenB[0].text === n1.t && JSON.stringify(Object.keys(seenB[0])) === '["id","text","at"]' && seenOther.length === 0 && clawNewsFor(state, b, { id: 'zz' }, now).length === 0
      && clawNewsFor(state, b, school, now + CLAW_NEWS.SHOW_MS + 1).length === 0,
      'V13.191 같은 학교 · 같은 학년(반이 달라도)만 보이고, 다른 학년 · 다른 학교는 안 보이며, 하루 지나면 사라진다. 소식에는 문구 · 시각만');
    postClawNews(state, a, school, win({ extra: { k: 'ox', g: 0 } }), { kinds: 4, now: now + 1000, id: 'n2' });
    assert(postClawNews(state, a, school, gold, { kinds: 4, now: now + 2000, id: 'n3' }) === null && postClawNews(state, a, school, gold, { kinds: 4, now: now + DAY, id: 'n4' }),
      `V13.191 학생 한 명은 하루 ${CLAW_NEWS.PER_DAY}개까지(다음 날 다시)`);
    for (let i = 0; i < 400; i++) postClawNews(state, mk(`m${i}`, { display_name: '아주아주아주아주긴이름의학생입니다' }), school, gold, { kinds: 3, now: now + DAY + i, id: `bulk-${i}-0123456789abcdef0123456789` });
    const size = JSON.stringify(state.clawNews).length;
    assert(state.clawNews.length === CLAW_NEWS.KEEP && size <= 12000 && clawNewsFor(state, b, school, now + DAY + 500).length === CLAW_NEWS.SHOW && state.clawNews.every(n => [...n.t].length <= 60),
      `V13.191 소식 저장은 최근 ${CLAW_NEWS.KEEP}개만(지금 ${size}바이트, 12KB 이하), 화면에는 ${CLAW_NEWS.SHOW}개, 긴 이름은 잘라서`);
  }

  /* ---------- 3. 서버 경로 ---------- */
  {
    const state = emptyState(), hash = await passwordHash('QaClaw1!'), now = Date.now();
    state.profiles.push({ id: 'qa-up', username: 'qa-up', display_name: '업글', role: 'student', active: true, class_name: '고1A', school_id: 'danwon-high', school: '단원고', division: 'high', password_hash: hash, pets: [{ key: 'dog', first: true, acquired_at: now - 9 * DAY }], avatar_key: 'dog', created_at: now - 9 * DAY });
    state.clawNews = [{ id: 'x1', s: 'danwon-high', d: 'high', g: '고1', p: 'other', t: '친구 학생이 대박! 인형 두 개를 한 번에 뽑았어요!', at: now - 1000 }];
    const token = (await service(state, 'POST', '/login', { username: 'qa-up', password: 'QaClaw1!', division: 'high' }, null))._cookie;
    const home = await service(state, 'POST', '/claw/home', {}, token);
    assert(Array.isArray(home.news) && home.news.length === 1 && home.news[0].text.includes('대박') && !JSON.stringify(home.news).includes('"s"') && !('dolls' in home),
      'V13.191 /claw/home이 내 반 소식(문구 · 시각만)을 함께 준다');
    const svc = source('./service.mjs');
    assert(svc.includes('const posted = res.again ? null : postClawNews(state, p, school, res, { kinds: view.kinds, now, id: randomUUID() });') && !/postClawNews[\s\S]{0,300}_push/.test(svc.slice(svc.indexOf("path === '/claw/drop'"), svc.indexOf("path === '/claw/drop'") + 900)),
      'V13.191 집게 결과마다 소식을 한 번만 남기고(다시 보낸 집게 제외), 푸시 알림은 보내지 않는다(스팸 방지)');
  }

  /* ---------- 4. 화면 · 소리 · 스타일 ---------- */
  {
    const ui = source('../public/modules/claw.js'), css = source('../public/v13191.css'), build = source('./build-assets.mjs'), synth = source('../docs/sound/claw-synth.mjs');
    assert(ui.includes("import { missPlan } from './claw-fx.js';") && ui.includes('const plan = missPlan(res, { reduced: reduced() });') && ui.includes("if (res.result === 'win') await winLift(res, doll);\n  else if (plan.held && doll) await slipLift(res, doll, plan);\n  else await airLift(plan);")
      && ui.includes('async function slipMoment(plan, at)') && ui.includes('async function strain(plan)') && ui.includes('plan.hitStop') && ui.includes('later(() => {\n    say(') && ui.includes('}, plan.delay);'),
      'V13.191 화면: 잡힘은 원래 연출, 놓침은 계획대로(버팀 → 멈춤 → 툭 · 솜털 · 흔들림 → 슬로모션 → 한 박자 늦은 "아깝다!"), 허공은 따로');
    assert(ui.includes('id="cw-news" role="status"') && ui.includes('news(res.news)') && ui.includes('esc(n.text)'), 'V13.191 인형뽑기 화면 위쪽에 반 소식 한 줄(글자는 이스케이프)');
    const keys = ['claw-strain', 'claw-slip', 'claw-aww'];
    assert(keys.every(k => SOUND_KEYS.includes(k) && synth.includes(`def('${k}'`) && ui.includes(`'${k}'`) && statSync(fileURLToPath(new URL(`../public/assets/sfx/${k}.mp3`, import.meta.url))).size <= 16 * 1024),
      'V13.191 새 소리 3개(버팀 · 툭 · 아깝다)는 합성(docs/sound/claw-synth.mjs)이고 하나에 16KB 이하, 들어갈 때 미리 받는다');
    const list = JSON.parse(build.slice(build.indexOf('const cssSources = ') + 'const cssSources = '.length, build.indexOf('];', build.indexOf('const cssSources = ')) + 1));
    assert(existsSync(fileURLToPath(new URL('../public/v13191.css', import.meta.url))) && list.includes('v13191.css') && list.indexOf('v13191.css') > list.indexOf('v13181.css') && list.at(-1) === 'v13178.css',
      'V13.191 스타일(v13191.css)은 인형뽑기 스타일 뒤에 들어가고, 민트 목록 CSS가 맨 끝');
    assert(css.includes('prefers-reduced-motion:reduce') && css.includes('.cw-near-badge') && css.includes('.cw-news-tag') && css.includes('var(--shake-px'),
      'V13.191 동작 줄이기면 흔들림 · 슬로모션 효과를 끄고, 단계 · 소식은 색만이 아니라 꼬리표 글자로도 구분한다');
  }
}
