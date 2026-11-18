import { api, esc, num, toast } from './ui.js';
import { coin } from './emblems.js';
import { avatar } from './character.js';
import { openSheet } from './sheet.js';
import { PET_SKILL } from './runner-rules.js';
import { RAID } from './runner-modes.js';

// V13.243 펫 대행진 ③단계 화면: 지도 위 "오늘 할 것" · 오늘의 도전 카드 · 반 보스 카드, 도전 순위 · 보스 창, 결과 화면 한 줄.
// 서버에 묻는 것은 모두 사람이 누를 때 한 번(GET /runner/daily · GET /runner/raid, 서버 1분 캐시) + 보상 받기 POST 한 번. 자동 새로고침 없음.
// 카드 숫자는 /runner/home(첫 화면) 응답의 daily · raid 요약(묶음 한 줄)으로 그린다(요청을 더 하지 않음). 그림은 보스 한 장(던전 몬스터)뿐.

const EL_KO = { flame: '불', water: '물', ice: '얼음', leaf: '풀', earth: '바위', wind: '바람', toxic: '독', star: '별' };
export const elKo = el => EL_KO[el] || '별';
export function leftText(ms) {
  const m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mm = m % 60;
  return d ? `${d}일 ${h}시간` : h ? `${h}시간 ${mm}분` : `${Math.max(1, mm)}분`;
}
const sec = t => `${(t * 0.05).toFixed(1)}초`;
const dailyLine = b => b ? (b.s > 0 ? `남은 정령 <b>${num(b.l)}</b> · ${sec(b.t)}` : '아직 못 깼어요 · 다시!') : '아직 안 했어요';

// 지도 위: 오늘 할 것(첫 판 상자 · 오늘의 도전 · 반 보스) + 카드 두 장
export function metaCards(v) {
  const d = v.daily, r = v.raid;
  if (!d || !r) return '';
  const now = Date.now(), boss = r.boss || {}, pct = Math.max(0, Math.min(100, r.pct | 0)), hpLeft = 100 - pct;
  const todo = [
    { done: !v.box, text: v.box ? `첫 판 상자 ${coin()}+${num(v.box_coins)}` : '첫 판 상자 받음' },
    { done: !!d.best, text: d.best ? '오늘의 도전 함' : '오늘의 도전 한 판' },
    { done: r.claim > 0 ? false : !!r.mine, hot: r.claim > 0, text: r.claim > 0 ? `반 보스 보상 ${coin()}+${num(r.claim)}` : r.mine ? '반 보스에 피해 넣음' : '반 보스에 피해 넣기' }
  ];
  return `<section class="rnm-today" aria-label="오늘 할 것"><h2>오늘 할 것</h2><ul>${todo.map(t => `<li class="${t.done ? 'done' : ''}${t.hot ? ' hot' : ''}"><i aria-hidden="true"></i><span>${t.text}</span></li>`).join('')}</ul></section>
    <section class="rnm-cards">
      <button type="button" class="rnm-card rnm-daily el-${esc(d.el)}" data-rn="daily">
        <span class="rnm-tag">오늘의 도전</span><span class="rnm-time">${leftText(d.ends_at - now)} 남음</span>
        <strong>모두 같은 맵</strong>
        <span class="rnm-el"><i aria-hidden="true"></i><span><b>${elKo(d.el)}</b> 속성 · ${esc(PET_SKILL[d.el]?.name || '')}</span></span>
        <span class="rnm-best">강화 · 응원 없이 공정하게</span>
        <span class="rnm-best rnm-mine">${d.best ? '내 최고 ' : ''}${dailyLine(d.best)}</span>
        <span class="rnm-cta">도전 · 순위</span>
      </button>
      <button type="button" class="rnm-card rnm-raid${r.killed ? ' down' : ''}${r.claim ? ' claim' : ''}" data-rn="raid" style="--rnm-boss:${esc(boss.color || '#8b5cf6')}">
        <span class="rnm-tag">주간 반 보스</span><span class="rnm-time">${leftText(r.ends_at - now)} 남음</span>
        ${boss.img ? `<img class="rnm-boss" src="${esc(boss.img)}" alt="" draggable="false" decoding="async" loading="lazy">` : ''}
        <strong>${esc(boss.name || '보스')}</strong>
        <span class="rnm-hp" role="img" aria-label="보스 HP ${hpLeft}% 남음"><i style="transform:scaleX(${hpLeft / 100})"></i><em>${r.killed ? '격파!' : `HP ${hpLeft}%`}</em></span>
        <span class="rnm-best">${r.claim ? `<b class="rnm-gift">${coin()}+${num(r.claim)}</b>` : r.killed ? '우리 반이 쓰러뜨렸어요!' : r.mine ? `내 피해 <b>${num(r.mine)}</b>` : '모든 판의 공성전 피해가 쌓여요'}</span>
        <span class="rnm-cta">${r.claim ? '보상 받기' : '보스 보기'}</span>
      </button>
    </section>`;
}

