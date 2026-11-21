// gsum.mjs <jsonl...> : 게임 × 조건별 중간값
import { readFileSync } from 'node:fs';
const rows = process.argv.slice(2).flatMap(f => readFileSync(f, 'utf8').split('\n')).filter(l => l.startsWith('{')).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const G = new Map(); for (const o of rows) { const r = o.r, k = `${o.tag} ${r.game} cpu${r.cpu}`; (G.get(k) || G.set(k, []).get(k)).push(r); }
const mid = xs => { const s = xs.filter(x => typeof x === 'number').sort((a, b) => a - b); return s.length ? s[s.length >> 1] : '-'; };
const F = ['fps', 'over50_min', 'over33_min', 'max', 'first5s_over50', 'long_tasks', 'input_p95', 'start_ms', 'style_ms', 'layout_ms', 'script_ms', 'seconds'];
console.log('조건 | n | ' + F.join(' | ') + ' | o50 각각');
for (const [k, rs] of G) console.log(`${k} | ${rs.filter(r => !r.fail).length}/${rs.length} | ${F.map(f => mid(rs.map(r => r[f]))).join(' | ')} | ${rs.map(r => r.over50_min).join(',')}`);
