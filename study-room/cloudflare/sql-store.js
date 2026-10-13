// Durable Object 안의 SQLite에 공부방 데이터를 저장한다.
// 반/공지는 'meta', 학생은 's:<id>', 공부 기록은 'd:<id>' 행으로 나눠서 바뀐 행만 다시 쓴다.

function emptyData() {
  return { version: 1, classes: {}, students: {}, daily: {}, notices: {} };
}

export class SqlStore {
  constructor(sql, { flushDelayMs = 1000, log = () => {} } = {}) {
    this.sql = sql;
    this.flushDelayMs = flushDelayMs;
    this.log = log;
    this.data = emptyData();
    this.written = new Map();
    this.pending = false;
    this.timer = null;
    this.beforeFlush = null;
  }

  get kind() {
    return 'durable-object';
  }

  load() {
    this.sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    for (const row of this.sql.exec('SELECT k, v FROM kv')) {
      const { k, v } = row;
      this.written.set(k, v);
      const value = JSON.parse(v);
      if (k === 'meta') Object.assign(this.data, value);
      else if (k === 'live') this.data.live = value;
      else if (k.startsWith('s:')) this.data.students[k.slice(2)] = value;
      else if (k.startsWith('d:')) this.data.daily[k.slice(2)] = value;
    }
    return this.data;
  }

  rows() {
    const d = this.data;
    const rows = new Map();
    rows.set('meta', JSON.stringify({ version: d.version, classes: d.classes, notices: d.notices }));
    rows.set('live', JSON.stringify(d.live || {}));
    for (const [id, s] of Object.entries(d.students)) rows.set(`s:${id}`, JSON.stringify(s));
    for (const [id, days] of Object.entries(d.daily)) rows.set(`d:${id}`, JSON.stringify(days));
    return rows;
  }

  markDirty() {
    this.pending = true;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        this.flush();
      } catch (err) {
        this.log('store flush failed', err);
      }
    }, this.flushDelayMs);
  }

  flush() {
    if (!this.pending) return;
    this.pending = false;
    if (this.beforeFlush) this.beforeFlush();
    const rows = this.rows();
    for (const [k, v] of rows) {
      if (this.written.get(k) === v) continue;
      this.sql.exec('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', k, v);
      this.written.set(k, v);
    }
    for (const k of Array.from(this.written.keys())) {
      if (rows.has(k)) continue;
      this.sql.exec('DELETE FROM kv WHERE k = ?', k);
      this.written.delete(k);
    }
  }
}
