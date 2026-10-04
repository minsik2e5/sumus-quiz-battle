import { validateState, serializeState } from '../../../lib/state.ts';
const BUCKET='deal-hunter-v5-files';
// Server-only deployment defaults reuse the existing operating code hash.
// Optional environment overrides support code rotation without a frontend build.
const DEPLOYMENT_ACCESS_HASH='d99d773b047b8267da8617c81f5d847eb12c5522bda325f8721b54bc0b1d5f52';
const DEPLOYMENT_ORIGIN='https://deal-hunter-v5.wwzb-64.chatgpt.site';
const encoder=new TextEncoder();
function cors(origin:string) {
  return {'access-control-allow-origin':origin,'access-control-allow-methods':'GET,PUT,POST,OPTIONS','access-control-allow-headers':'content-type,x-deal-code','vary':'Origin'};
}
async function hash(text:string) {return [...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
function equal(a:string,b:string) {if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
async function limitedJson(req:Request,max=6000000) {
  const reader=req.body?.getReader();if(!reader)throw new Error('empty body');let size=0;const parts:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new Error('too large');}parts.push(value);}
  const data=new Uint8Array(size);let offset=0;for(const part of parts){data.set(part,offset);offset+=part.length;}return JSON.parse(new TextDecoder().decode(data));
}
function validKey(key:string) {return /^main\/[0-9a-f-]{36}-[^/]+$/i.test(key)&&!key.includes('..');}
async function db(path:string,init:RequestInit={}) {
  const base=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const headers=new Headers(init.headers);headers.set('authorization',`Bearer ${key}`);headers.set('apikey',key);if(init.body&&!(init.body instanceof Blob)&&!headers.has('content-type'))headers.set('content-type','application/json');
  const r=await fetch(base+path,{...init,headers,signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error(`Backend request failed (${r.status})`);
  return r.status===204?null:await r.json();
}
async function signed(key:string) {
  const result=await db(`/storage/v1/object/sign/${BUCKET}/${encodeURIComponent(key).replace(/%2F/g,'/')}`,{method:'POST',body:JSON.stringify({expiresIn:3600})});
  return Deno.env.get('SUPABASE_URL')+'/storage/v1'+result.signedURL;
}
function fileType(bytes:Uint8Array) {
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
  if(bytes.slice(0,8).every((b,i)=>b===[137,80,78,71,13,10,26,10][i])&&bytes.length>=8)return 'image/png';
  const prefix=new TextDecoder().decode(bytes.slice(0,12));
  if(prefix.startsWith('GIF87a')||prefix.startsWith('GIF89a'))return 'image/gif';
  if(prefix.startsWith('RIFF')&&prefix.slice(8,12)==='WEBP')return 'image/webp';
  if(prefix.startsWith('%PDF-'))return 'application/pdf';return '';
}
Deno.serve(async req=>{
  const origin=req.headers.get('origin')||'';
  const allowed=(Deno.env.get('DEAL_HUNTER_ALLOWED_ORIGINS')||DEPLOYMENT_ORIGIN).split(',').map(s=>s.trim()).filter(Boolean);
  const accepted=!origin||allowed.includes(origin);
  const headers=cors(accepted?origin:'null');
  const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{...headers,'cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(!accepted)return json({error:'허용되지 않은 주소입니다.'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  const expected=Deno.env.get('DEAL_HUNTER_ACCESS_HASH')||DEPLOYMENT_ACCESS_HASH;
  const code=req.headers.get('x-deal-code')||'';
  if(expected.length!==64)return json({error:'서버 접속 설정이 필요합니다.'},503);
  if(!code||code.length>256||!equal(await hash(code),expected))return json({error:'인증이 필요합니다.'},401);
  const url=new URL(req.url),route=url.searchParams.get('route')||'';
  try {
    if(route==='state'&&req.method==='GET'){
      const rows=await db('/rest/v1/deal_hunter_v5_state?workspace_id=eq.main&select=revision,state_json,updated_at');
      if(!rows.length)return json({error:'최초 저장 전입니다.'},404);
      return json({state:rows[0].state_json,revision:Number(rows[0].revision),updatedAt:rows[0].updated_at});
    }
    if(route==='state'&&req.method==='PUT'){
      const body=await limitedJson(req);validateState(body.state);
      if(![4,5,6].includes(body.state.schemaVersion))return json({error:"V5 저장 형식으로 변환한 원장을 사용해 주세요."},400);
      if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)return json({error:'버전을 확인해 주세요.'},400);
      const result=await db('/rest/v1/rpc/deal_hunter_v5_commit',{method:'POST',body:JSON.stringify({p_workspace:'main',p_expected:body.expectedRevision,p_state:JSON.parse(serializeState(body.state)),p_version:null})});
      return json(result,result.conflict?409:200);
    }
    if(route==='state/versions'&&req.method==='GET'){
      const rows=await db('/rest/v1/deal_hunter_v5_state_versions?workspace_id=eq.main&select=id,revision,created_at&order=id.desc&limit=30');
      return json({versions:rows.map((v:{id:number;revision:number;created_at:string})=>({id:v.id,revision:Number(v.revision),createdAt:v.created_at}))});
    }
    if(route==='state/versions'&&req.method==='POST'){
      const body=await limitedJson(req,5000);
      if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||!Number.isSafeInteger(body.versionId)||body.versionId<=0)return json({error:'복원 버전을 확인해 주세요.'},400);
      const result=await db('/rest/v1/rpc/deal_hunter_v5_commit',{method:'POST',body:JSON.stringify({p_workspace:'main',p_expected:body.expectedRevision,p_state:null,p_version:body.versionId})});
      return json(result,result.conflict?409:result.missing?404:200);
    }
    if(route==='files'&&req.method==='POST'){
      if(Number(req.headers.get('content-length'))>9000000)return json({error:'파일은 8MB 이하여야 합니다.'},413);
      const bytes=await req.arrayBuffer();if(bytes.byteLength>9000000)return json({error:'파일은 8MB 이하여야 합니다.'},413);
      const form=await new Response(bytes,{headers:{'content-type':req.headers.get('content-type')||''}}).formData(),file=form.get('file');
      if(!(file instanceof File)||file.size<=0||file.size>8000000)return json({error:'파일은 8MB 이하여야 합니다.'},400);
      const data=new Uint8Array(await file.arrayBuffer()),type=fileType(data);
      if(!type)return json({error:'사진 또는 PDF 파일만 보관할 수 있습니다.'},400);
      const name=file.name.replace(/[^0-9A-Za-z가-힣._-]/g,'_').replace(/\.\./g,'_').slice(-120)||'file';
      const key=`main/${crypto.randomUUID()}-${name}`;
      await db(`/storage/v1/object/${BUCKET}/${encodeURIComponent(key).replace(/%2F/g,'/')}`,{method:'POST',headers:{'content-type':type,'x-upsert':'false'},body:new Blob([data],{type})});
      return json({key,name:file.name,type,size:file.size,url:await signed(key)});
    }
    if(route==='files'&&req.method==='GET'){
      const key=url.searchParams.get('key')||'';if(!validKey(key))return json({error:'사진 키를 확인해 주세요.'},400);
      return json({url:await signed(key)});
    }
    if(route==='files/sign'&&req.method==='POST'){
      const {keys}=await limitedJson(req,20000);
      if(!Array.isArray(keys)||keys.length>50||!keys.every(k=>typeof k==='string'&&validKey(k)))return json({error:'사진 목록을 확인해 주세요.'},400);
      const urls:Record<string,string>={};
      for(const key of keys){try{urls[key]=await signed(key);}catch{/* Preserve inaccessible keys in the ledger. */}}
      return json({urls});
    }
    // No physical file deletion: older snapshots and copied items can still reference files.
    return json({error:'지원하지 않는 요청입니다.'},405);
  } catch(error) {
    const message=error instanceof Error?error.message:'';
    if(error instanceof DOMException && ['TimeoutError','AbortError'].includes(error.name))return json({error:'서버 연결이 지연되고 있습니다. 변경은 보존되며 다시 시도할 수 있습니다.'},503);
    if(message==='too large')return json({error:'원장 용량 한도를 초과했습니다. 사진 포함 백업은 사진을 업로드한 뒤 복원하세요.'},413);
    if(error instanceof SyntaxError||!message.startsWith('Backend request failed'))return json({error:message||'요청을 확인해 주세요.'},400);
    return json({error:'서버 저장소 요청에 실패했습니다. 현재 변경을 보존하고 다시 시도해 주세요.'},503);
  }
});
