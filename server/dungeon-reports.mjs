// V13.128 던전 결과 보고 모아 처리하기. 메인 상태 객체는 변경마다 상태 전체를 복사 · 저장하므로, 결과 보고가
// 몰리면 보고 수만큼 줄이 길어진다(server/dungeon-load.mjs로 잼: 2.4MB 상태에서 보고 하나에 약 0.1초).
// 그래서 앞 묶음을 처리하는 동안 온 보고를 모아 한 번의 변경으로 처리한다(group commit).
// 이미 처리한 보고(재시도로 다시 온 것)는 줄에 넣지 않고 바로 끝낸다.
import { settleDungeon, dungeonReportPending } from './service.mjs';
import { NO_MUTATION } from './mutation-coordinator.mjs';

// run(items)을 한 번에 하나씩 돌리고, 돌리는 동안 들어온 것을 다음 묶음으로 모은다.
export function createBatcher(run) {
  let current = null, tail = Promise.resolve();
  return item => {
    if (!current) {
      const batch = current = { items: [] };
      batch.done = tail.then(() => { current = null; return run(batch.items); });
      tail = batch.done.catch(() => {});
    }
    current.items.push(item);
    return current.done;
  };
}

// mutations: createMutationCoordinator 결과(current · durable). 돌려주는 함수는 보고 하나를 받아
// 그 보고가 상태에 들어간 뒤(또는 이미 들어가 있으면 바로) 끝난다.
export function createDungeonReporter(mutations) {
  const batched = createBatcher(async reports => {
    const fresh = reports.filter(r => dungeonReportPending(mutations.current().state, r));
    if (!fresh.length) return 0;
    let count = 0;
    await mutations.durable(state => { count = 0; for (const r of fresh) if (settleDungeon(state, r)) count++; return count ? { ok: true } : NO_MUTATION; });
    return count;
  });
  return report => dungeonReportPending(mutations.current().state, report) ? batched(report) : Promise.resolve(0);
}
