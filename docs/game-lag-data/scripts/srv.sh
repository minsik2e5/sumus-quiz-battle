#!/bin/bash
# srv.sh <dir> <port> : 그 폴더의 서버를 새 테스트 데이터로 다시 켠다(포트별 sqlite · pid 파일)
. ~/.s.sh
dir=$1; port=$2
if [ -f "$S/srv-$port.pid" ]; then kill "$(cat "$S/srv-$port.pid")" 2>/dev/null; sleep 0.3; fi
db="$S/db-$port-$RANDOM$RANDOM.sqlite"
cd "$dir" || exit 1
node -e "const {repository}=await import('./server/repository.mjs');const {testSeedState}=await import('./server/test-seed.mjs');const r=await repository('$db');const {revision}=await r.read();await r.commit(await testSeedState(),revision);process.exit(0)" 2>/dev/null
DATA_PATH="$db" PORT="$port" nohup node server/index.mjs > "$S/srv-$port.log" 2>&1 &
echo $! > "$S/srv-$port.pid"
sleep 1.5
