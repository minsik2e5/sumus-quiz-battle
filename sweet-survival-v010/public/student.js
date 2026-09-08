import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

const $ = s => document.querySelector(s);
const joinPage=$('#joinPage'), lobbyPage=$('#lobbyPage'), gamePage=$('#gamePage');
const roomInput=$('#roomInput'), nameInput=$('#nameInput'), joinBtn=$('#joinBtn'), joinError=$('#joinError');
const readyBtn=$('#readyBtn'), studentCode=$('#studentCode'), studentName=$('#studentName'), lobbySummary=$('#lobbySummary');
const gameName=$('#gameName'), gameRoom=$('#gameRoom'), gameNet=$('#gameNet');
const view=$('#view'), timeEl=$('#time'), stageEl=$('#stage'), aliveHud=$('#aliveHud');
const countdown=$('#countdown'), countText=$('#countText'), warning=$('#warning'), warningName=$('#warningName');
const dead=$('#dead'), deadResult=$('#deadResult'), paused=$('#paused');
const joy=$('#joy'), knob=$('#knob'), jumpBtn=$('#jump'), audioBtn=$('#audioBtn');
const stageBanner=$('#stageBanner'), stageBannerText=$('#stageBannerText');

const q = new URLSearchParams(location.search);
if(q.get('room')) roomInput.value=q.get('room');

let code='', playerId='', playerToken='', room=null, events=null;
let roundId=0, seed=0, startAt=0, pausedAccumMs=0, pauseStartedAt=null, ready=false;
let lastStage=1, stageBannerTimer=null;

function show(p){ joinPage.classList.add('hidden'); lobbyPage.classList.add('hidden'); gamePage.classList.add('hidden'); p.classList.remove('hidden'); }
async function post(url,data){
  const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
  const j=await r.json(); if(!j.ok) throw new Error(j.error); return j;
}
function fmt(ms){ return (Math.max(0,ms)/1000).toFixed(2); }
function elapsedMs(){ if(!startAt)return 0; const end=pauseStartedAt||Date.now(); return Math.max(0,end-startAt-pausedAccumMs); }

function updateRoom(r){
  room=r;
  const ps=r.players.filter(p=>p.connected), me=r.players.find(p=>p.id===playerId);
  ready=!!me?.ready;
  const readyCount=ps.filter(p=>p.ready).length;
  lobbySummary.textContent=`${ps.length}/20 접속 · ${readyCount} READY`;
  readyBtn.classList.toggle('is-ready',ready);
  readyBtn.querySelector('b').textContent=ready?'READY ✓':'READY';
  readyBtn.querySelector('small').textContent=ready?'준비 완료 · 시작을 기다려요':'준비되면 눌러주세요';
  aliveHud.textContent=`${ps.filter(p=>p.alive).length} / ${ps.length}`;
  pausedAccumMs=r.pausedAccumMs||0;
  pauseStartedAt=r.phase==='paused'?r.pauseStartedAt:null;
  paused.classList.toggle('hidden',r.phase!=='paused');
}

function connectEvents(){
  if(events)events.close();
  events=new EventSource(`/api/events?role=student&code=${encodeURIComponent(code)}&playerId=${encodeURIComponent(playerId)}&token=${encodeURIComponent(playerToken)}`);
  events.onopen=()=>{ gameNet.innerHTML='<i></i> LIVE'; };
  events.onerror=()=>{ gameNet.innerHTML='<i style="background:#ffbd63"></i> RECONNECT'; };
  events.addEventListener('room:state',e=>updateRoom(JSON.parse(e.data)));
  events.addEventListener('round:scheduled',e=>{
    const d=JSON.parse(e.data); roundId=d.roundId; seed=d.seed; startAt=d.startAt; pausedAccumMs=0; pauseStartedAt=null;
    resetGame(); show(gamePage); countdown.classList.remove('hidden'); sfx('ready');
  });
  events.addEventListener('round:start',()=>{ countdown.classList.add('hidden'); sfx('go'); });
  events.addEventListener('round:pause',e=>{ pauseStartedAt=JSON.parse(e.data).at; paused.classList.remove('hidden'); });
  events.addEventListener('round:resume',e=>{ const d=JSON.parse(e.data); pausedAccumMs=d.pausedAccumMs||0; pauseStartedAt=null; paused.classList.add('hidden'); sfx('resume'); });
  events.addEventListener('round:reset',()=>{ ready=false; show(lobbyPage); dead.classList.add('hidden'); });
  events.addEventListener('round:finished',e=>{
    const d=JSON.parse(e.data);
    if(state.alive){ dead.classList.remove('hidden'); deadResult.textContent=d.winner?.id===playerId?'👑 WINNER!':`ROUND END · ${fmt(d.elapsedMs)}`; sfx(d.winner?.id===playerId?'win':'result'); }
  });
}

