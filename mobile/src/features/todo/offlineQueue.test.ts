import assert from 'node:assert/strict';
import { test } from 'node:test';

import { capItems, newClientKey, partition, type QueuedTodo } from './offlineQueueCore.ts';

/**
 * 오프라인 큐의 판단 부분.
 *
 * [고정하는 결함] 지금은 네트워크가 없으면 적은 것이 사라진다. 담아뒀다 다시 보내야 하는데
 * 재전송에는 함정이 있다 — **통째로 지우면 반쯤 살아난 연결에서 나머지를 잃는다.**
 * 성공한 것만 빼는 것이 이 큐의 핵심이다.
 *
 * 저장소(SecureStore)를 타는 부분은 얇은 껍데기라, 판단하는 곳만 여기서 고정한다.
 */

const item = (title: string): QueuedTodo => ({
  clientKey: newClientKey(),
  payload: { title, status: 'TODO' },
  queuedAt: Date.now(),
});

test('성공한 것만 빠지고 실패한 것은 남는다', async () => {
  const { sent, left } = await partition(
    [item('첫째'), item('둘째'), item('셋째')],
    async (it) => {
      if (it.payload.title === '둘째') throw new Error('network');
      return true;
    },
  );
  assert.equal(sent, 2);
  assert.equal(left.length, 1, '못 보낸 것만 남아야 한다');
  assert.equal(left[0].payload.title, '둘째');
});

test('전부 실패하면 하나도 잃지 않는다', async () => {
  const items = [item('가'), item('나')];
  const { sent, left } = await partition(items, async () => { throw new Error('network'); });
  assert.equal(sent, 0);
  assert.equal(left.length, 2);
});

test('전부 성공하면 큐가 빈다', async () => {
  const { sent, left } = await partition([item('가'), item('나')], async () => true);
  assert.equal(sent, 2);
  assert.equal(left.length, 0);
});

test('빈 큐는 아무 일도 하지 않는다', async () => {
  const { sent, left } = await partition([], async () => true);
  assert.equal(sent, 0);
  assert.equal(left.length, 0);
});

test('상한을 넘으면 오래된 것부터 버린다', () => {
  /* 방금 적은 것이 우선이다 — 무한히 쌓이면 저장소 한도에 걸린다. */
  const many = Array.from({ length: 35 }, (_, i) => item(`항목${i + 1}`));
  const capped = capItems(many, 30);
  assert.equal(capped.length, 30);
  assert.equal(capped[capped.length - 1].payload.title, '항목35', '가장 최근 것은 남는다');
  assert.ok(!capped.some((x) => x.payload.title === '항목1'), '가장 오래된 것은 빠진다');
});

test('상한 이하면 그대로 둔다', () => {
  const few = [item('가'), item('나')];
  assert.equal(capItems(few, 30).length, 2);
});

test('열쇠는 매번 다르다', () => {
  /* 같으면 서버가 서로 다른 할 일을 같은 것으로 보고 하나만 만든다. */
  const keys = new Set(Array.from({ length: 500 }, () => newClientKey()));
  assert.equal(keys.size, 500);
});
