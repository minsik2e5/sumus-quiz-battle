#!/bin/bash
# 두 번째 서버(8788)를 새 테스트 데이터로 다시 켠다
. ~/.s.sh; cd /home/user/sumus-quiz-battle
pkill -f "PORT2MARK" 2>/dev/null; kill $(cat $S/srv2.pid 2>/dev/null) 2>/dev/null; sleep 0.3
rm -f $S/g.sqlite*
node -e "const {repository}=await import('./server/repository.mjs');const {testSeedState}=await import('./server/test-seed.mjs');const r=await repository('$S/g.sqlite');const {revision}=await r.read();await r.commit(await testSeedState(),revision);process.exit(0)" 2>/dev/null
DATA_PATH=$S/g.sqlite PORT=8788 nohup node server/index.mjs > $S/srv2.log 2>&1 &
echo $! > $S/srv2.pid; sleep 1.5
