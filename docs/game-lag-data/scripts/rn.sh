#!/bin/bash
# usage: rn.sh <cpu> <q> <stage> [extra...]
cd /home/user/sumus-quiz-battle; . ~/.s.sh
cpu=$1; q=$2; st=$3; shift 3
node docs/runner-play-shot.mjs --perf --cpu $cpu --q $q --stage $st --window ${WIN:-40} --out $S/shots "$@" 2>&1 | tail -1 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const p=JSON.parse(s);delete p.errors;delete p.res_log;console.log(JSON.stringify(p))}catch(e){console.log(s.slice(0,600))}})"
