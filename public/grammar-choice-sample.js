import { $, $$, esc, icon, toast } from './modules/ui.js';

const PASSAGE = {
  title: '2026년 3월 서울교육청 · 18번',
  subtitle: 'Connexa Point Table Tennis Center',
  items: [
    { ko:'Connexa Point 탁구 센터 회원님께, 저는 Connexa Point 탁구 센터의 관리자입니다.', parts:[
      ['t','Dear Connexa Point Table Tennis Center '], ['c',['members','owners'],'members'], ['t',', I am the manager of the Connexa Point Table Tennis Center.']
    ]},
    { ko:'센터의 다가오는 재개장에 관심을 가져 주셔서 감사합니다.', parts:[
      ['t','Thank you for your '], ['c',['interest','disinterest'],'interest'], ['t',' in the upcoming '], ['c',['reopening','reopen'],'reopening'], ['t',' of the center.']
    ]},
    { ko:'안타깝게도, 보수 과정에서 예상치 못한 전기 문제가 발견되었고, 작업이 저희가 계획했던 것보다 더 오래 걸리게 되었습니다.', parts:[
      ['c',['Unfortunately','Fortunately'],'Unfortunately'], ['t',', '], ['c',['while','during'],'during'], ['t',' the repair process, '], ['c',['expected','unexpected'],'unexpected'], ['t',' electrical issues '], ['c',['were discovered','discovered'],'were discovered'], ['t',', '], ['c',['causing','caused'],'causing'], ['t',' the work to take '], ['c',['shorter','longer'],'longer'], ['t',' than we planned.']
    ]},
    { ko:'저희가 센터 재개장을 연기해야 함을 알려 드리게 되어 유감입니다.', parts:[
      ['t','We regret '], ['c',['to inform','informing'],'to inform'], ['t',' you '], ['c',['who','that'],'that'], ['t',' the center’s reopening must '], ['c',['be delayed','delay'],'be delayed'], ['t','.']
    ]},
    { ko:'센터는 원래 4월 1일에 재개장할 예정이었습니다.', parts:[
      ['t','The center was '], ['c',['original','originally'],'originally'], ['t',' scheduled to reopen on April 1st.']
    ]},
    { ko:'하지만, 이제는 모든 방문객의 안전을 보장하기 위해 5월 1일에 재개장할 것입니다.', parts:[
      ['t','However, '], ['c',['they','it'],'it'], ['t',' will now reopen on May 1st to '], ['c',['ensure','be ensured'],'ensure'], ['t',' the safety of all members.']
    ]},
    { ko:'저희는 코트에서 여러분을 곧 다시 뵐 수 있기를 기대합니다.', parts:[
      ['t','We look forward to '], ['c',['seeing','see'],'seeing'], ['t',' you back on the court soon.']
    ]},
    { ko:'여러분의 인내와 이해에 감사드립니다.', parts:[
      ['t','Thank you for your '], ['c',['impatience','patience'],'patience'], ['t',' and understanding.']
    ]}
  ]
};

function addStyle(){
  if(document.querySelector('#gc-style')) return;
  const s=document.createElement('style'); s.id='gc-style'; s.textContent=`
  .gc-page{min-height:100vh;background:#f7f8fa;padding-bottom:96px}.gc-top{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid #eaecf0;padding:13px 16px}.gc-topin{max-width:760px;margin:auto;display:flex;align-items:center;gap:12px}.gc-back{width:40px;height:40px;border:1px solid #eaecf0;background:#fff;border-radius:12px}.gc-head{flex:1}.gc-head b{display:block}.gc-head small{color:#667085}.gc-main{max-width:760px;margin:auto;padding:18px 14px}.gc-hero{background:linear-gradient(135deg,#111827,#344054);color:#fff;border-radius:22px;padding:22px;margin-bottom:16px}.gc-hero h1{margin:10px 0 5px;font-size:24px}.gc-hero p{margin:0;color:#d0d5dd}.gc-card{background:#fff;border:1px solid #eaecf0;border-radius:18px;padding:17px;margin:11px 0}.gc-no{font-size:12px;font-weight:800;color:#3867f0;margin-bottom:7px}.gc-ko{font-size:13px;line-height:1.55;color:#667085;margin-bottom:10px}.gc-en{font-size:17px;line-height:2.1;font-weight:600;color:#101828}.gc-choice{display:inline-flex;border:1px solid #d0d5dd;background:#fff;border-radius:10px;padding:5px 9px;margin:0 2px;font:inherit;font-weight:800;color:#344054}.gc-choice.selected{background:#eef4ff;border-color:#3867f0;color:#1849a9}.gc-choice.correct{background:#ecfdf3;border-color:#6ce9a6;color:#067647}.gc-choice.wrong{background:#fef3f2;border-color:#fda29b;color:#b42318;text-decoration:line-through}.gc-answer{display:none;margin-top:10px;padding:9px 11px;background:#f8fafc;border-radius:10px;color:#475467;font-size:13px}.gc-card.graded .gc-answer{display:block}.gc-score{text-align:center;background:#fff;border:1px solid #eaecf0;border-radius:20px;padding:22px;margin-bottom:14px}.gc-score strong{display:block;font-size:44px}.gc-score p{color:#667085;margin:5px 0}.gc-bottom{position:fixed;left:0;right:0;bottom:0;background:rgba(255,255,255,.96);border-top:1px solid #eaecf0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));z-index:6}.gc-bottomin{max-width:760px;margin:auto;display:flex;gap:8px}.gc-bottom .btn{flex:1}@media(max-width:560px){.gc-en{font-size:16px;line-height:2.2}}`; document.head.appendChild(s);
}
const totalChoices=()=>PASSAGE.items.reduce((n,x)=>n+x.parts.filter(p=>p[0]==='c').length,0);

