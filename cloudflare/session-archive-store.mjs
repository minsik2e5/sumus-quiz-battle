// V13.216 지난 연습 기록 보관 표(server/session-archive.mjs). 상태 조각(voca_rows)과 따로 둔다:
// cloudflare/local-first.mjs는 voca_rows만 읽으므로 부팅 때 이 표는 메모리에 올라오지 않는다. 기록 한 개를 열 때 한 줄만 읽는다.
//   voca_archive (id, student_id, created_at, data)  data: 보관 글(원래 칸 순서 + 옮긴 칸). 같은 id는 덮어쓴다(같은 글).
// 쓴 줄 수는 local-first의 오늘 쓴 줄 수에 더한다(countRows, 무료 한도 하루 10만 줄).
import { ARCHIVE_ROW_MAX_CHARS } from '../server/session-archive.mjs';

const UPSERT = 'INSERT INTO voca_archive (id, student_id, created_at, data) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET student_id = excluded.student_id, created_at = excluded.created_at, data = excluded.data';
// 크기 보기는 표 전체를 훑는다: 10분에 한 번만.
const STATS_CACHE_MS = 10 * 60000;

export function createSessionArchive(storage, { countRows = () => {}, now = () => Date.now() } = {}) {
  const sql = storage.sql;
  sql.exec('CREATE TABLE IF NOT EXISTS voca_archive (id TEXT PRIMARY KEY, student_id TEXT, created_at INTEGER NOT NULL, data TEXT NOT NULL) WITHOUT ROWID');
  let stats = null;
  return {
    // entries: [{ id, student_id, created_at, text }] 한 트랜잭션으로.
    put(entries) {
      const list = (entries || []).filter(e => e?.id && typeof e.text === 'string' && e.text.length <= ARCHIVE_ROW_MAX_CHARS);
      if (!list.length) return 0;
      let rows = 0;
      storage.transactionSync(() => {
        for (const e of list) {
          const cursor = sql.exec(UPSERT, String(e.id), e.student_id == null ? null : String(e.student_id), Number(e.created_at || 0), e.text);
          cursor?.toArray?.();
          const n = Number(cursor?.rowsWritten);
          rows += Number.isFinite(n) ? n : 1;
        }
      });
      countRows(rows);
      stats = null;
      return list.length;
    },
    // 보관 글 하나(없으면 null).
    get(id) {
      const row = sql.exec('SELECT data FROM voca_archive WHERE id = ?', String(id)).toArray()[0];
      return row ? row.data : null;
    },
    // /api/health용 개수 · 크기(KB).
    stats() {
      if (stats && now() - stats.at < STATS_CACHE_MS) return stats.value;
      const row = sql.exec('SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(data)), 0) AS chars FROM voca_archive').toArray()[0] || {};
      const value = { sessions: Number(row.n || 0), kb: Math.round(Number(row.chars || 0) / 102.4) / 10 };
      stats = { at: now(), value };
      return value;
    }
  };
}