joinBtn.onclick=async()=>{
  joinError.textContent=''; code=roomInput.value.trim(); const name=nameInput.value.trim();
  if(!/^\d{6}$/.test(code)) return joinError.textContent='6자리 방 코드를 입력하세요.';
  if(!name) return joinError.textContent='이름을 입력하세요.';
  try{
    unlockAudio();
    const j=await post('/api/student/join',{code,name});
    playerId=j.playerId; playerToken=j.playerToken; room=j.room;
    studentCode.textContent=code; studentName.textContent=name; gameName.textContent=name; gameRoom.textContent=`ROOM ${code}`;
    show(lobbyPage); updateRoom(room); connectEvents(); sfx('join');
  }catch(e){ joinError.textContent=e.message; }
};
readyBtn.onclick=async()=>{ try{ unlockAudio(); await post('/api/student/ready',{code,playerId,playerToken,ready:!ready}); sfx('tap'); }catch(e){ joinError.textContent=e.message; } };

let audioCtx=null, muted=false;
function unlockAudio(){ try{ if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended')audioCtx.resume(); }catch{} }
function tone(freq,dur=.08,type='sine',gain=.04,slide=0){ if(muted||!audioCtx)return; const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type=type;o.frequency.setValueAtTime(freq,audioCtx.currentTime); if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),audioCtx.currentTime+dur);g.gain.setValueAtTime(gain,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+dur);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur); }
function sfx(name){
  unlockAudio();
  if(name==='jump'){tone(380,.09,'sine',.035,220);tone(610,.07,'triangle',.018,80)}
  else if(name==='land'){tone(120,.06,'triangle',.025,-45)}
  else if(name==='warn'){tone(720,.07,'square',.018,-180);setTimeout(()=>tone(620,.08,'square',.014,-120),90)}
  else if(name==='hit'){tone(170,.18,'sawtooth',.05,-90);tone(75,.22,'triangle',.04,-30)}
  else if(name==='go'){tone(520,.08,'triangle',.03,160);setTimeout(()=>tone(820,.12,'triangle',.03,120),90)}
  else if(name==='ready'){tone(330,.08,'triangle',.018,90)}
  else if(name==='stage'){tone(520,.08,'triangle',.025,160);setTimeout(()=>tone(760,.11,'triangle',.025,120),80)}
  else if(name==='win'){[520,660,820,1040].forEach((f,i)=>setTimeout(()=>tone(f,.13,'triangle',.03,80),i*90))}
  else if(name==='join'||name==='tap'||name==='resume'){tone(520,.05,'sine',.018,80)}
  else if(name==='result'){tone(380,.08,'triangle',.02,-80)}
}
audioBtn.onclick=()=>{ unlockAudio(); muted=!muted; audioBtn.textContent=muted?'🔇':'🔊'; };

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x23173d);
scene.fog=new THREE.FogExp2(0x291847,.018);
const camera=new THREE.PerspectiveCamera(43,1,.1,120);
const cameraBase=new THREE.Vector3(0,10.8,13.2); camera.position.copy(cameraBase); camera.lookAt(0,.45,0);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.45)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.25; view.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffeaf7,0x241431,2.5));
const sun=new THREE.DirectionalLight(0xfff4df,4.5); sun.position.set(-5,11,7); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); scene.add(sun);
const rim=new THREE.PointLight(0xb479ff,18,24,2);rim.position.set(5,6,-7);scene.add(rim);

