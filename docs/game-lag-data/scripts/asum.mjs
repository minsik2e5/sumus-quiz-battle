import { readFileSync } from 'node:fs';
const rows = process.argv.slice(2).flatMap(f => readFileSync(f, 'utf8').split('\n')).filter(l => l.startsWith('{')).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const G = new Map(); for (const o of rows) { const k = `${o.m} cpu${o.cpu} ${o.tier} ${o.tag}`; (G.get(k) || G.set(k, []).get(k)).push(o.r); }
const mid = xs => { const s = xs.filter(x => typeof x === 'number').sort((a, b) => a - b); return s.length ? s[s.length >> 1] : '-'; };
const F = ['fps', 'fight_over50_per_min', 'fight_over33_per_min', 'fight_max', 'frame_max', 'long_tasks', 'input_p95', 'style_ms', 'layout_ms', 'script_ms', 'heap_mb', 'seconds'];
console.log('조건 | n | ' + F.join(' | ') + ' | tier | o50 각각');
for (const [k, rs] of [...G].sort()) console.log(`${k} | ${rs.filter(r => !r.fail).length}/${rs.length} | ${F.map(f => mid(rs.map(r => r[f]))).join(' | ')} | ${rs.map(r => r.tier).join(',')} | ${rs.map(r => r.fight_over50_per_min).join(',')}`);
