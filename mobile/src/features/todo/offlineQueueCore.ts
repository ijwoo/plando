import type { Schemas } from '@/api/types';

/**
 * 오프라인 큐의 **판단 부분** — 저장소를 타지 않는다.
 *
 * SecureStore 를 쓰는 쪽(offlineQueue.ts)과 나눠 둔 이유: 재전송 규칙은 이 앱에서 데이터를
 * 잃느냐 마느냐를 가르는 곳이라 반드시 시험해야 하는데, 네이티브 저장소를 함께 물고 있으면
 * 노드 테스트에서 부를 수 없다.
 */

/** 큐에 담아둘 상한. 넘으면 오래된 것부터 버린다 — 방금 적은 것이 우선이다. */
export const MAX_ITEMS = 30;

export type QueuedTodo = {
  /** 재전송 중복 방지 열쇠. 서버가 이 값으로 같은 요청을 알아본다. */
  clientKey: string;
  /** 보낼 내용. status 는 담을 때 확정해 둔다(나중에 기본값이 바뀌어도 적을 때 상태를 지킨다). */
  payload: Schemas['TodoRequestDto'];
  queuedAt: number;
};

/** 열쇠 하나. 시각과 난수를 섞어 재설치·시계 변경에도 겹치지 않게. */
export function newClientKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 상한을 넘으면 오래된 것부터 버린다. */
export function capItems(items: QueuedTodo[], max: number = MAX_ITEMS): QueuedTodo[] {
  return items.length <= max ? items : items.slice(items.length - max);
}

/**
 * 하나씩 보내고 **성공한 것만** 빼낸다.
 *
 * 통째로 지우면 반쯤 살아난 연결에서 못 보낸 것을 잃는다. 그래서 실패한 것은 남긴다.
 */
export async function partition(
  items: QueuedTodo[],
  send: (item: QueuedTodo) => Promise<unknown>,
): Promise<{ sent: number; left: QueuedTodo[] }> {
  const left: QueuedTodo[] = [];
  let sent = 0;
  for (const item of items) {
    try {
      await send(item);
      sent++;
    } catch {
      left.push(item);
    }
  }
  return { sent, left };
}