const arena=new THREE.Group();scene.add(arena);
const base=new THREE.Mesh(new THREE.CylinderGeometry(6.35,6.75,1.45,64),new THREE.MeshStandardMaterial({color:0xe7a489,roughness:.82}));base.position.y=-.78;base.receiveShadow=true;arena.add(base);
const creamRing=new THREE.Mesh(new THREE.CylinderGeometry(6.20,6.38,.38,64),new THREE.MeshStandardMaterial({color:0xfff0d4,roughness:.72}));creamRing.position.y=-.08;arena.add(creamRing);
const turf=new THREE.Mesh(new THREE.CylinderGeometry(6.02,6.12,.42,64),new THREE.MeshStandardMaterial({color:0x87d884,roughness:.72}));turf.position.y=.18;turf.receiveShadow=true;arena.add(turf);
const innerRing=new THREE.Mesh(new THREE.RingGeometry(4.8,5.62,64),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.05,side:THREE.DoubleSide}));innerRing.rotation.x=-Math.PI/2;innerRing.position.y=.41;arena.add(innerRing);

const candyColors=[0xffbed7,0xffdfa6,0xc8afff,0x99e0ff,0xff9f9f];
for(let i=0;i<48;i++){const a=i/48*Math.PI*2,o=new THREE.Mesh(new THREE.SphereGeometry(.35,12,9),new THREE.MeshStandardMaterial({color:candyColors[i%candyColors.length],roughness:.45}));o.position.set(Math.cos(a)*6.22,.37,Math.sin(a)*6.22);o.scale.set(1.18,.7,.9);o.rotation.y=a;o.castShadow=true;arena.add(o)}

const decor=new THREE.Group();scene.add(decor);
for(let i=0;i<16;i++){
  const a=i/16*Math.PI*2,rr=8.2+(i%3)*.7;
  const stick=new THREE.Mesh(new THREE.CylinderGeometry(.06,.075,1.8,8),new THREE.MeshStandardMaterial({color:0xfff2e3,roughness:.55}));stick.position.set(Math.cos(a)*rr,.65,Math.sin(a)*rr);decor.add(stick);
  const candy=new THREE.Mesh(new THREE.TorusGeometry(.38,.18,10,24),new THREE.MeshStandardMaterial({color:candyColors[(i+1)%candyColors.length],roughness:.36,metalness:.03}));candy.position.set(Math.cos(a)*rr,1.55,Math.sin(a)*rr);candy.rotation.y=-a;candy.rotation.x=.25;decor.add(candy);
}
for(let i=0;i<28;i++){const a=i/28*Math.PI*2,rr=10+(i%4)*1.1;const star=new THREE.Mesh(new THREE.OctahedronGeometry(.07+(i%3)*.025),new THREE.MeshBasicMaterial({color:i%2?0xffe49b:0xcbb7ff,transparent:true,opacity:.6}));star.position.set(Math.cos(a)*rr,2.5+(i%5)*.65,Math.sin(a)*rr);decor.add(star)}

