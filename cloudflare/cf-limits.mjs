// V13.144: Cloudflare 요금 체계 숫자는 이 파일 한 곳에만 둔다.
//
// 2026-10-12 저녁, 무료 플랜의 Durable Object(SQLite) 쓰기 한도(하루 10만 줄)를 넘어 모든 요청이
// "Error 1101"이 됐다. 한도는 UTC 0시(한국 시간 오전 9시)에 다시 풀린다.
export const CF_FREE_PLAN = {
  // 하루에 쓸 수 있는 줄 수(계정 전체: 상태 객체 + 대결 방 + 던전 방).
  rowsWrittenPerDay: 100_000,
  // 하루에 읽을 수 있는 줄 수.
  rowsReadPerDay: 5_000_000,
  // SQLite 행 하나의 최대 크기(바이트). 이보다 큰 조각은 여러 행으로 나눈다.
  maxRowBytes: 2_000_000
};

// 선생님 첫 화면에 경고를 띄우는 비율(%).
export const WRITE_WARN_PCT = 70;
// 이 비율을 넘으면 급하지 않은 쓰기(시간마다 정리, 백업 횟수)를 줄이거나 다음 날로 미룬다.
export const WRITE_DEFER_PCT = 90;

// 한도를 세는 날: UTC 날짜(한국 시간 오전 9시에 바뀐다).
export const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

export function writeBudget(rows, limit = CF_FREE_PLAN.rowsWrittenPerDay) {
  const pct = Math.round((Number(rows) || 0) / limit * 1000) / 10;
  return { rows: Number(rows) || 0, limit, pct, level: pct >= WRITE_DEFER_PCT ? 'defer' : pct >= WRITE_WARN_PCT ? 'warn' : 'ok' };
}
