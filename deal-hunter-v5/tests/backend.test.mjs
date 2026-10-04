import test from 'node:test';
import assert from 'node:assert/strict';
let handler;const code='fixture-only-code';const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code));
const env={SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-service-key',DEAL_HUNTER_ALLOWED_ORIGINS:'https://fixture-site.invalid',DEAL_HUNTER_ACCESS_HASH:[...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,'0')).join('')};
globalThis.Deno={env:{get:key=>env[key]},serve:fn=>handler=fn};
await import('../supabase/functions/deal-hunter-v5-api/index.ts');
let calls=[],stored=null,revision=0;
globalThis.fetch=async (url,init={})=>{
 calls.push({url,init});
 if(url.includes('/rpc/')){const b=JSON.parse(init.body);if(b.p_expected!==revision)return Response.json({conflict:true,revision});stored=b.p_state;revision++;return Response.json({conflict:false,revision,updatedAt:new Date().toISOString()});}
 if(url.includes('/deal_hunter_v5_state?'))return Response.json(stored?[{revision,state_json:stored,updated_at:'2026-10-01'}]:[]);
 return Response.json({signedURL:'/object/sign/fixture?token=fixture'});
};
const request=(route,method='GET',body,overrides={})=>new Request(`https://fixture.invalid/functions/v1/deal-hunter-v5-api?route=${route}`,{method,headers:{origin:'https://fixture-site.invalid','x-deal-code':code,...(body?{'content-type':'application/json'}:{}),...overrides},body:body?JSON.stringify(body):undefined});
test('API refuses invalid auth and disallowed origins without touching storage',async()=>{calls=[];assert.equal((await handler(request('state','GET',undefined,{'x-deal-code':'bad'}))).status,401);assert.equal((await handler(request('state','GET',undefined,{origin:'https://untrusted.invalid'}))).status,403);assert.equal(calls.length,0);});
test('GET of empty ledger does not seed or write data',async()=>{calls=[];assert.equal((await handler(request('state'))).status,404);assert(calls.every(c=>!c.init.method||c.init.method==='GET'));});
test('API validates amounts, duplicates and expected revision before commit',async()=>{calls=[];for(const body of [{state:{schemaVersion:6,items:[{id:'x'},{id:'x'}]},expectedRevision:0},{state:{schemaVersion:6,items:[{id:'x',purchasePrice:-1}]},expectedRevision:0},{state:{schemaVersion:6,items:[]},expectedRevision:-1}])assert.equal((await handler(request('state','PUT',body))).status,400);assert.equal(calls.length,0);});
test('state writes go through transactional RPC; stale revisions conflict',async()=>{const body={state:{schemaVersion:6,items:[{id:'REAL-1',purchasePrice:50000}]},expectedRevision:0};assert.equal((await handler(request('state','PUT',body))).status,200);assert.equal((await handler(request('state','PUT',body))).status,409);assert(calls.filter(c=>c.init.method==='POST').every(c=>c.url.endsWith('/rpc/deal_hunter_v5_commit')));});
test('API refuses traversal and cross-workspace image keys',async()=>{calls=[];assert.equal((await handler(request('files/sign','POST',{keys:['other/a']}))).status,400);assert.equal((await handler(new Request('https://fixture.invalid?route=files&key=main/../secret',{headers:{'x-deal-code':code}}))).status,400);assert.equal(calls.length,0);});
test('API has no file deletion endpoint, protecting older backups',async()=>{assert.equal((await handler(request('files','DELETE'))).status,405);});
