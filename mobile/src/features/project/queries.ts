import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import { toast } from '@/shared/ui/toast';
import * as projectApi from './api';

export const projectKeys = { all: ['projects'] as const };

export function useProjects() {
  const activeId = useWorkspaceStore((s) => s.activeId);
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: projectApi.getProjects,
    enabled: activeId != null,
  });
}

/** 프로젝트 상세 개요의 최근 활동 피드 */
export function useProjectActivity(projectId: number) {
  return useQuery({
    queryKey: ['project-activity', projectId],
    queryFn: () => projectApi.getProjectActivity(projectId),
    enabled: Number.isFinite(projectId),
    staleTime: 30_000,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color, icon }: { name: string; color?: string; icon?: string }) =>
      projectApi.createProject(name, color, icon),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      toast.success('프로젝트를 추가했어요');
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, color, icon }: { id: number; name: string; color?: string; icon?: string }) =>
      projectApi.updateProject(id, name, color, icon),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      toast.success('프로젝트를 수정했어요');
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => projectApi.deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      toast.success('프로젝트를 삭제했어요');
    },
  });
}
