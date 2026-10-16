import { api } from '@/api/client';
import type { Schemas } from '@/api/types';

export type Comment = Schemas['CommentResponse'];

export async function getComments(todoId: number): Promise<Comment[]> {
  const { data } = await api.get<Comment[]>(`/api/comments/${todoId}`);
  return data;
}

export async function createComment(todoId: number, content: string): Promise<Comment> {
  const { data } = await api.post<Comment>('/api/comments', { todoId, content });
  return data;
}

export async function deleteComment(commentId: number): Promise<void> {
  await api.delete(`/api/comments/${commentId}`);
}
