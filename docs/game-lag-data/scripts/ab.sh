#!/bin/bash
# ab.sh <out.jsonl> <passes> <seconds> "<cpus>" game...  : 전(운영 폴더) · 후(작업 폴더)를 번갈아 잰다
. ~/.s.sh
out=$1; passes=$2; secs=$3; cpus=$4; shift 4
for p in $(seq 1 "$passes"); do for g in "$@"; do for c in $cpus; do
  for side in "before:$S/wtprod:8789" "after:/home/user/sumus-quiz-battle:8788"; do
    tag=${side%%:*}; rest=${side#*:}; dir=${rest%%:*}; port=${rest##*:}
    "$S/srv.sh" "$dir" "$port"
    r=$(cd /home/user/sumus-quiz-battle && node docs/game-perf.mjs --base "http://localhost:$port" --game "$g" --cpu "$c" --seconds "$secs" $GP_EXTRA 2>&1 | grep '^{"game"' | tail -1)
    [ -z "$r" ] && r='{"game":"'$g'","cpu":'$c',"fail":true}'
    echo "{\"tag\":\"$tag\",\"pass\":$p,\"r\":$r}" >> "$out"
  done
done; done; done
echo DONE >> "$out"
