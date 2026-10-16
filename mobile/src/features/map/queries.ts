import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { todoKeys } from '@/features/todo/queries';
import { useWorkspaceStore } from '@/shared/store/workspaceStore';
import { toast } from '@/shared/ui/toast';
import * as mapApi from './api';
import type { TodoLocation, TriggerMap } from './api';

export const mapKeys = {
  locationTodos: ['map', 'locationTodos'] as const,
  triggers: ['map', 'triggers'] as const,
};

export function useLocationTodos() {
  // 워크스페이스 스코프 — 헤더 확정 전 fetch 방지 (지오펜스가 잘못된 데이터로 sync되는 것 차단)
  const activeId = useWorkspaceStore((s) => s.activeId);
  return useQuery({
    queryKey: mapKeys.locationTodos,
    queryFn: mapApi.getLocationTodos,
    enabled: activeId != null,
  });
}

export function useUpdateTodoLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, location }: { id: number; location: TodoLocation }) =>
      mapApi.updateTodoLocation(id, location),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mapKeys.locationTodos });
      qc.invalidateQueries({ queryKey: todoKeys.all });
      toast.success('위치를 저장했어요');
    },
  });
}


export function useTriggers() {
  const activeId = useWorkspaceStore((s) => s.activeId);
  return useQuery({
    queryKey: mapKeys.triggers,
    queryFn: mapApi.getTriggers,
    enabled: activeId != null,
  });
}

export function useSaveTriggers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (map: TriggerMap) => mapApi.saveTriggers(map),
    onSuccess: () => qc.invalidateQueries({ queryKey: mapKeys.triggers }),
  });
}
