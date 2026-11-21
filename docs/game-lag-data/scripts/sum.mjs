// sum.mjs <jsonl> [keyfield...] : 조건별 중간값 표(대행진 기준 측정)
import { readFileSync } from 'node:fs';
const rows = readFileSync(process.argv[2], 'utf8').split('\n').filter(l => l.startsWith('{')).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const groups = new Map();
for (const o of rows) { const r = o.r || o; const k = `${o.tag ?? ''} st${o.stage ?? ''} cpu${r.cpu} ${r.q ?? ''}`; (groups.get(k) || groups.set(k, []).get(k)).push(r); }
const mid = xs => { const s = xs.filter(x => x != null).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };
const F = process.argv.slice(3).length ? process.argv.slice(3) : ['fps', 'over50_min', 'over33_min', 'max', 'first5s_over50', 'input_p95', 'start_ms', 'start_frame_max', 'siege_max', 'result_max'];
console.log('조건 | n | ' + F.join(' | ') + ' | over50 각각 | tier');
for (const [k, rs] of groups) console.log(`${k} | ${rs.length} | ${F.map(f => mid(rs.map(r => r[f]))).join(' | ')} | ${rs.map(r => r.over50_min).join(',')} | ${rs.map(r => r.tier_last ?? r.tier ?? '').join(',')}`);
