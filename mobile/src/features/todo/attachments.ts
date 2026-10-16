import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/client';
import type { Schemas } from '@/api/types';

export type TodoAttachment = Schemas['TodoAttachmentResponse'];
type UploadFile = { uri: string; name: string; type: string };

const key = (todoId: number) => ['todo', todoId, 'attachments'] as const;

export function useAttachments(todoId: number) {
  return useQuery({
    queryKey: key(todoId),
    queryFn: async () => (await api.get<TodoAttachment[]>(`/api/todos/${todoId}/attachments`)).data,
  });
}

export function useUploadAttachment(todoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: UploadFile) => {
      const form = new FormData();
      // RN multipart: { uri, name, type } 객체
      form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
      await api.post(`/api/todos/${todoId}/attachments`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(todoId) }),
  });
}

export function useDeleteAttachment(todoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachId: number) => api.delete(`/api/todos/${todoId}/attachments/${attachId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(todoId) }),
  });
}