// 오늘의 도전 창: 오늘의 맵 · 내 최고 · 묶음 순위 상위 10 + 내 등수
export async function openDailySheet(onGo) {
  let res; try { res = await api('/runner/daily'); } catch (err) { return toast(err.message || '오늘의 도전 순위를 불러오지 못했어요.'); }
  const row = r => `<li class="${r.me ? 'me' : ''}"><b>${r.rank}</b>${avatar(r.pet, { size: 'mini' })}<span>${esc(r.name)}</span><em>${r.s > 0 ? `${num(r.l)}<small>마리</small>` : '<small>못 깸</small>'}</em><small>${sec(r.t)}</small></li>`;
  const top = res.top || [];
  const sh = openSheet(`<div class="rn-board-sheet rnm-sheet"><h2>오늘의 도전</h2>
    <p class="rnm-spec el-${esc(res.spec?.el)}"><i aria-hidden="true"></i><span>${res.spec?.stage}스테이지 난도 · 오늘의 속성 <b>${elKo(res.spec?.el)}</b> · ${leftText(res.ends_at - Date.now())} 뒤 새 맵</span></p>
    <p>같은 학교 · 같은 학년 친구들이 모두 같은 맵을 달려요. 정령 강화 · 응원 정령 없이, <b>남은 정령이 많을수록</b>(같으면 더 빨리 깬 친구) 위예요. 몇 판이든 최고 기록만 남아요.</p>
    <ol>${top.map(row).join('') || '<li class="empty">오늘 아직 아무도 안 했어요. 1등을 찜해요!</li>'}</ol>${res.me && !top.some(r => r.me) ? `<ol class="mine">${row(res.me)}</ol>` : ''}
    <button type="button" class="yl-cta rnm-go" data-rnm="daily-go">오늘의 도전 출발!</button></div>`, '오늘의 도전', { className: 'rn-sheet' });
  sh.box.querySelector('[data-rnm="daily-go"]')?.addEventListener('click', () => { sh.close(); onGo?.(); }, { once: true });
}

