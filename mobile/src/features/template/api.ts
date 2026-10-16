import { api } from '@/api/client';
import type { Schemas } from '@/api/types';

export type TodoTemplate = Schemas['TodoTemplateResponse'];
export type TodoTemplateInput = Schemas['TodoTemplateRequest'];

/** 워크스페이스 템플릿 목록 (경로에 workspaceId 필요) */
export async function getTemplates(workspaceId: number): Promise<TodoTemplate[]> {
  const { data } = await api.get<TodoTemplate[]>(`/api/workspaces/${workspaceId}/templates`);
  return data;
}

export async function createTemplate(workspaceId: number, input: TodoTemplateInput): Promise<TodoTemplate> {
  const { data } = await api.post<TodoTemplate>(`/api/workspaces/${workspaceId}/templates`, input);
  return data;
}

export async function updateTemplate(
  workspaceId: number,
  id: number,
  input: TodoTemplateInput,
): Promise<TodoTemplate> {
  const { data } = await api.put<TodoTemplate>(`/api/workspaces/${workspaceId}/templates/${id}`, input);
  return data;
}

export async function deleteTemplate(workspaceId: number, id: number): Promise<void> {
  await api.delete(`/api/workspaces/${workspaceId}/templates/${id}`);
}
