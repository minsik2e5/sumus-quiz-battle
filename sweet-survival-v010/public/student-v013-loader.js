// Sweet Survival V0.13 · RUSH difficulty loader
// Keeps the stable V0.12 game client, then upgrades stage pacing, hazard density,
// combo scheduling, and late-game intensity before the module is executed.

const SOURCE_URL = '/student-v012.js?v=13-base';

async function boot(){
  const response = await fetch(SOURCE_URL,{cache:'no-store'});
  if(!response.ok) throw new Error(`Failed to load game source: ${response.status}`);
  let source = await response.text();
  const applied=[];
  const failed=[];

  const patch=(from,to,label)=>{
    if(!source.includes(from)){failed.push(label);return;}
    source=source.replace(from,to);applied.push(label);
  };

  patch(
    "function stageFor(ms){const t=ms/1000;if(t<18)return 1;if(t<36)return 2;if(t<58)return 3;if(t<82)return 4;if(t<108)return 5;if(t<136)return 6;if(t<168)return 7;return 8}",
    "function stageFor(ms){const t=ms/1000;if(t<8)return 1;if(t<18)return 2;if(t<30)return 3;if(t<44)return 4;if(t<60)return 5;if(t<78)return 6;if(t<98)return 7;return 8}",
    'stage pacing'
  );

  patch(
    "function scheduleFor(seed,maxMs=300000){const rnd=rng32(seed),unlock=[1,2,3,4,5,7,9,10];let t=2600,last=-1;const arr=[];while(t<maxMs){const st=stageFor(t),count=unlock[st-1],options=[];for(let i=0;i<count;i++)if(i!==last)options.push(i);const type=options[Math.floor(rnd()*options.length)],diff=1+Math.min(1.8,t/100000),warn=1000+Math.floor(rnd()*320);arr.push({type,start:t,warn,diff,seed:Math.floor(rnd()*1e9),spawned:false});last=type;const gap=Math.max(850,1350-t*.0017);t+=warn+HAZARD_LIFE[type]+gap+Math.floor(rnd()*320)}return arr}",
    `function scheduleFor(seed,maxMs=300000){
      const rnd=rng32(seed),unlock=[2,3,5,7,9,10,10,10];
      const comboPairs={0:[3,4],1:[5,3],2:[4,5],3:[0,6,8],4:[0,2,7],5:[1,2],6:[3,9],7:[4,9],8:[3,5],9:[6,7]};
      let t=1450,last=-1;const arr=[];
      while(t<maxMs){
        const st=stageFor(t),count=unlock[st-1],options=[];
        for(let i=0;i<count;i++)if(i!==last)options.push(i);
        if(!options.length)for(let i=0;i<count;i++)options.push(i);
        const type=options[Math.floor(rnd()*options.length)];
        const diff=1.18+Math.min(2.45,t/60000);
        const warn=Math.max(560,800-st*24+Math.floor(rnd()*150));
        arr.push({type,start:t,warn,diff,seed:Math.floor(rnd()*1e9),spawned:false});
        let end=t+warn+HAZARD_LIFE[type];
        const comboChance=st<2?0:Math.min(.78,.12+(st-2)*.11);
        if(rnd()<comboChance){
          const partners=(comboPairs[type]||[]).filter(x=>x<count&&x!==last&&x!==type);
          if(partners.length){
            const type2=partners[Math.floor(rnd()*partners.length)];
            const delay=Math.max(900,Math.min(1950,warn+360+Math.floor(rnd()*460)));
            const warn2=Math.max(520,warn-80+Math.floor(rnd()*130));
            arr.push({type:type2,start:t+delay,warn:warn2,diff:diff+.18,seed:Math.floor(rnd()*1e9),spawned:false,combo:true});
            end=Math.max(end,t+delay+warn2+HAZARD_LIFE[type2]);
          }
        }
        last=type;
        const gap=Math.max(240,570-st*38)+Math.floor(rnd()*130);
        t=end+gap;
      }
      return arr.sort((a,b)=>a.start-b.start);
    }`,
    'rush scheduler'
  );

  // Fallback for the original stage-1 empty-options bug if the full scheduler patch ever misses.
  patch(
    "const type=options[Math.floor(rnd()*options.length)],diff=1+Math.min(1.8,t/100000),warn=1000+Math.floor(rnd()*320);",
    "if(!options.length){for(let i=0;i<count;i++)options.push(i)}const type=options[Math.floor(rnd()*options.length)],diff=1+Math.min(1.8,t/100000),warn=1000+Math.floor(rnd()*320);",
    'scheduler fallback'
  );

  patch("const arms=d.diff>1.55?3:2;","const arms=d.diff>2.4?4:d.diff>1.32?3:2;",'candy arm count');
  patch("speed:.38+.12*d.diff","speed:.52+.16*d.diff",'candy speed');
  patch("speed:2.05+.25*d.diff","speed:2.48+.34*d.diff",'bubble speed');
  patch("speed:5+.35*d.diff","speed:6.15+.46*d.diff",'cookie speed');

  patch(
    "for(let i=0;i<3+(d.diff>1.5?1:0);i++){const a=r()*Math.PI*2,rr=1.4+r()*3.5",
    "for(let i=0;i<4+(d.diff>2.0?2:d.diff>1.35?1:0);i++){const a=r()*Math.PI*2,rr=1.25+r()*3.65",
    'star count'
  );
  patch("const f=Math.min(1,z/720);","const f=Math.min(1,z/560);",'star drop speed');

  patch(
    "for(let i=0;i<3+(d.diff>1.5?1:0);i++){const a=r()*Math.PI*2,rr=1.6+r()*3.3",
    "for(let i=0;i<4+(d.diff>1.75?1:0);i++){const a=r()*Math.PI*2,rr=1.35+r()*3.55",
    'jelly count'
  );

  patch("const count=3+(d.diff>1.7?1:0);","const count=4+(d.diff>1.65?1:0);",'hammer count');
  patch("const f=Math.min(1,z/640);","const f=Math.min(1,z/500);",'hammer speed');
  patch("force:.62+.12*d.diff","force:.84+.18*d.diff",'vortex strength');
  patch("speed:3.5+.35*d.diff,force:1.05+.18*d.diff","speed:4.25+.42*d.diff,force:1.35+.24*d.diff",'cloud strength');
  patch("const dangerCount=d.diff>1.7?2:1;","const dangerCount=d.diff>2.25?3:2;",'fake gift danger count');

  patch(
    "desiredX=mx*(icy?4.2:3.9);desiredZ=mz*(icy?4.2:3.9);",
    "desiredX=mx*(icy?4.65:4.05);desiredZ=mz*(icy?4.65:4.05);",
    'movement speed'
  );
  patch(
    "const response=icy?Math.min(1,dt*2.0):Math.min(1,dt*18);",
    "const response=icy?Math.min(1,dt*1.05):Math.min(1,dt*19);",
    'ice slide'
  );

  patch(
    "function announceStage(st){if(st<=1)return;stageBannerText.textContent=`STAGE ${st}`;stageBanner.classList.remove('hidden');sfx('stage');clearTimeout(stageBannerTimer);stageBannerTimer=setTimeout(()=>stageBanner.classList.add('hidden'),1100)}",
    "function announceStage(st){if(st<=1)return;stageBannerText.textContent=st>=6?`RUSH · STAGE ${st}`:`STAGE ${st}`;stageBanner.classList.remove('hidden');sfx('stage');cameraShake=Math.max(cameraShake,.13+.02*st);renderer.toneMappingExposure=Math.min(1.42,1.22+st*.025);clearTimeout(stageBannerTimer);stageBannerTimer=setTimeout(()=>stageBanner.classList.add('hidden'),900)}",
    'stage escalation fx'
  );

  console.info('[Sweet Survival V0.13] RUSH patches:',applied.join(', '));
  if(failed.length)console.warn('[Sweet Survival V0.13] patch targets missed:',failed.join(', '));

  const blob=new Blob([source],{type:'text/javascript'});
  const url=URL.createObjectURL(blob);
  try{await import(url);}finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
}

boot().catch(err=>{
  console.error('[Sweet Survival V0.13] Boot failed',err);
  const target=document.getElementById('joinError');
  if(target)target.textContent='게임을 불러오지 못했습니다. 새로고침해주세요.';
});
