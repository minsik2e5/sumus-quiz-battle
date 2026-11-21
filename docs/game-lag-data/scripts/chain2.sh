#!/bin/bash
# 아레나 측정이 끝나면: 짝 맞추기 전·후(4× · 6× 세 번) → 5판 연속(메모리 · 나간 뒤 남는 것 · 탭 숨김)
. ~/.s.sh
until [ -f "$S/ar2-p.jsonl" ] && grep -q DONE "$S/ar2-p.jsonl"; do sleep 5; done
"$S/ab.sh" "$S/ab-match2.jsonl" 3 30 "4 6" match
for g in match fishing claw hunt rps yabawi; do
  "$S/srv.sh" /home/user/sumus-quiz-battle 8788
  r=$(cd /home/user/sumus-quiz-battle && node docs/game-perf.mjs --base http://localhost:8788 --game "$g" --cpu 1 --rounds 5 --seconds 45 --hide 2>&1 | grep '^{"game"' | tail -1)
  [ -z "$r" ] && r='{"game":"'$g'","fail":true}'
  echo "$r" >> "$S/leak.jsonl"
done
for g in wall timing; do
  "$S/srv.sh" /home/user/sumus-quiz-battle 8788
  r=$(cd /home/user/sumus-quiz-battle && node docs/game-perf.mjs --base http://localhost:8788 --game "$g" --cpu 1 --rounds 3 --seconds 80 --hide 2>&1 | grep '^{"game"' | tail -1)
  [ -z "$r" ] && r='{"game":"'$g'","fail":true}'
  echo "$r" >> "$S/leak.jsonl"
done
for g in yacha monster; do
  "$S/srv.sh" /home/user/sumus-quiz-battle 8788
  r=$(cd /home/user/sumus-quiz-battle && node docs/game-perf.mjs --base http://localhost:8788 --game "$g" --cpu 1 --rounds 2 --seconds 140 --hide 2>&1 | grep '^{"game"' | tail -1)
  [ -z "$r" ] && r='{"game":"'$g'","fail":true}'
  echo "$r" >> "$S/leak.jsonl"
done
echo DONE >> "$S/leak.jsonl"
