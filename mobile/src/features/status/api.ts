import { api } from '@/api/client';
import type { WorkflowStatusLite } from '@/api/typesExt';

export async function getStatuses(): Promise<WorkflowStatusLite[]> {
  const { data } = await api.get<WorkflowStatusLite[]>('/api/statuses');
  return data ?? [];
}

export async function createStatus(label: string, category: string, color?: string): Promise<WorkflowStatusLite> {
  const { data } = await api.post<WorkflowStatusLite>('/api/statuses', { label, category, color });
  return data;
}

export async function updateStatus(
  id: number,
  patch: { label?: string; category?: string; color?: string },
): Promise<WorkflowStatusLite> {
  const { data } = await api.patch<WorkflowStatusLite>(`/api/statuses/${id}`, patch);
  return data;
}

export async function reorderStatuses(orderedIds: number[]): Promise<void> {
  await api.patch('/api/statuses/reorder', { orderedIds });
}

export async function setDefaultStatus(id: number): Promise<void> {
  await api.patch(`/api/statuses/${id}/default`);
}

export async function deleteStatus(id: number, reassignTo: string): Promise<void> {
  await api.delete(`/api/statuses/${id}`, { params: { reassignTo } });
}
