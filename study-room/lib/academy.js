'use strict';

const crypto = require('crypto');
const Avatar = require('../public/avatar');
const { dayKey, splitByDay, addDays, isDayKey } = require('./time');
const { cleanBubble, cleanName } = require('./filter');

const ALL = 'ALL';
const AWAY_GRACE_MS = 10 * 60 * 1000; // 화면이 꺼져 연결이 끊겨도 10분 안에 돌아오면 이어서 잰다
const BUBBLES_PER_DAY = 20;
const CHEER_GAP_MS = 1500;
const STREAK_MIN_MS = 30 * 60 * 1000; // 하루 30분 이상 공부해야 연속 기록으로 친다
const MAX_TOKENS = 5;
// 켜두기만 하는 걸 막기 위한 집중 확인: 30~50분마다 한 번, 3분 안에 눌러야 한다
const CHECK_EVERY_MS = [30 * 60 * 1000, 50 * 60 * 1000];
const CHECK_WINDOW_MS = 3 * 60 * 1000;
// 카메라를 켠 학생: 얼굴이 5분 넘게 안 보이면 자리를 뜬 시점까지만 기록하고 멈춘다
const CAM_GONE_MS = 5 * 60 * 1000;
const CAM_POSES = ['down', 'up', 'yawn', 'sleep', 'gone'];
// 오늘 목표: 30분 단위, 최대 16시간
const GOAL_STEP_MIN = 30;
const GOAL_MAX_MIN = 16 * 60;
const HISTORY_DAYS = 18 * 7; // 잔디 달력: 18주
const STATUS_ORDER = { study: 0, away: 1, rest: 2, offline: 3 };