const player=new THREE.Group();scene.add(player);
const yellow=new THREE.MeshStandardMaterial({color:0xffd867,roughness:.38}),cream=new THREE.MeshStandardMaterial({color:0xfff1d5,roughness:.45}),dark=new THREE.MeshStandardMaterial({color:0x3b2630,roughness:.7}),pink=new THREE.MeshStandardMaterial({color:0xff8da7,roughness:.45});
const bodyMesh=new THREE.Mesh(new THREE.SphereGeometry(.43,24,18),yellow);bodyMesh.scale.set(.98,1.05,.92);bodyMesh.position.y=-.04;bodyMesh.castShadow=true;player.add(bodyMesh);
const head=new THREE.Mesh(new THREE.SphereGeometry(.39,24,18),yellow);head.position.y=.46;head.scale.set(1.03,.95,1);head.castShadow=true;player.add(head);
const belly=new THREE.Mesh(new THREE.SphereGeometry(.24,18,14),cream);belly.position.set(0,-.06,.37);belly.scale.set(.9,1,.36);player.add(belly);
const earG=new THREE.SphereGeometry(.13,12,9),ear1=new THREE.Mesh(earG,yellow),ear2=ear1.clone();ear1.scale.set(.72,2.1,.8);ear2.scale.copy(ear1.scale);ear1.position.set(-.22,.82,.01);ear2.position.set(.22,.82,.01);player.add(ear1,ear2);
const eyeG=new THREE.SphereGeometry(.036,8,6),eye1=new THREE.Mesh(eyeG,dark),eye2=eye1.clone();eye1.position.set(-.13,.52,.35);eye2.position.set(.13,.52,.35);player.add(eye1,eye2);
const cheekG=new THREE.SphereGeometry(.05,8,6),ch1=new THREE.Mesh(cheekG,pink),ch2=ch1.clone();ch1.position.set(-.25,.4,.34);ch2.position.set(.25,.4,.34);ch1.scale.set(1.2,.7,.4);ch2.scale.copy(ch1.scale);player.add(ch1,ch2);
const armG=new THREE.CapsuleGeometry(.07,.28,4,8),arm1=new THREE.Mesh(armG,yellow),arm2=arm1.clone();arm1.position.set(-.42,.08,0);arm2.position.set(.42,.08,0);arm1.rotation.z=.25;arm2.rotation.z=-.25;player.add(arm1,arm2);
const legG=new THREE.CapsuleGeometry(.08,.18,4,8),leg1=new THREE.Mesh(legG,yellow),leg2=leg1.clone();leg1.position.set(-.18,-.47,0);leg2.position.set(.18,-.47,0);player.add(leg1,leg2);
const tail=new THREE.Mesh(new THREE.SphereGeometry(.18,12,9),yellow);tail.position.set(0,-.05,-.39);tail.scale.set(1.2,.8,.8);player.add(tail);
const badge=new THREE.Mesh(new THREE.OctahedronGeometry(.08),new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffe799,emissiveIntensity:1.1}));badge.position.set(0,.08,.44);badge.scale.set(1.2,1.2,.45);player.add(badge);
const shadow=new THREE.Mesh(new THREE.CircleGeometry(.53,28),new THREE.MeshBasicMaterial({color:0x251633,transparent:true,opacity:.25,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.39;scene.add(shadow);

const particles=[];
function particleBurst(x,y,z,color=0xffffff,count=10,power=1){
  for(let i=0;i<count;i++){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.035+(i%3)*.012,6,5),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9}));mesh.position.set(x,y,z);scene.add(mesh);const a=Math.random()*Math.PI*2,s=.7+Math.random()*power;particles.push({mesh,vx:Math.cos(a)*s,vy:.6+Math.random()*1.2,vz:Math.sin(a)*s,life:.45+Math.random()*.35,max:.8})}
}
function tickParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.vy-=2.7*dt;p.mesh.position.x+=p.vx*dt;p.mesh.position.y+=p.vy*dt;p.mesh.position.z+=p.vz*dt;p.mesh.material.opacity=Math.max(0,p.life/p.max);p.mesh.scale.setScalar(.6+p.life);if(p.life<=0){scene.remove(p.mesh);particles.splice(i,1)}}}

const state={x:0,z:3.6,jy:0,vy:0,ground:true,jumpBuf:0,alive:true,moving:false};
const joyVec={x:0,y:0},keys=new Set(),hazards=[];
const groundY=.92,limit=5.05,radius=.32,gravity=-17.8,jumpV=6.7;
let cameraShake=0,runPhase=0,landCooldown=0;

