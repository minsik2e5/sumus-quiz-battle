// Sweet Survival V0.12 scheduler hotfix loader
// The original scheduler excludes the previous hazard. In stage 1 only hazard 0 is unlocked,
// so the second schedule slot became undefined and the whole future timeline turned into NaN.
// Patch the source before execution so stage 1 can repeat its only unlocked hazard and later stages continue normally.

const SOURCE_URL = '/student-v012.js?v=12';

async function boot(){
  const response = await fetch(SOURCE_URL,{cache:'no-store'});
  if(!response.ok) throw new Error(`Failed to load game source: ${response.status}`);
  let source = await response.text();

  const broken = "const type=options[Math.floor(rnd()*options.length)],diff=1+Math.min(1.8,t/100000),warn=1000+Math.floor(rnd()*320);";
  const fixed = "if(!options.length){for(let i=0;i<count;i++)options.push(i)}const type=options[Math.floor(rnd()*options.length)],diff=1+Math.min(1.8,t/100000),warn=1000+Math.floor(rnd()*320);";

  if(!source.includes(broken)){
    console.warn('[Sweet Survival] Scheduler patch target not found; booting source unchanged.');
  }else{
    source = source.replace(broken,fixed);
    console.info('[Sweet Survival] Scheduler hotfix applied: stage progression restored.');
  }

  const blob = new Blob([source],{type:'text/javascript'});
  const url = URL.createObjectURL(blob);
  try{
    await import(url);
  } finally {
    // Keep the URL alive through module initialization, then release it.
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}

boot().catch(err=>{
  console.error('[Sweet Survival] Boot failed',err);
  const target=document.getElementById('joinError');
  if(target) target.textContent='게임을 불러오지 못했습니다. 새로고침해주세요.';
});
