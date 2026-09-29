// Makes pet art with the OpenAI image API. Run it on your own PC: the API key stays there.
//
// Usage (from prototypes/tools):
//   node gen-pet-art.mjs <jobs.json> --dry-run          # check the plan, no request, no key needed
//   node gen-pet-art.mjs <jobs.json>                    # asks "N장 만들까요?" before spending
//   node gen-pet-art.mjs <jobs.json> --only fox-run --yes --max 4
//
// Key: OPENAI_API_KEY from the environment, or a line `OPENAI_API_KEY=...` in
// prototypes/tools/.env (ignored by git). The key is never printed or written anywhere.
//
// Each job draws from reference pictures (the current pet sprites by default), so the
// character keeps its look. Results go to prototypes/tools/out/<time>/ with the exact
// prompt beside each picture and an index.html to compare them. Nothing is written into
// public/: picking a picture and putting it in the app is a separate, deliberate step.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const API = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

const PETS = {
  dog: '몽이, a cream-and-orange puppy', pig: '핑키, a pink piglet', cat: '나비, a grey tabby kitten',
  dragon: '용이, a white baby dragon with green-blue scales and golden horns', panda: '밤부, a panda cub',
  snake: '초롱, a green snake', rabbit: '토리, a pink bunny', fox: '호야, an orange fox cub'
};
const FORMS = ['egg', 'baby', 'growing (bigger body, a little older, same face)', 'final (grown, strong and proud, same face)'];
const STYLE = 'Same character and same art style as the reference picture: soft, cute Korean mascot illustration, clean outlines, gentle shading. No text, no watermark, no frame, no ground shadow, plain transparent background.';
const TEMPLATES = {
  run: j => `Six frames of a side-view running cycle of ${PETS[j.pet] || 'the character'} (${FORMS[j.form ?? 1]} stage), facing right, in ONE horizontal row, evenly spaced, every frame the same size and with the feet on the same line. Frames: contact, down, passing, up, contact, down. ${STYLE}`,
  redraw: j => `Redraw ${PETS[j.pet] || 'the character'} at the ${FORMS[j.form ?? 1]} stage, full body, front three-quarter view, centred. Keep the face, colours and markings of the reference exactly. ${STYLE}`,
  evolution: j => `An evolution sheet of ${PETS[j.pet] || 'the character'}: four stages in ONE horizontal row from left to right: egg, baby, growing, final. The body grows with each stage while the face and colours stay the same. Evenly spaced, feet on the same line. ${STYLE}`,
  happy: j => `The same picture of ${PETS[j.pet] || 'the character'} with a happy expression: eyes closed in a smile, open mouth. Keep pose, framing, size and colours exactly. ${STYLE}`
};
const DEFAULTS = { model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1', size: '1536x1024', quality: 'high', background: 'transparent', n: 2 };

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const jobsFile = args.find(a => !a.startsWith('--') && !['--only', '--max', '--model'].includes(args[args.indexOf(a) - 1]));
if (!jobsFile) { console.log('사용법: node gen-pet-art.mjs <jobs.json> [--dry-run] [--only 이름,이름] [--max 8] [--yes]'); process.exit(1); }

const file = JSON.parse(readFileSync(jobsFile, 'utf8'));
const base = { ...DEFAULTS, ...(file.defaults || {}), ...(file.model ? { model: file.model } : {}), ...(option('--model') ? { model: option('--model') } : {}) };
const only = option('--only') ? new Set(option('--only').split(',')) : null;
const jobs = (file.jobs || []).filter(j => !only || only.has(j.name)).map(j => {
  const job = { ...base, ...j };
  if (!job.name || !/^[\w.-]+$/.test(job.name)) throw Error(`job name "${job.name}": letters, numbers, - _ . only`);
  job.prompt = job.prompt || (TEMPLATES[job.template] ? TEMPLATES[job.template](job) : null);
  if (!job.prompt) throw Error(`${job.name}: needs "prompt" or a template (${Object.keys(TEMPLATES).join(', ')})`);
  if (job.notes) job.prompt += ` Extra direction: ${job.notes}`;
  const refs = job.refs || (job.pet ? [`public/assets/pets/${job.pet}-${job.form ?? 1}.webp`] : []);
  job.refs = refs.map(r => resolve(REPO, r));
  job.n = Math.max(1, Math.min(4, Number(job.n) || 1));
  return job;
});
if (!jobs.length) { console.log('만들 작업이 없어요. --only 이름을 확인하세요.'); process.exit(1); }

const total = jobs.reduce((s, j) => s + j.n, 0);
const max = Number(option('--max', 8));
console.log(`\n모델 ${base.model} · 작업 ${jobs.length}개 · 그림 ${total}장 (한 번에 최대 ${max}장)\n`);
let missing = 0;
for (const j of jobs) {
  console.log(`- ${j.name}: ${j.n}장, ${j.size}, ${j.quality}, 배경 ${j.background}`);
  for (const r of j.refs) { const ok = existsSync(r); if (!ok) missing++; console.log(`    기준 그림 ${ok ? '✓' : '✗ 없음'} ${r.replace(REPO + '/', '')}`); }
  console.log(`    요청문: ${j.prompt.slice(0, 160)}${j.prompt.length > 160 ? '…' : ''}`);
}
if (missing) { console.log(`\n기준 그림 ${missing}개가 없어요. 경로를 고친 뒤 다시 실행하세요.`); process.exit(1); }
if (total > max) { console.log(`\n${total}장은 한 번에 만들 수 있는 ${max}장보다 많아요. --only로 나누거나 --max를 늘리세요.`); process.exit(1); }
if (flag('--dry-run')) { console.log('\n--dry-run: 요청은 보내지 않았어요.'); process.exit(0); }

const key = process.env.OPENAI_API_KEY || readEnvKey(join(HERE, '.env'));
if (!key) { console.log('\nOPENAI_API_KEY가 없어요. prototypes/tools/.env 파일에 OPENAI_API_KEY=... 한 줄을 넣으세요.'); process.exit(1); }
if (!flag('--yes')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`\n그림 ${total}장을 만들어요(사용량만큼 요금이 나가요). 계속할까요? (y/N) `)).trim().toLowerCase();
  rl.close();
  if (answer !== 'y') { console.log('취소했어요.'); process.exit(0); }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = join(HERE, 'out', stamp);
