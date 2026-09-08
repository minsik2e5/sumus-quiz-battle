// Sweet Survival V0.15 · CHAOS EVENTS loader
// Layers reactive arena events on top of the stable V0.14 FINAL RUSH loader:
// reversing sweep, moving safe zone, floor drop, fake alerts, and jump jam.

const PARENT_URL='/student-v014-loader.js?v=15-parent';

async function boot(){
  const response=await fetch(PARENT_URL,{cache:'no-store'});
  if(!response.ok)throw new Error(`Failed to load parent loader: ${response.status}`);
  let loader=await response.text();

  const marker="  console.info('[Sweet Survival V0.14] FINAL RUSH patches:',applied.join(', '));";
  if(!loader.includes(marker))throw new Error('V0.14 injection marker not found');

  const injection=String.raw`
  // ---- V0.15 CHAOS EVENTS ----
  patch(
    "const particles=[];",
    \`const chaosFx=new THREE.Group();scene.add(chaosFx);
const safeZone=new THREE.Mesh(new THREE.CircleGeometry(1.52,48),new THREE.MeshBasicMaterial({color:0x64f2b9,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));safeZone.rotation.x=-Math.PI/2;safeZone.position.y=.465;chaosFx.add(safeZone);
const safeZoneRing=new THREE.Mesh(new THREE.TorusGeometry(1.52,.055,8,72),new THREE.MeshBasicMaterial({color:0xc8ffe8,transparent:true,opacity:0,depthWrite:false}));safeZoneRing.rotation.x=Math.PI/2;safeZoneRing.position.y=.49;chaosFx.add(safeZoneRing);
const collapseGroup=new THREE.Group();scene.add(collapseGroup);const collapseSectors=[];
for(let i=0;i<8;i++){const m=new THREE.Mesh(new THREE.RingGeometry(.18,5.13,40,1,i*Math.PI/4,Math.PI/4*.93),new THREE.MeshBasicMaterial({color:0xff536f,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.455;collapseGroup.add(m);collapseSectors.push(m)}
let safeShown=-1,collapseShown=-1,jamShown=-1,fakeShown=-1;
function safeEvent(ms){const rel=ms-36000;if(rel<0)return null;const idx=Math.floor(rel/21000),local=rel%21000;const r=rng32((seed^(idx*2654435761))>>>0),base=r()*Math.PI*2,rr=1.6+r()*1.3,ang=base+Math.sin(local*.0013)*.38;return{idx,local,x:Math.cos(ang)*rr,z:Math.sin(ang)*rr,r:1.52}}
function collapseEvent(ms){const rel=ms-49000;if(rel<0)return null;const idx=Math.floor(rel/26000),local=rel%26000,base=Math.abs(((seed>>>3)+idx*3)%8);return{idx,local,bad:[base,(base+3)%8,(base+6)%8]}}
function jumpLocked(ms){const rel=ms-61000;if(rel<0)return false;const local=rel%19000;return local>=1550&&local<4200}
function resetChaos(){safeZone.material.opacity=0;safeZoneRing.material.opacity=0;safeZone.position.set(0,.465,0);safeZoneRing.position.set(0,.49,0);for(const m of collapseSectors){m.material.opacity=0;m.position.y=.455}safeShown=collapseShown=jamShown=fakeShown=-1;jumpBtn.style.filter='';jumpBtn.style.opacity=''}
function chaosTick(ms,dt,st){
  const se=safeEvent(ms);
  if(se&&se.local<5600){
    safeZone.position.set(se.x,.465,se.z);safeZoneRing.position.set(se.x,.49,se.z);
    const pulse=.76+.16*Math.sin(ms*.012);safeZone.material.opacity=se.local<2400?.16:.25;safeZoneRing.material.opacity=pulse;
    if(se.local<120&&safeShown!==se.idx){safeShown=se.idx;showWarn('MOVING SAFE ZONE')}
    if(se.local>=3200&&se.local<4400&&state.alive&&Math.hypot(state.x-se.x,state.z-se.z)>se.r-.08)eliminate();
  }else{safeZone.material.opacity*=.88;safeZoneRing.material.opacity*=.88}

  const ce=collapseEvent(ms);
  if(ce&&ce.local<4300){
    if(ce.local<120&&collapseShown!==ce.idx){collapseShown=ce.idx;showWarn('FLOOR DROP')}
    collapseSectors.forEach((m,i)=>{const bad=ce.bad.includes(i);m.material.opacity=bad?(ce.local<2300?.22+.16*Math.sin(ms*.018):.58):0;m.position.y=bad&&ce.local>2300?.455-Math.min(.7,(ce.local-2300)/850*.7):.455});
    if(ce.local>=2500&&ce.local<3300&&state.alive){let a=Math.atan2(state.z,state.x);if(a<0)a+=Math.PI*2;const sector=Math.floor((a/(Math.PI*2))*8)%8;if(ce.bad.includes(sector)&&Math.hypot(state.x,state.z)>.32)eliminate()}
  }else for(const m of collapseSectors){m.material.opacity*=.82;m.position.y=THREE.MathUtils.lerp(m.position.y,.455,.18)}

  if(st>=6){const rel=ms-61000,idx=rel>=0?Math.floor(rel/19000):-1,local=rel>=0?rel%19000:0;if(idx>=0&&local<120&&jamShown!==idx){jamShown=idx;showWarn('JUMP JAM')}const jam=jumpLocked(ms);jumpBtn.style.filter=jam?'grayscale(.75) brightness(.72) saturate(.6)':'';jumpBtn.style.opacity=jam?'.58':''}

  if(st>=4){const rel=ms-33000,idx=rel>=0?Math.floor(rel/31000):-1,local=rel>=0?rel%31000:0;if(idx>=0&&local<90&&fakeShown!==idx){fakeShown=idx;showWarn('⚠ FAKE ALERT');setTimeout(()=>{if(state.alive)showWarn('JUST KIDDING!')},720)}}
}
const particles=[];\`,
    'chaos event system'
  );

  patch(
    "h.group.rotation.y=h.speed*sec;",
    "const reverseWobble=h.speed>1.02?Math.sin(sec*(2.05+Math.min(.75,h.speed*.16)))*(1.02+Math.min(.55,h.speed*.12)):0;h.group.rotation.y=h.speed*sec+reverseWobble;",
    'sweeper reversal'
  );

  patch(
    "function jump(){if(!state.alive||pauseStartedAt)return;state.jumpBuf=.14;sfx('jump');jumpBtn.style.transform='scale(.92)';setTimeout(()=>jumpBtn.style.transform='',90)}",
    "function jump(){if(!state.alive||pauseStartedAt)return;if(jumpLocked(elapsedMs())){cameraShake=Math.max(cameraShake,.12);tone(120,.08,'square',.025,-25);jumpBtn.style.transform='scale(.86)';setTimeout(()=>jumpBtn.style.transform='',90);return}state.jumpBuf=.14;sfx('jump');jumpBtn.style.transform='scale(.92)';setTimeout(()=>jumpBtn.style.transform='',90)}",
    'jump jam control'
  );

  patch(
    "shrinkRing.material.opacity=st<5?.10:.32+.13*Math.sin(ms*.008);spawnDue(ms);",
    "shrinkRing.material.opacity=st<5?.10:.32+.13*Math.sin(ms*.008);chaosTick(ms,dt,st);spawnDue(ms);",
    'chaos runtime'
  );

  patch(
    "function resetGame(){limit=baseLimit;shrinkRing.scale.setScalar(1);shrinkRing.material.opacity=.1;state.x=0;state.z=3.6;",
    "function resetGame(){limit=baseLimit;shrinkRing.scale.setScalar(1);shrinkRing.material.opacity=.1;resetChaos();state.x=0;state.z=3.6;",
    'chaos reset'
  );

`;

  loader=loader.replace(marker,injection+"\n"+marker.replace('V0.14','V0.15'));
  loader=loader.replaceAll('[Sweet Survival V0.14]','[Sweet Survival V0.15]');
  const blob=new Blob([loader],{type:'text/javascript'});
  const url=URL.createObjectURL(blob);
  try{await import(url)}finally{setTimeout(()=>URL.revokeObjectURL(url),1200)}
}

boot().catch(err=>{
  console.error('[Sweet Survival V0.15] Boot failed',err);
  const target=document.getElementById('joinError');
  if(target)target.textContent='게임을 불러오지 못했습니다. 새로고침해주세요.';
});
