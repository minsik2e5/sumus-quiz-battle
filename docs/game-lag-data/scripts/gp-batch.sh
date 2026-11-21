#!/bin/bash
# gp-batch.sh <out.jsonl> <dir> <port> <tag> <passes> <seconds> "<cpus>" game...
# 게임 × CPU 배율을 passes번 돌려 한 줄씩 적는다(판마다 서버를 새 데이터로 다시 켠다). 측정 스크립트는 항상 지금 작업 폴더의 것.
. ~/.s.sh
out=$1; dir=$2; port=$3; tag=$4; passes=$5; secs=$6; cpus=$7; shift 7
for p in $(seq 1 "$passes"); do for g in "$@"; do for c in $cpus; do
  "$S/srv.sh" "$dir" "$port"
  r=$(cd /home/user/sumus-quiz-battle && node docs/game-perf.mjs --base "http://localhost:$port" --game "$g" --cpu "$c" --seconds "$secs" $GP_EXTRA 2>&1 | grep '^{"game"' | tail -1)
  [ -z "$r" ] && r='{"game":"'$g'","cpu":'$c',"fail":true}'
  echo "{\"tag\":\"$tag\",\"pass\":$p,\"r\":$r}" >> "$out"
done; done; done
echo DONE >> "$out"