function rng32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function stageFor(ms){const t=ms/1000;if(t<20)return 1;if(t<42)return 2;if(t<68)return 3;if(t<98)return 4;if(t<132)return 5;return 6}
function scheduleFor(seed,maxMs=220000){const rnd=rng32(seed),life=[5200,3800,3600,3100,3800];let t=2500,last=-1;const arr=[];while(t<maxMs){const st=stageFor(t),unlocked=Math.min(5,1+Math.floor((st-1)*.9));let options=[];for(let i=0;i<unlocked;i++)if(i!==last)options.push(i);if(!options.length)options=[0];const type=options[Math.floor(rnd()*options.length)],diff=1+Math.min(1.45,t/120000),warn=1100+Math.floor(rnd()*250);arr.push({type,start:t,warn,diff,seed:Math.floor(rnd()*1e9),spawned:false});last=type;const gap=Math.max(900,1350-t*.002);t+=warn+life[type]+gap+Math.floor(rnd()*250)}return arr}

let schedule=[];
function clearHazards(){while(hazards.length){const h=hazards.pop();scene.remove(h.group)}}
function resetGame(){state.x=0;state.z=3.6;state.jy=0;state.vy=0;state.ground=true;state.jumpBuf=0;state.alive=true;player.position.set(0,groundY,3.6);player.rotation.set(0,0,0);player.scale.set(1,1,1);dead.classList.add('hidden');clearHazards();schedule=scheduleFor(seed);lastStage=1;stageBanner.classList.add('hidden')}
function showWarn(n){warningName.textContent=n;warning.classList.remove('hidden');sfx('warn');setTimeout(()=>warning.classList.add('hidden'),900)}
function announceStage(st){if(st<=1)return;stageBannerText.textContent=`STAGE ${st}`;stageBanner.classList.remove('hidden');sfx('stage');clearTimeout(stageBannerTimer);stageBannerTimer=setTimeout(()=>stageBanner.classList.add('hidden'),1100)}
function candyMaterial(color,emissive=0x000000,intensity=.2){return new THREE.MeshStandardMaterial({color,roughness:.35,metalness:.02,emissive,emissiveIntensity:intensity})}

