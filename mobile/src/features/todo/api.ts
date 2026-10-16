import { api } from '@/api/client';
import type { TodoExt, TodoRequestExt } from '@/api/typesExt';
import type { TodoStatus } from '@/shared/ui/tone';

// 서브태스크 필드(parentId/subtaskTotal/subtaskDone) 합성 — 백엔드 머지 후 typesExt 제거 시 원복
export type Todo = TodoExt;
export type TodoRequest = TodoRequestExt;
export type { TodoStatus };

/** 활성 워크스페이스의 미보관(non-archived) todo 목록 (헤더 없으면 백엔드가 기본 워크스페이스 사용) */
export async function getTodos(): Promise<Todo[]> {
  const { data } = await api.get<Todo[]>('/api/todos');
  return data;
}

export async function createTodo(input: TodoRequest): Promise<Todo> {
  const { data } = await api.post<Todo>('/api/todos', input);
  return data;
}

export async function getTodo(id: number): Promise<Todo> {
  const { data } = await api.get<Todo>(`/api/todos/${id}`);
  return data;
}

/** 부모의 서브태스크 목록 (깊이 1단계 — 서브태스크는 자식을 가질 수 없음) */
export async function getSubtasks(id: number): Promise<Todo[]> {
  const { data } = await api.get<Todo[]>(`/api/todos/${id}/subtasks`);
  return data;
}

/** 전체 수정 (PUT). 보내지 않은 필드는 비워지므로 기존 값과 병합해서 호출한다. */
export async function updateTodo(id: number, dto: TodoRequest): Promise<Todo> {
  const { data } = await api.put<Todo>(`/api/todos/${id}`, dto);
  return data;
}

/**
 * 상태 변경. status는 워크플로우 상태의 statusKey — 커스텀 상태가 있으므로 TodoStatus 3종으로
 * 좁히면 안 된다(그렇게 좁혀 두었던 탓에 호출부가 'DONE'/'TODO'를 하드코딩하게 됐다).
 */
export async function updateTodoStatus(id: number, status: string): Promise<void> {
  await api.put(`/api/todos/${id}/status`, { status });
}

/** 단건 필드 자동저장 — 웹 updateTodoField와 동일(PATCH {field, value}). 권한 없으면 403. */
export async function updateTodoField(id: number, field: string, value: unknown): Promise<void> {
  await api.patch(`/api/todos/${id}`, { field, value });
}

export async function deleteTodo(id: number): Promise<void> {
  await api.delete(`/api/todos/${id}`);
}

/** 포커스(⚡) 토글 — per-user 전용 엔드포인트(일반 필드 patch는 focused 미지원). */
export async function updateTodoFocus(id: number, focused: boolean): Promise<void> {
  await api.patch(`/api/todos/${id}/focus`, { focused });
}

/** 보관된 할 일 목록 */
export async function getArchivedTodos(): Promise<Todo[]> {
  const { data } = await api.get<Todo[]>('/api/todos/archived');
  return data;
}

export async function archiveTodo(id: number): Promise<void> {
  await api.patch(`/api/todos/${id}/archive`);
}

export async function restoreTodo(id: number): Promise<void> {
  await api.patch(`/api/todos/${id}/restore`);
}

/** 샘플 할 일 존재 여부 — 신규 계정 첫인상용 */
export async function sampleTodosExist(): Promise<boolean> {
  const { data } = await api.get<boolean>('/api/sample-todos/exists');
  return !!data;
}

/** 샘플 할 일 생성(재생성) — 빈 계정 온보딩 직후 채움 */
export async function recreateSampleTodos(): Promise<void> {
  await api.post('/api/sample-todos/recreate');
}
