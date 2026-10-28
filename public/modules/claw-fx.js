// V13.191 인형뽑기 놓침 연출(docs/claw-upgrade-design.md §1). 화면(claw.js)이 서버 결과를 받은 뒤 이 표대로 연출만 한다.
//   잡힘 · 놓침 · 놓침 모양(slip) · 쥔 힘(grip) · 조준(aim)은 모두 서버가 정한 값이다. 여기서는 아무것도 새로 정하지 않는다:
//   잡힘(win)이면 null(놓침 연출이 절대 나오지 않음), 허공(miss)이면 인형을 들지 않는 허공 연출,
//   놓침(slip)이면 조준이 가까울수록(perfect · good) 더 아슬아슬하게(버팀 → 멈춤 → 슬로모션 → 흔들림 → 한 박자 늦은 "아깝다!").
// 동작 줄이기(prefers-reduced-motion)면 멈춤 · 슬로모션 · 흔들림을 없애고, 글자와 소리로 같은 뜻을 전한다(색만으로 구분하지 않음).

// 단계: air(허공) < graze(살짝 걸림) < slip(미끄러짐) < heart(심쿵: 거의 잡았다가 놓침).
export const NEAR_LEVELS = ['air', 'graze', 'slip', 'heart'];
// 단계마다 연출 값. wobble: 놓치기 전 인형이 발톱에서 흔들리는 횟수(한 번 STRAIN_MS), hitStop: 미끄러지는 순간 멈춤(ms),
//   slow: 떨어지기 시작 구간의 속도 배율(1 = 보통), slowMs: 그 구간 길이, shake: 화면 흔들림(px · ms, 짧고 빨리 사라짐),
//   particles: 솜털 · 반짝이 수, delay: "아깝다" 문구 · 소리가 미끄러진 뒤 늦게 나오는 시간(ms), buzz: 진동(안드로이드).
export const STRAIN_MS = 210;
export const NEAR_FX = {
  air: { wobble: 0, hitStop: 0, slow: 1, slowMs: 0, shake: null, particles: 3, delay: 220, buzz: [14], sounds: [] },
  graze: { wobble: 0, hitStop: 50, slow: 1, slowMs: 0, shake: null, particles: 5, delay: 200, buzz: [30, 30, 18], sounds: ['claw-slip'] },
  slip: { wobble: 1, hitStop: 70, slow: 0.6, slowMs: 260, shake: { px: 3, ms: 160 }, particles: 7, delay: 240, buzz: [50, 40, 20], sounds: ['claw-strain', 'claw-slip', 'claw-aww'] },
  heart: { wobble: 2, hitStop: 95, slow: 0.45, slowMs: 240, shake: { px: 5, ms: 200 }, particles: 12, delay: 280, buzz: [80, 50, 30, 40, 20], sounds: ['claw-strain', 'claw-slip', 'claw-aww'] }
};
// 기존 놓침 연출에 더해지는 시간 상한(ms). 집게 하나 연출(CLAW.ANIM_MS 4500)과 서버 최소 간격(GAP_MS 4000) 안에 들어가야 한다.
export const NEAR_EXTRA_MAX = 900;
export const NEAR_TEXT = {
  air: '앗, 허공을 잡았어요',
  graze: { close: '살짝 걸렸다가 빠졌어요!', edge: '끝에 걸렸다가 빠졌어요' },
  slip: { close: '아깝다! 툭 미끄러졌어요', edge: '앗, 미끄러졌어요!' },
  heart: { close: '아깝다!! 거의 잡았는데…', chute: '아깝다!! 거의 다 왔는데…' }
};
const CLOSE = new Set(['perfect', 'good']);

// 서버 응답(res: result · slip · grip · aim · target) → 놓침 연출 계획. 잡힘이면 null.
export function missPlan(res, { reduced = false } = {}) {
  if (!res || res.result === 'win') return null;
  const close = CLOSE.has(res.aim);
  let level, text;
  if (res.result !== 'slip' || res.target == null) { level = 'air'; text = NEAR_TEXT.air; }
  else if (res.slip === 'chute') { level = 'heart'; text = NEAR_TEXT.heart.chute; }
  else if (res.slip === 'lift') { level = close ? 'heart' : 'slip'; text = close ? NEAR_TEXT.heart.close : NEAR_TEXT.slip.edge; }
  else { level = 'graze'; text = close ? NEAR_TEXT.graze.close : NEAR_TEXT.graze.edge; }
  // 같은 단계 안에서도 쥔 힘(grip)이 셀수록 조금 더 오래 버틴다(서버 grip: lift 35~59 · chute 55~69 · loose 10~29, 70에서 자른다).
  const fx = NEAR_FX[level], grip = Math.max(0, Math.min(70, Number(res.grip) || 0));
  const strain = fx.wobble ? Math.round(fx.wobble * STRAIN_MS * (0.85 + grip / 200)) : 0;
  const plan = {
    level, text, held: level !== 'air', lift: res.slip === 'chute' ? 1 : res.slip === 'lift' ? 0.45 : level === 'graze' ? 0.12 : 0,
    strain, hitStop: fx.hitStop, slow: fx.slow, slowMs: fx.slowMs, shake: fx.shake, particles: fx.particles, delay: fx.delay,
    buzz: fx.buzz, sounds: fx.sounds, badge: level === 'heart' ? '아슬아슬!' : ''
  };
  if (reduced) Object.assign(plan, { strain: Math.min(strain, STRAIN_MS), hitStop: 0, slow: 1, slowMs: 0, shake: null, particles: Math.min(plan.particles, 3), delay: Math.min(plan.delay, 120) });
  return plan;
}
// 계획이 기존 놓침 연출에 더하는 시간(ms): 버팀 + 멈춤 + 슬로모션으로 늘어난 몫.
export const planExtraMs = plan => !plan ? 0 : plan.strain + plan.hitStop + Math.round(plan.slowMs * (1 / plan.slow - 1));
