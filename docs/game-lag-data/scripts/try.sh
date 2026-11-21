#!/bin/bash
# try.sh <cpu> <seconds> game...  : 게임을 하나씩 돌려 결과 한 줄(또는 오류 첫 줄)을 찍는다
. ~/.s.sh
cpu=$1; secs=$2; shift 2
for g in "$@"; do
  echo "== $g"
  "$S/gp.sh" "$g" "$cpu" --seconds "$secs" 2>&1 | grep "game\|Error\|waiting for\|Timeout" | head -3 | cut -c1-${CUT:-700}
done
