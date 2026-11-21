import { readFileSync } from 'node:fs';
const p = JSON.parse(readFileSync(process.argv[2])), self = new Map(), by = new Map(p.nodes.map(n => [n.id, n])); let tot = 0;
p.samples.forEach((id, i) => { const f = by.get(id).callFrame, k = `${f.functionName || '(anon)'} ${f.url.split('/').pop().split('?')[0]}:${f.lineNumber + 1}`, d = (p.timeDeltas[i] || 0) / 1000; self.set(k, (self.get(k) || 0) + d); tot += d; });
console.log('total ms', Math.round(tot)); console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, Number(process.argv[3] || 18)).map(([k, v]) => `${Math.round(v)}ms ${(v / tot * 100).toFixed(1)}% ${k}`).join('\n'));
