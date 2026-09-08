// Sweet Survival V0.14 · FINAL RUSH loader
// Aggressive classroom pacing: faster stages, denser compatible combos,
// tuned triple patterns, visible arena shrink, and late-game FINAL RUSH.

const SOURCE_URL='/student-v012.js?v=14-base';

async function boot(){
  const response=await fetch(SOURCE_URL,{cache:'no-store'});
  if(!response.ok)throw new Error(`Failed to load game source: ${response.status}`);
  let source=await response.text();
  const applied=[],failed=[];
  const patch=(from,to,label)=>{if(!source.includes(from)){failed.push(label);return}source=source.replace(from,to);applied.push(label)};

  patch(
    "function stageFor(ms){const t=ms/1000;if(t<18)return 1;if(t<36)return 2;if(t<58)return 3;if(t<82)return 4;if(t<108)return 5;if(t<136)return 6;if(t<168)return 7;return 8}",
    "function stageFor(ms){const t=ms/1000;if(t<6)return 1;if(t<13)return 2;if(t<22)return 3;if(t<33)return 4;if(t<46)return 5;if(t<61)return 6;if(t<78)return 7;return 8}",
    'faster stage pacing'
  );

  patch(
    "function scheduleFor(seed,maxMs=300000){const rnd=rng32(seed),unlock=[1,2,3,4,5,7,9,10];let t=2600,last=-1;const arr=[];while(t<maxMs){const st=stageFor(t),count=unlock[st-1],options=[];for(let i=0;i<count;i++)if(i!==last)options.push(i);const type=options[Math.floor(rnd()*options.length)],diff=1+Math.min(1.8,t/100000),warn=1000+Math.floor(rnd()*320);arr.push({type,start:t,warn,diff,seed:Math.floor(rnd()*1e9),spawned:false});last=type;const gap=Math.max(850,1350-t*.0017);t+=warn+HAZARD_LIFE[type]+gap+Math.floor(rnd()*320)}return arr}",
    `function scheduleFor(seed,maxMs=300000){
      const rnd=rng32(seed),unlock=[3,5,7,9,10,10,10,10];
      const pairMap={0:[3,4,7,8],1:[5,3,8],2:[4,5,6],3:[0,6,9],4:[0,2,7],5:[1,2,8],6:[2,3,9],7:[0,4,9],8:[1,5,3],9:[3,6,7]};
      const safeTriples=[[0,3,7],[1,5,8],[2,4,6],[3,7,9],[0,4,8],[2,5,9]];
      let t=900,last=-1;const arr=[];
      while(t<maxMs){
        const st=stageFor(t),count=unlock[st-1];
        const diff=1.35+Math.min(3.1,t/45000);
        const warn=Math.max(430,690-st*28+Math.floor(rnd()*120));
        const tripleChance=st<5?0:st===5?.16:st===6?.34:st===7?.52:.74;
        const triplePool=safeTriples.filter(set=>set.every(x=>x<count));
        if(triplePool.length&&rnd()<tripleChance){
          const set=triplePool[Math.floor(rnd()*triplePool.length)];
          const delays=[0,720+Math.floor(rnd()*190),1450+Math.floor(rnd()*260)];
          let end=t;
          set.forEach((type,i)=>{
            const w=Math.max(390,warn-i*35);
            const start=t+delays[i];
            arr.push({type,start,warn:w,diff:diff+i*.16,seed:Math.floor(rnd()*1e9),spawned:false,combo:true,triple:true});
            end=Math.max(end,start+w+HAZARD_LIFE[type]);
          });
          last=set[2];
          t=end+Math.max(110,330-st*24)+Math.floor(rnd()*80);
          continue;
        }
        const options=[];for(let i=0;i<count;i++)if(i!==last)options.push(i);if(!options.length)for(let i=0;i<count;i++)options.push(i);
        const type=options[Math.floor(rnd()*options.length)];
        arr.push({type,start:t,warn,diff,seed:Math.floor(rnd()*1e9),spawned:false});
        let end=t+warn+HAZARD_LIFE[type];
        const comboChance=[.18,.34,.52,.66,.78,.87,.93,.96][st-1];
        if(rnd()<comboChance){
          const partners=(pairMap[type]||[]).filter(x=>x<count&&x!==last&&x!==type);
          if(partners.length){
            const type2=partners[Math.floor(rnd()*partners.length)];
            const delay=Math.max(620,820+Math.floor(rnd()*330));
            const warn2=Math.max(400,warn-55+Math.floor(rnd()*90));
            arr.push({type:type2,start:t+delay,warn:warn2,diff:diff+.18,seed:Math.floor(rnd()*1e9),spawned:false,combo:true});
            end=Math.max(end,t+delay+warn2+HAZARD_LIFE[type2]);
          }
        }
        last=type;
        t=end+Math.max(120,410-st*34)+Math.floor(rnd()*90);
      }
      return arr.sort((a,b)=>a.start-b.start);
    }`,
    'final rush scheduler'
  );

  patch("const joyVec={x:0,y:0},keys=new Set(),hazards=[];const groundY=.92,limit=5.05,radius=.32,gravity=-17.8,jumpV=6.7;",
        "const joyVec={x:0,y:0},keys=new Set(),hazards=[];const groundY=.92,baseLimit=5.05,radius=.32,gravity=-17.8,jumpV=6.7;let limit=baseLimit;",
        'dynamic arena limit');

  patch(
    "const innerRing=new THREE.Mesh(new THREE.RingGeometry(4.8,5.62,64),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.05,side:THREE.DoubleSide}));innerRing.rotation.x=-Math.PI/2;innerRing.position.y=.41;arena.add(innerRing);",
    "const innerRing=new THREE.Mesh(new THREE.RingGeometry(4.8,5.62,64),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.05,side:THREE.DoubleSide}));innerRing.rotation.x=-Math.PI/2;innerRing.position.y=.41;arena.add(innerRing);const shrinkRing=new THREE.Mesh(new THREE.TorusGeometry(baseLimit,.055,8,96),new THREE.MeshBasicMaterial({color:0xff6f9e,transparent:true,opacity:.12,depthWrite:false}));shrinkRing.rotation.x=Math.PI/2;shrinkRing.position.y=.455;scene.add(shrinkRing);",
    'shrink ring visual'
  );

  patch("const arms=d.diff>1.55?3:2;","const arms=d.diff>3.45?5:d.diff>2.15?4:d.diff>1.25?3:2;",'candy arms');
  patch("speed:.38+.12*d.diff","speed:.60+.18*d.diff",'candy speed');
  patch("speed:2.05+.25*d.diff","speed:2.72+.40*d.diff",'bubble speed');
  patch("speed:5+.35*d.diff","speed:6.55+.55*d.diff",'cookie speed');
  patch("for(let i=0;i<3+(d.diff>1.5?1:0);i++){const a=r()*Math.PI*2,rr=1.4+r()*3.5","for(let i=0;i<5+(d.diff>2.45?2:d.diff>1.55?1:0);i++){const a=r()*Math.PI*2,rr=1.15+r()*3.75",'star density');
  patch("const f=Math.min(1,z/720);","const f=Math.min(1,z/470);",'star speed');
  patch("for(let i=0;i<3+(d.diff>1.5?1:0);i++){const a=r()*Math.PI*2,rr=1.6+r()*3.3","for(let i=0;i<5+(d.diff>2.2?1:0);i++){const a=r()*Math.PI*2,rr=1.2+r()*3.65",'jelly density');
  patch("const count=3+(d.diff>1.7?1:0);","const count=5+(d.diff>2.25?1:0);",'hammer density');
  patch("const f=Math.min(1,z/640);","const f=Math.min(1,z/430);",'hammer speed');
  patch("force:.62+.12*d.diff","force:.98+.20*d.diff",'vortex strength');
  patch("speed:3.5+.35*d.diff,force:1.05+.18*d.diff","speed:4.70+.50*d.diff,force:1.50+.26*d.diff",'cloud strength');
  patch("const dangerCount=d.diff>1.7?2:1;","const dangerCount=d.diff>3.25?4:d.diff>2.0?3:2;",'gift danger density');
  patch("desiredX=mx*(icy?4.2:3.9);desiredZ=mz*(icy?4.2:3.9);","desiredX=mx*(icy?4.75:4.10);desiredZ=mz*(icy?4.75:4.10);",'movement speed');
  patch("const response=icy?Math.min(1,dt*2.0):Math.min(1,dt*18);","const response=icy?Math.min(1,dt*.82):Math.min(1,dt*19);",'ice slipperiness');

  patch(
    "function announceStage(st){if(st<=1)return;stageBannerText.textContent=`STAGE ${st}`;stageBanner.classList.remove('hidden');sfx('stage');clearTimeout(stageBannerTimer);stageBannerTimer=setTimeout(()=>stageBanner.classList.add('hidden'),1100)}",
    "function announceStage(st){if(st<=1)return;stageBannerText.textContent=st===8?'FINAL RUSH':st>=6?`RUSH · STAGE ${st}`:`STAGE ${st}`;stageBanner.classList.remove('hidden');sfx('stage');cameraShake=Math.max(cameraShake,.16+.025*st);renderer.toneMappingExposure=Math.min(1.5,1.22+st*.032);const bg=[0x23173d,0x26173f,0x291640,0x2d173f,0x31163d,0x35163a,0x391536,0x3f1432][st-1];scene.background.setHex(bg);scene.fog.color.setHex(bg);clearTimeout(stageBannerTimer);stageBannerTimer=setTimeout(()=>stageBanner.classList.add('hidden'),820)}",
    'final rush stage fx'
  );

  patch(
    "const st=stageFor(ms);if(st!==lastStage){lastStage=st;announceStage(st)}\n  spawnDue(ms);",
    "const st=stageFor(ms);if(st!==lastStage){lastStage=st;announceStage(st)}const targetLimit=st<=4?baseLimit:st===5?4.72:st===6?4.48:st===7?4.22:(ms>112000?3.72:3.98);limit=THREE.MathUtils.lerp(limit,targetLimit,Math.min(1,dt*.72));shrinkRing.scale.setScalar(limit/baseLimit);shrinkRing.material.opacity=st<5?.10:.32+.13*Math.sin(ms*.008);spawnDue(ms);",
    'arena shrink runtime'
  );

  patch("function resetGame(){state.x=0;state.z=3.6;","function resetGame(){limit=baseLimit;shrinkRing.scale.setScalar(1);shrinkRing.material.opacity=.1;state.x=0;state.z=3.6;",'arena reset');

  console.info('[Sweet Survival V0.14] FINAL RUSH patches:',applied.join(', '));
  if(failed.length)console.warn('[Sweet Survival V0.14] patch targets missed:',failed.join(', '));
  const blob=new Blob([source],{type:'text/javascript'}),url=URL.createObjectURL(blob);
  try{await import(url)}finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}
}

boot().catch(err=>{
  console.error('[Sweet Survival V0.14] Boot failed',err);
  const target=document.getElementById('joinError');
  if(target)target.textContent='게임을 불러오지 못했습니다. 새로고침해주세요.';
});
