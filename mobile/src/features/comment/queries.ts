import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as commentApi from './api';

export const commentKeys = {
  list: (todoId: number) => ['comments', todoId] as const,
};

export function useComments(todoId: number) {
  return useQuery({
    queryKey: commentKeys.list(todoId),
    queryFn: () => commentApi.getComments(todoId),
  });
}

export function useCreateComment(todoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => commentApi.createComment(todoId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: commentKeys.list(todoId) }),
  });
}

export function useDeleteComment(todoId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: number) => commentApi.deleteComment(commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: commentKeys.list(todoId) }),
  });
}
