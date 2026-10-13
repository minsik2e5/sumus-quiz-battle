'use strict';

// 학원 기준 하루는 한국 시간(UTC+9, 서머타임 없음) 자정에 바뀐다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(ms) {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function nextMidnight(ms) {
  return (Math.floor((ms + KST_OFFSET_MS) / DAY_MS) + 1) * DAY_MS - KST_OFFSET_MS;
}

// [from, to) 구간을 날짜별 [day, ms] 조각으로 나눈다.
function splitByDay(from, to) {
  const out = [];
  let t = from;
  while (t < to) {
    const end = Math.min(to, nextMidnight(t));
    out.push([dayKey(t), end - t]);
    t = end;
  }
  return out;
}

function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function isDayKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

module.exports = { KST_OFFSET_MS, DAY_MS, dayKey, nextMidnight, splitByDay, addDays, isDayKey };
