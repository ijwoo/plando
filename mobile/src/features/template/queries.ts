import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createTodo } from '@/features/todo/api';
import { newTodoStatusKey, todoKeys } from '@/features/todo/queries';
import { useStatuses } from '@/features/status/queries';
import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import { toast } from '@/shared/ui/toast';
import * as templateApi from './api';
import type { TodoTemplate, TodoTemplateInput } from './api';

const key = (wsId: number | null) => ['templates', wsId] as const;

export function useTemplates() {
  const activeId = useWorkspaceStore((s) => s.activeId);
  return useQuery({
    queryKey: key(activeId),
    queryFn: () => templateApi.getTemplates(activeId as number),
    enabled: activeId != null,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  const activeId = useWorkspaceStore((s) => s.activeId);
  return useMutation({
    mutationFn: (input: TodoTemplateInput) => templateApi.createTemplate(activeId as number, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(activeId) });
      toast.success('템플릿을 추가했어요');
    },
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  const activeId = useWorkspaceStore((s) => s.activeId);
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: TodoTemplateInput }) =>
      templateApi.updateTemplate(activeId as number, id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(activeId) }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  const activeId = useWorkspaceStore((s) => s.activeId);
  return useMutation({
    mutationFn: (id: number) => templateApi.deleteTemplate(activeId as number, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(activeId) });
      toast.success('템플릿을 삭제했어요');
    },
  });
}

/**
 * 템플릿으로 할 일 생성 — 제목/내용/우선순위/프로젝트/담당자로 todo 생성.
 * (템플릿의 defaultSubtasks는 예전 체크리스트 필드로, 체크리스트 제거 후 더 이상 적용하지 않는다)
 */
export function useApplyTemplate() {
  const qc = useQueryClient();
  // raw createTodo 를 쓰므로 useCreateTodo 의 기본 상태 처리를 타지 않는다. 같은 규칙을 직접 적용.
  const { data: statuses } = useStatuses();
  return useMutation({
    mutationFn: async (t: TodoTemplate) => {
      return createTodo({
        title: t.defaultTitle?.trim() || t.name || '새 할 일',
        status: newTodoStatusKey(statuses),
        priority: (t.defaultPriority as 'HIGH' | 'MEDIUM' | 'LOW') ?? undefined,
        content: t.defaultContent || undefined,
        projectId: t.defaultProjectId ?? undefined,
        assignees: t.defaultAssigneeEmails ?? undefined,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: todoKeys.all }),
  });
}
