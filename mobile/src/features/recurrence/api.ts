import { api } from '@/api/client';

export type RecurrenceType = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface Recurrence {
  recurrenceType?: string;
  endDate?: string;
}

/** 반복 옵션 — 기존 웹 constants/recurrence.js와 동일 */
export const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'NONE', label: '반복 없음' },
  { value: 'DAILY', label: '매일' },
  { value: 'WEEKLY', label: '매주' },
  { value: 'MONTHLY', label: '매월' },
];

export async function getRecurrence(todoId: number): Promise<Recurrence | null> {
  const { data } = await api.get<Recurrence | null>(`/api/todos/${todoId}/recurrence`);
  return data;
}

export type RecurrenceScope = 'THIS' | 'THIS_AND_FOLLOWING' | 'ALL';

/** 반복 할 일의 필드 변경을 다른 인스턴스에도 전파. scope THIS는 호출 불필요(현재 항목만). */
export async function propagateRecurrence(
  todoId: number,
  scope: Exclude<RecurrenceScope, 'THIS'>,
  field: string,
  value: string,
): Promise<void> {
  await api.post(`/api/todos/${todoId}/recurrence-propagate`, { scope, field, value });
}

export async function upsertRecurrence(
  todoId: number,
  recurrenceType: RecurrenceType,
  endDate?: string,
): Promise<Recurrence> {
  const { data } = await api.put<Recurrence>(`/api/todos/${todoId}/recurrence`, {
    recurrenceType,
    endDate: endDate ?? null,
  });
  return data;
}
