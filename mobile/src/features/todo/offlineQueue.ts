import * as SecureStore from 'expo-secure-store';

import { capItems, partition, type QueuedTodo } from './offlineQueueCore';

export { newClientKey, type QueuedTodo } from './offlineQueueCore';

/**
 * 오프라인에서 적은 할 일을 담아두는 큐.
 *
 * 왜 필요한가: 지금은 네트워크가 없으면 토스트 하나 뜨고 **적은 것이 사라진다**
 * (shared/query/queryClient.ts 주석에 "오프라인 큐를 제대로 만들기 전까지" 라고 적힌 그 빚).
 * 할 일 앱은 떠오를 때 적는 도구인데, 떠오르는 순간이 하필 지하철인 경우가 많다.
 *
 * **재전송의 위험은 중복이다.** 보냈는데 응답만 못 받으면 서버는 이미 만들었고 앱은
 * 실패로 안다. 그래서 항목마다 열쇠(clientKey)를 붙여 보내고, 서버가 같은 열쇠를 보면
 * 새로 만들지 않고 있던 것을 돌려준다. 몇 번을 다시 보내도 결과가 같다.
 *
 * 저장소는 SecureStore 를 쓴다 — 이 앱이 로컬 설정에 이미 쓰고 있어서 새 네이티브
 * 의존성을 늘리지 않는다. 큐는 몇 건 수준이라 크기도 문제되지 않는다.
 */

const KEY = 'plando.todo.offlineQueue.v1';

async function read(): Promise<QueuedTodo[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // 저장소가 깨졌으면 큐를 잃는 게 앱이 죽는 것보다 낫다
    return [];
  }
}



async function write(items: QueuedTodo[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(capItems(items)));
  } catch {
    // 저장 실패는 삼킨다 — 여기서 던지면 원래 하던 저장까지 못 하게 된다
  }
}

export async function enqueue(item: QueuedTodo): Promise<void> {
  const items = await read();
  items.push(item);
  await write(items);
}

export async function peekAll(): Promise<QueuedTodo[]> {
  return read();
}

export async function count(): Promise<number> {
  return (await read()).length;
}

export async function clear(): Promise<void> {
  await write([]);
}

/**
 * 큐를 비우며 하나씩 보낸다.
 *
 * 실패한 것은 **큐에 남긴다.** 성공한 것만 빼는 게 핵심이다 — 통째로 지우면 네트워크가
 * 반쯤 살아난 상태에서 나머지를 잃는다.
 *
 * @param send 한 건을 실제로 보내는 함수. 성공하면 resolve.
 * @returns 보낸 건수
 */
export async function drain(send: (item: QueuedTodo) => Promise<unknown>): Promise<number> {
  const items = await read();
  if (items.length === 0) return 0;
  const { sent, left } = await partition(items, send);
  await write(left);
  return sent;
}