function sha(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

class AcademyError extends Error {
  constructor(message, code = 'bad_request') {
    super(message);
    this.code = code;
  }
}

class Academy {
  constructor(store, {
    now = () => Date.now(),
    onMember = () => {},
    onRemove = () => {},
    onCheer = () => {},
    onNotice = () => {},
    onCheckMissed = () => {},
    onCamStopped = () => {},
    onGoal = () => {},
    checkEveryMs = CHECK_EVERY_MS,
    checkWindowMs = CHECK_WINDOW_MS,
    random = Math.random
  } = {}) {
    this.store = store;
    this.now = now;
    this.onCheckMissed = onCheckMissed;
    this.onCamStopped = onCamStopped;
    this.onGoal = onGoal;
    this.recentGoals = [];
    this.checkEveryMs = checkEveryMs;
    this.checkWindowMs = checkWindowMs;
    this.random = random;
    this.onMember = onMember;
    this.onRemove = onRemove;
    this.onCheer = onCheer;
    this.onNotice = onNotice;
    this.live = new Map();
    this.tokenIndex = new Map();
    for (const student of Object.values(this.data.students)) {
      for (const hash of student.tokens || []) this.tokenIndex.set(hash, student.id);
    }
    this.lastDay = dayKey(this.now());
    this.restoreLive(this.data.live);
    // 저장 직전에 실시간 상태(공부 시작 시각, 말풍선 등)도 함께 남겨서 서버가 다시 켜져도 이어지게 한다
    store.beforeFlush = () => { this.data.live = this.exportLive(); };
  }

  exportLive() {
    const out = {};
    for (const [id, l] of this.live) {
      if (!this.data.students[id]) continue;
      if (l.since == null && !l.bubble) continue;
      out[id] = { since: l.since, awayAt: l.awayAt, bubble: l.bubble, check: l.check, nextCheckAt: l.nextCheckAt };
    }
    return out;
  }

  // 서버가 다시 켜지면 연결은 모두 끊긴 상태라, 공부 중이던 학생은 지금부터 자리비움 유예로 시작한다
  restoreLive(saved) {
    if (!saved || typeof saved !== 'object') return;
    const now = this.now();
    for (const [id, v] of Object.entries(saved)) {
      if (!this.data.students[id] || !v) continue;
      const l = this.liveOf(id);
      l.since = typeof v.since === 'number' ? v.since : null;
      l.awayAt = l.since != null ? (typeof v.awayAt === 'number' ? v.awayAt : now) : null;
      l.bubble = v.bubble && typeof v.bubble.text === 'string' ? v.bubble : null;
      l.check = v.check && typeof v.check.at === 'number' ? v.check : null;
      l.nextCheckAt = typeof v.nextCheckAt === 'number' ? v.nextCheckAt : null;
    }
  }

  get data() {
    return this.store.data;
  }

  dirty() {
    this.store.markDirty();
  }

  today() {
    return dayKey(this.now());
  }

  // ---------- 반 ----------

  listClasses() {
    const counts = {};
    for (const s of Object.values(this.data.students)) counts[s.classCode] = (counts[s.classCode] || 0) + 1;
    return Object.values(this.data.classes)
      .map((c) => ({ code: c.code, name: c.name, count: counts[c.code] || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }

  getClass(code) {
    return this.data.classes[String(code || '').trim()] || null;
  }

  createClass(name) {
    const clean = cleanName(name);
    if (!clean) throw new AcademyError('반 이름을 입력해 주세요.');
    if (Object.values(this.data.classes).some((c) => c.name === clean)) throw new AcademyError('같은 이름의 반이 이미 있어요.', 'conflict');
    let code;
    do code = String(1000 + crypto.randomInt(9000));
    while (this.data.classes[code]);
    const cls = { code, name: clean, createdAt: this.now() };
    this.data.classes[code] = cls;
    this.dirty();
    return cls;
  }

  renameClass(code, name) {
    const cls = this.getClass(code);
    if (!cls) throw new AcademyError('없는 반이에요.', 'not_found');
    const clean = cleanName(name);
    if (!clean) throw new AcademyError('반 이름을 입력해 주세요.');
    cls.name = clean;
    this.dirty();
    for (const s of this.studentsOf(code)) this.emit(s.id);
    return cls;
  }

  deleteClass(code) {
    if (!this.getClass(code)) throw new AcademyError('없는 반이에요.', 'not_found');
    if (this.studentsOf(code).length) throw new AcademyError('학생이 있는 반은 삭제할 수 없어요. 학생을 먼저 정리해 주세요.', 'conflict');
    delete this.data.classes[code];
    delete this.data.notices[code];
    this.dirty();
  }

  studentsOf(target) {
    const list = Object.values(this.data.students);
    return target === ALL ? list : list.filter((s) => s.classCode === target);
  }

  // ---------- 학생 계정 ----------

  pinHash(student, pin) {
    return sha(`${student.salt}:${pin}`);
  }

  findStudent(classCode, name) {
    const clean = cleanName(name);
    return Object.values(this.data.students).find((s) => s.classCode === classCode && s.name === clean) || null;
  }

  register({ name, classCode, pin, avatar }) {
    const code = String(classCode || '').trim();
    if (!this.getClass(code)) throw new AcademyError('반 코드를 다시 확인해 주세요.', 'not_found');
    const clean = cleanName(name);
    if (!clean) throw new AcademyError('이름을 입력해 주세요.');
    if (!/^\d{4}$/.test(String(pin || ''))) throw new AcademyError('PIN은 숫자 4자리예요.');
    if (this.findStudent(code, clean)) throw new AcademyError('이미 같은 이름이 있어요. "다시 들어가기"로 로그인하거나 다른 이름을 써 주세요.', 'conflict');
    const student = this.createStudent(code, clean, pin, avatar);
    const token = this.issueToken(student);
    return { student, token };
  }

  createStudent(code, name, pin, avatar, lastSeen = this.now()) {
    const student = {
      id: randomHex(8),
      name,
      classCode: code,
      salt: randomHex(8),
      pin: '',
      avatar: Avatar.normalize(avatar || Avatar.random()),
      tokens: [],
      createdAt: this.now(),
      lastSeen
    };
    student.pin = this.pinHash(student, pin);
    this.data.students[student.id] = student;
    this.dirty();
    this.emit(student.id);
    return student;
  }

  // 선생님이 이름 목록으로 한꺼번에 등록한다. 학생마다 처음 PIN을 무작위로 만들어 돌려준다.
  addStudents(classCode, names) {
    const code = String(classCode || '').trim();
    if (!this.getClass(code)) throw new AcademyError('없는 반이에요.', 'not_found');
    const list = Array.isArray(names) ? names.slice(0, 200) : [];
    const seen = new Set();
    const results = [];
    for (const raw of list) {
      const name = cleanName(raw);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      if (this.findStudent(code, name)) {
        results.push({ name, status: 'exists' });
        continue;
      }
      const pin = String(crypto.randomInt(10000)).padStart(4, '0');
      this.createStudent(code, name, pin, null, null);
      results.push({ name, status: 'added', pin });
    }
    return results;
  }

  login({ name, classCode, pin }) {
    const student = this.findStudent(String(classCode || '').trim(), name);
    if (!student || student.pin !== this.pinHash(student, String(pin || ''))) {
      throw new AcademyError('반 코드, 이름, PIN을 다시 확인해 주세요.', 'unauthorized');
    }
    return { student, token: this.issueToken(student) };
  }

  issueToken(student) {
    const token = randomHex(24);
    const hash = sha(token);
    student.tokens = [...(student.tokens || []), hash];
    while (student.tokens.length > MAX_TOKENS) this.tokenIndex.delete(student.tokens.shift());
    this.tokenIndex.set(hash, student.id);
    this.dirty();
    return token;
  }

  auth(token) {
    if (!token) return null;
    const id = this.tokenIndex.get(sha(token));
    return (id && this.data.students[id]) || null;
  }

  logout(token) {
    const hash = sha(token);
    const id = this.tokenIndex.get(hash);
    if (!id) return;
    this.tokenIndex.delete(hash);
    const s = this.data.students[id];
    if (s) s.tokens = s.tokens.filter((t) => t !== hash);
    this.dirty();
  }

  setAvatar(id, avatar) {
    const s = this.mustStudent(id);
    s.avatar = Avatar.normalize(avatar);
    this.dirty();
    this.emit(id);
  }

  resetPin(id, pin) {
    const s = this.mustStudent(id);
    if (!/^\d{4}$/.test(String(pin || ''))) throw new AcademyError('PIN은 숫자 4자리예요.');
    s.pin = this.pinHash(s, pin);
    for (const hash of s.tokens) this.tokenIndex.delete(hash);
    s.tokens = [];
    this.dirty();
  }

  moveStudent(id, classCode) {
    const s = this.mustStudent(id);
    if (!this.getClass(classCode)) throw new AcademyError('없는 반이에요.', 'not_found');
    if (this.findStudent(classCode, s.name)) throw new AcademyError('옮길 반에 같은 이름이 있어요.', 'conflict');
    const from = s.classCode;
    s.classCode = classCode;
    this.dirty();
    this.onRemove(id, from);
    this.emit(id);
  }

  removeStudent(id) {
    const s = this.mustStudent(id);
    this.stopStudy(id);
    for (const hash of s.tokens) this.tokenIndex.delete(hash);
    delete this.data.students[id];
    delete this.data.daily[id];
    this.live.delete(id);
    this.dirty();
    this.onRemove(id, s.classCode, true);
  }

  mustStudent(id) {
    const s = this.data.students[id];
    if (!s) throw new AcademyError('없는 학생이에요.', 'not_found');
    return s;
  }

  // ---------- 실시간 공부 상태 ----------

  liveOf(id) {
    let l = this.live.get(id);
    if (!l) {
      l = { sockets: 0, since: null, awayAt: null, bubble: null, lastCheer: 0, check: null, nextCheckAt: null, cam: null, camGoneAt: null };
      this.live.set(id, l);
    }
    return l;
  }

  record(id, day) {
    const byDay = this.data.daily[id] || (this.data.daily[id] = {});
    return byDay[day] || (byDay[day] = { ms: 0, b: 0, h: 0, ok: 0, miss: 0, cms: 0 });
  }

  peek(id, day) {
    const byDay = this.data.daily[id];
    return (byDay && byDay[day]) || null;
  }

  attach(id) {
    const s = this.mustStudent(id);
    const l = this.liveOf(id);
    l.sockets += 1;
    l.awayAt = null;
    s.lastSeen = this.now();
    this.emit(id);
  }

  detach(id) {
    const l = this.live.get(id);
    const s = this.data.students[id];
    if (!l || !s) return;
    l.sockets = Math.max(0, l.sockets - 1);
    s.lastSeen = this.now();
    this.dirty();
    if (l.sockets === 0 && l.since != null) {
      this.commit(id, this.cap(l, this.now()));
      l.awayAt = this.now();
    }
    if (l.sockets === 0) {
      l.cam = null;
      l.camGoneAt = null;
    }
    this.emit(id);
  }

  // since 이후 upTo까지 공부한 시간을 날짜별로 기록하고 since를 앞으로 당긴다.
  commit(id, upTo) {
    const l = this.live.get(id);
    if (!l || l.since == null || upTo <= l.since) return;
    const verified = l.cam != null && l.cam !== 'gone';
    for (const [day, ms] of splitByDay(l.since, upTo)) {
      const rec = this.record(id, day);
      rec.ms += ms;
      if (verified) rec.cms = (rec.cms || 0) + ms;
    }
    l.since = upTo;
    this.dirty();
  }

  // 자리비움이나 집중 확인 대기 중에는 그 시점까지만 기록한다
  cap(l, upTo) {
    let t = upTo;
    if (l.awayAt != null) t = Math.min(t, l.awayAt);
    if (l.check) t = Math.min(t, l.check.at);
    if (l.cam === 'gone' && l.camGoneAt != null) t = Math.min(t, l.camGoneAt);
    return t;
  }

  // 카메라 상태 변경 (on=false면 카메라 끔)
  setCam(id, on, pose) {
    this.mustStudent(id);
    const l = this.liveOf(id);
    const next = on ? (CAM_POSES.includes(pose) ? pose : 'up') : null;
    if (next === l.cam) return;
    if (l.since != null && l.awayAt == null) {
      // 자리를 비웠다 5분 안에 돌아오면 그 사이도 공부 시간으로 치되 '카메라 인증'에서는 뺀다
      if (l.cam === 'gone') l.camGoneAt = null;
      this.commit(id, this.cap(l, this.now()));
    }
    l.cam = next;
    if (next === 'gone') {
      if (l.camGoneAt == null) l.camGoneAt = this.now();
    } else {
      // 5분 안에 돌아오면 비운 시간도 이어서 인정한다
      l.camGoneAt = null;
    }
    // 카메라에 얼굴이 보이면 집중 확인은 필요 없다
    if (next && next !== 'gone' && l.check) this.confirmCheck(id);
    this.emit(id);
  }

  scheduleCheck(l) {
    const [min, max] = this.checkEveryMs;
    l.nextCheckAt = this.now() + min + Math.floor(this.random() * (max - min));
  }

  startStudy(id) {
    this.mustStudent(id);
    const l = this.liveOf(id);
    if (l.since != null && l.awayAt == null) return;
    if (l.since != null) this.commit(id, this.cap(l, this.now()));
    l.since = this.now();
    l.awayAt = null;
    l.check = null;
    this.scheduleCheck(l);
    this.emit(id);
  }

  stopStudy(id, upTo) {
    const l = this.live.get(id);
    if (!l || l.since == null) return;
    // 직접 멈추면 확인 대기 중이었어도 지금까지 인정한다 (화면 앞에 있다는 뜻)
    this.commit(id, upTo != null ? upTo : (l.awayAt != null ? l.awayAt : this.now()));
    l.since = null;
    l.awayAt = null;
    l.check = null;
    l.nextCheckAt = null;
    this.checkGoal(id);
    this.emit(id);
  }

  // ---------- 오늘 목표 ----------

  setGoal(id, minutes) {
    const s = this.mustStudent(id);
    const m = Number(minutes) || 0;
    if (m !== 0 && (!Number.isInteger(m) || m % GOAL_STEP_MIN !== 0 || m < GOAL_STEP_MIN || m > GOAL_MAX_MIN)) {
      throw new AcademyError('목표는 30분 단위로 16시간까지 정할 수 있어요.');
    }
    s.goalMin = m || null;
    this.dirty();
    this.checkGoal(id);
    this.emit(id);
  }

  goalMs(id) {
    const s = this.data.students[id];
    return s && s.goalMin ? s.goalMin * 60000 : null;
  }

  // 오늘 목표를 처음 넘기면 한 번만 축하한다
  checkGoal(id) {
    const goal = this.goalMs(id);
    if (!goal) return false;
    const rec = this.peek(id, this.today());
    if (rec && rec.g) return false;
    if (this.todayMs(id) < goal) return false;
    const r = this.record(id, this.today());
    r.g = this.data.students[id].goalMin;
    this.dirty();
    const event = { id, name: this.data.students[id].name, classCode: this.data.students[id].classCode, goalMin: r.g, at: this.now() };
    this.recentGoals = [event, ...this.recentGoals.filter((e) => this.now() - e.at < 10 * 60 * 1000)].slice(0, 20);
    this.emit(id);
    this.onGoal(event);
    return true;
  }

  confirmCheck(id) {
    const l = this.live.get(id);
    if (!l || !l.check || l.since == null) return false;
    this.record(id, dayKey(l.check.at)).ok += 1;
    l.check = null;
    this.scheduleCheck(l);
    this.dirty();
    this.emit(id);
    return true;
  }

  setStudy(id, on) {
    if (on) this.startStudy(id);
    else this.stopStudy(id);
  }

  postBubble(id, text) {
    this.mustStudent(id);
    const clean = cleanBubble(text);
    const l = this.liveOf(id);
    if (!clean) {
      l.bubble = null;
      this.emit(id);
      return;
    }
    const rec = this.record(id, this.today());
    if (rec.b >= BUBBLES_PER_DAY) throw new AcademyError('오늘 말풍선은 다 썼어요. 내일 또 만나요!', 'limit');
    rec.b += 1;
    l.bubble = { text: clean, at: this.now() };
    this.dirty();
    this.emit(id);
  }

  clearBubble(id) {
    const l = this.live.get(id);
    if (l && l.bubble) {
      l.bubble = null;
      this.emit(id);
    }
  }

  cheer(fromId, toId) {
    const from = this.mustStudent(fromId);
    this.mustStudent(toId);
    if (fromId === toId) throw new AcademyError('나 자신은 응원할 수 없어요.');
    const l = this.liveOf(fromId);
    if (this.now() - l.lastCheer < CHEER_GAP_MS) return false;
    l.lastCheer = this.now();
    this.record(toId, this.today()).h += 1;
    this.dirty();
    this.emit(toId);
    this.onCheer({ from: fromId, fromName: from.name, to: toId });
    return true;
  }

  // 주기적으로 호출: 공부 시간 저장, 자리비움 만료, 날짜 변경 처리
  tick() {
    const now = this.now();
    for (const [id, l] of this.live) {
      if (l.since == null) continue;
      if (l.check && now > l.check.deadline) {
        const at = l.check.at;
        this.record(id, dayKey(at)).miss += 1;
        this.stopStudy(id, Math.min(at, l.awayAt != null ? l.awayAt : at));
        this.onCheckMissed(id);
      } else if (l.awayAt != null) {
        if (now - l.awayAt > AWAY_GRACE_MS) this.stopStudy(id);
      } else if (l.cam === 'gone' && l.camGoneAt != null && now - l.camGoneAt > CAM_GONE_MS) {
        this.stopStudy(id, l.camGoneAt);
        this.onCamStopped(id);
      } else {
        this.commit(id, this.cap(l, now));
        this.checkGoal(id);
        if (l.cam && l.nextCheckAt != null && now >= l.nextCheckAt) this.scheduleCheck(l);
        if (!l.check && l.nextCheckAt != null && now >= l.nextCheckAt) {
          l.check = { at: now, deadline: now + this.checkWindowMs };
          this.emit(id);
        }
      }
    }
    const day = dayKey(now);
    if (day !== this.lastDay) {
      this.lastDay = day;
      for (const [id, l] of this.live) {
        l.bubble = null;
        if (this.data.students[id]) this.emit(id);
      }
    }
  }

  status(id) {
    const l = this.live.get(id);
    if (!l) return 'offline';
    if (l.since != null) return l.awayAt != null ? 'away' : 'study';
    return l.sockets > 0 ? 'rest' : 'offline';
  }

  isOnline(id) {
    return this.status(id) !== 'offline';
  }

  // 오늘 기록된 시간 + 아직 저장 안 된 진행 중 시간
  todayMs(id) {
    const rec = this.peek(id, this.today());
    let ms = rec ? rec.ms : 0;
    const l = this.live.get(id);
    if (l && l.since != null && l.awayAt == null) ms += Math.max(0, this.now() - Math.max(l.since, this.startOfToday()));
    return ms;
  }

  startOfToday() {
    return Date.parse(`${this.today()}T00:00:00+09:00`);
  }

  member(id) {
    const s = this.data.students[id];
    if (!s) return null;
    const l = this.live.get(id);
    const rec = this.peek(id, this.today());
    const status = this.status(id);
    const cls = this.getClass(s.classCode);
    return {
      id,
      name: s.name,
      classCode: s.classCode,
      className: cls ? cls.name : '',
      avatar: s.avatar,
      status,
      // 클라이언트는 baseMs + (지금 - since)로 타이머를 직접 돌린다
      baseMs: rec ? rec.ms : 0,
      since: status === 'study' ? Math.max(l.since, this.startOfToday()) : null,
      bubble: (l && l.bubble) || null,
      hearts: rec ? rec.h : 0,
      cam: (l && l.cam) || null,
      goalMs: this.goalMs(id),
      goalHit: !!(rec && rec.g)
    };
  }

  me(id) {
    const m = this.member(id);
    if (!m) return null;
    const rec = this.peek(id, this.today());
    const l = this.live.get(id);
    return {
      ...m,
      bubblesLeft: BUBBLES_PER_DAY - (rec ? rec.b : 0),
      check: (l && l.check) || null,
      camGoneAt: (l && l.cam === 'gone' && l.since != null && l.camGoneAt) || null,
      camStopMs: CAM_GONE_MS
    };
  }

  roomMembers(view, classCode) {
    const list = view === 'all'
      ? Object.values(this.data.students).filter((s) => this.isOnline(s.id))
      : this.studentsOf(classCode);
    return list.map((s) => this.member(s.id)).sort(compareMembers);
  }

  emit(id) {
    this.dirty();
    const m = this.member(id);
    if (m) this.onMember(m);
  }

  // ---------- 공지 ----------

  setNotice(target, text) {
    if (target !== ALL && !this.getClass(target)) throw new AcademyError('없는 반이에요.', 'not_found');
    const clean = String(text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80);
    if (clean) this.data.notices[target] = { text: clean, at: this.now() };
    else delete this.data.notices[target];
    this.dirty();
    this.onNotice(target, this.data.notices[target] || null);
  }

  noticesFor(classCode) {
    return [this.data.notices[ALL], this.data.notices[classCode]].filter(Boolean);
  }

  // ---------- 기록/통계 ----------

  daysMs(id, endDay, count) {
    const out = [];
    for (let i = count - 1; i >= 0; i -= 1) {
      const day = addDays(endDay, -i);
      const rec = this.peek(id, day);
      let ms = rec ? rec.ms : 0;
      if (day === this.today()) ms = this.todayMs(id);
      out.push({ day, ms });
    }
    return out;
  }

  streak(id) {
    // 오늘은 아직 진행 중이라 30분이 안 돼도 연속 기록을 끊지 않는다
    let n = this.todayMs(id) >= STREAK_MIN_MS ? 1 : 0;
    let day = addDays(this.today(), -1);
    for (;;) {
      const rec = this.peek(id, day);
      if (!rec || rec.ms < STREAK_MIN_MS) break;
      n += 1;
      day = addDays(day, -1);
    }
    return n;
  }

  weekMs(id, endDay = this.today()) {
    return this.daysMs(id, endDay, 7).reduce((sum, d) => sum + d.ms, 0);
  }

  stats(id) {
    const s = this.mustStudent(id);
    const days = this.daysMs(id, this.today(), 7);
    const ranking = this.studentsOf(s.classCode)
      .map((st) => ({ id: st.id, name: st.name, avatar: st.avatar, ms: this.weekMs(st.id) }))
      .sort((a, b) => b.ms - a.ms);
    const myRank = ranking.findIndex((r) => r.id === id) + 1;
    const rec = this.peek(id, this.today());
    return {
      today: this.today(),
      todayMs: this.todayMs(id),
      weekMs: days.reduce((sum, d) => sum + d.ms, 0),
      days,
      streak: this.streak(id),
      hearts: rec ? rec.h : 0,
      camMs: rec ? rec.cms || 0 : 0,
      goalMs: this.goalMs(id),
      goalHit: !!(rec && rec.g),
      history: this.daysMs(id, this.today(), HISTORY_DAYS).map((d) => {
        const r = this.peek(id, d.day);
        return { day: d.day, ms: d.ms, g: !!(r && r.g) };
      }),
      goalDays: this.daysMs(id, this.today(), 30).filter((d) => { const r = this.peek(id, d.day); return r && r.g; }).length,
      top: ranking.slice(0, 3).filter((r) => r.ms > 0),
      myRank,
      classSize: ranking.length
    };
  }

  // 학원 TV 화면: 지금 접속한 학생들과 오늘/최근 7일 순위
  board(target) {
    if (target !== ALL && !this.getClass(target)) throw new AcademyError('없는 반이에요.', 'not_found');
    const cls = target === ALL ? null : this.getClass(target);
    const students = this.studentsOf(target);
    const members = students.filter((s) => this.isOnline(s.id)).map((s) => this.member(s.id)).sort(compareMembers);
    const today = students
      .map((s) => this.member(s.id))
      .filter((m) => m.baseMs > 0 || m.since)
      .sort((a, b) => this.todayMs(b.id) - this.todayMs(a.id))
      .slice(0, 10);
    const week = students
      .map((s) => ({ id: s.id, name: s.name, className: this.member(s.id).className, avatar: s.avatar, ms: this.weekMs(s.id) }))
      .filter((r) => r.ms > 0)
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 10);
    return {
      target,
      title: cls ? cls.name : '학원 전체',
      serverNow: this.now(),
      studying: members.filter((m) => m.status === 'study').length,
      totalTodayMs: students.reduce((sum, s) => sum + this.todayMs(s.id), 0),
      goals: this.recentGoals.filter((e) => this.now() - e.at < 3 * 60 * 1000 && (target === ALL || e.classCode === target)),
      notice: this.data.notices[target] || this.data.notices[ALL] || null,
      members,
      today,
      week
    };
  }

  overview(target, day = this.today()) {
    if (target !== ALL && !this.getClass(target)) throw new AcademyError('없는 반이에요.', 'not_found');
    if (!isDayKey(day)) throw new AcademyError('날짜 형식이 올바르지 않아요.');
    const students = this.studentsOf(target).map((s) => {
      const days = this.daysMs(s.id, day, 7);
      const rec = this.peek(s.id, day);
      const l = this.live.get(s.id);
      const cls = this.getClass(s.classCode);
      return {
        id: s.id,
        name: s.name,
        classCode: s.classCode,
        className: cls ? cls.name : '',
        avatar: s.avatar,
        status: this.status(s.id),
        dayMs: days[days.length - 1].ms,
        weekMs: days.reduce((sum, d) => sum + d.ms, 0),
        days,
        streak: this.streak(s.id),
        bubble: (l && l.bubble) || null,
        bubblesUsed: rec ? rec.b : 0,
        checksOk: rec ? rec.ok || 0 : 0,
        checksMissed: rec ? rec.miss || 0 : 0,
        camMs: rec ? rec.cms || 0 : 0,
        cam: (l && l.cam) || null,
        goalMin: rec && rec.g ? rec.g : (day === this.today() ? s.goalMin || null : null),
        goalHit: !!(rec && rec.g),
        hearts: rec ? rec.h : 0,
        lastSeen: s.lastSeen || null
      };
    }).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.dayMs - a.dayMs || a.name.localeCompare(b.name, 'ko'));
    const studying = students.filter((s) => s.status === 'study').length;
    return {
      target,
      day,
      today: this.today(),
      studying,
      total: students.length,
      notice: this.data.notices[target] || null,
      students
    };
  }

  exportCsv(target, from, to) {
    if (!isDayKey(from) || !isDayKey(to) || from > to) throw new AcademyError('기간을 다시 확인해 주세요.');
    const days = [];
    for (let d = from; d <= to && days.length < 92; d = addDays(d, 1)) days.push(d);
    const rows = [['반', '이름', ...days, '합계(분)']];
    for (const s of this.studentsOf(target).sort((a, b) => a.classCode.localeCompare(b.classCode) || a.name.localeCompare(b.name, 'ko'))) {
      const mins = days.map((day) => Math.round((day === this.today() ? this.todayMs(s.id) : (this.peek(s.id, day) || { ms: 0 }).ms) / 60000));
      const cls = this.getClass(s.classCode);
      rows.push([cls ? cls.name : s.classCode, s.name, ...mins, mins.reduce((a, b) => a + b, 0)]);
    }
    return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  }
}

function csvCell(value) {
  let s = String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function compareMembers(a, b) {
  return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name, 'ko');
}

module.exports = { Academy, AcademyError, ALL, AWAY_GRACE_MS, BUBBLES_PER_DAY, STREAK_MIN_MS, CHECK_EVERY_MS, CHECK_WINDOW_MS, CAM_GONE_MS };