mkdirSync(outDir, { recursive: true });
const made = [];
for (const job of jobs) {
  process.stdout.write(`\n${job.name} 만드는 중… `);
  try {
    const images = await generate(job, key);
    images.forEach((png, i) => {
      const name = `${job.name}-${i + 1}.png`;
      writeFileSync(join(outDir, name), png);
      made.push({ job: job.name, file: name });
    });
    writeFileSync(join(outDir, `${job.name}.json`), JSON.stringify({ name: job.name, model: job.model, size: job.size, quality: job.quality, background: job.background, refs: job.refs.map(r => r.replace(REPO + '/', '')), prompt: job.prompt, made_at: new Date().toISOString() }, null, 2));
    console.log(`${images.length}장 저장`);
  } catch (err) { console.log(`실패: ${err.message}`); }
}
writeFileSync(join(outDir, 'index.html'), gallery(made, jobs));
console.log(`\n완료: ${made.length}장 → ${outDir}\n비교 화면: ${join(outDir, 'index.html')}`);

async function generate(job, apiKey) {
  const headers = { Authorization: `Bearer ${apiKey}` };
  let res;
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (job.refs.length) {
      const form = new FormData();
      for (const [k, v] of Object.entries({ model: job.model, prompt: job.prompt, n: String(job.n), size: job.size, quality: job.quality, background: job.background, output_format: 'png' })) form.append(k, v);
      for (const r of job.refs) form.append(job.refs.length > 1 ? 'image[]' : 'image', new Blob([readFileSync(r)], { type: mime(r) }), basename(r));
      res = await fetch(`${API}/images/edits`, { method: 'POST', headers, body: form, signal: AbortSignal.timeout(300000) });
    } else {
      res = await fetch(`${API}/images/generations`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: job.model, prompt: job.prompt, n: job.n, size: job.size, quality: job.quality, background: job.background, output_format: 'png' }), signal: AbortSignal.timeout(300000) });
    }
    if (res.ok || attempt === 2 || !(res.status === 429 || res.status >= 500)) break;
    await new Promise(r => setTimeout(r, 8000));
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Error(`HTTP ${res.status} ${String(body?.error?.message || '').slice(0, 200)}`);
  const out = [];
  for (const d of body.data || []) {
    if (d.b64_json) out.push(Buffer.from(d.b64_json, 'base64'));
    else if (d.url) out.push(Buffer.from(await (await fetch(d.url, { signal: AbortSignal.timeout(120000) })).arrayBuffer()));
  }
  if (!out.length) throw Error('그림이 오지 않았어요');
  return out;
}
function mime(path) { return { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }[extname(path).toLowerCase()] || 'application/octet-stream'; }
function readEnvKey(path) {
  if (!existsSync(path)) return '';
  const line = readFileSync(path, 'utf8').split(/\r?\n/).find(l => /^\s*OPENAI_API_KEY\s*=/.test(l));
  return line ? line.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '') : '';
}
function gallery(files, jobList) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const blocks = jobList.map(j => `<section><h2>${esc(j.name)}</h2><p>${esc(j.prompt)}</p><div class="row">${files.filter(f => f.job === j.name).map(f => `<figure><img src="${esc(f.file)}" alt=""><figcaption>${esc(f.file)}</figcaption></figure>`).join('') || '<em>실패</em>'}</div></section>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>펫 그림 비교</title><style>body{font:14px system-ui,sans-serif;margin:24px;color:#16241f}h2{margin:24px 0 4px}p{color:#5d6d68;max-width:900px}.row{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}img{max-width:460px;border:1px solid #dfe7e3;border-radius:10px;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/20px 20px}figcaption{font-size:12px;color:#6c7c77}</style><h1>펫 그림 비교</h1>${blocks}`;
}
