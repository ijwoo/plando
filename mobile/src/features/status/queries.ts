import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import { toast } from '@/shared/ui/toast';
import type { Todo } from '@/features/todo/api';
import type { WorkflowStatusLite } from '@/api/typesExt';
import { createStatus, deleteStatus, getStatuses, reorderStatuses, setDefaultStatus, updateStatus } from './api';

export function useStatuses() {
  const activeId = useWorkspaceStore((s) => s.activeId);
  return useQuery({ queryKey: ['statuses', activeId], queryFn: getStatuses });
}

/** 상태 key → 정의 맵 + 기본 폴백(TODO/IN_PROGRESS/DONE). 라벨·색·완료판정에 사용. */
export function useStatusMap() {
  const { data } = useStatuses();
  return useMemo(() => {
    const map = new Map<string, WorkflowStatusLite>();
    for (const s of data ?? []) map.set(s.statusKey, s);
    const label = (key?: string | null) => (key ? map.get(key)?.label ?? DEFAULT_LABEL[key] ?? key : '');
    const color = (key?: string | null) => (key ? map.get(key)?.color ?? null : null);
    const category = (key?: string | null) => (key ? map.get(key)?.category ?? DEFAULT_CATEGORY[key] ?? 'TODO' : 'TODO');
    return { list: data ?? [], map, label, color, category };
  }, [data]);
}

/** 완료 판정 — 응답 doneAt 우선(카테고리 안전), 없으면 기본 DONE key 폴백. */
export function isTodoDone(todo: Pick<Todo, 'doneAt' | 'status'>): boolean {
  if (todo.doneAt != null) return true;
  return todo.status === 'DONE';
}

/**
 * 완료 처리에 쓸 상태 key — DONE 카테고리의 첫 항목, 없으면 'DONE'.
 *
 * 예전엔 완료 토글이 'DONE'/'TODO'를 하드코딩했다. 그런데 기본 DONE 상태는 같은 카테고리에
 * 다른 상태가 하나라도 있으면 삭제할 수 있고(WorkflowStatusService.delete), 서버는
 * isValidKey로 워크스페이스에 실제 존재하는 key만 받는다. 즉 "완료"를 지우고 "검수완료"만
 * 남긴 워크스페이스에서는 앱의 완료 체크가 전부 400으로 실패했다.
 * 웹은 이미 doneTodoStatusKey를 쓰고 있었고 모바일에만 없었다.
 */
export function doneStatusKey(statuses?: WorkflowStatusLite[] | null): string {
  const found = (statuses ?? []).find((s) => s.category === 'DONE');
  return found?.statusKey ?? 'DONE';
}

/** 미완료로 되돌릴 상태 key — TODO 카테고리의 기본 항목, 없으면 첫 항목, 없으면 'TODO'. */
export function undoneStatusKey(statuses?: WorkflowStatusLite[] | null): string {
  const list = statuses ?? [];
  const todoCat = list.filter((s) => s.category === 'TODO');
  const pick = todoCat.find((s) => s.isDefault) ?? todoCat[0] ?? list[0];
  return pick?.statusKey ?? 'TODO';
}

const DEFAULT_LABEL: Record<string, string> = { TODO: '할 일', IN_PROGRESS: '진행 중', DONE: '완료' };
const DEFAULT_CATEGORY: Record<string, 'TODO' | 'IN_PROGRESS' | 'DONE'> = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
};

export function useCreateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ label, category, color }: { label: string; category: string; color?: string }) =>
      createStatus(label, category, color),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statuses'] }),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '상태를 만들지 못했어요'),
  });
}

export function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: { label?: string; category?: string; color?: string } }) => updateStatus(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['statuses'] });
      qc.invalidateQueries({ queryKey: ['todos'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '상태를 수정하지 못했어요'),
  });
}

export function useReorderStatuses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: number[]) => reorderStatuses(orderedIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statuses'] }),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '순서를 바꾸지 못했어요'),
  });
}

export function useSetDefaultStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => setDefaultStatus(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['statuses'] }),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '기본 상태를 지정하지 못했어요'),
  });
}

export function useDeleteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reassignTo }: { id: number; reassignTo: string }) => deleteStatus(id, reassignTo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['statuses'] });
      qc.invalidateQueries({ queryKey: ['todos'] });
      toast.success('상태를 삭제했어요');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '상태를 삭제하지 못했어요'),
  });
}