function spawn(d){
  const r=rng32(d.seed);
  if(d.type===0){
    const g=new THREE.Group();g.position.y=.78;scene.add(g);const arms=d.diff>1.55?3:2;
    const hub=new THREE.Mesh(new THREE.SphereGeometry(.34,16,12),candyMaterial(0xffd77c,0xff8c45,.45));g.add(hub);
    for(let a=0;a<arms;a++){const arm=new THREE.Group();arm.rotation.y=a*Math.PI*2/arms;for(let s=0;s<7;s++){const m=new THREE.Mesh(new THREE.BoxGeometry(.78,.20,.24),candyMaterial(s%2?0xfff7f5:0xff6e9f,s%2?0x22121a:0x4a1027,1));m.position.x=.68+s*.77;m.castShadow=true;arm.add(m)}const cap=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),candyMaterial(0xffe17a,0xffa842,.5));cap.position.x=5.55;arm.add(cap);g.add(arm)}
    hazards.push({type:0,group:g,start:d.start,warn:d.warn,life:5200,arms,speed:.38+.12*d.diff});showWarn('CANDY SWEEP');
  } else if(d.type===1){
    const mat=new THREE.MeshStandardMaterial({color:0x80eaff,emissive:0x36bfff,emissiveIntensity:2.7,transparent:true,opacity:.34,roughness:.2});
    const g=new THREE.Mesh(new THREE.TorusGeometry(.45,.13,10,64),mat);g.rotation.x=Math.PI/2;g.position.y=.48;scene.add(g);hazards.push({type:1,group:g,start:d.start,warn:d.warn,life:3800,r:.45,speed:2.05+.25*d.diff});showWarn('BUBBLE WAVE');
  } else if(d.type===2){
    const g=new THREE.Group();scene.add(g);const a=r()*Math.PI*2,dx=Math.cos(a),dz=Math.sin(a);
    const mark=new THREE.Mesh(new THREE.PlaneGeometry(12,.95),new THREE.MeshBasicMaterial({color:0xffc876,transparent:true,opacity:.16,side:THREE.DoubleSide}));mark.rotation.x=-Math.PI/2;mark.rotation.z=-a;mark.position.y=.42;g.add(mark);
    const disc=new THREE.Mesh(new THREE.CylinderGeometry(.77,.77,.30,30),candyMaterial(0xc9864f));disc.rotation.z=Math.PI/2;disc.castShadow=true;g.add(disc);
    const chipMat=candyMaterial(0x5b362a);for(let i=0;i<5;i++){const chip=new THREE.Mesh(new THREE.SphereGeometry(.08,8,6),chipMat);const aa=i/5*Math.PI*2;chip.position.set(0,.79*Math.cos(aa),.79*Math.sin(aa));g.add(chip)}
    hazards.push({type:2,group:g,disc,start:d.start,warn:d.warn,life:3600,dx,dz,speed:5+.35*d.diff});showWarn('ROLLING COOKIE');
  } else if(d.type===3){
    const g=new THREE.Group();scene.add(g);const pts=[];
    for(let i=0;i<3+(d.diff>1.5?1:0);i++){const a=r()*Math.PI*2,rr=1.4+r()*3.5,x=Math.cos(a)*rr,z=Math.sin(a)*rr;const mark=new THREE.Mesh(new THREE.RingGeometry(.52,.72,28),new THREE.MeshBasicMaterial({color:0xff648e,transparent:true,opacity:.72,side:THREE.DoubleSide}));mark.rotation.x=-Math.PI/2;mark.position.set(x,.42,z);g.add(mark);const star=new THREE.Mesh(new THREE.OctahedronGeometry(.43,0),candyMaterial(0xffed72,0xff9c28,2.4));star.position.set(x,7+i*.3,z);star.castShadow=true;g.add(star);pts.push({x,z,star,mark,hit:false})}
    hazards.push({type:3,group:g,pts,start:d.start,warn:d.warn,life:3100});showWarn('STAR DROP');
  } else {
    const g=new THREE.Group();scene.add(g);const pts=[];
    for(let i=0;i<3+(d.diff>1.5?1:0);i++){const a=r()*Math.PI*2,rr=1.6+r()*3.3,x=Math.cos(a)*rr,z=Math.sin(a)*rr;const mark=new THREE.Mesh(new THREE.RingGeometry(.44,.62,26),new THREE.MeshBasicMaterial({color:0xffd95f,transparent:true,opacity:.7,side:THREE.DoubleSide}));mark.rotation.x=-Math.PI/2;mark.position.set(x,.42,z);g.add(mark);const stem=new THREE.Mesh(new THREE.CylinderGeometry(.42,.47,1.45,14),new THREE.MeshPhysicalMaterial({color:i%2?0xc9a7ff:0xff98bf,roughness:.2,transmission:.08,transparent:true,opacity:.92}));stem.position.set(x,.36,z);stem.scale.y=.01;stem.castShadow=true;g.add(stem);pts.push({x,z,stem,mark})}
    hazards.push({type:4,group:g,pts,start:d.start,warn:d.warn,life:3800});showWarn('JELLY POP');
  }
}

async function eliminate(){
  if(!state.alive)return; state.alive=false; cameraShake=.55; particleBurst(state.x,groundY+state.jy+.35,state.z,0xff7da8,22,2.0); sfx('hit');
  const em=elapsedMs(); try{await post('/api/student/eliminated',{code,playerId,playerToken,roundId,elapsedMs:em})}catch{}
  deadResult.textContent=`${fmt(em)}초 생존 · STAGE ${stageFor(em)}`; setTimeout(()=>dead.classList.remove('hidden'),320);
}

