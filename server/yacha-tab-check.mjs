// V13.131 야차전 탭 화면 정리 검사 (Design A안: 대결 탭 · 단어 범위 창 · 친구 목록 · 톤 맞추기).
// 판정 · 범위 규칙 · 판돈 · 도전장 흐름은 그대로이고, 그것을 그리는 화면 코드와 스타일만 본다.
// 화면 모양은 폰 390×844에서 직접 확인했고, 여기서는 규칙으로 남길 수 있는 것(구성 · 크기 · 색 · 연결)을 지킨다.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { friendGroup } from '../public/modules/friend-sheet.js';

const path = relative => fileURLToPath(new URL(relative, import.meta.url));
const source = relative => readFileSync(path(relative), 'utf8');
const between = (text, from, to) => { const a = text.indexOf(from), b = text.indexOf(to, a + from.length); return a >= 0 && b > a ? text.slice(a, b) : ''; };
// "초록 하나 + 회색": a color is allowed when it is nearly gray (low saturation) or green (hue 140~170°).
function greenOrGray(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map(c => c + c).join('');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return true;
  const s = d / (1 - Math.abs(max + min - 1));
  if (s < 0.25) return true;
  const hue = (max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return hue >= 140 && hue <= 170;
}

export function runYachaTabChecks(assert) {
  const battle = source('../public/modules/battle.js'), dungeon = source('../public/modules/dungeon.js');
  const friend = source('../public/modules/friend-sheet.js'), sheet = source('../public/modules/sheet.js');
  const css = source('../public/v13131.css'), build = source('./build-assets.mjs');
  const play = between(battle, 'function playTab(h) {', '// 기록: [리그 | 내 전적].');
  const lobby = between(battle, 'function lobby() {', 'function petSkillChip(pet)');

  /* ---------- 탭 4개 한 줄 · 기록 안에 [리그 | 내 전적] ---------- */
  assert(battle.includes("const LOBBY_TABS = [['play', '대결', 'nav-yacha'], ['monster', '몬스터', 'monster-tab'], ['dungeon', '던전', 'dungeon-tab'], ['record', '기록', 'trophy-s']];"), 'V13.131 야차전 탭은 대결 · 몬스터 · 던전 · 기록 네 개이고, 탭마다 앱 그림(nav-yacha · monster-tab · dungeon-tab · trophy-s)');
  assert(['nav-yacha', 'monster-tab', 'dungeon-tab', 'trophy-s', 'mode-speed', 'mode-skill', 'coin', 'stopwatch', 'study-vocab'].every(key => existsSync(path(`../public/assets/ui/${key}.webp`))), 'V13.131 새 화면이 쓰는 앱 그림 파일이 모두 있다');
  assert(css.includes('.yl-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))') && /\.yl-tab-art\{width:26px;height:26px/.test(css), 'V13.131 탭 네 개는 한 줄(4칸 격자), 그림은 26px');
  assert(battle.includes("key === 'league' || key === 'me' ? 'record'") && battle.includes("recordSub: startTab === 'me' ? 'me' : 'league'"), 'V13.131 이전 탭 이름(league · me)은 기록 탭으로 열린다');
  assert(battle.includes("[['league', '리그'], ['me', '내 전적']]") && battle.includes('data-yb="sub"') && battle.includes('data-tab="record" data-sub="league"') && battle.includes("if (tab === 'record' && sub === 'league') mountLeagueBoard("), 'V13.131 기록 안에 [리그 | 내 전적] 전환, 펫 카드의 리그 칩은 기록 > 리그로');
  assert(!lobby.includes("['league', '리그'], ['me', '내 전적']].map(([key, label]) => `<button type=\"button\" data-yb=\"tab\""), 'V13.131 리그 · 내 전적은 더 이상 위 탭 줄에 따로 없다');

  /* ---------- 대결 탭: 펫 카드 → 설정 카드 한 장 → 큰 버튼 하나 → 작은 버튼 → 로보 ---------- */
  assert(lobby.includes('class="yl-hero"') && lobby.includes('--arena:url(/assets/battle/') && css.includes('.yl-hero{') && css.includes('var(--arena) center/cover') && lobby.includes('출전 준비!') && ['승</', '패</', '승률</'].every(t => lobby.includes(t)), 'V13.131 펫 카드: 대결장 배경 위에 펫 · 승 패 승률 · 리그 칩');
  assert((play.match(/class="yl-card/g) || []).length === 2 && play.includes('class="yl-card yl-setup"') && play.includes('class="yl-card yl-bot"'), 'V13.131 대결 탭 카드는 설정 카드 한 장과 로보 카드뿐');
  assert(['방식</span>', '단어</span>', '판돈</span>'].every(t => play.includes(t)) && play.includes('data-yb="mode"') && play.includes('class="yl-hint"') && play.includes('[minutesText(BATTLE_MODES[B.mode].match_ms), ...MODE_FACTS[B.mode]].join(\' · \')') && play.includes("m.name.replace(/전$/, '')"), 'V13.131 설정 카드: 방식(스피드 · 실력 그림 버튼 + 설명 한 줄), 단어, 판돈');
  assert(play.includes('data-yb="range-sheet"') && play.includes("['each', '각자 내 범위', true], ['same', '같은 범위로', false]") && play.includes('class="yl-duel"') && play.includes('class="yl-chips"') && play.includes('rangeShort(picked)'), 'V13.131 단어 줄을 누르면 범위 선택 창, 아래에 각자 내 범위 · 같은 범위로 비교 카드(펫 vs ?)');
  assert(play.includes("STAKES.map(s => `<button type=\"button\" class=\"yl-stake") && play.includes('uiArt(\'coin\')') && play.includes('balance < s || s > lossLeft') && battle.includes('const STAKES = [10, 30, 50];'), 'V13.131 판돈은 코인 그림 + 숫자 한 줄(10 · 30 · 50), 코인이 모자라거나 하루 한도를 넘는 판돈은 못 고른다');
  assert((play.match(/class="yl-cta"/g) || []).length === 1 && play.includes('data-yb="challenge"') && play.includes('친구에게 도전장') && play.includes('class="yl-sm"') && play.includes('data-yb="create"') && play.includes('data-yb="join-sheet"') && ['방 만들기', '코드로 참가'].every(t => play.includes(t)), 'V13.131 큰 버튼은 친구에게 도전장 하나, 방 만들기 · 코드로 참가는 작은 버튼');
  assert(play.includes("Object.entries(BOT_LEVELS).map(([key, lv]) => `<button type=\"button\" class=\"yl-level") && play.includes('정답률 ${Math.round(lv.accuracy * 100)}%') && battle.includes('class="yl-bot-reward"') && play.includes('botRewardLine()') && play.includes('class="yl-go" data-yb="bot"') && play.includes('연습 대결 시작'), 'V13.131 로보 연습 카드: 큰 로보 + AI, 난이도 3개 + 정답률, 보상 한 줄, 연한 초록 연습 시작');
  assert(!/<section class="yl-card yl-setup"[\s\S]*<section class="yl-card yl-setup"/.test(play) && play.indexOf('class="yl-cta"') > play.indexOf('class="yl-card yl-setup"') && play.indexOf('class="yl-card yl-bot"') > play.indexOf('class="yl-pair"'), 'V13.131 순서: 설정 카드 → 도전장 → 방 만들기 · 코드로 참가 → 로보 카드');

  /* ---------- 기능은 그대로 ---------- */
  assert(play.includes('const canCreate = wordsOk && balance >= B.stake && B.stake <= lossLeft;') && play.includes('const wordsOk = B.ranges.size && selectedWords >= 8;'), 'V13.131 대결을 열 수 있는 조건(단어 8개 이상 · 판돈 · 하루 잃는 한도)은 그대로');
  assert(battle.includes("api('/battle/rooms', { stake: B.stake, range_codes: [...B.ranges], mode: B.mode, range_mode: rangeMode() })") && battle.includes("api('/battle/challenge', { friend_id: f.id, stake: B.stake, range_codes: [...B.ranges], mode: B.mode, range_mode: rangeMode() })") && battle.includes("api('/battle/join', { code: room.code, stake: room.stake, range_codes: myRanges() })"), 'V13.131 방 만들기 · 도전장 · 참가가 서버로 보내는 값(판돈 · 범위 · 방식 · 범위 방식)은 그대로');
  assert(battle.includes("const rangeMode = () => pref('sumus-yacha-range-mode', 'each') === 'same' ? 'same' : 'each';") && battle.includes("setPref('sumus-yacha-range-mode', modeButton.dataset.rsMode === 'same' ? 'same' : 'each')") && battle.includes("setPref('sumus-yacha-range-mode', b.dataset.rangeMode === 'same' ? 'same' : 'each')"), 'V13.131 각자 내 범위 / 같은 범위로는 카드와 범위 창에서 같은 값(sumus-yacha-range-mode)을 바꾼다');
  assert(battle.includes("setPref(rangesKey(), JSON.stringify([...B.ranges]))") && battle.includes('onClose: () => { if (B === cur) lobby(); }') && battle.includes("codes.filter(code => B.ranges.has(code))"), 'V13.131 범위 창에서 고른 범위는 이 폰에 기억되고, 창을 닫으면 로비가 다시 그려지며, 범위 이름은 단어장 순서로 보인다');
  assert(battle.includes('closeSheet?.();') && battle.includes('joinRoom(go, sheet.close)') && battle.includes("if (!/^\\d{6}$/.test(B.joinCode)) return toast('6자리 코드를 입력해주세요.');"), 'V13.131 코드로 참가: 창에서 6자리를 넣으면 같은 확인 창(판돈 · 방장)으로 이어진다');
  assert(dungeon.includes("api('/dungeon/invite', { friend_id: f.id })") && dungeon.includes("{ c2: 'c3', c1: 'c2', max: 'c1' }[cut]") && dungeon.includes("status: f => f.busy ? '던전 중' : locked(f) ? '단계 잠김' : ''"), 'V13.131 던전 초대 규칙(보낼 값 · 단계 잠김 · 던전 중)은 그대로');

  /* ---------- 긴 설명은 작은 ? 안으로 ---------- */
  assert(battle.includes("const helpNote = (key, html) => B.help[key] ? `<p class=\"yl-help\"") && (play.match(/helpButton\(/g) || []).length >= 4 && lobby.includes("helpButton('skill')") && battle.includes("if (act === 'help') { B.help[b.dataset.key] = !B.help[b.dataset.key]; lobby(); return; }"), 'V13.131 긴 설명은 작은 ? 를 눌러야 보인다(방식 · 범위 방식 · 판돈 · 로보 · 펫 특기), 처음에는 닫혀 있다');
  assert(!battle.includes('친구가 다른 번호를 외우고 있다면?') && !battle.includes('class="ya-explain"') && !battle.includes('class="ya-rules"') && !battle.includes('class="ya-hint"') && !play.includes('연습 상대 난이도"><b>'), 'V13.131 설정 카드에 긴 설명 문장이 그대로 놓여 있지 않다');

  /* ---------- 톤: 초록 #0E8A5F 하나 + 회색, 버튼 52/40px, 글자 19/15/12 ---------- */
  assert(css.includes('--yl-g:#0E8A5F') && css.includes('--yl-t1:19px;--yl-t2:15px;--yl-t3:12px'), 'V13.131 톤 값: 초록 #0E8A5F, 글자 19 · 15 · 12px');
  const hex = [...new Set(css.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [])];
  assert(hex.length > 10 && hex.every(greenOrGray), `V13.131 색은 초록과 회색뿐(로보 보라 · 판돈 노란 배경 없음): ${hex.filter(h => !greenOrGray(h)).join(' ')}`);
  const sizes = [...css.matchAll(/font-size:([^;}]+)/g)].map(m => m[1].trim());
  assert(sizes.length > 40 && sizes.every(v => ['var(--yl-t1)', 'var(--yl-t2)', 'var(--yl-t3)'].includes(v)), 'V13.131 새 화면의 글자 크기는 19 · 15 · 12px 세 단계만');
  assert(/\.yl-cta\{[^}]*height:52px/.test(css) && /\.yl-level\{height:52px/.test(css) && ['.yl-sm', '.yl-go', '.yl-stake', '.yl-mode', '.fl-go', '.ya-seg button'].every(sel => new RegExp(`${sel.replace('.', '\\.')}\\{[^}]*height:40px`).test(css)), 'V13.131 버튼 높이는 52px(큰 버튼 · 난이도 카드)와 40px(작은 버튼 · 선택 버튼 · 도전 버튼 · 전환)');
  assert(!play.includes('yl-cta" data-yb="bot"') && /\.yl-go\{height:40px;border:0;border-radius:12px;background:var\(--yl-soft\)/.test(css), 'V13.131 연습 시작은 연한 초록(보조 40px), 큰 버튼은 화면에 도전장 하나');

  /* ---------- 단어 범위 창 · 코드로 참가 창 · 바닥에서 올라오는 창 ---------- */
  assert(sheet.includes("import { modal } from './ui.js';") && sheet.includes("className: `ya-sheet ${className}`.trim()") && sheet.includes("classList.add('ya-sheet-back')") && css.includes('border-radius:26px 26px 0 0!important') && css.includes('.modal-backdrop.ya-sheet-back{display:flex;align-items:flex-end'), 'V13.131 바닥 창은 앱의 한 가지 대화창(modal)을 쓴다: 이름 · Tab 가두기 · Esc · 뒷배경 · 포커스 복귀 그대로');
  assert(battle.includes("openSheet(draw(), '단어 범위', { className: 'rs-sheet'") && ['data-rs-period', 'data-rs-code', 'data-rs-mode', 'data-rs-done', 'periodGroups(A, codes)'].every(t => battle.includes(t)) && battle.includes('${num(total())}단어로 대결') && battle.includes('8단어 이상 골라 주세요'), 'V13.131 단어 범위 창: 기말고사 · 중간고사 전환, 단어장 번호(단어 수), 친구 단어, “○과 · ○과 · N단어로 대결”');
  assert(battle.includes('function openJoinSheet()') && battle.includes('id="yb-code"') && battle.includes("replace(/\\D/g, '').slice(0, 6)") && css.includes('.rs-code{height:52px'), 'V13.131 코드로 참가 창: 6자리 숫자 칸과 큰 버튼');

  /* ---------- 친구 목록(야차전 도전장 · 던전 초대 공통) ---------- */
  assert(friendGroup({ same_class: true, school: '강서고' }, '강서고') === 'class' && friendGroup({ same_class: false, school: '강서고' }, '강서고') === 'school' && friendGroup({ same_class: false, school: '단원고' }, '강서고') === 'other' && friendGroup({ same_class: false, school: '강서고' }, '') === 'other', 'V13.131 친구 묶음: 우리 반(같은 반) · 우리 학교(같은 학교 다른 반) · 다른 학교');
  assert(friend.includes("const GROUPS = [['class', '우리 반'], ['school', '우리 학교'], ['other', '다른 학교']];") && friend.includes('<span class="fl-status">') && friend.includes('class="fl-go') && friend.includes("size: 'mini'"), 'V13.131 친구 목록: 우리 반 · 우리 학교 · 다른 학교 탭, 작은 버튼, 쉬는 친구는 버튼 대신 회색 글자');
  assert(battle.includes('openFriendSheet({') && dungeon.includes('openFriendSheet({') && !/yb-friend|dg-friend/.test(battle + dungeon), 'V13.131 야차전 도전장과 던전 초대가 같은 친구 목록(friend-sheet.js)을 쓴다');
  assert(/\.fl-pet\{flex:none;display:block;width:44px;height:44px;border-radius:14px/.test(css) && /\.fl-who b\{[^}]*text-overflow:ellipsis/.test(css) && /\.fl-go\{flex:none;height:40px/.test(css) && /\.fl-status\{[^}]*color:var\(--yl-gray2\)/.test(css), 'V13.131 친구 한 줄: 44px 둥근 펫 얼굴(고정 상자), 이름 한 줄(넘치면 …), 40px 작은 버튼, 상태는 회색 글자');
  assert(!/\.dg-friend/.test(source('../public/v13128.css')) && !/\.yb-friend/.test(source('../public/v1361.css') + source('../public/v1366.css')), 'V13.131 던전 초대 창에서 펫 그림을 가로로 늘리던 규칙(.dg-friend > div { flex: 1 })이 없다');

  /* ---------- 묶음 CSS ---------- */
  assert(/"v13130\.css",\s*"v13131\.css"\s*]/.test(build), 'V13.131 v13131.css는 묶음 CSS 목록의 맨 끝(앞 화면 CSS를 덮어쓰는 자리)');
}
