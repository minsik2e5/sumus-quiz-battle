#!/bin/bash
# ar-batch.sh <out.jsonl> <passes> <seconds> "<dir:tag ...>" "<modes>" "<cpu:tier ...>"
# 펫 아레나를 폴더(브랜치)별 · 모드별 · 조건별로 번갈아 잰다(같은 pass 안에서 브랜치를 번갈아 → 기계 상태 차이를 줄임)
. ~/.s.sh
out=$1; passes=$2; secs=$3; dirs=$4; modes=$5; conds=$6
for p in $(seq 1 "$passes"); do for m in $modes; do for c in $conds; do for d in $dirs; do
  dir=${d%%:*}; tag=${d##*:}; cpu=${c%%:*}; tier=${c##*:}
  case $m in solo) extra="";; practice) extra="--practice";; *) extra="--mode $m";; esac
  r=$(cd "$dir" && node docs/arena-perf.mjs --cpu "$cpu" --seconds "$secs" --tier "$tier" $extra 2>&1 | grep '^{"mode"' | tail -1)
  [ -z "$r" ] && r='{"fail":true}'
  echo "{\"tag\":\"$tag\",\"m\":\"$m\",\"cpu\":$cpu,\"tier\":\"$tier\",\"pass\":$p,\"r\":$r}" >> "$out"
done; done; done; done
echo DONE >> "$out"