function hazardTick(ms){
  for(const d of schedule)if(!d.spawned&&ms>=d.start-50){d.spawned=true;spawn(d)}
  for(let i=hazards.length-1;i>=0;i--){
    const h=hazards[i],q=ms-h.start;if(q<0)continue;
    if(h.type===0&&q>=h.warn){const sec=(q-h.warn)/1000;h.group.rotation.y=h.speed*sec;for(let a=0;a<h.arms&&state.alive;a++){const ang=-h.group.rotation.y+a*Math.PI*2/h.arms,dx=Math.cos(ang),dz=Math.sin(ang),along=state.x*dx+state.z*dz,side=-state.x*dz+state.z*dx;if(along>.1-radius&&along<6.2+radius&&Math.abs(side)<.12+radius&&state.jy<.58)eliminate()}}
    else if(h.type===1&&q>=h.warn){h.r=.45+(q-h.warn)/1000*h.speed;h.group.geometry.dispose();h.group.geometry=new THREE.TorusGeometry(Math.max(.45,h.r),.13,10,64);h.group.material.opacity=Math.max(.08,.42-h.r*.025);const dd=Math.hypot(state.x,state.z);if(state.alive&&Math.abs(dd-h.r)<.28+radius&&state.jy<.62)eliminate()}
    else if(h.type===2&&q>=h.warn){const travel=-7+(q-h.warn)/1000*h.speed;h.disc.position.set(h.dx*travel,.98,h.dz*travel);h.disc.rotation.z=(q-h.warn)/1000*6;const along=state.x*h.dx+state.z*h.dz,side=-state.x*h.dz+state.z*h.dx;if(state.alive&&Math.abs(along-travel)<.9+radius&&Math.abs(side)<.7+radius&&state.jy<.7)eliminate()}
    else if(h.type===3&&q>=h.warn){const z=q-h.warn;for(const p of h.pts)if(!p.hit){p.mark.material.opacity=.35+.3*Math.sin(z*.018);p.star.rotation.y+=.08;const f=Math.min(1,z/720);p.star.position.y=7*(1-f)+.62;if(f>=1){p.hit=true;p.star.visible=false;particleBurst(p.x,.55,p.z,0xffd86b,8,1.2);if(state.alive&&Math.hypot(state.x-p.x,state.z-p.z)<1)eliminate()}}}
    else if(h.type===4&&q>=h.warn){const z=q-h.warn;for(const p of h.pts){p.mark.material.opacity=.35+.25*Math.sin(z*.022);p.stem.scale.y=Math.min(1,z/250);p.stem.scale.x=1+Math.sin(z*.02)*.06;p.stem.scale.z=1+Math.sin(z*.02)*.06;if(state.alive&&z<2300&&Math.hypot(state.x-p.x,state.z-p.z)<.5+radius)eliminate()}}
    if(q>h.warn+h.life){scene.remove(h.group);hazards.splice(i,1)}
  }
}

function jump(){if(!state.alive||pauseStartedAt)return;state.jumpBuf=.14;sfx('jump');jumpBtn.style.transform='scale(.92)';setTimeout(()=>jumpBtn.style.transform='',90)}
let joyId=null;
function joyMove(e){if(e.pointerId!==joyId)return;const b=joy.getBoundingClientRect(),cx=b.left+b.width/2,cy=b.top+b.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=b.width*.31,m=Math.hypot(dx,dy),k=m>max?max/m:1,x=dx*k,y=dy*k;joyVec.x=x/max;joyVec.y=y/max;knob.style.transform=`translate(${x}px,${y}px)`}
function joyEnd(e){if(e.pointerId!==joyId)return;joyId=null;joyVec.x=joyVec.y=0;knob.style.transform='translate(0,0)'}
joy.addEventListener('pointerdown',e=>{unlockAudio();joyId=e.pointerId;joy.setPointerCapture(e.pointerId);joyMove(e)});joy.addEventListener('pointermove',joyMove);joy.addEventListener('pointerup',joyEnd);joy.addEventListener('pointercancel',joyEnd);jumpBtn.addEventListener('pointerdown',e=>{e.preventDefault();unlockAudio();jump()});
addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','w','a','s','d','W','A','S','D'].includes(e.key))e.preventDefault();if(e.code==='Space'){if(!e.repeat)jump();return}keys.add(e.key.length===1?e.key.toLowerCase():e.key)});addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));

