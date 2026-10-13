'use strict';

const fs = require('fs');
const path = require('path');

function emptyData() {
  return { version: 1, classes: {}, students: {}, daily: {}, notices: {} };
}

// 전체 상태를 JSON 스냅샷 하나로 저장한다.
// DATABASE_URL이 있으면 Postgres 한 행(jsonb)에, 없으면 로컬 파일에 쓴다.
class Store {
  constructor({ file = null, databaseUrl = null, flushDelayMs = 3000, log = () => {} } = {}) {
    this.file = file;
    this.databaseUrl = databaseUrl;
    this.flushDelayMs = flushDelayMs;
    this.log = log;
    this.data = emptyData();
    this.pool = null;
    this.timer = null;
    this.writing = null;
    this.pending = false;
  }

  get kind() {
    if (this.databaseUrl) return 'postgres';
    return this.file ? 'file' : 'memory';
  }

  async load() {
    if (this.databaseUrl) {
      const { Pool } = require('pg');
      const ssl = /localhost|127\.0\.0\.1/.test(this.databaseUrl) ? false : { rejectUnauthorized: false };
      this.pool = new Pool({ connectionString: this.databaseUrl, ssl, max: 2 });
      await this.pool.query('CREATE TABLE IF NOT EXISTS study_room_state (id INT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())');
      const result = await this.pool.query('SELECT data FROM study_room_state WHERE id = 1');
      if (result.rows[0]) this.data = { ...emptyData(), ...result.rows[0].data };
    } else if (this.file && fs.existsSync(this.file)) {
      this.data = { ...emptyData(), ...JSON.parse(fs.readFileSync(this.file, 'utf8')) };
    }
    return this.data;
  }

  markDirty() {
    this.pending = true;
    if (this.timer || this.kind === 'memory') return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush().catch((err) => this.log('store flush failed:', err.message));
    }, this.flushDelayMs);
    if (this.timer.unref) this.timer.unref();
  }

  async flush() {
    if (this.writing) await this.writing;
    if (!this.pending || this.kind === 'memory') return;
    this.pending = false;
    const json = JSON.stringify(this.data);
    this.writing = (async () => {
      try {
        if (this.pool) {
          await this.pool.query(
            'INSERT INTO study_room_state (id, data, updated_at) VALUES (1, $1::jsonb, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()',
            [json]
          );
        } else {
          fs.mkdirSync(path.dirname(this.file), { recursive: true });
          const tmp = `${this.file}.tmp`;
          fs.writeFileSync(tmp, json);
          fs.renameSync(tmp, this.file);
        }
      } catch (err) {
        this.pending = true;
        throw err;
      } finally {
        this.writing = null;
      }
    })();
    await this.writing;
  }

  async close() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.flush();
    if (this.pool) await this.pool.end();
  }
}

module.exports = { Store, emptyData };
