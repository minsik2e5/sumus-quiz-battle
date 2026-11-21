#!/bin/bash
# tr.sh <cpu> <seconds> game... : 작업 폴더로 트레이스 한 번씩(원인 찾기) → $S/tr-<game>.txt
. ~/.s.sh
cpu=$1; secs=$2; shift 2
for g in "$@"; do
  "$S/srv.sh" /home/user/sumus-quiz-battle 8788
  (cd /home/user/sumus-quiz-battle && node docs/game-perf.mjs --base http://localhost:8788 --game "$g" --cpu "$cpu" --seconds "$secs" --trace 2>&1 | grep -v '^    at' | cut -c1-900) > "$S/tr-$g.txt"
done
echo TRDONE
