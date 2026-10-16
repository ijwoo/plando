import { api } from '@/api/client';
import type { TagLite } from '@/api/typesExt';

export async function getTags(): Promise<TagLite[]> {
  const { data } = await api.get<TagLite[]>('/api/tags');
  return data ?? [];
}

export async function createTag(name: string, color?: string): Promise<TagLite> {
  const { data } = await api.post<TagLite>('/api/tags', { name, color });
  return data;
}

/** 태그 이름·색 수정 (PATCH). 백엔드는 넘긴 키만 반영한다. */
export async function updateTag(id: number, patch: { name?: string; color?: string }): Promise<TagLite> {
  const { data } = await api.patch<TagLite>(`/api/tags/${id}`, patch);
  return data;
}

export async function deleteTag(id: number): Promise<void> {
  await api.delete(`/api/tags/${id}`);
}

/** 할 일의 태그 전체 교체 */
export async function setTodoTags(todoId: number, tagIds: number[]): Promise<TagLite[]> {
  const { data } = await api.put<TagLite[]>(`/api/todos/${todoId}/tags`, { tagIds });
  return data ?? [];
}
