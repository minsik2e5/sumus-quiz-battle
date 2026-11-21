#!/bin/bash
# cssx.sh <out> <game> <cpu> <passes> <css> : 작업 폴더에서 기본 · 실험 CSS를 번갈아 잰다
. ~/.s.sh
out=$1; g=$2; c=$3; passes=$4; css=$5
for p in $(seq 1 "$passes"); do
  for v in base css; do
    "$S/srv.sh" /home/user/sumus-quiz-battle 8788
    if [ "$v" = css ]; then r=$(cd /home/user/sumus-quiz-battle && node docs/game-perf.mjs --base http://localhost:8788 --game "$g" --cpu "$c" --seconds 30 --css "$css" 2>&1 | grep '^{"game"' | tail -1)
    else r=$(cd /home/user/sumus-quiz-battle && node docs/game-perf.mjs --base http://localhost:8788 --game "$g" --cpu "$c" --seconds 30 2>&1 | grep '^{"game"' | tail -1); fi
    [ -z "$r" ] && r='{"game":"'$g'","cpu":'$c',"fail":true}'
    echo "{\"tag\":\"$v\",\"pass\":$p,\"r\":$r}" >> "$out"
  done
done
