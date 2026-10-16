import { api } from '@/api/client';
import type { Schemas } from '@/api/types';
import type { Todo } from '@/features/todo/api';

export type TodoLocation = Schemas['TodoLocationDto'];
export type TriggerItem = Schemas['TriggerItem'];
export type TriggerMap = Record<string, TriggerItem>;

/** 위치가 등록된 할 일 목록 */
export async function getLocationTodos(): Promise<Todo[]> {
  const { data } = await api.get<Todo[]>('/api/todos/location');
  return data;
}

/** 할 일 위치 저장/수정 */
export async function updateTodoLocation(id: number, location: TodoLocation): Promise<void> {
  await api.patch(`/api/todos/${id}/location`, location);
}

/** 장소 알림 트리거 전체 조회 → { [todoId]: { enabled, radius } } */
export async function getTriggers(): Promise<TriggerMap> {
  const { data } = await api.get<TriggerMap>('/api/triggers');
  return data ?? {};
}

/** 트리거 일괄 저장(upsert) */
export async function saveTriggers(map: TriggerMap): Promise<void> {
  await api.put('/api/triggers', map);
}
