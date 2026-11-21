#!/bin/bash
# rn-batch.sh <outfile> <passes> <stages...>
. ~/.s.sh; out=$1; passes=$2; shift 2
for p in $(seq 1 $passes); do for st in "$@"; do for c in "1 auto" "4 auto" "6 0"; do

  cpu=${c% *}; q=${c#* }
  r=$($S/rn.sh $cpu $q $st --user ts2 $EXTRA)
  echo "{\"stage\":$st,\"pass\":$p,\"r\":$r}" >> $out
done; done; done
echo DONE >> $out
