import { serializeState } from './state';
const endpoint = import.meta.env.VITE_DEAL_HUNTER_API_URL || '';
let code = '';
export function setAccessCode(value:string) { code = value; }
export function cloudConfigured() { return Boolean(endpoint); }
export async function apiFetch(path:string, init:RequestInit = {}):Promise<Response> {
  if (!endpoint) return Response.json({error:'서버 주소가 설정되지 않았습니다.'},{status:503});
  const url = new URL(endpoint,window.location.origin);
  url.searchParams.set('route',path.split('?')[0].replace('/api/',''));
  for (const [key,value] of new URLSearchParams(path.split('?')[1] || '')) url.searchParams.set(key,value);
  const headers = new Headers(init.headers); headers.set('x-deal-code',code);
  const controller = new AbortController();
  const abort = () => controller.abort();
  init.signal?.addEventListener('abort',abort,{once:true});
  const timer = setTimeout(abort,15000);
  try { return await fetch(url,{...init,headers,signal:controller.signal,cache:'no-store'}); }
  finally { clearTimeout(timer); init.signal?.removeEventListener('abort',abort); }
}
export async function hydrateFiles<T>(state:T):Promise<T> {
  const copy = JSON.parse(serializeState(state));
  const files = new Map<string,Record<string,unknown>[]>();
  for (const item of copy.items || []) for (const attachment of [...(item.attachments || []),...(item.productPhotos || [])]) {
    if (attachment.key?.startsWith('main/')) files.set(attachment.key,[...(files.get(attachment.key)||[]),attachment]);
  }
  const keys = [...files.keys()];
  for (let start=0;start<keys.length;start+=50) {
    try {
      const response = await apiFetch('/api/files/sign',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({keys:keys.slice(start,start+50)})});
      if (!response.ok) continue;
      const {urls} = await response.json();
      for (const [key,url] of Object.entries(urls || {})) for (const attachment of files.get(key) || []) attachment.url = url;
    } catch { /* Keep original file references; never discard unavailable photos. */ }
  }
  return copy;
}