function animateMascot(dt){
  const moving=state.moving&&state.alive;runPhase+=dt*(moving?12:3.4);landCooldown=Math.max(0,landCooldown-dt);
  const idle=Math.sin(runPhase)*.018;
  bodyMesh.position.y=-.04+idle;head.position.y=.46+idle*.7;
  ear1.rotation.z=.10+Math.sin(runPhase*.8)*.08+(moving?.08:0);ear2.rotation.z=-.10-Math.sin(runPhase*.8)*.08-(moving?.08:0);
  if(moving){arm1.rotation.x=Math.sin(runPhase)*.8;arm2.rotation.x=-Math.sin(runPhase)*.8;leg1.rotation.x=-Math.sin(runPhase)*.65;leg2.rotation.x=Math.sin(runPhase)*.65;player.rotation.z=Math.sin(runPhase)*.025}
  else{arm1.rotation.x*=.8;arm2.rotation.x*=.8;leg1.rotation.x*=.8;leg2.rotation.x*=.8;player.rotation.z*=.8}
  const stretch=state.ground?1:THREE.MathUtils.clamp(1+state.vy*.018,.88,1.12);player.scale.y=THREE.MathUtils.lerp(player.scale.y,stretch,.28);player.scale.x=THREE.MathUtils.lerp(player.scale.x,2-stretch,.24);player.scale.z=player.scale.x;
}

function update(dt){
  if(!startAt){tickParticles(dt);animateMascot(dt);return}
  const ms=elapsedMs();
  if(Date.now()<startAt){countText.textContent=Math.max(1,Math.ceil((startAt-Date.now())/1000));tickParticles(dt);animateMascot(dt);return}
  if(pauseStartedAt){tickParticles(dt);return}
  const st=stageFor(ms);if(st!==lastStage){lastStage=st;announceStage(st)}
  state.jumpBuf=Math.max(0,state.jumpBuf-dt);
  let mx=joyVec.x,mz=joyVec.y;if(keys.has('a')||keys.has('ArrowLeft'))mx--;if(keys.has('d')||keys.has('ArrowRight'))mx++;if(keys.has('w')||keys.has('ArrowUp'))mz--;if(keys.has('s')||keys.has('ArrowDown'))mz++;
  state.moving=Math.abs(mx)+Math.abs(mz)>.05;
  if(state.alive&&state.moving){const m=Math.hypot(mx,mz);mx/=m;mz/=m;state.x+=mx*3.9*dt;state.z+=mz*3.9*dt;player.rotation.y=Math.atan2(mx,mz)}
  const rr=Math.hypot(state.x,state.z);if(rr>limit){state.x=state.x/rr*limit;state.z=state.z/rr*limit}
  if(state.ground&&state.jumpBuf>0){state.ground=false;state.vy=jumpV;state.jumpBuf=0}
  if(!state.ground){state.vy+=gravity*dt;state.jy+=state.vy*dt;if(state.jy<=0){state.jy=0;state.vy=0;state.ground=true;if(landCooldown<=0){landCooldown=.12;particleBurst(state.x,.48,state.z,0xffe7bc,7,.7);sfx('land')}}}
  hazardTick(ms); animateMascot(dt); tickParticles(dt);
  player.position.set(state.x,groundY+state.jy,state.z);shadow.position.set(state.x,.405,state.z);shadow.scale.setScalar(Math.max(.5,1-state.jy*.14));shadow.material.opacity=Math.max(.08,.25-state.jy*.035);
  timeEl.textContent=fmt(ms);stageEl.textContent=`STAGE ${st}`;
  if(cameraShake>0){cameraShake=Math.max(0,cameraShake-dt*2.4);camera.position.set(cameraBase.x+(Math.random()-.5)*cameraShake,cameraBase.y+(Math.random()-.5)*cameraShake*.5,cameraBase.z+(Math.random()-.5)*cameraShake);}
  else camera.position.lerp(cameraBase,.16);
  camera.lookAt(state.x*.05,.55,state.z*.03);
}

let last=performance.now();
function loop(now){const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);renderer.render(scene,camera);requestAnimationFrame(loop)}
function resize(){const w=Math.max(300,view.clientWidth),h=Math.max(330,view.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(view);resize();requestAnimationFrame(loop);
