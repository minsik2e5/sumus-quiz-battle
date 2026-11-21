#!/bin/bash
# gp.sh <game> <cpu> [extra]  (서버를 새로 켜고 한 번 잰다)
. ~/.s.sh; cd /home/user/sumus-quiz-battle; g=$1; c=$2; shift 2
$S/srv2.sh; node docs/game-perf.mjs --base http://localhost:8788 --game $g --cpu $c "$@" 2>&1 | tail -4 | cut -c1-1800
