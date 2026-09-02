    /* V0.9.3C.5 dedicated RAID results. RUN result rendering remains delegated. */
    const RaidResults = (() => {
      const escapeText = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
      let selectedId = '';
      const metric = (label, value, suffix = '') => `<article><small>${label}</small><b>${escapeText(value)}${suffix}</b></article>`;
      const retryList = rows => rows.length ? `<div class="raid-retry-list">${rows.map(row=>`<article><div><b>${escapeText(row.word)}</b><span>${escapeText(row.meaning || row.expected)}</span></div><strong class="${row.status.toLowerCase()}">${row.status}${row.resolved?' · TAMED':''}</strong><small>${row.wrong?`WRONG ×${row.wrong} `:''}${row.pass?`PASS ×${row.pass} `:''}${row.timeout?`TIMEOUT ×${row.timeout}`:''}</small></article>`).join('')}</div>` : '<p class="raid-empty-result">RETRY BATTLE 단어가 없습니다.</p>';
      const renderStudent = player => {
        const result = player?.raidResult || RaidResultsModel.publicResult(player || {});
        const title = result.cleared ? 'ALL WORDS TAMED' : result.partial ? 'RAID ENDED · PARTIAL' : 'RAID COMPLETE';
        const subtitle = result.cleared ? '최종 보스를 클리어했습니다.' : '완료한 범위까지 학습 결과를 확인하세요.';
        return `<div class="raid-student-result"><header><small>SUMUS RAID RESULT</small><h1>${title}</h1><p>${subtitle}</p></header><section class="raid-result-metrics">${metric('TOTAL',result.total)}${metric('CORRECT',result.correct)}${metric('WRONG',result.wrong)}${metric('PASS',result.pass)}${metric('TIMEOUT',result.timeout)}${metric('ACCURACY',result.accuracy,'%')}${metric('MAX COMBO',`×${result.maxCombo}`)}${metric('REVIVE',result.reviveCount)}${metric('WAVES',`${result.wavesCleared}/${result.totalWaves}`)}${metric('RETRY',result.retryCount)}</section><section class="raid-student-review"><div><small>LEARNING REVIEW</small><h2>RETRY BATTLE WORDS</h2></div>${retryList(result.retryWords)}</section><button type="button" class="raid-entry-primary" id="studentReturnLobby">BACK TO LOBBY</button></div>`;
      };
      const summaryCards = summary => [
        ['STUDENTS',summary.students],['CLEARED',summary.cleared],['INCOMPLETE',summary.incomplete],
        ['AVG ACCURACY',`${summary.averageAccuracy}%`],['AVG PROGRESS',`${summary.averageProgress}%`],
        ['MAX COMBO',`×${summary.maxCombo}`],['REVIVES',summary.reviveCount],['RETRY BURDEN',summary.retryBurden]
      ].map(([label,value])=>metric(label,value)).join('');
      const renderTeacher = () => {
        const screen=document.getElementById('results'); if(!screen)return;
        screen.classList.add('raid-results-active');
        screen.querySelector('#raidResultsRoot')?.remove();
        const summary=RaidResultsModel.classroom(state.players);
        const ordered=[...state.players].sort((a,b)=>(b.raid?.cleared?1:0)-(a.raid?.cleared?1:0)||(b.questionIndex||0)-(a.questionIndex||0)||(b.correct/Math.max(1,b.correct+b.wrong+b.pass))-(a.correct/Math.max(1,a.correct+a.wrong+a.pass)));
        selectedId=ordered.some(player=>player.id===selectedId)?selectedId:ordered[0]?.id||'';
        const selected=state.players.find(player=>player.id===selectedId),detail=RaidResultsModel.student(selected||{});
        const root=document.createElement('div');root.id='raidResultsRoot';root.className='raid-shell raid-teacher-results';
        root.innerHTML=`<header><div><small>CLASSROOM RAID RESULTS</small><h1>LEARNING BROADCAST</h1></div><div class="raid-result-actions"><button type="button" data-raid-result="review">CLASS REVIEW</button><button type="button" class="primary" data-raid-result="rematch">RETRY / NEW RAID</button></div></header><section class="raid-class-summary">${summaryCards(summary)}</section><main><section class="raid-result-roster"><div class="raid-result-table-head"><b>STUDENT</b><b>STATE</b><b>PROGRESS</b><b>ACCURACY</b><b>COMBO</b><b>RETRY</b></div>${ordered.map(player=>{const row=RaidResultsModel.student(player);return`<button type="button" data-raid-student-detail="${escapeText(player.id)}" class="${player.id===selectedId?'active':''}"><b>${escapeText(player.name)}</b><span class="${row.cleared?'clear':row.partial?'partial':'incomplete'}">${row.cleared?'CLEAR':row.partial?'PARTIAL':'INCOMPLETE'}</span><span>${row.progressed}/${row.assigned}</span><span>${row.accuracy}%</span><span>×${row.maxCombo}</span><span>${row.retryCount}</span></button>`}).join('')}</section><aside class="raid-result-detail"><small>STUDENT DETAIL</small><h2>${escapeText(detail.name||'—')}</h2><div class="raid-detail-metrics">${metric('CORRECT',detail.correct)}${metric('WRONG',detail.wrong)}${metric('PASS',detail.pass)}${metric('TIMEOUT',detail.timeout)}${metric('REVIVE',detail.reviveCount)}${metric('FINAL WAVE',`${detail.wavesCleared}/${detail.totalWaves}`)}</div><h3>RETRY WORDS</h3>${retryList(detail.retryWords||[])}</aside></main><section class="raid-class-review" hidden><div><small>CLASS RETRY SUMMARY</small><h2>WORDS NEEDING REVIEW</h2></div>${classReview(ordered)}</section>`;
        screen.append(root);
        root.addEventListener('click',event=>{
          const student=event.target.closest('[data-raid-student-detail]');if(student){selectedId=student.dataset.raidStudentDetail;renderTeacher();return;}
          const action=event.target.closest('[data-raid-result]')?.dataset.raidResult;
          if(action==='rematch')document.getElementById('rematch')?.click();
          if(action==='review'){const panel=root.querySelector('.raid-class-review');panel.hidden=!panel.hidden;event.target.textContent=panel.hidden?'CLASS REVIEW':'HIDE REVIEW';}
        });
        RaidAssetDirector?.mountAll(root);
      };
      const classReview = players => {
        const words=new Map();
        players.forEach(player=>RaidResultsModel.retryRows(player).forEach(row=>{
          const entry=words.get(row.id)||{...row,students:0,attempts:0};entry.students+=1;entry.attempts+=row.wrong+row.pass+row.timeout;words.set(row.id,entry);
        }));
        const list=[...words.values()].sort((a,b)=>b.students-a.students||b.attempts-a.attempts).slice(0,12);
        return list.length?`<div class="raid-class-review-grid">${list.map(row=>`<article><b>${escapeText(row.word)}</b><span>${escapeText(row.meaning||row.expected)}</span><strong>${row.students} STUDENTS · ${row.attempts} RETRIES</strong></article>`).join('')}</div>`:'<p class="raid-empty-result">공통 복습이 필요한 단어가 없습니다.</p>';
      };
      const baseRenderResults=renderResults;
      renderResults=function(){
        if(!V093_isRaid()){document.getElementById('results')?.classList.remove('raid-results-active');document.getElementById('raidResultsRoot')?.remove();return baseRenderResults();}
        updateArenaLabels();renderTeacher();
      };
      return Object.freeze({ renderStudent, renderTeacher, classReview });
    })();
    window.SUMUS_RAID_RESULTS=RaidResults;