// 반 보스 창: 남은 HP 막대 · 이번 주 기여 상위 5 · 내 기여 · 지난주 한 줄 · 보상 받기
export async function openRaidSheet(onClaimed) {
  let res; try { res = await api('/runner/raid'); } catch (err) { return toast(err.message || '반 보스를 불러오지 못했어요.'); }
  const boss = res.boss || {}, hpLeft = 100 - Math.max(0, Math.min(100, res.pct | 0)), claim = (res.claim || []).reduce((n, x) => n + x.coins, 0);
  const row = r => `<li class="${r.me ? 'me' : ''}"><b>${r.rank}</b>${avatar(r.pet, { size: 'mini' })}<span>${esc(r.name)}</span><em>${num(r.d)}</em></li>`;
  const last = res.last ? `<p class="rnm-last">지난주 ${esc(res.last.boss)}: ${res.last.killed ? '<b>격파!</b>' : `HP ${100 - res.last.pct}% 남기고 도망`} · ${res.last.mine ? `내 기여 ${num(res.last.mine)} (${res.last.rank}등 / ${res.last.of}명)` : '나는 안 했어요'}</p>` : '';
  const sh = openSheet(`<div class="rn-board-sheet rnm-sheet rnm-raid-sheet${res.killed ? ' down' : ''}" style="--rnm-boss:${esc(boss.color || '#8b5cf6')}">
    <div class="rnm-boss-hero">${boss.img ? `<img src="${esc(res.killed && boss.hurt ? boss.hurt : boss.img)}" alt="" draggable="false" decoding="async">` : ''}${res.killed ? '<span class="rnm-stamp">격파!</span>' : ''}</div>
    <h2>${esc(boss.name || '이번 주 반 보스')}</h2>
    <div class="rnm-hp big" role="img" aria-label="보스 HP ${hpLeft}% 남음"><i style="transform:scaleX(${hpLeft / 100})"></i><em>${res.killed ? '격파!' : `${num(Math.max(0, res.hp - res.dmg))} / ${num(res.hp)}`}</em></div>
    <p>우리 반(같은 학교 · 같은 학년) ${num(res.size)}명이 이번 주에 ${num(res.players)}명 참여 · ${leftText(res.ends_at - Date.now())} 뒤 새 보스. 일반 판 · 오늘의 도전 모든 판의 <b>공성전 피해</b>가 쌓여요.
      쓰러뜨리면 이번 주에 한 판이라도 한 친구 모두 ${coin()}${num(res.coins || RAID.COINS)}(하루 코인 상한과 따로)!</p>
    ${claim ? `<button type="button" class="rnm-go rnm-claim" data-rnm="claim">보상 받기 ${coin()}+${num(claim)}</button>` : ''}
    <h3>이번 주 기여 상위 ${RAID.TOP}</h3>
    <ol>${(res.top || []).map(row).join('') || '<li class="empty">아직 아무도 공격하지 않았어요. 첫 일격!</li>'}</ol>
    <p class="rnm-mine">내 기여 <b>${num(res.me?.dmg || 0)}</b>${res.me?.rank ? ` · ${res.me.rank}등` : ''}</p>${last}</div>`, '주간 반 보스', { className: 'rn-sheet' });
  const b = sh.box.querySelector('[data-rnm="claim"]');
  b?.addEventListener('click', async () => {
    b.disabled = true;
    try { const out = await api('/runner/raid/claim', {}); toast(`반 보스 보상 ${out.coins}코인을 받았어요!`); sh.close(); onClaimed?.(out); }
    catch (err) { b.disabled = false; toast(err.message || '보상을 받지 못했어요.'); }
  }, { once: true });
}

// 결과 화면 한 줄: "반 보스에 ○○ 피해!" · 격파 · 오늘의 도전 기록
export function resultMeta(res) {
  if (!res?.valid) return '';
  const out = [];
  if (res.raid) out.push(`<li class="rnm-res-raid${res.raid.killed_now ? ' down' : ''}"><span>${res.raid.killed_now ? '반 보스 격파!' : '반 보스에'}</span><b>${num(res.raid.dmg)} 피해!</b><small>${res.raid.killed ? '격파 완료' : `남은 HP ${100 - res.raid.pct}%`}</small></li>`);
  if (res.mode === 'daily') out.push(`<li class="rnm-res-daily" id="rnm-res-daily"><span>오늘의 도전</span><b>${res.daily_best ? '새 최고 기록!' : '기록 확인 중…'}</b><small>${res.today?.s > 0 ? `최고 남은 정령 ${num(res.today.l)}` : ''}</small></li>`);
  return out.length ? `<ul class="rnm-res">${out.join('')}</ul>` : '';
}
// 도전 판이 끝나면 등수를 한 번 받아 결과 줄에 쓴다(GET, 서버 1분 캐시 + 내 줄은 지금 기록으로).
export async function fillDailyRank() {
  let res; try { res = await api('/runner/daily'); } catch { return; }
  const el = document.getElementById('rnm-res-daily'); if (!el || !res?.me) return;
  el.querySelector('b').textContent = `오늘의 도전 ${res.me.rank}등!`;
  el.querySelector('small').textContent = `${res.count}명 중 · 남은 정령 ${res.me.l}`;
  el.classList.add('pop');
}
