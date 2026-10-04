// Run against an owner-private deployment; credentials arrive on stdin only.
// Never changes a product value. Concurrent writes and restore use identical snapshots.
import fs from 'node:fs';import assert from 'node:assert/strict';
if(process.stdin.isTTY)process.stdin.setRawMode(true);let input='';for await(const chunk of process.stdin){input+=chunk;if(input.includes('\n'))break;}const {url,code,serviceToken,statePath}=JSON.parse(input);
const initial=JSON.parse(fs.readFileSync(statePath,'utf8')),checks=[],latencies=[];
const headers={'OAI-Sites-Authorization':`Bearer ${serviceToken}`,'x-deal-code':code};
async function api(route,method='GET',data,extra={}){const u=new URL('/api/cloud',url);u.searchParams.set('route',route);const start=Date.now();const r=await fetch(u,{method,headers:{...headers,...(data?{'content-type':'application/json'}:{}),...extra},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(30000)});latencies.push(Date.now()-start);return {status:r.status,data:await r.json()};}
assert.equal((await api('state','GET',null,{'x-deal-code':'wrong-code'})).status,401);checks.push('invalid operating code refused');
assert.equal((await api('state','GET',null,{origin:'https://other.example'})).status,403);checks.push('foreign origin refused');
let r=await api('state');if(r.status===404){assert.equal((await api('state')).status,404);checks.push('GET does not initialize empty ledger');r=await api('state','PUT',{expectedRevision:0,state:initial});assert.equal(r.status,200);checks.push('explicit initial import');}else assert.equal(r.status,200);
r=await api('state');assert.equal(r.status,200);assert.deepEqual(r.data.state,initial);assert.equal(r.data.state.items.length,164);checks.push('164 master records and all missing values match exactly');
let revision=r.data.revision;const pair=await Promise.all([api('state','PUT',{expectedRevision:revision,state:initial}),api('state','PUT',{expectedRevision:revision,state:initial})]);assert.deepEqual(pair.map(p=>p.status).sort(),[200,409]);checks.push('two simultaneous writers: one commit, one conflict');
r=await api('state');assert.deepEqual(r.data.state,initial);assert.equal(r.data.revision,revision+1);revision=r.data.revision;
const versions=await api('state/versions');assert.equal(versions.status,200);const previous=versions.data.versions.find(v=>v.revision===revision-1);assert(previous);checks.push('previous snapshot retained');
const restored=await api('state/versions','POST',{expectedRevision:revision,versionId:previous.id});assert.equal(restored.status,200);assert.deepEqual(restored.data.state,initial);revision=restored.data.revision;checks.push('restore preserves identical ledger');
const after=await api('state/versions');assert(after.data.versions.some(v=>v.revision===revision-1));checks.push('pre-restore version retained');
assert.equal((await api('state','PUT',{expectedRevision:0,state:initial})).status,409);checks.push('stale revision cannot overwrite ledger');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4U0AAAAASUVORK5CYII=','base64');const form=new FormData();form.set('file',new File([png],'v5-storage-verification.png',{type:'image/png'}));
const upload=await fetch(new URL('/api/cloud?route=files',url),{method:'POST',headers,body:form,signal:AbortSignal.timeout(30000)});assert.equal(upload.status,200);const photo=await upload.json();
const downloaded=await fetch(photo.url,{headers:{'OAI-Sites-Authorization':`Bearer ${serviceToken}`}});assert.equal(downloaded.status,200);assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),png);checks.push('private R2 photo byte round-trip');
const forged=new URL(photo.url);forged.searchParams.set('sig','forged');assert.equal((await fetch(forged,{headers:{'OAI-Sites-Authorization':`Bearer ${serviceToken}`}})).status,403);checks.push('forged photo signature refused');
assert.equal((await api('files/sign','POST',{keys:['other/file.png']})).status,400);assert.equal((await api('files','DELETE')).status,405);checks.push('cross-workspace photo keys and physical deletion refused');
r=await api('state');assert.deepEqual(r.data.state,initial);checks.push('final cloud ledger unchanged; actual price reductions zero');
const report={date:new Date().toISOString(),url,passed:checks.length,checks,finalRevision:r.data.revision,apiLatencyMs:latencies,originalProductValuesChanged:0,actualPriceReductions:0,testPhotoAttachedToLedger:false};
fs.writeFileSync('docs/live-cloud-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
