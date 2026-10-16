import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import { toast } from '@/shared/ui/toast';
import { createTag, deleteTag, getTags, setTodoTags, updateTag } from './api';

export function useTags() {
  const activeId = useWorkspaceStore((s) => s.activeId);
  return useQuery({ queryKey: ['tags', activeId], queryFn: getTags });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color?: string }) => createTag(name, color),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '태그를 만들지 못했어요'),
  });
}

/** 태그 이름 변경 — 할 일에 붙은 칩 라벨도 함께 바뀌므로 todos 캐시까지 무효화한다. */
export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, color }: { id: number; name?: string; color?: string }) =>
      updateTag(id, { name, color }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      qc.invalidateQueries({ queryKey: ['todos'] });
      toast.success('태그를 수정했어요');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '태그를 수정하지 못했어요'),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTag(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      qc.invalidateQueries({ queryKey: ['todos'] });
      toast.success('태그를 삭제했어요');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '태그를 삭제하지 못했어요'),
  });
}

export function useSetTodoTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ todoId, tagIds }: { todoId: number; tagIds: number[] }) => setTodoTags(todoId, tagIds),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['todos'] });
      qc.invalidateQueries({ queryKey: ['todo', v.todoId] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '태그를 변경하지 못했어요'),
  });
}