export function openGrammarChoiceSample(A, redraw){
  addStyle(); A.screen='grammar-choice';
  const picks=new Map(); let graded=false;
  const exit=()=>{A.screen=null;redraw();window.scrollTo(0,0)};
  const mount=()=>{
    const total=totalChoices();
    let correct=0;
    if(graded) for(const [key,val] of picks){ const [i,j]=key.split(':').map(Number); if(PASSAGE.items[i].parts[j][2]===val) correct++; }
    const cards=PASSAGE.items.map((item,i)=>{
      const answers=item.parts.filter(p=>p[0]==='c').map(p=>p[2]);
      const body=item.parts.map((p,j)=>{
        if(p[0]==='t') return esc(p[1]);
        const key=i+':'+j, val=picks.get(key);
        let cls='gc-choice'+(val?' selected':'');
        if(graded) cls+=(val===p[2]?' correct':' wrong');
        return `<button class="${cls}" data-gc="${key}" ${graded?'disabled':''}>${esc(val||'선택')} ▾</button>`;
      }).join('');
      return `<section class="gc-card ${graded?'graded':''}"><div class="gc-no">${String(i+1).padStart(2,'0')}</div><div class="gc-ko">${esc(item.ko)}</div><div class="gc-en">${body}</div><div class="gc-answer">정답 · ${answers.map(esc).join(' / ')}</div></section>`;
    }).join('');
    const score=graded?`<section class="gc-score"><span class="pill blue">채점 완료</span><strong>${correct}/${total}</strong><p>${correct===total?'18번 MASTER!':'틀린 선택지를 확인하고 다시 풀어보세요.'}</p></section>`:'';
    $('#app').innerHTML=`<div class="gc-page"><header class="gc-top"><div class="gc-topin"><button class="gc-back" id="gc-back">${icon('back')}</button><div class="gc-head"><b>${esc(PASSAGE.title)}</b><small>WORKBOOK 6 · 어법·어휘 고르기</small></div><span class="pill blue">${picks.size}/${total}</span></div></header><main class="gc-main"><section class="gc-hero"><span class="pill">SAMPLE</span><h1>어법·어휘 고르기</h1><p>${esc(PASSAGE.subtitle)}<br>문장 속 괄호를 눌러 알맞은 표현을 골라보세요.</p></section>${score}${cards}</main><div class="gc-bottom"><div class="gc-bottomin">${graded?'<button class="btn" id="gc-retry">다시 풀기</button><button class="btn primary" id="gc-home">홈으로</button>':'<button class="btn primary" id="gc-grade">채점하기</button>'}</div></div></div>`;
    $('#gc-back').onclick=exit; $('#gc-home')?.addEventListener('click',exit);
    $('#gc-retry')?.addEventListener('click',()=>{picks.clear();graded=false;mount();window.scrollTo(0,0)});
    $('#gc-grade')?.addEventListener('click',()=>{if(picks.size<total)return toast('아직 '+(total-picks.size)+'개를 선택하지 않았어요.'); graded=true;mount();window.scrollTo(0,0)});
    $$('[data-gc]').forEach(b=>b.onclick=()=>{const [i,j]=b.dataset.gc.split(':').map(Number), opts=PASSAGE.items[i].parts[j][1], cur=picks.get(b.dataset.gc), next=opts[(Math.max(-1,opts.indexOf(cur))+1)%opts.length]; picks.set(b.dataset.gc,next); mount(); document.querySelector('[data-gc="'+b.dataset.gc+'"]')?.focus();});
  };
  mount();
}
