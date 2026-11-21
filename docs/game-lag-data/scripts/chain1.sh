#!/bin/bash
# 낚시 전·후가 끝나면: CSS 묶음 다시 만들기 → 짝 맞추기 · 인형뽑기 · 벽 통과 · 가위바위보 전·후 → 아레나(운영 243 vs #301)
. ~/.s.sh
until grep -q DONE "$S/ab-fishing2.jsonl"; do sleep 5; done
(cd /home/user/sumus-quiz-battle && npm run build:assets >/dev/null 2>&1)
"$S/ab.sh" "$S/ab-games.jsonl" 3 30 "4 6" match claw wall rps
echo ABDONE
"$S/ar-batch.sh" "$S/ar.jsonl" 3 40 "$S/wtprod:prod243 $S/wt301:pr301" "solo 2v2 ffa practice" "4:auto 6:0"
"$S/ar-batch.sh" "$S/ar1.jsonl" 1 40 "$S/wtprod:prod243 $S/wt301:pr301" "solo 2v2 ffa practice" "1:auto"
echo ARDONE
